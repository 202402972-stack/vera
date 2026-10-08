import {migrateAtelierImages} from './atelier-images.js';
import { registerGala, validateGala } from './gala.js';
import { registerCollections } from "./collections.js";
import { registerRetail, currentShopper } from "./retail.js";
import {
  registerShopperPayments,
  paymentsReady,
  beginShopperPayment,
} from "./shopper-payments.js";
import { tenantId, tenantPath, adminCookie } from "./tenant.js";
import { resolveBrand, defaultCommerce } from "../src/data/brand.js";
import { priceCart, quoteTotals, validateDiscount } from "./commerce.js";
import { exportData } from "./exports.js";
import express from "express";
import compression from "compression";
import helmet from "helmet";
import multer from "multer";
import sharp from "sharp";
import {
  randomBytes,
  randomUUID,
  createHash,
  timingSafeEqual,
  scryptSync,
  scrypt,
} from "node:crypto";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  db,
  dataDir,
  getSetting,
  setSetting,
  productsAll,
  transaction,
  orderObject,
  encrypt,
  stmt,
  productById,
  productForVariant,
  writeProduct,
  indexProductVariants,
} from "./db.js";
import {
  HttpError,
  text,
  validateProduct,
  validateSettings,
  validateCustomer,
} from "./validation.js";
import {
  telegramConfig,
  telegramApi,
  deliverPending,
  stopDelivery,
} from "./telegram.js";
import { localizeSettings, localizeProduct } from "../src/i18n/content.js";
import {
  recordAnalytics,
  analyticsReport,
  trackedVisit,
  invalidateAnalytics,
  visitTimeline,
} from "./analytics.js";

export const app = express();
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use("/api/admin", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'self'"],
        upgradeInsecureRequests:
          process.env.NODE_ENV === "production" ? [] : null,
      },
    },
  }),
);
app.use(compression());
app.use(express.json({ limit: "2mb" }));
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store");
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.headers.origin;
    const expected = `${req.protocol}://${req.get("host")}`;
    if (origin && origin !== expected)
      return res
        .status(403)
        .json({ error: "Cross-site requests are not allowed." });
    if (req.headers["sec-fetch-site"] === "cross-site")
      return res
        .status(403)
        .json({ error: "Cross-site requests are not allowed." });
  }
  if (
    req.body === null ||
    (["POST", "PUT", "PATCH"].includes(req.method) &&
      req.is("application/json") &&
      (Array.isArray(req.body) || typeof req.body !== "object"))
  )
    return res.status(400).json({ error: "Invalid request body." });
  next();
});
const buckets = new Map();
function limit(scope, max, windowMs) {
  return (req, res, next) => {
    const key = `${scope}:${req.ip}`,
      now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || bucket.until < now)
      bucket = { count: 0, until: now + windowMs };
    bucket.count++;
    buckets.set(key, bucket);
    if (bucket.count > max) {
      res.set("Retry-After", String(Math.ceil((bucket.until - now) / 1000)));
      return res
        .status(429)
        .json({ error: "Too many requests. Please try again shortly." });
    }
    next();
  };
}
const sessionHash = (token) => createHash("sha256").update(token).digest("hex");
const cookieToken = (req) =>
  req.headers.cookie
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(adminCookie() + "="))
    ?.slice(adminCookie().length + 1) || "";
let savedPasswordSalt = getSetting("password_salt");
if (!savedPasswordSalt) {
  savedPasswordSalt = randomBytes(32).toString("hex");
  setSetting("password_salt", savedPasswordSalt);
}
const passwordSalt = Buffer.from(savedPasswordSalt, "hex");
if (
  process.env.NODE_ENV === "production" &&
  !process.env.PLATFORM_MODE &&
  (!process.env.ADMIN_PASSWORD ||
    process.env.ADMIN_PASSWORD === "admin@admin" ||
    process.env.ADMIN_PASSWORD.length < 12)
) {
  throw new Error(
    "Set ADMIN_PASSWORD to a private password of at least 12 characters before starting production.",
  );
}
const configuredPassword = process.env.ADMIN_PASSWORD || "admin@admin";
const passwordHash = scryptSync(configuredPassword, passwordSalt, 64);
if (getSetting("password_fingerprint") !== passwordHash.toString("hex")) {
  stmt("DELETE FROM admin_sessions").run();
  setSetting("password_fingerprint", passwordHash.toString("hex"));
}
function admin(req, res, next) {
  const token = cookieToken(req);
  const session = stmt(
    "SELECT expires_at FROM admin_sessions WHERE token_hash=?",
  ).get(sessionHash(token));
  if (!session || session.expires_at < Date.now())
    return res.status(401).json({ error: "Please sign in to the dashboard." });
  next();
}
registerCollections(app, admin);
registerRetail(app, admin, limit);
registerShopperPayments(app, admin, limit);
registerGala(app, admin, limit);
const publicSettings = () => {
  const store = getSetting("store");
  return {
    ...store,
    ...(tenantId() ? { _template: getSetting("template") } : {}),
    brand: resolveBrand(store.brand),
    commerce: { ...defaultCommerce, ...store.commerce },
  };
};

