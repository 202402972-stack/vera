import { productsAll } from "./db.js";
import { tenantPath } from "./tenant.js";
const escape = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
const origin = (req) =>
  (req.customStoreHost
    ? req.customOrigin
    : process.env.PUBLIC_URL || `${req.protocol}://${req.get("host")}`
  ).replace(/\/$/, "");
const document = (tag, items) =>
  `<?xml version="1.0" encoding="UTF-8"?><${tag} xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${items}</${tag}>`;
export function registerStoreSEO(app) {
  app.get("/sitemap.xml", (req, res) => {
    if (req.query.preview === "1")
      return res.status(404).set("Cache-Control", "private,no-store").end();
    const base = tenantPath() === "/" ? "" : tenantPath(),
      urls = [
        "/",
        "/shop",
        "/about",
        ...productsAll()
          .filter((p) => p.status === "published")
          .map((p) => "/product/" + encodeURIComponent(p.id)),
      ];
    res
      .type("application/xml")
      .set("Cache-Control", "public,max-age=60")
      .send(
        document(
          "urlset",
          urls
            .map(
              (path) =>
                `<url><loc>${escape(origin(req) + base + path)}</loc></url>`,
            )
            .join(""),
        ),
      );
  });
  app.get("/robots.txt", (req, res) =>
    res
      .type("text/plain")
      .send(
        `User-agent: *\nDisallow: /admin\nDisallow: /api/\nDisallow: /account\nDisallow: /checkout\nDisallow: /success\nDisallow: /*preview=1\nSitemap: ${origin(req)}${tenantPath() === "/" ? "" : tenantPath()}/sitemap.xml\n`,
      ),
  );
}
export function registerPlatformSEO(app, sql) {
  app.get("/sitemap.xml", (req, res) => {
    const stores = sql(
      "SELECT s.slug,d.hostname FROM platform_stores s LEFT JOIN platform_domains d ON d.store_id=s.id AND d.state='active' WHERE s.publication_state='published' AND s.paused=0 AND s.suspended=0 AND max(s.trial_until,s.access_until)>? ORDER BY s.id LIMIT 10000",
    ).all(Date.now());
    res
      .type("application/xml")
      .set("Cache-Control", "public,max-age=60")
      .send(
        document(
          "sitemapindex",
          `<sitemap><loc>${escape(origin(req) + "/platform-sitemap.xml")}</loc></sitemap>` +
            stores
              .map(
                (s) =>
                  `<sitemap><loc>${escape(s.hostname ? "https://" + s.hostname + "/sitemap.xml" : origin(req) + "/s/" + s.slug + "/sitemap.xml")}</loc></sitemap>`,
              )
              .join(""),
        ),
      );
  });
  app.get("/platform-sitemap.xml", (req, res) =>
    res
      .type("application/xml")
      .send(
        document(
          "urlset",
          ["/", "/templates", "/privacy", "/terms"]
            .map(
              (path) => `<url><loc>${escape(origin(req) + path)}</loc></url>`,
            )
            .join(""),
        ),
      ),
  );
  app.get("/robots.txt", (req, res) =>
    res
      .type("text/plain")
      .send(
        `User-agent: *\nDisallow: /workspace\nDisallow: /owner\nDisallow: /api/\nDisallow: /demo/\nDisallow: /s/*/admin\nDisallow: /s/*/api/\nDisallow: /s/*/account\nDisallow: /s/*/checkout\nDisallow: /s/*/success\nDisallow: /*preview=1\nSitemap: ${origin(req)}/sitemap.xml\n`,
      ),
  );
}
