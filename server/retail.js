import { randomBytes, createHash, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import {
  db,
  stmt,
  transaction,
  orderObject,
  getSetting,
  setSetting,
  productById,
} from "./db.js";
import { tenantPath, tenantId } from "./tenant.js";
import { HttpError, text } from "./validation.js";
const derive = promisify(scrypt);
const hash = (v) => createHash("sha256").update(v).digest("hex");
const cookieName = () => `shopper_${tenantId()}`;
export function ensureRetailSchema() {
  db.exec(`
 CREATE TABLE IF NOT EXISTS shoppers(id INTEGER PRIMARY KEY,email TEXT NOT NULL UNIQUE,name TEXT NOT NULL,password TEXT NOT NULL,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS shopper_sessions(hash TEXT PRIMARY KEY,customer_id INTEGER NOT NULL REFERENCES shoppers(id) ON DELETE CASCADE,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS retail_reviews(id INTEGER PRIMARY KEY,customer_id INTEGER NOT NULL REFERENCES shoppers(id),order_id INTEGER NOT NULL REFERENCES orders(id),product_id TEXT NOT NULL,rating INTEGER NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created TEXT NOT NULL,UNIQUE(order_id,product_id));
 CREATE TABLE IF NOT EXISTS retail_returns(id INTEGER PRIMARY KEY,customer_id INTEGER REFERENCES shoppers(id),order_id INTEGER NOT NULL REFERENCES orders(id),type TEXT NOT NULL,reason TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'requested',note TEXT NOT NULL DEFAULT '',created TEXT NOT NULL,updated TEXT NOT NULL);
`);
}
ensureRetailSchema();
function tokenFrom(req) {
  return (
    req.headers.cookie
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith(cookieName() + "="))
      ?.slice(cookieName().length + 1) || ""
  );
}
export function currentShopper(req) {
  return (
    stmt(
      "SELECT c.id,c.email,c.name,c.created FROM shopper_sessions s JOIN shoppers c ON c.id=s.customer_id WHERE s.hash=? AND s.expires>?",
    ).get(hash(tokenFrom(req)), Date.now()) || null
  );
}
function requireShopper(req, res, next) {
  req.shopper = currentShopper(req);
  if (!req.shopper)
    return res
      .status(401)
      .json({ error: "Please sign in to your customer account." });
  next();
}
function email(value) {
  const e = text(value, "Email", 200).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    throw new HttpError("Enter a valid email address.");
  return e;
}
function password(value) {
  if (typeof value !== "string" || value.length < 12 || value.length > 128)
    throw new HttpError("Use a password with 12–128 characters.");
  return value;
}
const cookieOptions = (req) => ({
  httpOnly: true,
  sameSite: "strict",
  secure: req.secure,
  path: tenantPath(),
  maxAge: 7 * 86400000,
});
function startSession(req, res, id) {
  stmt("DELETE FROM shopper_sessions WHERE expires<?").run(Date.now());
  const token = randomBytes(32).toString("hex");
  stmt(
    "INSERT INTO shopper_sessions(hash,customer_id,expires) VALUES(?,?,?)",
  ).run(hash(token), id, Date.now() + 7 * 86400000);
  res.cookie(cookieName(), token, cookieOptions(req));
}
function ownedOrder(req, id) {
  const row = stmt("SELECT * FROM orders WHERE id=?").get(Number(id) || 0);
  const customer = currentShopper(req);
  if (!row || !customer || JSON.parse(row.data).shopper_id !== customer.id)
    throw new HttpError("This order is not available in your account.", 403);
  return row;
}
export function registerRetail(app, admin, limit) {
  app.get("/api/retail/saved", requireShopper, (req, res) => {
    const saved = getSetting("shopper_saved_" + req.shopper.id, null);
    res.json({
      initialized: saved !== null,
      ids: (saved || []).filter(
        (id) => productById(id)?.status === "published",
      ),
    });
  });
  app.put("/api/retail/saved", requireShopper, (req, res, next) => {
    try {
      if (
        !Array.isArray(req.body.ids) ||
        req.body.ids.length > 100 ||
        req.body.ids.some((id) => typeof id !== "string" || id.length > 100)
      )
        throw new HttpError("Provide up to 100 saved products.");
      setSetting(
        "shopper_saved_" + req.shopper.id,
        [...new Set(req.body.ids)].filter(
          (id) => productById(id)?.status === "published",
        ),
      );
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });
  app.post(
    "/api/retail/claim",
    requireShopper,
    limit("shopper-claim", 10, 60000),
    (req, res, next) => {
      try {
        const row = stmt("SELECT * FROM orders WHERE token=?").get(
          text(req.body.token, "Receipt token", 100),
        );
        if (!row) throw new HttpError("Order not found.", 404);
        const data = JSON.parse(row.data);
        if (
          data.shopper_id ||
          data.customer.email?.toLowerCase() !== req.shopper.email
        )
          throw new HttpError(
            "Only an unclaimed order with your email and secure receipt token can be added.",
            403,
          );
        data.shopper_id = req.shopper.id;
        stmt("UPDATE orders SET data=? WHERE id=?").run(
          JSON.stringify(data),
          row.id,
        );
        res.json({ ok: true });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post("/api/admin/customers/:id/recovery", admin, (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!stmt("SELECT id FROM shoppers WHERE id=?").get(id))
        throw new HttpError("Customer not found.", 404);
      const token = randomBytes(32).toString("hex");
      setSetting("shopper_recovery_" + id, {
        hash: hash(token),
        expires: Date.now() + 1800000,
        customer_id: id,
      });
      res.json({
        url: tenantPath() + "/account?recover=" + token,
        expiresInMinutes: 30,
      });
    } catch (e) {
      next(e);
    }
  });
  app.post(
    "/api/retail/recover",
    limit("shopper-recover", 10, 900000),
    async (req, res, next) => {
      try {
        const token = text(req.body.token, "Recovery token", 100);
        if (!/^[a-f0-9]{64}$/.test(token))
          throw new HttpError("Recovery link is invalid or expired.", 400);
        const record = stmt(
          "SELECT key,value FROM settings WHERE key LIKE 'shopper_recovery_%' AND json_extract(value,'$.hash')=?",
        ).get(hash(token));
        if (!record || JSON.parse(record.value).expires < Date.now())
          throw new HttpError("Recovery link is invalid or expired.");
        const id = JSON.parse(record.value).customer_id,
          salt = randomBytes(24).toString("hex"),
          digest = (
            await derive(password(req.body.password), salt, 64)
          ).toString("hex");
        transaction(() => {
          const current = stmt("SELECT value FROM settings WHERE key=?").get(
            record.key,
          );
          if (
            !current ||
            JSON.parse(current.value).hash !== hash(token) ||
            JSON.parse(current.value).expires < Date.now()
          )
            throw new HttpError("Recovery link is invalid or expired.");
          stmt("UPDATE shoppers SET password=? WHERE id=?").run(
            `${salt}:${digest}`,
            id,
          );
          stmt("DELETE FROM shopper_sessions WHERE customer_id=?").run(id);
          stmt("DELETE FROM settings WHERE key=?").run(record.key);
        });
        res.json({ ok: true });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get("/api/retail/session", (req, res) =>
    res.json({ customer: currentShopper(req) }),
  );
  app.post(
    "/api/retail/register",
    limit("shopper-register", 10, 3600000),
    async (req, res, next) => {
      try {
        const e = email(req.body.email),
          p = password(req.body.password),
          name = text(req.body.name, "Name", 120);
        if (stmt("SELECT id FROM shoppers WHERE email=?").get(e))
          throw new HttpError(
            "An account could not be created with these details.",
            409,
          );
        const salt = randomBytes(24).toString("hex"),
          digest = (await derive(p, salt, 64)).toString("hex");
        const id = Number(
          stmt(
            "INSERT INTO shoppers(email,name,password,created) VALUES(?,?,?,?)",
          ).run(e, name, `${salt}:${digest}`, new Date().toISOString())
            .lastInsertRowid,
        );
        startSession(req, res, id);
        res.status(201).json({
          customer: { id, name, email: e },
        });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/retail/login",
    limit("shopper-login", 30, 900000),
    async (req, res, next) => {
      try {
        const e = email(req.body.email),
          p = password(req.body.password),
          row = stmt("SELECT * FROM shoppers WHERE email=?").get(e);
        const [salt, digest] = (
          row?.password || "invalid:" + "0".repeat(128)
        ).split(":");
        const actual = await derive(p, salt, 64);
        if (!row || !timingSafeEqual(actual, Buffer.from(digest, "hex")))
          throw new HttpError("Email or password is incorrect.", 401);
        startSession(req, res, row.id);
        res.json({
          customer: { id: row.id, name: row.name, email: row.email },
        });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post("/api/retail/logout", (req, res) => {
    stmt("DELETE FROM shopper_sessions WHERE hash=?").run(hash(tokenFrom(req)));
    res.clearCookie(cookieName(), { ...cookieOptions(req), maxAge: undefined });
    res.json({ ok: true });
  });
  app.post(
    "/api/retail/password",
    requireShopper,
    limit("shopper-password", 5, 900000),
    async (req, res, next) => {
      try {
        const row = stmt("SELECT * FROM shoppers WHERE id=?").get(
            req.shopper.id,
          ),
          [salt, digest] = row.password.split(":");
        const actual = await derive(
          password(req.body.currentPassword),
          salt,
          64,
        );
        if (!timingSafeEqual(actual, Buffer.from(digest, "hex")))
          throw new HttpError("Current password is incorrect.", 401);
        const newSalt = randomBytes(24).toString("hex"),
          newDigest = (
            await derive(password(req.body.password), newSalt, 64)
          ).toString("hex");
        transaction(() => {
          stmt("UPDATE shoppers SET password=? WHERE id=?").run(
            `${newSalt}:${newDigest}`,
            row.id,
          );
          stmt("DELETE FROM shopper_sessions WHERE customer_id=?").run(row.id);
        });
        res.clearCookie(cookieName(), {
          ...cookieOptions(req),
          maxAge: undefined,
        });
        res.json({ ok: true });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get("/api/retail/orders", requireShopper, (req, res) =>
    res.json({
      orders: stmt(
        "SELECT * FROM orders WHERE json_extract(data,'$.shopper_id')=? ORDER BY id DESC LIMIT 100",
      )
        .all(req.shopper.id)
        .map((row) => ({
          ...orderObject(row, false),
          history: stmt(
            "SELECT status,at FROM order_history WHERE order_id=? ORDER BY id",
          ).all(row.id),
          returns: stmt(
            "SELECT id,type,reason,status,note,created FROM retail_returns WHERE order_id=?",
          ).all(row.id),
        })),
    }),
  );
  app.post(
    "/api/retail/track",
    limit("shopper-track", 30, 60000),
    (req, res, next) => {
      try {
        const token = text(req.body.token || "", "Receipt token", 100);
        if (!/^[a-f0-9]{64}$/.test(token))
          throw new HttpError(
            "Order not found. Use the receipt link from your order confirmation.",
            404,
          );
        const row = stmt("SELECT * FROM orders WHERE token=?").get(token);
        if (!row) throw new HttpError("Order not found.", 404);
        res.json({
          ...orderObject(row, false),
          history: stmt(
            "SELECT status,at FROM order_history WHERE order_id=? ORDER BY id",
          ).all(row.id),
        });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get("/api/retail/reviews/:id", (req, res) =>
    res.json({
      reviews: stmt(
        "SELECT r.id,r.rating,r.body,r.created,c.name FROM retail_reviews r JOIN shoppers c ON c.id=r.customer_id WHERE r.product_id=? AND r.status='approved' ORDER BY r.id DESC LIMIT 100",
      ).all(req.params.id),
    }),
  );
  app.post(
    "/api/retail/reviews",
    requireShopper,
    limit("shopper-reviews", 20, 3600000),
    (req, res, next) => {
      try {
        const row = ownedOrder(req, req.body.orderId),
          order = orderObject(row);
        if (
          row.status !== "delivered" ||
          !order.items.some((x) => x.product_id === req.body.productId)
        )
          throw new HttpError(
            "Reviews are available after delivery for products you purchased.",
            403,
          );
        if (
          !Number.isInteger(req.body.rating) ||
          req.body.rating < 1 ||
          req.body.rating > 5
        )
          throw new HttpError("Choose a rating from 1 to 5.");
        if (
          stmt(
            "SELECT id FROM retail_reviews WHERE order_id=? AND product_id=?",
          ).get(row.id, req.body.productId)
        )
          throw new HttpError("You already reviewed this product.", 409);
        stmt(
          "INSERT INTO retail_reviews(customer_id,order_id,product_id,rating,body,created) VALUES(?,?,?,?,?,?)",
        ).run(
          req.shopper.id,
          row.id,
          req.body.productId,
          req.body.rating,
          text(req.body.body, "Review", 2000),
          new Date().toISOString(),
        );
        res.status(201).json({ status: "pending" });
      } catch (e) {
        next(e);
      }
    },
  );
  app.post(
    "/api/retail/returns",
    requireShopper,
    limit("shopper-returns", 20, 3600000),
    (req, res, next) => {
      try {
        const row = ownedOrder(req, req.body.orderId);
        if (row.status !== "delivered")
          throw new HttpError(
            "Return and exchange requests are available after delivery.",
            409,
          );
        if (!["return", "exchange"].includes(req.body.type))
          throw new HttpError("Choose return or exchange.");
        if (
          stmt(
            "SELECT id FROM retail_returns WHERE order_id=? AND status IN ('requested','approved','received')",
          ).get(row.id)
        )
          throw new HttpError("This order already has an open request.", 409);
        const now = new Date().toISOString();
        stmt(
          "INSERT INTO retail_returns(customer_id,order_id,type,reason,created,updated) VALUES(?,?,?,?,?,?)",
        ).run(
          req.shopper.id,
          row.id,
          req.body.type,
          text(req.body.reason, "Reason", 2000),
          now,
          now,
        );
        res.status(201).json({ status: "requested" });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get("/api/admin/customers", admin, (_req, res) =>
    res.json({
      customers: stmt(
        "SELECT c.id,c.name,c.email,c.created,(SELECT count(*) FROM orders WHERE json_extract(data,'$.shopper_id')=c.id) orders FROM shoppers c ORDER BY c.id DESC LIMIT 500",
      ).all(),
    }),
  );
  app.get("/api/admin/reviews", admin, (_req, res) =>
    res.json({
      reviews: stmt(
        "SELECT r.*,c.name FROM retail_reviews r JOIN shoppers c ON c.id=r.customer_id ORDER BY r.id DESC LIMIT 500",
      ).all(),
    }),
  );
  app.patch("/api/admin/reviews/:id", admin, (req, res, next) => {
    try {
      if (!["approved", "rejected", "pending"].includes(req.body.status))
        throw new HttpError("Invalid review status.");
      const r = stmt("UPDATE retail_reviews SET status=? WHERE id=?").run(
        req.body.status,
        req.params.id,
      );
      if (!r.changes) throw new HttpError("Review not found.", 404);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/admin/returns", admin, (_req, res) =>
    res.json({
      returns: stmt(
        "SELECT r.*,o.number,c.name FROM retail_returns r JOIN orders o ON o.id=r.order_id LEFT JOIN shoppers c ON c.id=r.customer_id ORDER BY r.id DESC LIMIT 500",
      ).all(),
    }),
  );
  app.patch("/api/admin/returns/:id", admin, (req, res, next) => {
    try {
      if (
        !["requested", "approved", "rejected", "received", "closed"].includes(
          req.body.status,
        )
      )
        throw new HttpError("Invalid return status.");
      const r = stmt(
        "UPDATE retail_returns SET status=?,note=?,updated=? WHERE id=?",
      ).run(
        req.body.status,
        text(req.body.note || "", "Note", 2000, false),
        new Date().toISOString(),
        req.params.id,
      );
      if (!r.changes) throw new HttpError("Request not found.", 404);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });
}