const priced = (p) => ({
  ...p,
  price_in_cents: p.variants[0].price_in_cents,
  currency: p.variants[0].currency,
});
app.get("/api/health", (_req, res) => {
  stmt("SELECT 1").get();
  res.json({ ok: true });
});
app.get("/api/store", (_req, res) => res.json(publicSettings()));
app.get("/api/admin/bootstrap", (_req, res) => res.json(publicSettings()));
app.get("/api/products", (req, res, next) => {
  try {
    if (req.query.ids !== undefined) {
      const ids = String(req.query.ids).split(",");
      if (ids.length > 100 || ids.some((id) => !id || id.length > 100))
        throw new HttpError("Invalid product IDs.");
      const products = [...new Set(ids)]
        .map(productById)
        .filter((p) => p?.status === "published")
        .map(priced);
      return res.json({ products, total: products.length, hasMore: false });
    }
    const size = Math.min(100, Math.max(1, parseInt(req.query.limit) || 24)),
      offset = Math.min(10000000, Math.max(0, parseInt(req.query.offset) || 0));
    const search = String(req.query.search || "")
      .trim()
      .slice(0, 100);
    const category = String(req.query.category || "")
      .trim()
      .slice(0, 60);
    const conditions = ["json_extract(data,'$.status')='published'"],
      params = [];
    if (search) {
      conditions.push(
        "(instr(lower(json_extract(data,'$.title')),lower(?))>0 OR instr(lower(COALESCE(json_extract(data,'$.translations.ar.title'),'')),lower(?))>0 OR instr(lower(COALESCE(json_extract(data,'$.subtitle'),'')),lower(?))>0)",
      );
      params.push(search, search, search);
    }
    if (category) {
      conditions.push("json_extract(data,'$.category')=?");
      params.push(category);
    }
    if (req.query.collection) {
      const collection = getSetting("collections", []).find(
        (c) => c.id === req.query.collection && c.published,
      );
      if (!collection) throw new HttpError("Collection not found.", 404);
      if (collection.productIds.length) {
        conditions.push(
          `id IN (${collection.productIds.map(() => "?").join(",")})`,
        );
        params.push(...collection.productIds);
      } else conditions.push("0");
    }
    const price =
      "(SELECT MIN(COALESCE(json_extract(v.value,'$.sale_price_in_cents'),json_extract(v.value,'$.price_in_cents'))) FROM json_each(products.data,'$.variants') v)";
    const variantRules = [],
      variantParams = [];
    for (const [queryKey, attribute] of [
      ["colors", "color"],
      ["sizes", "size"],
      ["materials", "material"],
    ])
      if (req.query[queryKey]) {
        const values = String(req.query[queryKey]).split("|");
        if (values.length > 20 || values.some((v) => !v || v.length > 60))
          throw new HttpError("Invalid product filters.");
        variantRules.push(
          `json_extract(v.value,'$.attributes.${attribute}') IN (${values.map(() => "?").join(",")})`,
        );
        variantParams.push(...values);
      }
    for (const [key, comparison] of [
      ["min_price", ">="],
      ["max_price", "<="],
    ])
      if (req.query[key]) {
        const priceValue = Number(req.query[key]);
        if (
          !Number.isFinite(priceValue) ||
          priceValue < 0 ||
          priceValue > 1000000
        )
          throw new HttpError("Invalid price filter.");
        variantRules.push(
          `COALESCE(json_extract(v.value,'$.sale_price_in_cents'),json_extract(v.value,'$.price_in_cents')) ${comparison} ?`,
        );
        variantParams.push(Math.round(priceValue * 100));
      }
    if (req.query.in_stock === "1")
      variantRules.push(
        "(json_extract(v.value,'$.manage_inventory')=0 OR json_extract(v.value,'$.inventory_quantity')>0)",
      );
    if(req.query.in_stock === "0") conditions.push("NOT EXISTS(SELECT 1 FROM json_each(products.data,'$.variants') v WHERE json_extract(v.value,'$.manage_inventory')=0 OR json_extract(v.value,'$.inventory_quantity')>0)");
    if(req.query.rating){const rating=Number(req.query.rating);if(!Number.isInteger(rating)||rating<1||rating>5)throw new HttpError("Invalid rating filter.");conditions.push("(SELECT AVG(r.rating) FROM retail_reviews r WHERE r.product_id=products.id AND r.status='approved')>=?");params.push(rating);}
    if (variantRules.length) {
      conditions.push(
        `EXISTS(SELECT 1 FROM json_each(products.data,'$.variants') v WHERE ${variantRules.join(" AND ")})`,
      );
      params.push(...variantParams);
    }
    const sorts = {
      "price-asc": `${price} ASC,position,id`,
      "price-desc": `${price} DESC,position,id`,
      newest: "products.rowid DESC",
      featured: "position,id",
      "name-asc": "json_extract(data,'$.title') COLLATE NOCASE ASC,id",
      "name-desc": "json_extract(data,'$.title') COLLATE NOCASE DESC,id",
    };
    const order = Object.hasOwn(sorts, req.query.sort)
      ? sorts[req.query.sort]
      : sorts.featured;
    const where = conditions.join(" AND ");
    const total = stmt(
      `SELECT COUNT(*) count FROM products INDEXED BY products_status_position WHERE ${where}`,
    ).get(...params).count;
    const products = stmt(
      `SELECT data,version FROM products INDEXED BY products_status_position WHERE ${where} ORDER BY ${order} LIMIT ? OFFSET ?`,
    )
      .all(...params, size, offset)
      .map((row) => priced({ ...JSON.parse(row.data), _version: row.version }));
    res.json({
      products,
      total,
      offset,
      hasMore: offset + products.length < total,
    });
  } catch (error) {
    next(error);
  }
});
app.get("/api/categories", (_req, res) =>
  res.json({
    categories: stmt(
      "SELECT DISTINCT json_extract(data,'$.category') category FROM products WHERE json_extract(data,'$.status')='published' AND COALESCE(json_extract(data,'$.category'),'')<>'' ORDER BY category",
    )
      .all()
      .map((r) => r.category),
  }),
);
app.get("/api/facets", (req, res) => {
  const collection=req.query.collection ? getSetting('collections',[]).find(c=>c.id===req.query.collection&&c.published!==false) : null;
  const products = productsAll().filter((p) => p.status === "published" && (!req.query.collection || collection?.productIds.includes(p.id)));
  res.json({
    maxPriceInCents:products.reduce((max,p)=>Math.max(max,...p.variants.map(v=>v.sale_price_in_cents??v.price_in_cents)),0),
    colors: [
      ...new Set(
        products.flatMap((p) =>
          p.variants.map((v) => v.attributes?.color).filter(Boolean),
        ),
      ),
    ].sort(),
    sizes: [
      ...new Set(
        products.flatMap((p) =>
          p.variants.map((v) => v.attributes?.size).filter(Boolean),
        ),
      ),
    ].sort(),
    materials: [
      ...new Set(
        products.flatMap((p) =>
          p.variants.map((v) => v.attributes?.material).filter(Boolean),
        ),
      ),
    ].sort(),
    categoryLabels: Object.fromEntries(
      products
        .filter((p) => p.category && p.translations?.ar?.category)
        .map((p) => [p.category, p.translations.ar.category]),
    ),
  });
});
app.get("/api/products/:id", (req, res, next) => {
  const p = productById(req.params.id);
  if (!p || p.status !== "published")
    return next(new HttpError("Product not found.", 404));
  res.json(priced(p));
});
app.post(
  "/api/quantities",
  limit("quantities", 120, 60000),
  (req, res, next) => {
    try {
      const ids = req.body.product_ids;
      if (
        !Array.isArray(ids) ||
        ids.length > 10000 ||
        ids.some((id) => typeof id !== "string" || id.length > 100)
      )
        throw new HttpError("Invalid product IDs.");
      const variants = [...new Set(ids)]
        .flatMap((id) => {
          const p = productById(id);
          return p?.status === "published" ? p.variants : [];
        })
        .map((v) => ({ id: v.id, inventory_quantity: v.inventory_quantity }));
      res.json({ variants });
    } catch (error) {
      next(error);
    }
  },
);
app.post(
  "/api/admin/login",
  limit("login", 10, 900000),
  async (req, res, next) => {
    try {
      const password = req.body.password;
      if (typeof password !== "string" || !password || password.length > 500)
        throw new HttpError(
          "Password is required and must be at most 500 characters.",
        );
      const hash = await promisify(scrypt)(
        password,
        Buffer.from(getSetting("password_salt"), "hex"),
        64,
      );
      if (
        !timingSafeEqual(
          hash,
          Buffer.from(getSetting("password_fingerprint"), "hex"),
        )
      )
        throw new HttpError("Incorrect password.", 401);
      const token = randomBytes(32).toString("hex");
      stmt(
        "INSERT INTO admin_sessions(token_hash,expires_at) VALUES (?,?)",
      ).run(sessionHash(token), Date.now() + 7 * 86400000);
      res.cookie(adminCookie(), token, {
        httpOnly: true,
        secure: req.secure,
        sameSite: "strict",
        path: tenantPath(),
        maxAge: 7 * 86400000,
      });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  },
);
app.get("/api/admin/session", admin, (_req, res) =>
  res.json({
    ok: true,
    defaultPassword: !tenantId() && !process.env.ADMIN_PASSWORD,
  }),
);
app.post("/api/admin/logout", admin, (req, res) => {
  stmt("DELETE FROM admin_sessions WHERE token_hash=?").run(
    sessionHash(cookieToken(req)),
  );
  res.clearCookie(adminCookie(), { path: tenantPath() });
  res.json({ ok: true });
});
app.post(
  "/api/admin/password",
  admin,
  limit("password", 5, 900000),
  async (req, res, next) => {
    try {
      const { currentPassword, password } = req.body;
      if (
        typeof currentPassword !== "string" ||
        currentPassword.length > 500 ||
        typeof password !== "string" ||
        password.length < 12 ||
        password.length > 128
      )
        throw new HttpError("Use a password of 12–128 characters.");
      const old = await promisify(scrypt)(
        currentPassword,
        Buffer.from(getSetting("password_salt"), "hex"),
        64,
      );
      if (
        !timingSafeEqual(
          old,
          Buffer.from(getSetting("password_fingerprint"), "hex"),
        )
      )
        throw new HttpError("Incorrect current password.", 401);
      const salt = randomBytes(32);
      const hash = await promisify(scrypt)(password, salt, 64);
      transaction(() => {
        setSetting("password_salt", salt.toString("hex"));
        setSetting("password_fingerprint", hash.toString("hex"));
        stmt("DELETE FROM admin_sessions").run();
      });
      res.clearCookie(adminCookie(), { path: tenantPath() });
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  },
);
app.get("/api/admin/store", admin, (_req, res) =>
  res.json({ ...publicSettings(), _version: getSetting("store_version", 1) }),
);
app.put("/api/admin/store", admin, (req, res, next) => {
  try {
    const settings = validateSettings(req.body);
    if(getSetting("template")?.renderer === "gala") settings.gala = validateGala(req.body.gala);
    transaction(() => {
      const before = publicSettings();
      const version = getSetting("store_version", 1);
      if (req.body._version !== version)
        throw new HttpError(
          "Store settings changed while you were editing. Reload the latest data before saving.",
          409,
        );
      setSetting("store_version", version + 1);
      setSetting("store", settings);
      if (
        before.checkout.currency === settings.checkout.currency &&
        before.checkout.symbol === settings.checkout.symbol
      )
        return;
      // A single currency applies across catalogue and checkout. Existing order snapshots stay unchanged.
      for (const product of productsAll()) {
        product.variants = product.variants.map((v) => ({
          ...v,
          currency: settings.checkout.currency,
          currency_info: {
            code: settings.checkout.currency,
            symbol: settings.checkout.symbol,
            decimal_digits: 2,
          },
        }));
        writeProduct(product);
      }
    });
    res.json({ ...publicSettings(), _version: getSetting("store_version", 1) });
  } catch (error) {
    next(error);
  }
});
app.get("/api/admin/products", admin, (req, res) => {
  if (req.query.page === undefined)
    return res.json({ products: productsAll() });
  const page = Math.min(1000000, Math.max(1, parseInt(req.query.page) || 1)),
    size = 24,
    search = String(req.query.search || "")
      .trim()
      .slice(0, 100),
    params = [];
  let where = "";
  if (search) {
    where =
      "WHERE instr(lower(json_extract(data,'$.title')),lower(?))>0 OR instr(lower(COALESCE(json_extract(data,'$.translations.ar.title'),'')),lower(?))>0 OR instr(id,?)>0";
    params.push(search, search, search);
  }
  const total = stmt(`SELECT COUNT(*) count FROM products ${where}`).get(
    ...params,
  ).count;
  const products = stmt(
    `SELECT data,version FROM products ${where} ORDER BY position,id LIMIT ? OFFSET ?`,
  )
    .all(...params, size, (page - 1) * size)
    .map((row) => ({ ...JSON.parse(row.data), _version: row.version }));
  res.json({
    products,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / size)),
  });
});
app.get("/api/admin/products/:id", admin, (req, res, next) => {
  const p = productById(req.params.id);
  if (!p) return next(new HttpError("Product not found.", 404));
  res.json(p);
});
app.post("/api/admin/products/:id/move", admin, (req, res, next) => {
  try {
    if (![-1, 1].includes(req.body.direction))
      throw new HttpError("Invalid move direction.");
    transaction(() => {
      const current = stmt("SELECT position FROM products WHERE id=?").get(
        req.params.id,
      );
      if (!current) throw new HttpError("Product not found.", 404);
      const neighbor = stmt(
        req.body.direction === -1
          ? "SELECT id,position FROM products WHERE position<? ORDER BY position DESC LIMIT 1"
          : "SELECT id,position FROM products WHERE position>? ORDER BY position LIMIT 1",
      ).get(current.position);
      if (neighbor) {
        stmt("UPDATE products SET position=? WHERE id=?").run(
          neighbor.position,
          req.params.id,
        );
        stmt("UPDATE products SET position=? WHERE id=?").run(
          current.position,
          neighbor.id,
        );
      }
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
function saveProduct(req, res, next) {
  try {
    const existing = req.params.id ? productById(req.params.id) : null;
    if (req.params.id && !existing)
      throw new HttpError("Product not found.", 404);
    if (req.params.id && req.body.id !== req.params.id)
      throw new HttpError("Existing product IDs cannot be changed.");
    if (!existing && productById(req.body.id))
      throw new HttpError("That product ID already exists.", 409);
    if (existing && req.body._version !== existing._version)
      throw new HttpError(
        "This product changed while you were editing. Reload its latest data before saving.",
        409,
      );
    const ids = new Set(
      (Array.isArray(req.body.variants) ? req.body.variants : [])
        .filter(
          (v) =>
            v &&
            typeof v.id === "string" &&
            stmt(
              "SELECT id FROM variant_lookup WHERE id=? AND product_id<>?",
            ).get(v.id, existing?.id || ""),
        )
        .map((v) => v.id),
    );
    const product = validateProduct(req.body, ids);
    const store = publicSettings();
    product.variants = product.variants.map((v) => ({
      ...v,
      currency: store.checkout.currency,
      currency_info: {
        code: store.checkout.currency,
        symbol: store.checkout.symbol,
        decimal_digits: 2,
      },
    }));
    transaction(() => {
      if (existing) {
        if (
          !writeProduct({ ...product, _version: existing._version }, true)
            .changes
        )
          throw new HttpError(
            "This product changed while you were editing. Reload its latest data before saving.",
            409,
          );
      } else
        stmt("INSERT INTO products(id,data,position) VALUES (?,?,?)").run(
          product.id,
          JSON.stringify(product),
          stmt(
            "SELECT COALESCE(MAX(position),-1)+1 position FROM products",
          ).get().position,
        );
      indexProductVariants(product);
    });
    res.status(existing ? 200 : 201).json(productById(product.id));
  } catch (error) {
    next(error);
  }
}
app.post("/api/admin/products", admin, saveProduct);
app.put("/api/admin/products/:id", admin, saveProduct);
app.delete("/api/admin/products/:id", admin, (req, res) => {
  const result = stmt("DELETE FROM products WHERE id=?").run(req.params.id);
  res
    .status(result.changes ? 200 : 404)
    .json(result.changes ? { ok: true } : { error: "Product not found." });
});
app.put("/api/admin/product-order", admin, (req, res, next) => {
  try {
    const ids = req.body.ids,
      all = productsAll();
    if (
      !Array.isArray(ids) ||
      ids.length !== all.length ||
      new Set(ids).size !== all.length ||
      ids.some((id) => !all.some((p) => p.id === id))
    )
      throw new HttpError("Provide all product IDs once.");
    transaction(() =>
      ids.forEach((id, i) =>
        stmt("UPDATE products SET position=? WHERE id=?").run(i, id),
      ),
    );
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});
app.post(
  "/api/admin/upload",
  admin,
  limit("upload", 80, 3600000),
  upload.single("image"),
  async (req, res, next) => {
    try {
      if (!req.file) throw new HttpError("Choose an image.");
      const meta = await sharp(req.file.buffer, { limitInputPixels: 40000000 })
        .metadata()
        .catch(() => {
          throw new HttpError("The selected file is not a valid image.");
        });
      if (!["jpeg", "png", "webp", "avif"].includes(meta.format))
        throw new HttpError("Upload a JPG, PNG, WebP or AVIF image.");
      const hero = req.body.kind === "hero";
      const wide = req.body.kind === "wide";
      const logo = req.body.kind === "logo";
      const original = req.body.kind === "original";
      const width = original ? 1800 : logo ? 640 : wide ? 1800 : hero ? 1600 : 800,
        height = original ? 1800 : logo ? 240 : wide ? 1200 : hero ? 1800 : 1000;
      const output = await sharp(req.file.buffer, {
        limitInputPixels: 40000000,
      })
        .rotate()
        .resize(
          width,
          height,
          logo || original
            ? { fit: "inside", withoutEnlargement: true }
            : { fit: "cover", position: "attention" },
        )
        .webp({ quality: 85 })
        .toBuffer();
      const filename = `${randomUUID()}.webp`;
      await writeFile(path.join(dataDir, "uploads", filename), output);
      res.status(201).json({
        url: `/uploads/${filename}`,
        width,
        height,
        originalWidth: meta.width,
        originalHeight: meta.height,
        bytes: output.length,
      });
    } catch (error) {
      next(error);
    }
  },
);
app.post(
  "/api/orders",
  limit("orders", 60, 3600000),
  async (req, res, next) => {
    try {
      const key = text(req.body.idempotency_key || "", "Checkout key", 80);
      if (!/^[a-zA-Z0-9-]{16,80}$/.test(key))
        throw new HttpError("Invalid checkout key.");
      const previous = stmt("SELECT * FROM orders WHERE idempotency_key=?").get(
        key,
      );
      if (previous) {
        let payment_url = null;
        try {
          payment_url = await beginShopperPayment(previous);
        } catch {}
        return res.json({
          order: orderObject(previous, false),
          receipt_token: previous.token,
          payment_url,
        });
      }
      if (!["cod", "paymob"].includes(req.body.payment_method))
        throw new HttpError("Choose a supported payment method.");
      if (req.body.payment_method === "paymob" && !paymentsReady())
        throw new HttpError(
          "Online payment is not configured for this store.",
          409,
        );
      const customer = validateCustomer(req.body.customer);
      if (req.body.payment_method === "paymob" && !customer.email)
        throw new HttpError("Enter your email address for online payment.");
      if (
        !Array.isArray(req.body.items) ||
        !req.body.items.length ||
        req.body.items.length > 40
      )
        throw new HttpError(
          "An order must contain between 1 and 40 product lines.",
        );
      const store = localizeSettings(publicSettings(), req.body.language);
      const token = randomBytes(32).toString("hex");
      const createdAt = new Date().toISOString();
      const row = transaction(() => {
        const changed = new Map();
        const aggregated = new Map();
        req.body.items.forEach((line) => {
          if (
            !line ||
            typeof line !== "object" ||
            !Number.isSafeInteger(line.quantity) ||
            line.quantity < 1 ||
            line.quantity > 99 ||
            typeof line.variant_id !== "string"
          )
            throw new HttpError("Invalid product quantity.");
          aggregated.set(
            line.variant_id,
            (aggregated.get(line.variant_id) || 0) + line.quantity,
          );
        });
        const items = [];
        for (const [variantId, quantity] of aggregated) {
          if (quantity > 99)
            throw new HttpError("The maximum quantity per style is 99.");
          const found = productForVariant(variantId);
          const product = found ? changed.get(found.id) || found : null;
          if (product) changed.set(product.id, product);
          if (
            !product ||
            product.status !== "published" ||
            !product.purchasable
          )
            throw new HttpError(
              "A product is no longer available. Please update your cart.",
              409,
            );
          const variant = product.variants.find((v) => v.id === variantId);
          if (variant.manage_inventory && variant.inventory_quantity < quantity)
            throw new HttpError(
              `Not enough stock for ${product.title} (${variant.title}). ${variant.inventory_quantity} left.`,
              409,
            );
          const price = variant.sale_price_in_cents ?? variant.price_in_cents;
          const visible = localizeProduct(product, req.body.language);
          const visibleVariant = visible.variants.find(
            (v) => v.id === variant.id,
          );
          items.push({
            product_id: product.id,
            variant_id: variant.id,
            title: visible.title,
            subtitle: visible.subtitle,
            description: visible.description,
            additional_info: visible.additional_info,
            variant_title: visibleVariant.title,
            image: variant.image_url || product.image,
            price_in_cents: price,
            quantity,
            total_in_cents: price * quantity,
          });
          if (variant.manage_inventory) variant.inventory_quantity -= quantity;
        }
        const subtotal = items.reduce(
          (sum, line) => sum + line.total_in_cents,
          0,
        );
        const totals = quoteTotals(
          store,
          subtotal,
          req.body.coupon_code || "",
          customer.country,
        );
        if (req.body.payment_method === "paymob" && totals.total_in_cents < 1)
          throw new HttpError(
            "Online payments require a positive order total.",
          );
        const data = {
          language: req.body.language === "ar" ? "ar" : "en",
          storeName: store.name,
          customer,
          shopper_id: currentShopper(req)?.id || null,
          items,
          payment_method: req.body.payment_method,
          payment_status:
            req.body.payment_method === "paymob" ? "pending" : "cod",
          ...(req.body.payment_method === "paymob"
            ? {
                payment_reference: randomUUID(),
                payment_expires: Date.now() + 3600000,
              }
            : {}),
          currency: store.checkout.currency,
          symbol: store.checkout.symbol,
          ...totals,
          delivery_note: store.checkout.deliveryNote,
        };
        const result = stmt(
          "INSERT INTO orders(token,idempotency_key,created_at,data,visit_id) VALUES (?,?,?,?,?)",
        ).run(
          token,
          key,
          createdAt,
          JSON.stringify(data),
          trackedVisit(req.body.analytics, req),
        );
        const number = `ORD-${String(result.lastInsertRowid).padStart(6, "0")}`;
        stmt("UPDATE orders SET number=? WHERE id=?").run(
          number,
          result.lastInsertRowid,
        );
        if (req.body.payment_method === "paymob")
          stmt(
            "UPDATE orders SET telegram_status='awaiting_payment' WHERE id=?",
          ).run(result.lastInsertRowid);
        if (totals.coupon_code)
          stmt("UPDATE discounts SET used=used+1 WHERE code=?").run(
            totals.coupon_code,
          );
        stmt(
          "INSERT INTO order_history(order_id,status,at) VALUES (?,?,?)",
        ).run(result.lastInsertRowid, "new", createdAt);
        for (const product of changed.values()) writeProduct(product);
        return stmt("SELECT * FROM orders WHERE id=?").get(
          result.lastInsertRowid,
        );
      });
      let payment_url = null,
        payment_error = "";
      try {
        payment_url = await beginShopperPayment(row);
      } catch (e) {
        payment_error = e.message;
      }
      res.status(201).json({
        order: orderObject(
          stmt("SELECT * FROM orders WHERE id=?").get(row.id),
          false,
        ),
        receipt_token: token,
        payment_url,
        payment_error,
      });
      invalidateAnalytics();
      void deliverPending();
    } catch (error) {
      next(error);
    }
  },
);
app.get(
  "/api/receipt/:token",
  limit("receipt", 120, 60000),
  (req, res, next) => {
    const row = stmt("SELECT * FROM orders WHERE token=?").get(
      req.params.token,
    );
    if (!row) return next(new HttpError("Order confirmation not found.", 404));
    const order = orderObject(row, false);
    res.json({
      ...order,
      history: stmt(
        "SELECT status,at FROM order_history WHERE order_id=? ORDER BY id",
      ).all(row.id),
    });
  },
);
app.post(
  "/api/checkout/quote",
  limit("quote", 180, 60000),
  (req, res, next) => {
    try {
      res.json(
        quoteTotals(
          publicSettings(),
          priceCart(req.body.items),
          req.body.coupon_code || "",
          req.body.country || "",
        ),
      );
    } catch (e) {
      next(e);
    }
  },
);
app.get("/api/admin/discounts", admin, (_req, res) =>
  res.json({
    discounts: stmt("SELECT * FROM discounts ORDER BY code")
      .all()
      .map((r) => ({
        ...JSON.parse(r.data),
        used: r.used,
        _version: r.version,
      })),
  }),
);
app.put("/api/admin/discounts/:code", admin, (req, res, next) => {
  try {
    const discount = validateDiscount(
      req.body,
      publicSettings().checkout.currency,
    );
    if (discount.code !== req.params.code)
      throw new HttpError("Discount codes cannot be renamed.");
    transaction(() => {
      const old = stmt("SELECT version FROM discounts WHERE code=?").get(
        discount.code,
      );
      if (old && req.body._version !== old.version)
        throw new HttpError(
          "This discount changed. Reload the latest data before saving.",
          409,
        );
      if (
        !old &&
        stmt("SELECT COUNT(*) count FROM discounts").get().count >= 200
      )
        throw new HttpError("A maximum of 200 discount codes is supported.");
      stmt(
        "INSERT INTO discounts(code,data) VALUES (?,?) ON CONFLICT(code) DO UPDATE SET data=excluded.data,version=discounts.version+1",
      ).run(discount.code, JSON.stringify(discount));
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
app.get("/api/admin/operations", admin, (_req, res) => {
  const store = publicSettings();
  const lowStock = stmt(
    "SELECT p.id product_id,json_extract(p.data,'$.title') title,json_extract(p.data,'$.translations.ar.title') title_ar,json_extract(v.value,'$.title') variant,(SELECT json_extract(a.value,'$.title') FROM json_each(p.data,'$.translations.ar.variants') a WHERE json_extract(a.value,'$.id')=json_extract(v.value,'$.id')) variant_ar,json_extract(v.value,'$.inventory_quantity') quantity FROM products p,json_each(p.data,'$.variants') v WHERE json_extract(p.data,'$.status')='published' AND json_extract(v.value,'$.manage_inventory')=1 AND json_extract(v.value,'$.inventory_quantity')<=? ORDER BY quantity,p.position LIMIT 12",
  ).all(store.commerce.lowStockThreshold);
  res.json({
    lowStock,
    published: stmt(
      "SELECT COUNT(*) count FROM products WHERE json_extract(data,'$.status')='published'",
    ).get().count,
    drafts: stmt(
      "SELECT COUNT(*) count FROM products WHERE json_extract(data,'$.status')='draft'",
    ).get().count,
    pendingOrders: stmt(
      "SELECT COUNT(*) count FROM orders WHERE status IN ('new','processing')",
    ).get().count,
    recentOrders: stmt("SELECT * FROM orders ORDER BY id DESC LIMIT 5")
      .all()
      .map((r) => orderObject(r)),
    telegramFailures: stmt(
      "SELECT COUNT(*) count FROM orders WHERE telegram_status='failed'",
    ).get().count,
  });
});
app.get("/api/admin/orders", admin, (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1),
    size = 30;
  const search = String(req.query.search || "").slice(0, 100);
  const status = [
    "new",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
  ].includes(req.query.status)
    ? req.query.status
    : "";
  const conditions = [],
    params = [];
  if (status) {
    conditions.push("status=?");
    params.push(status);
  }
  if (search) {
    conditions.push(
      "(number LIKE ? ESCAPE '\\' OR json_extract(data,'$.customer.name') LIKE ? ESCAPE '\\' OR json_extract(data,'$.customer.phone') LIKE ? ESCAPE '\\')",
    );
    const match = "%" + search.replace(/[\\%_]/g, "\\$&") + "%";
    params.push(match, match, match);
  }
  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
  const total = stmt(`SELECT COUNT(*) count FROM orders ${where}`).get(
    ...params,
  ).count;
  const orders = stmt(
    `SELECT * FROM orders ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
  )
    .all(...params, size, (page - 1) * size)
    .map((row) => orderObject(row));
  const summary = stmt(
    "SELECT status,COUNT(*) count FROM orders GROUP BY status",
  ).all();
  res.json({ orders, total, page, pages: Math.ceil(total / size), summary });
});
function adminOrderDetail(row) {
  return {
    ...orderObject(row),
    history: stmt(
      "SELECT status,at FROM order_history WHERE order_id=? ORDER BY id",
    ).all(row.id),
  };
}
app.get("/api/admin/orders/:id", admin, (req, res, next) => {
  try {
    const row = /^\d{1,12}$/.test(req.params.id)
      ? stmt("SELECT * FROM orders WHERE id=?").get(req.params.id)
      : null;
    if (!row) throw new HttpError("Order not found.", 404);
    res.json(adminOrderDetail(row));
  } catch (error) {
    next(error);
  }
});
app.patch("/api/admin/orders/:id", admin, (req, res, next) => {
  try {
    const status = req.body.status;
    if (
      !["new", "processing", "shipped", "delivered", "cancelled"].includes(
        status,
      )
    )
      throw new HttpError("Invalid order status.");
    const result = transaction(() => {
      const row = stmt("SELECT * FROM orders WHERE id=?").get(req.params.id);
      if (!row) throw new HttpError("Order not found.", 404);
      const payment = JSON.parse(row.data);
      if (
        payment.payment_method === "paymob" &&
        payment.payment_status !== "paid" &&
        ["processing", "shipped", "delivered"].includes(status)
      )
        throw new HttpError(
          "Confirm online payment before fulfilling this order.",
          409,
        );
      if (
        req.body.expected_status !== undefined &&
        req.body.expected_status !== row.status
      )
        throw new HttpError(
          "This order changed. Close it and reopen the latest version.",
          409,
        );
      if (row.status === "cancelled" && status !== "cancelled")
        throw new HttpError(
          "Cancelled orders cannot be reopened. Create a new order to reserve stock.",
        );
      if (row.status === "delivered" && status !== "delivered")
        throw new HttpError("Delivered orders are final.");
      if (status === "cancelled" && row.status !== "cancelled") {
        const order = orderObject(row);
        const affected = new Set(order.items.map((item) => item.product_id));
        for (const id of affected) {
          const product = productById(id);
          if (!product) continue;
          for (const variant of product.variants) {
            if (variant.manage_inventory)
              variant.inventory_quantity += order.items
                .filter((i) => i.variant_id === variant.id)
                .reduce((sum, i) => sum + i.quantity, 0);
          }
          writeProduct(product);
        }
      }
      if (row.status !== status)
        stmt(
          "INSERT INTO order_history(order_id,status,at) VALUES (?,?,?)",
        ).run(row.id, status, new Date().toISOString());
      const snapshot = orderObject(row);
      if (req.body.tracking !== undefined) {
        const tracking = req.body.tracking;
        if (!tracking || typeof tracking !== "object")
          throw new HttpError("Invalid tracking information.");
        const carrier = text(tracking.carrier || "", "Carrier", 80, false);
        const number = text(
          tracking.number || "",
          "Tracking number",
          120,
          false,
        );
        const url = text(tracking.url || "", "Tracking URL", 500, false);
        if (url) {
          let parsed;
          try {
            parsed = new URL(url);
          } catch {
            throw new HttpError("Use an HTTPS tracking URL.");
          }
          if (parsed.protocol !== "https:")
            throw new HttpError("Use an HTTPS tracking URL.");
        }
        const raw = JSON.parse(row.data);
        raw.tracking = { carrier, number, url };
        stmt("UPDATE orders SET data=? WHERE id=?").run(
          JSON.stringify(raw),
          row.id,
        );
      }
      stmt("UPDATE orders SET status=? WHERE id=?").run(status, row.id);
      return adminOrderDetail(
        stmt("SELECT * FROM orders WHERE id=?").get(row.id),
      );
    });
    invalidateAnalytics();
    res.json(result);
  } catch (error) {
    next(error);
  }
});
app.post("/api/admin/orders/:id/telegram", admin, (req, res, next) => {
  const row = stmt("SELECT * FROM orders WHERE id=?").get(req.params.id);
  if (!row) return next(new HttpError("Order not found.", 404));
  const payment = JSON.parse(row.data);
  if (payment.payment_method === "paymob" && payment.payment_status !== "paid")
    return next(
      new HttpError(
        "Confirm payment before sending the order notification.",
        409,
      ),
    );
  if (
    row.telegram_status === "sending" &&
    row.telegram_lease_until > Date.now()
  )
    return next(
      new HttpError("Telegram delivery is already in progress.", 409),
    );
  stmt(
    "UPDATE orders SET telegram_status='pending',telegram_attempts=0,telegram_next_attempt=0 WHERE id=?",
  ).run(row.id);
  void deliverPending();
  res.json({ ok: true });
});
app.get("/api/admin/telegram", admin, (_req, res) => {
  const c = telegramConfig();
  res.json({
    configured: !!(c.token && c.chatId),
    hasToken: !!c.token,
    chatId: c.chatId,
    credentialsError: c.credentialsError,
  });
});
app.put("/api/admin/telegram", admin, (req, res, next) => {
  try {
    const old = telegramConfig();
    const token =
      req.body.token === undefined || req.body.token === ""
        ? old.token
        : text(req.body.token, "Bot token", 200);
    const chatId = text(req.body.chatId || "", "Chat ID", 80, false);
    if (token && !/^\d+:[A-Za-z0-9_-]{20,}$/.test(token))
      throw new HttpError("Enter a valid Telegram bot token from @BotFather.");
    if (
      chatId &&
      !/^-?\d+$/.test(chatId) &&
      !/^@[A-Za-z0-9_]{5,}$/.test(chatId)
    )
      throw new HttpError("Enter a numeric chat ID or @channel username.");
    setSetting("telegram", { token: token ? encrypt(token) : "", chatId });
    stmt(
      "UPDATE orders SET telegram_attempts=0,telegram_next_attempt=0 WHERE telegram_status IN ('pending','failed')",
    ).run();
    void deliverPending();
    res.json({ configured: !!(token && chatId), hasToken: !!token, chatId });
  } catch (error) {
    next(error);
  }
});
app.delete("/api/admin/telegram", admin, (_req, res) => {
  setSetting("telegram", {});
  res.json({ ok: true });
});
app.post(
  "/api/admin/telegram/test",
  admin,
  limit("telegramtest", 5, 60000),
  async (_req, res, next) => {
    try {
      const { token, chatId } = telegramConfig();
      if (!token || !chatId)
        throw new HttpError("Save the bot token and chat ID first.");
      const form = new FormData();
      form.set("chat_id", chatId);
      form.set(
        "text",
        `✅ ${publicSettings().name}\nTelegram order notifications are connected.`,
      );
      await telegramApi("sendMessage", form);
      res.json({ ok: true });
    } catch (error) {
      next(
        new HttpError(
          "Telegram could not deliver the test. Check the token, chat ID, and bot permissions.",
        ),
      );
    }
  },
);
app.post("/api/analytics", limit("analytics", 600, 60000), (req, res, next) => {
  try {
    recordAnalytics(req.body, req);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});
app.get("/api/admin/analytics", admin, (req, res) =>
  res.json(
    analyticsReport(
      [0, 7, 30, 90, 365].includes(Number(req.query.days))
        ? Number(req.query.days)
        : 30,
      Math.min(100000, Math.max(1, parseInt(req.query.page) || 1)),
    ),
  ),
);
app.get("/api/admin/analytics/visits/:id", admin, (req, res, next) => {
  try {
    res.json(
      visitTimeline(
        req.params.id,
        Math.min(100000, Math.max(1, parseInt(req.query.page) || 1)),
      ),
    );
  } catch (error) {
    next(error);
  }
});
app.get("/api/admin/export", admin, exportData(false));
app.get("/api/admin/orders-export", admin, exportData(true));
app.use(
  "/uploads",
  express.static(path.join(dataDir, "uploads"), {
    maxAge: "1y",
    immutable: true,
    index: false,
    dotfiles: "deny",
  }),
);
app.use("/api", (_req, res) =>
  res.status(404).json({ error: "API route not found." }),
);
const dist = path.resolve("dist");
if (existsSync(dist)) {
  app.use(
    express.static(dist, {
      maxAge: "1h",
      setHeaders: (res, file) => {
        if (
          file.includes(`${path.sep}assets${path.sep}`) &&
          /-[A-Za-z0-9_-]{8,}\.(?:css|js)$/.test(path.basename(file))
        )
          res.set("Cache-Control", "public,max-age=31536000,immutable");
        else if (file.endsWith("index.html"))
          res.set("Cache-Control", "no-cache");
      },
    }),
  );
  app.get("/{*path}", (req, res) => {
    const pages = [
      "/",
      "/shop",
      "/about",
      "/contact",
      "/privacy",
      "/terms",
      "/shipping",
      "/returns",
      "/checkout",
      "/success",
      "/admin",
      "/account",
      "/saved",
      "/cart",
      "/collections",
      "/track",
    ];
    const productId = req.path.startsWith("/product/") ? req.path.slice(9) : "";
    const valid =
      pages.includes(req.path) ||
      (productId && productById(productId)?.status === "published");
    res.status(valid ? 200 : 404).sendFile(path.join(dist, "index.html"));
  });
}
app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError)
    return res.status(400).json({
      error:
        error.code === "LIMIT_FILE_SIZE"
          ? "Images must be smaller than 10 MB."
          : error.message,
    });
  if (error.type === "entity.parse.failed")
    return res.status(400).json({ error: "Invalid JSON." });
  if (error.type === "entity.too.large")
    return res.status(413).json({ error: "Request is too large." });
  if (error instanceof HttpError)
    return res.status(error.status).json({ error: error.message });
  console.error("Request failed:", error.name);
  res
    .status(500)
    .json({ error: "The request could not be completed. Please try again." });
});
let timers = [];
export function startServer(port = Number(process.env.PORT) || 3000) {
  const server = app.listen(port, "0.0.0.0", () =>
    console.log(`Store running on port ${server.address().port}`),
  );
  timers.push(setInterval(() => void deliverPending(), 15000));
  timers.push(
    setInterval(() => {
      stmt("DELETE FROM admin_sessions WHERE expires_at<?").run(Date.now());
      for (const [key, bucket] of buckets)
        if (bucket.until < Date.now()) buckets.delete(key);
    }, 60000),
  );
  timers.forEach((timer) => timer.unref());
  void deliverPending();
  return server;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const server = startServer();
  for (const signal of ["SIGTERM", "SIGINT"])
    process.on(signal, () => {
      timers.forEach(clearInterval);
      server.close(async () => {
        await stopDelivery();
        db.close();
        process.exit(0);
      });
    });
}

if(process.env.PLATFORM_MODE!=='1')migrateAtelierImages();
