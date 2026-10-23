import os
import sqlite3
import time
from pathlib import Path

DB_PATH = Path(os.environ.get("READING_DB", Path(__file__).with_name("reading.db")))


def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    with connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY,
              name TEXT NOT NULL UNIQUE,
              salt TEXT NOT NULL,
              password_hash TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS sessions (
              token TEXT PRIMARY KEY,
              user_id INTEGER NOT NULL,
              expires_at INTEGER NOT NULL,
              FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS books (
              id INTEGER PRIMARY KEY,
              user_id INTEGER NOT NULL,
              title TEXT NOT NULL,
              author TEXT NOT NULL,
              status TEXT NOT NULL CHECK (status IN ('want', 'reading', 'done')),
              memo TEXT NOT NULL DEFAULT '',
              FOREIGN KEY (user_id) REFERENCES users(id)
            );
            """
        )


def get_user_by_name(name):
    with connect() as conn:
        return conn.execute("SELECT * FROM users WHERE name = ?", (name,)).fetchone()


def insert_user(name, salt, password_hash):
    try:
        with connect() as conn:
            cur = conn.execute(
                "INSERT INTO users (name, salt, password_hash) VALUES (?, ?, ?)",
                (name, salt, password_hash),
            )
            return cur.lastrowid
    except sqlite3.IntegrityError:
        return None


def insert_session(token, user_id):
    expires_at = int(time.time()) + 7 * 24 * 60 * 60
    with connect() as conn:
        conn.execute(
            "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
            (token, user_id, expires_at),
        )


def delete_session(token):
    with connect() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))


def user_from_session(token):
    now = int(time.time())
    with connect() as conn:
        conn.execute("DELETE FROM sessions WHERE expires_at <= ?", (now,))
        return conn.execute(
            """
            SELECT users.id AS id, users.name AS name
            FROM sessions
            INNER JOIN users ON users.id = sessions.user_id
            WHERE sessions.token = ?
            """,
            (token,),
        ).fetchone()


def list_books(user_id):
    with connect() as conn:
        return conn.execute(
            """
            SELECT id, title, author, status, memo
            FROM books
            WHERE user_id = ?
            ORDER BY id DESC
            """,
            (user_id,),
        ).fetchall()


def insert_book(user_id, title, author, status, memo):
    with connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO books (user_id, title, author, status, memo)
            VALUES (?, ?, ?, ?, ?)
            """,
            (user_id, title, author, status, memo),
        )
        return cur.lastrowid


def get_book(user_id, book_id):
    with connect() as conn:
        return conn.execute(
            """
            SELECT id, title, author, status, memo
            FROM books
            WHERE id = ? AND user_id = ?
            """,
            (book_id, user_id),
        ).fetchone()


def update_book(user_id, book_id, title, author, status, memo):
    with connect() as conn:
        cur = conn.execute(
            """
            UPDATE books
            SET title = ?, author = ?, status = ?, memo = ?
            WHERE id = ? AND user_id = ?
            """,
            (title, author, status, memo, book_id, user_id),
        )
        return cur.rowcount == 1


def delete_book(user_id, book_id):
    with connect() as conn:
        cur = conn.execute(
            "DELETE FROM books WHERE id = ? AND user_id = ?",
            (book_id, user_id),
        )
        return cur.rowcount == 1
