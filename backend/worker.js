import { Hono } from "hono";
import { Reading } from "../durable-object/reading.js";

export { Reading };

var app = new Hono();

app.get("/api/health", function (c) {
  return c.json({ status: "ok" });
});
app.all("/api/health", function (c) {
  return c.json({ error: "method" }, 405);
});

app.all("/api/*", function (c) {
  var id = c.env.READING.idFromName("reading-log");
  var stub = c.env.READING.get(id);
  return stub.fetch(c.req.raw);
});

export default app;
