import { featureGate } from "../platform/features.js";
import { createHmac, timingSafeEqual } from "node:crypto";
import { encrypt, decrypt, rawDb } from "../db.js";
import { sql, token, hash, audit } from "../platform/core.js";
import { requireUser } from "../platform/auth.js";
import { safeFetch, validateDestination } from "./safe-fetch.js";
rawDb.exec(
  `CREATE TABLE IF NOT EXISTS platform_import_oauth(hash TEXT PRIMARY KEY,owner_id INTEGER NOT NULL,domain TEXT NOT NULL,location TEXT NOT NULL,expires INTEGER NOT NULL);`,
);
export function shopifyHmac(query, secret) {
  if (!secret || !query || !/^[a-f0-9]{64}$/i.test(String(query.hmac || "")))
    return false;
  const message = Object.keys(query)
    .filter((k) => k !== "hmac" && k !== "signature")
    .sort()
    .map((k) => k + "=" + query[k])
    .join("&");
  return timingSafeEqual(
    createHmac("sha256", secret).update(message).digest(),
    Buffer.from(query.hmac, "hex"),
  );
}
export function registerConnections(app, rate) {
  app.get("/api/platform/import-connections", requireUser, (req, res) =>
    res.json({
      shopifyConfigured: !!(
        process.env.VERA_SHOPIFY_CLIENT_ID &&
        process.env.VERA_SHOPIFY_CLIENT_SECRET
      ),
      connections: sql(
        "SELECT id,provider,domain,state,created FROM platform_import_connections WHERE owner_id=?",
      ).all(req.user.id),
    }),
  );
  app.post(
    "/api/platform/import-connections/shopify/start",
    requireUser,
    featureGate("providerConnectors"),
    rate,
    async (req, res) => {
      try {
        if (
          !process.env.VERA_SHOPIFY_CLIENT_ID ||
          !process.env.VERA_SHOPIFY_CLIENT_SECRET
        )
          return res.status(503).json({
            error:
              "Set VERA_SHOPIFY_CLIENT_ID and VERA_SHOPIFY_CLIENT_SECRET in secure environment settings, and configure the HTTPS callback.",
          });
        const domain = String(req.body.domain || "").toLowerCase();
        if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain))
          throw Error("Use your official myshopify.com domain.");
        await validateDestination("https://" + domain);
        if (!process.env.PUBLIC_URL?.startsWith("https://"))
          throw Error("Shopify OAuth requires an HTTPS PUBLIC_URL.");
        const state = token();
        sql("INSERT INTO platform_import_oauth VALUES(?,?,?,?,?)").run(
          hash(state),
          req.user.id,
          domain,
          String(req.body.location || "").slice(0, 100),
          Date.now() + 600000,
        );
        const url = new URL("https://" + domain + "/admin/oauth/authorize");
        url.search = new URLSearchParams({
          client_id: process.env.VERA_SHOPIFY_CLIENT_ID,
          scope: "read_products,read_inventory,read_locations",
          redirect_uri:
            process.env.PUBLIC_URL +
            "/api/platform/import-connections/shopify/callback",
          state,
        });
        res.json({ url: url.href });
      } catch (e) {
        res.status(400).json({ error: e.message });
      }
    },
  );
  app.get(
    "/api/platform/import-connections/shopify/callback",
    requireUser,
    async (req, res) => {
      try {
        if (!shopifyHmac(req.query, process.env.VERA_SHOPIFY_CLIENT_SECRET))
          throw Error("OAuth signature invalid.");
        const row = sql(
          "DELETE FROM platform_import_oauth WHERE hash=? RETURNING *",
        ).get(hash(String(req.query.state || "")));
        if (
          !row ||
          row.owner_id !== req.user.id ||
          row.expires < Date.now() ||
          row.domain !== req.query.shop ||
          typeof req.query.code !== "string"
        )
          throw Error("OAuth state invalid.");
        const r = await safeFetch(
          "https://" + row.domain + "/admin/oauth/access_token",
          {
            method: "POST",
            body: JSON.stringify({
              client_id: process.env.VERA_SHOPIFY_CLIENT_ID,
              client_secret: process.env.VERA_SHOPIFY_CLIENT_SECRET,
              code: req.query.code,
            }),
            headers: { "Content-Type": "application/json" },
          },
        );
        const result = JSON.parse(r.buffer);
        if (!result.access_token) throw Error("Access token missing.");
        const scopes = String(result.scope || "").split(",");
        if (!scopes.includes("read_products"))
          throw Error("Product read scope required.");
        const id = token();
        sql(
          "INSERT INTO platform_import_connections VALUES(?,?,?,?,?,?,?)",
        ).run(
          id,
          req.user.id,
          "shopify",
          row.domain,
          encrypt(
            JSON.stringify({
              token: result.access_token,
              scopes,
              location: row.location,
              expiresAt: result.expires_in
                ? Date.now() + result.expires_in * 1000
                : null,
            }),
          ),
          "active",
          Date.now(),
        );
        audit(req.user.id, "import.connected");
        res.redirect("/workspace/import");
      } catch (e) {
        res.status(400).json({ error: e.message });
      }
    },
  );
  app.post(
    "/api/platform/import-connections/woocommerce",
    requireUser,
    featureGate("providerConnectors"),
    rate,
    async (req, res) => {
      try {
        const url = new URL(req.body.url);
        if (
          url.protocol !== "https:" ||
          url.pathname !== "/" ||
          url.username ||
          url.password
        )
          throw Error("Use the HTTPS origin of the WooCommerce store.");
        const { key, secret } = req.body;
        if (
          typeof key !== "string" ||
          typeof secret !== "string" ||
          !key.startsWith("ck_") ||
          !secret.startsWith("cs_")
        )
          throw Error("Read-only WooCommerce API keys required.");
        const auth =
          "Basic " + Buffer.from(key + ":" + secret).toString("base64");
        await safeFetch(url.origin + "/wp-json/wc/v3/products?per_page=1", {
          headers: { Authorization: auth },
        });
        const id = token();
        sql(
          "INSERT INTO platform_import_connections VALUES(?,?,?,?,?,?,?)",
        ).run(
          id,
          req.user.id,
          "woocommerce",
          url.hostname,
          encrypt(JSON.stringify({ key, secret, origin: url.origin })),
          "active",
          Date.now(),
        );
        audit(req.user.id, "import.connected");
        res.status(201).json({ id });
      } catch (e) {
        res.status(400).json({ error: e.message });
      }
    },
  );
  app.get(
    "/api/platform/import-connections/:connectionId/locations",
    requireUser,
    async (req, res) => {
      try {
        const row = sql(
          "SELECT * FROM platform_import_connections WHERE id=? AND owner_id=? AND provider='shopify' AND state='active'",
        ).get(req.params.connectionId, req.user.id);
        if (!row) return res.sendStatus(404);
        const c = JSON.parse(decrypt(row.secret));
        const r = await safeFetch(
          "https://" + row.domain + "/admin/api/2026-10/graphql.json",
          {
            method: "POST",
            body: JSON.stringify({
              query: "{locations(first:50){nodes{id name}}}",
            }),
            headers: {
              "Content-Type": "application/json",
              "X-Shopify-Access-Token": c.token,
            },
          },
        );
        const d = JSON.parse(r.buffer);
        if (d.errors) throw Error("SHOPIFY_LOCATIONS_SCOPE_REQUIRED");
        res.json({ locations: d.data.locations.nodes });
      } catch (e) {
        res.status(400).json({ error: e.message });
      }
    },
  );
  app.patch(
    "/api/platform/import-connections/:connectionId/location",
    requireUser,
    (req, res) => {
      const row = sql(
        "SELECT * FROM platform_import_connections WHERE id=? AND owner_id=? AND provider='shopify' AND state='active'",
      ).get(req.params.connectionId, req.user.id);
      if (!row) return res.sendStatus(404);
      if (!/^gid:\/\/shopify\/Location\/\d+$/.test(req.body.location || ""))
        return res
          .status(400)
          .json({ error: "Select a Shopify inventory location." });
      const c = JSON.parse(decrypt(row.secret));
      c.location = req.body.location;
      sql("UPDATE platform_import_connections SET secret=? WHERE id=?").run(
        encrypt(JSON.stringify(c)),
        row.id,
      );
      res.json({ ok: true });
    },
  );
  app.delete(
    "/api/platform/import-connections/:connectionId",
    requireUser,
    (req, res) => {
      sql(
        "UPDATE platform_import_connections SET state='disconnected',secret=NULL WHERE id=? AND owner_id=?",
      ).run(req.params.connectionId, req.user.id);
      audit(req.user.id, "import.disconnected");
      res.json({ ok: true });
    },
  );
}
export async function connectedProducts(
  connectionId,
  ownerId,
  page,
  cursor,
  signal,
) {
  const read = (url, options = {}) => safeFetch(url, { ...options, signal });
  const row = sql(
    "SELECT * FROM platform_import_connections WHERE id=? AND owner_id=? AND state='active'",
  ).get(connectionId, ownerId);
  if (!row) throw Error("CONNECTION_DISCONNECTED");
  const credentials = JSON.parse(decrypt(row.secret));
  if (credentials.expiresAt && credentials.expiresAt < Date.now())
    throw Error("CONNECTION_EXPIRED_RECONNECT");
  if (row.provider === "shopify") {
    const query = `query($after:String){products(first:50,after:$after){pageInfo{hasNextPage endCursor}nodes{id title isGiftCard descriptionHtml productType onlineStoreUrl images(first:12){nodes{url altText}} variants(first:41){pageInfo{hasNextPage}nodes{id title sku price inventoryItem{requiresShipping inventoryLevels(first:50){nodes{location{id} quantities(names:["available"]){name quantity}}}} selectedOptions{name value}}}}}}`;
    const r = await read(
        "https://" + row.domain + "/admin/api/2026-10/graphql.json",
        {
          method: "POST",
          body: JSON.stringify({ query, variables: { after: cursor || null } }),
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": credentials.token,
          },
        },
      ),
      result = JSON.parse(r.buffer);
    if (result.errors) {
      const e = Error(
        result.errors.some((x) => x.extensions?.code === "THROTTLED")
          ? "SOURCE_RATE_LIMIT"
          : "SHOPIFY_SCOPE_OR_API_ERROR",
      );
      e.retryable = e.message === "SOURCE_RATE_LIMIT";
      e.retryAfter = 5000;
      throw e;
    }
    const money = await read(
      "https://" + row.domain + "/admin/api/2026-10/graphql.json",
      {
        method: "POST",
        body: JSON.stringify({ query: "{shop{currencyCode}}" }),
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": credentials.token,
        },
      },
    );
    const currency = JSON.parse(money.buffer).data.shop.currencyCode;
    const p = result.data.products;
    return {
      next: p.pageInfo.hasNextPage ? p.pageInfo.endCursor : null,
      products: p.nodes.map((x) => ({
        sourceType: "shopify-api",
        domain: row.domain,
        externalId: x.id,
        sourceUrl: x.onlineStoreUrl,
        title: x.title,
        description: x.descriptionHtml,
        category: x.productType,
        currency,
        locale: "en",
        images: x.images.nodes.map((i) => i.url),
        warnings: [
          ...(x.variants.pageInfo.hasNextPage
            ? ["UNSUPPORTED_VARIANT_COUNT"]
            : []),
          ...(x.isGiftCard ||
          x.variants.nodes.some(
            (v) => v.inventoryItem?.requiresShipping === false,
          )
            ? ["UNSUPPORTED_PRODUCT_TYPE"]
            : []),
        ],
        variants: x.variants.nodes.map((v) => {
          const level = v.inventoryItem?.inventoryLevels.nodes.find(
            (n) => n.location.id === credentials.location,
          );
          return {
            externalId: v.id,
            title: v.title,
            sku: v.sku,
            priceMinor: Math.round(Number(v.price) * 100),
            optionValues: v.selectedOptions.filter(
              (o) => o.value !== "Default Title",
            ),
            stockKnown: !!level,
            stock: level?.quantities[0]?.quantity ?? null,
          };
        }),
      })),
    };
  }
  const headers = {
    Authorization:
      "Basic " +
      Buffer.from(credentials.key + ":" + credentials.secret).toString(
        "base64",
      ),
  };
  const r = await read(
      credentials.origin + "/wp-json/wc/v3/products?per_page=100&page=" + page,
      { headers },
    ),
    products = JSON.parse(r.buffer);
  const out = [];
  for (const x of products) {
    let variants = [x];
    if (x.type === "variable" && x.variations.length <= 40) {
      const v = await read(
        credentials.origin +
          `/wp-json/wc/v3/products/${x.id}/variations?per_page=100`,
        { headers },
      );
      variants = JSON.parse(v.buffer);
    }
    const unsupported =
      !["simple", "variable"].includes(x.type) ||
      x.variations?.length > 40 ||
      x.virtual ||
      x.downloadable;
    out.push({
      sourceType: "woocommerce-api",
      domain: row.domain,
      externalId: String(x.id),
      sourceUrl: x.permalink,
      title: x.name,
      description: x.description,
      currency: null,
      locale: "en",
      images: x.images.map((i) => i.src),
      warnings: unsupported ? ["UNSUPPORTED_PRODUCT_TYPE"] : [],
      variants: variants.map((v) => ({
        externalId: String(v.id),
        title: v.name || x.name,
        sku: v.sku,
        priceMinor: v.price !== "" ? Math.round(Number(v.price) * 100) : null,
        stockKnown: v.manage_stock && Number.isSafeInteger(v.stock_quantity),
        stock: v.stock_quantity,
        optionValues: (v.attributes || [])
          .map((a) => ({ name: a.name, value: a.option || "" }))
          .filter((a) => a.value),
      })),
    });
  }
  return {
    products: out,
    next: products.length === 100 ? String(page + 1) : null,
  };
}
