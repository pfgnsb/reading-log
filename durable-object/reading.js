import { DurableObject } from "cloudflare:workers";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

var ITERATIONS = 100000;
var SESSION_MS = 7 * 24 * 60 * 60 * 1000;
var STATUSES = { want: true, reading: true, done: true };

export class Reading extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.env = env;
    this.ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS users (" +
        "id INTEGER PRIMARY KEY, " +
        "name TEXT NOT NULL UNIQUE, " +
        "salt TEXT NOT NULL, " +
        "password_hash TEXT NOT NULL" +
      ")"
    );
    this.ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS sessions (" +
        "token TEXT PRIMARY KEY, " +
        "user_id INTEGER NOT NULL, " +
        "expires_at INTEGER NOT NULL, " +
        "FOREIGN KEY (user_id) REFERENCES users(id)" +
      ")"
    );
    this.ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS books (" +
        "id INTEGER PRIMARY KEY, " +
        "user_id INTEGER NOT NULL, " +
        "title TEXT NOT NULL, " +
        "author TEXT NOT NULL, " +
        "status TEXT NOT NULL CHECK (status IN ('want', 'reading', 'done')), " +
        "memo TEXT NOT NULL DEFAULT '', " +
        "FOREIGN KEY (user_id) REFERENCES users(id)" +
      ")"
    );
    this.app = new Hono();
    this.routes();
  }

  routes() {
    var self = this;
    var app = this.app;

    app.post("/api/register", function (c) {
      return self.register(c);
    });
    app.post("/api/login", function (c) {
      return self.login(c);
    });
    app.post("/api/logout", function (c) {
      return self.logout(c);
    });
    app.get("/api/me", function (c) {
      return self.me(c);
    });
    app.get("/api/books", function (c) {
      return self.listBooks(c);
    });
    app.post("/api/books", function (c) {
      return self.addBook(c);
    });
    app.put("/api/books/:id", function (c) {
      return self.updateBook(c);
    });
    app.delete("/api/books/:id", function (c) {
      return self.deleteBook(c);
    });
    app.all("/api/register", methodNotAllowed);
    app.all("/api/login", methodNotAllowed);
    app.all("/api/logout", methodNotAllowed);
    app.all("/api/me", methodNotAllowed);
    app.all("/api/books", methodNotAllowed);
    app.all("/api/books/:id", methodNotAllowed);
    app.all("/api/*", function (c) {
      return c.json({ error: "not_found" }, 404);
    });
  }

  fetch(request) {
    return this.app.fetch(request);
  }

  async register(c) {
    var parsed = await readAccount(c);
    if (!parsed) return c.json({ error: "invalid" }, 400);
    var existing = this.sql("SELECT id FROM users WHERE name = ?", parsed.name).toArray();
    if (existing.length) return c.json({ error: "taken" }, 409);
    var salt = randomHex(16);
    var hash = await hashPassword(parsed.password, salt);
    var token = randomHex(32);
    var expires = Math.floor(Date.now() / 1000) + Math.floor(SESSION_MS / 1000);
    var self = this;
    var name;
    this.ctx.storage.transactionSync(function () {
      self.sql(
        "INSERT INTO users (name, salt, password_hash) VALUES (?, ?, ?)",
        parsed.name,
        salt,
        hash
      );
      var user = self.sql("SELECT id, name FROM users WHERE name = ?", parsed.name).one();
      self.sql(
        "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
        token,
        user.id,
        expires
      );
      name = user.name;
    });
    setCookie(c, "session", token, {
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      maxAge: Math.floor(SESSION_MS / 1000)
    });
    return c.json({ name: name }, 201);
  }

  async login(c) {
    var parsed = await readAccount(c);
    if (!parsed) return c.json({ error: "invalid" }, 400);
    var rows = this.sql("SELECT id, name, password_hash, salt FROM users WHERE name = ?", parsed.name).toArray();
    if (!rows.length) return c.json({ error: "unauthorized" }, 401);
    var user = rows[0];
    var hash = await hashPassword(parsed.password, user.salt);
    if (!safeEqual(hash, user.password_hash)) return c.json({ error: "unauthorized" }, 401);
    await this.startSession(c, user.id);
    return c.json({ name: user.name });
  }

  logout(c) {
    var token = getCookie(c, "session");
    if (token) this.sql("DELETE FROM sessions WHERE token = ?", token);
    deleteCookie(c, "session", { path: "/" });
    return c.body(null, 204);
  }

  me(c) {
    var user = this.currentUser(c);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    return c.json({ name: user.name });
  }

  listBooks(c) {
    var user = this.currentUser(c);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    var rows = this.sql(
      "SELECT id, title, author, status, memo FROM books WHERE user_id = ? ORDER BY id DESC",
      user.id
    ).toArray();
    return c.json(rows);
  }

  async addBook(c) {
    var user = this.currentUser(c);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    var book = await readBook(c);
    if (!book) return c.json({ error: "invalid" }, 400);
    this.sql(
      "INSERT INTO books (user_id, title, author, status, memo) VALUES (?, ?, ?, ?, ?)",
      user.id,
      book.title,
      book.author,
      book.status,
      book.memo
    );
    var row = this.sql(
      "SELECT id, title, author, status, memo FROM books WHERE user_id = ? ORDER BY id DESC LIMIT 1",
      user.id
    ).one();
    return c.json(row, 201);
  }

  async updateBook(c) {
    var user = this.currentUser(c);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    var id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "not_found" }, 404);
    var book = await readBook(c);
    if (!book) return c.json({ error: "invalid" }, 400);
    var found = this.sql("SELECT id FROM books WHERE id = ? AND user_id = ?", id, user.id).toArray();
    if (!found.length) return c.json({ error: "not_found" }, 404);
    this.sql(
      "UPDATE books SET title = ?, author = ?, status = ?, memo = ? WHERE id = ? AND user_id = ?",
      book.title,
      book.author,
      book.status,
      book.memo,
      id,
      user.id
    );
    var row = this.sql(
      "SELECT id, title, author, status, memo FROM books WHERE id = ? AND user_id = ?",
      id,
      user.id
    ).one();
    return c.json(row);
  }

  deleteBook(c) {
    var user = this.currentUser(c);
    if (!user) return c.json({ error: "unauthorized" }, 401);
    var id = Number(c.req.param("id"));
    if (!Number.isInteger(id)) return c.json({ error: "not_found" }, 404);
    var found = this.sql("SELECT id FROM books WHERE id = ? AND user_id = ?", id, user.id).toArray();
    if (!found.length) return c.json({ error: "not_found" }, 404);
    this.sql("DELETE FROM books WHERE id = ? AND user_id = ?", id, user.id);
    return c.body(null, 204);
  }

  async startSession(c, userId) {
    var token = randomHex(32);
    var expires = Math.floor(Date.now() / 1000) + Math.floor(SESSION_MS / 1000);
    this.sql("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)", token, userId, expires);
    setCookie(c, "session", token, {
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      maxAge: Math.floor(SESSION_MS / 1000)
    });
  }

  currentUser(c) {
    var token = getCookie(c, "session");
    if (!token) return null;
    this.sql("DELETE FROM sessions WHERE expires_at <= ?", Math.floor(Date.now() / 1000));
    var rows = this.sql(
      "SELECT users.id AS id, users.name AS name FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token = ?",
      token
    ).toArray();
    return rows.length ? rows[0] : null;
  }

  sql(query, ...binds) {
    return this.ctx.storage.sql.exec(query, ...binds);
  }
}

