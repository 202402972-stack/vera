import { randomUUID } from "node:crypto";
import { db, stmt, transaction, getSetting, setSetting } from "./db.js";
import { registerTenantIdentifiers, tenantId } from "./tenant.js";
import { currentShopper } from "./retail.js";
import { HttpError, text, imageUrl, safeLink } from "./validation.js";
import { galaDefaults, galaDemoTestimonials } from "../src/data/gala.js";
import multer from "multer";
import sharp from "sharp";
registerTenantIdentifiers(["gala_messages", "gala_media"]);
export function ensureGalaSchema() {
  db.exec(`CREATE TABLE IF NOT EXISTS gala_messages(id INTEGER PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'new',created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS gala_media(id TEXT PRIMARY KEY,shopper_id INTEGER NOT NULL,image BLOB NOT NULL,created INTEGER NOT NULL);`);
}
ensureGalaSchema();
export function validateGala(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new HttpError("Invalid GALA settings.");
  const output = structuredClone(galaDefaults);
  for (const key of Object.keys(input)) {
    if (!Object.hasOwn(output, key))
      throw new HttpError("Unknown GALA setting: " + key);
    output[key] = input[key];
  }
  function check(value, key = "", depth = 0) {
    if (depth > 9) throw new HttpError("Settings are too deeply nested.");
    if (typeof value === "string") {
      text(value, key || "Text", 4000, false);
      if (/^(path|primaryLink|secondaryLink)$/.test(key)) safeLink(value);
      if (/^(storyImage|image)$/.test(key) && value) imageUrl(value);
      return;
    }
    if (typeof value === "number") {
      if (!Number.isFinite(value) || value < 0 || value > 100000)
        throw new HttpError("Invalid number.");
      return;
    }
    if (typeof value === "boolean") return;
    if (Array.isArray(value)) {
      if (value.length > 100) throw new HttpError("Maximum 100 entries.");
      value.forEach((x) => check(x, key, depth + 1));
      return;
    }
    if (!value || typeof value !== "object")
      throw new HttpError("Invalid setting: " + key);
    for (const [k, v] of Object.entries(value)) {
      if (["__proto__", "constructor", "prototype"].includes(k))
        throw new HttpError("Invalid field.");
      check(v, k, depth + 1);
    }
  }
  function shape(value, sample, path = "gala") {
    if (Array.isArray(sample)) {
      if (!Array.isArray(value)) throw new HttpError("Invalid " + path + ".");
      const key = path.split(".").at(-1);
      const item =
        sample[0] ?? (key === "testimonials" ? galaDemoTestimonials[0] : "");
      value.forEach((v) => shape(v, item, path + ".item"));
      return;
    }
    if (sample && typeof sample === "object") {
      if (!value || typeof value !== "object" || Array.isArray(value))
        throw new HttpError("Invalid " + path + ".");
      if (Object.keys(value).some((k) => !Object.hasOwn(sample, k)))
        throw new HttpError("Unknown field in " + path + ".");
      for (const [k, v] of Object.entries(sample))
        shape(value[k], v, path + "." + k);
      return;
    }
    if (typeof value !== typeof sample)
      throw new HttpError("Invalid " + path + ".");
  }
  shape(output, galaDefaults);
  check(output);
  for (const key of Object.keys(galaDefaults.palette))
    if (!/^#[a-f0-9]{6}$/i.test(output.palette[key]))
      throw new HttpError("Use six-digit theme colours.");
  if (
    !["Albert", "System"].includes(output.typography.body) ||
    !["Reference", "Serif", "Sans"].includes(output.typography.heading) ||
    output.typography.bodySize < 12 ||
    output.typography.bodySize > 22 ||
    output.typography.headingScale < 0.7 ||
    output.typography.headingScale > 1.4
  )
    throw new HttpError("Invalid typography.");
  if (
    output.layout.width < 960 ||
    output.layout.width > 1800 ||
    output.layout.sectionSpacing < 16 ||
    output.layout.sectionSpacing > 120 ||
    !["portrait", "square", "landscape"].includes(output.layout.cardRatio)
  )
    throw new HttpError("Invalid layout.");
  if (output.hero.images.length !== 3 || output.hero.positions.length !== 3)
    throw new HttpError("The collage requires three images.");
  output.hero.images.forEach(imageUrl);
  output.hero.positions.forEach((x) => {
    if (x < 0 || x > 100) throw new HttpError("Image position must be 0–100.");
  });
  const ids = galaDefaults.sections.map((x) => x.id);
  if (
    output.sections.length !== ids.length ||
    new Set(output.sections.map((x) => x.id)).size !== ids.length ||
    output.sections.some(
      (x) => !ids.includes(x.id) || typeof x.enabled !== "boolean",
    )
  )
    throw new HttpError("Invalid homepage sections.");
  for (const key of ["trendingIds", "lookbookIds", "collectionIds"])
    if (
      output[key].some((x) => typeof x !== "string" || !/^[a-z0-9-]+$/.test(x))
    )
      throw new HttpError("Invalid selection.");
  if (
    output.testimonials.some(
      (x) => !Number.isInteger(x.rating) || x.rating < 1 || x.rating > 5,
    )
  )
    throw new HttpError("Rating must be 1–5.");
  for (const x of output.currency.codes)
    if (
      !/^[A-Z]{3}$/.test(x) ||
      !Intl.supportedValuesOf("currency").includes(x)
    )
      throw new HttpError("Invalid display currency.");
  return output;
}
const fxCache = new Map();
export function registerGala(app, admin, limit) {
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
  app.get("/api/currency-rates", async (_req, res) => {
    const base = getSetting("store").checkout.currency;
    let cached = fxCache.get(base);
    if (cached && Date.now() - cached.at < 86400000)
      return res.json(cached.data);
    try {
      const r = await fetch("https://open.er-api.com/v6/latest/" + base, {
        signal: AbortSignal.timeout(8000),
      });
      const data = await r.json();
      if (
        !r.ok ||
        data.result !== "success" ||
        data.base_code !== base ||
        !data.rates ||
        Date.now() - data.time_last_update_unix * 1000 > 3 * 86400000
      )
        throw new Error();
      const result = {
        base,
        rates: data.rates,
        updatedAt: data.time_last_update_unix * 1000,
      };
      fxCache.set(base, { at: Date.now(), data: result });
      res.json(result);
    } catch {
      res.json({ base, rates: { [base]: 1 }, unavailable: true });
    }
  });
  app.get("/api/admin/review-image/:id", admin, (req, res) => {
    const media = stmt("SELECT image FROM gala_media WHERE id=?").get(
      req.params.id,
    );
    if (!media) return res.sendStatus(404);
    res
      .set("Cache-Control", "private,no-store")
      .type("webp")
      .send(Buffer.from(media.image));
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
  });
  app.post(
    "/api/retail/review-image",
    limit("review-image", 12, 3600000),
    (req, res, next) => {
      req.shopper = currentShopper(req);
      if (!req.shopper)
        return res.status(401).json({ error: "Sign in first." });
      next();
    },
    upload.single("image"),
    async (req, res, next) => {
      try {
        if (!req.file) throw new HttpError("Choose an image.");
        const processor = sharp(req.file.buffer, {
          limitInputPixels: 20000000,
        });
        const meta = await processor.metadata().catch(() => {
          throw new HttpError("The selected file is not a valid image.");
        });
        if (!["jpeg", "png", "webp", "avif"].includes(meta.format))
          throw new HttpError("Choose a JPG, PNG or WebP.");
        const bytes = await processor
          .rotate()
          .resize({
            width: 1200,
            height: 1200,
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 82 })
          .toBuffer();
        const id = randomUUID();
        stmt(
          "INSERT INTO gala_media(id,shopper_id,image,created) VALUES(?,?,?,?)",
        ).run(id, req.shopper.id, bytes, Date.now());
        res.status(201).json({ id });
      } catch (e) {
        next(e);
      }
    },
  );
  app.get("/api/retail/review-image/:id", (req, res) => {
    const media = stmt("SELECT * FROM gala_media WHERE id=?").get(
      req.params.id,
    );
    if (!media) return res.sendStatus(404);
    const approved = stmt(
      "SELECT id FROM retail_reviews WHERE status='approved' AND EXISTS(SELECT 1 FROM json_each(metadata,'$.images') WHERE value=?)",
    ).get(req.params.id);
    if (!approved && currentShopper(req)?.id !== media.shopper_id)
      return res.sendStatus(404);
    res
      .set(
        "Cache-Control",
        approved ? "public,max-age=300" : "private,no-store",
      )
      .type("webp")
      .send(Buffer.from(media.image));
  });
}
