import { stmt } from "./db.js";
import { text, HttpError } from "./validation.js";
export function registerCommunity(app, admin, limit) {
  app.post(
    "/api/newsletter",
    limit("newsletter", 10, 3600000),
    (req, res, next) => {
      try {
        const email = text(req.body.email, "Email", 200).toLowerCase();
        if (
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
          req.body.consent !== true
        )
          throw new HttpError(
            "Enter a valid email and agree to receive updates.",
          );
        stmt(
          "INSERT OR IGNORE INTO subscribers(email,created_at) VALUES(?,?)",
        ).run(email, new Date().toISOString());
        res.json({ ok: true });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get("/api/admin/newsletter", admin, (_req, res) =>
    res.json({
      subscribers: stmt(
        "SELECT * FROM subscribers ORDER BY created_at DESC LIMIT 1000",
      ).all(),
    }),
  );
  app.delete("/api/admin/newsletter", admin, (req, res) => {
    stmt("DELETE FROM subscribers WHERE email=?").run(
      String(req.body.email || ""),
    );
    res.json({ ok: true });
  });
  app.post("/api/contact", limit("contact", 6, 3600000), (req, res, next) => {
    try {
      const name = text(req.body.name, "Name", 120),
        email = text(req.body.email, "Email", 200),
        body = text(req.body.body, "Message", 4000);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        throw new HttpError("Enter a valid email.");
      stmt(
        "INSERT INTO gala_messages(name,email,body,created) VALUES(?,?,?,?)",
      ).run(name, email, body, new Date().toISOString());
      res.status(201).json({ ok: true });
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/admin/messages", admin, (_req, res) =>
    res.json({
      messages: stmt(
        "SELECT * FROM gala_messages ORDER BY id DESC LIMIT 500",
      ).all(),
    }),
  );
  app.patch("/api/admin/messages/:id", admin, (req, res) => {
    if (!["new", "resolved"].includes(req.body.status))
      return res.status(400).json({ error: "Invalid status." });
    stmt("UPDATE gala_messages SET status=? WHERE id=?").run(
      req.body.status,
      req.params.id,
    );
    res.json({ ok: true });
  });
}