function methodNotAllowed(c) {
  return c.json({ error: "method" }, 405);
}

async function readAccount(c) {
  var body = await c.req.json().catch(function () {
    return null;
  });
  if (!body || typeof body !== "object") return null;
  if (!validName(body.name) || !validPassword(body.password)) return null;
  return { name: body.name, password: body.password };
}

async function readBook(c) {
  var body = await c.req.json().catch(function () {
    return null;
  });
  if (!body || typeof body !== "object") return null;
  if (typeof body.title !== "string" || typeof body.author !== "string" || typeof body.status !== "string") {
    return null;
  }
  if (body.memo !== undefined && typeof body.memo !== "string") return null;
  var title = body.title.trim();
  var author = body.author.trim();
  var memo = body.memo === undefined ? "" : body.memo.trim();
  if (!title || title.length > 80 || !author || author.length > 80) return null;
  if (memo.length > 400 || !STATUSES[body.status]) return null;
  return { title: title, author: author, status: body.status, memo: memo };
}

function validName(name) {
  if (typeof name !== "string" || name.length < 1 || name.length > 32) return false;
  var i;
  for (i = 0; i < name.length; i++) {
    if (/\s/u.test(name.charAt(i))) return false;
    if (name.charCodeAt(i) < 32 || name.charCodeAt(i) === 127) return false;
  }
  return true;
}

function validPassword(password) {
  return typeof password === "string" && password.length >= 8 && password.length <= 64;
}

function randomHex(bytes) {
  var list = new Uint8Array(bytes);
  crypto.getRandomValues(list);
  return [...list].map(function (value) {
    return value.toString(16).padStart(2, "0");
  }).join("");
}

async function hashPassword(password, saltHex) {
  var key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  var bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: hexToBytes(saltHex), iterations: ITERATIONS },
    key,
    256
  );
  return [...new Uint8Array(bits)].map(function (value) {
    return value.toString(16).padStart(2, "0");
  }).join("");
}

function hexToBytes(hex) {
  var bytes = new Uint8Array(hex.length / 2);
  var i;
  for (i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  return bytes;
}

function safeEqual(left, right) {
  if (left.length !== right.length) return false;
  var diff = 0;
  var i;
  for (i = 0; i < left.length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}
