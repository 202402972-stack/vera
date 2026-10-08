import { tenantId } from "./tenant.js";
import { randomUUID } from "node:crypto";
import { stmt, transaction } from "./db.js";
import { HttpError } from "./validation.js";
const types = new Set([
  "page_view",
  "page_exit",
  "heartbeat",
  "click",
  "add_to_cart",
  "remove_from_cart",
  "checkout_start",
  "checkout_error",
  "order_created",
  "scroll",
]);
const cut = (v, max = 200) => String(v || "").slice(0, max);
const identifier = (value) =>
  typeof value === "string" && /^[a-zA-Z0-9-]{16,64}$/.test(value);
export function recordAnalytics(body, req) {
  if (req.headers.dnt === "1" || req.headers["sec-gpc"] === "1") return;
  if (!body || !identifier(body.session) || !identifier(body.visitor))
    throw new HttpError("Invalid analytics session.");
  if (!Array.isArray(body.events) || body.events.length > 25)
    throw new HttpError("Invalid events.");
  const now = Date.now(),
    ua = req.headers["user-agent"] || "";
  const device = /tablet|ipad/i.test(ua)
    ? "Tablet"
    : /mobile|iphone|android/i.test(ua)
      ? "Mobile"
      : "Desktop";
  const browser = /edg/i.test(ua)
    ? "Edge"
    : /firefox/i.test(ua)
      ? "Firefox"
      : /chrome/i.test(ua)
        ? "Chrome"
        : /safari/i.test(ua)
          ? "Safari"
          : "Other";
  let referrer = "Direct";
  try {
    referrer = new URL(body.referrer).hostname;
  } catch {}
  const rawCountry =
    req.headers["cf-ipcountry"] || req.headers["x-vercel-ip-country"];
  const country = /^[A-Z]{2}$/.test(rawCountry || "") ? rawCountry : "Unknown";
  const events = body.events.filter(
    (e) =>
      e &&
      types.has(e.type) &&
      typeof e.path === "string" &&
      e.path.startsWith("/") &&
      !e.path.startsWith("/admin"),
  );
  if (!events.length) return;
  const duration = Math.min(Math.max(Number(body.duration) || 0, 0), 86400000);
  transaction(() => {
    const existing = stmt("SELECT visitor,last_at FROM visits WHERE id=?").get(
      body.session,
    );
    if (existing && existing.visitor !== body.visitor)
      throw new HttpError("Session mismatch.");
    const first = events[0],
      firstAt = Math.max(now - 3600000, Math.min(now, Number(first.at) || now));
    stmt(
      "INSERT OR IGNORE INTO visits(id,visitor,started_at,last_at,entry,exit,referrer,device,browser,country,source,medium,campaign) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
    ).run(
      body.session,
      body.visitor,
      firstAt,
      firstAt,
      cut(first.path),
      cut(first.path),
      referrer,
      device,
      browser,
      country,
      cut(body.source, 80),
      cut(body.medium, 80),
      cut(body.campaign, 120),
    );
    let last = existing?.last_at || firstAt,
      exit = null,
      pageviews = 0,
      cart = 0,
      checkout = 0;
    for (const e of events) {
      const at = Math.max(now - 3600000, Math.min(now, Number(e.at) || now)),
        eventId = identifier(e.id) ? e.id : randomUUID();
      // Heartbeats update liveness without growing the event table every 15 seconds.
      if (e.type !== "heartbeat") {
        const inserted = stmt(
          "INSERT OR IGNORE INTO events(event_id,session,at,type,path,label,value) VALUES (?,?,?,?,?,?,?)",
        ).run(
          eventId,
          body.session,
          at,
          e.type,
          cut(e.path),
          cut(e.label, 180),
          Math.max(0, Math.min(Number(e.value) || 0, 86400000)),
        );
        if (!inserted.changes) continue;
        if (e.type === "page_view") pageviews++;
        if (e.type === "add_to_cart") cart = 1;
        if (e.type === "checkout_start") checkout = 1;
      }
      if (at >= last) {
        last = at;
        exit = cut(e.path);
      }
    }
    stmt(
      "UPDATE visits SET last_at=MAX(last_at,?),exit=CASE WHEN ? IS NOT NULL AND last_at<=? THEN ? ELSE exit END,duration=MAX(duration,?),pageviews=pageviews+?,cart=MAX(cart,?),checkout=MAX(checkout,?) WHERE id=?",
    ).run(
      last,
      exit,
      last,
      exit,
      duration,
      pageviews,
      cart,
      checkout,
      body.session,
    );
  });
  reportCache.clear();
}
export function trackedVisit(value, req) {
  if (
    req.headers.dnt === "1" ||
    req.headers["sec-gpc"] === "1" ||
    !identifier(value?.session) ||
    !identifier(value?.visitor)
  )
    return null;
  const row = stmt("SELECT id FROM visits WHERE id=? AND visitor=?").get(
    value.session,
    value.visitor,
  );
  return row?.id || null;
}
const reportCache = new Map();
export function invalidateAnalytics() {
  reportCache.clear();
}
export function analyticsReport(days = 30, page = 1) {
  const cacheKey = tenantId() + ":" + days + ":" + page;
  const cached = reportCache.get(cacheKey);
  if (cached && cached.until > Date.now()) return cached.value;
  const d = new Date(),
    since =
      days === 0
        ? 0
        : Date.UTC(
            d.getUTCFullYear(),
            d.getUTCMonth(),
            d.getUTCDate() - (days - 1),
          ),
    iso = new Date(since).toISOString();
  const visits = stmt(
    "SELECT COUNT(*) sessions,COUNT(DISTINCT visitor) visitors,COALESCE(AVG(duration),0) avg_duration FROM visits WHERE started_at>=?",
  ).get(since);
  const pageviews = stmt(
    "SELECT COUNT(*) count FROM events WHERE at>=? AND type='page_view'",
  ).get(since).count;
  const bounce = stmt(
    "SELECT COUNT(*) count FROM visits WHERE started_at>=? AND pageviews<=1 AND duration<10000",
  ).get(since).count;
  const active = stmt(
    "SELECT COUNT(DISTINCT visitor) count FROM visits WHERE last_at>=?",
  ).get(Date.now() - 300000).count;
  const returning = stmt(
    "SELECT COUNT(DISTINCT visitor) count FROM visits v WHERE started_at>=? AND EXISTS(SELECT 1 FROM visits p WHERE p.visitor=v.visitor AND p.started_at<v.started_at)",
  ).get(since).count;
  // Aggregate small numeric facts in SQLite; never deserialize every historical receipt.
  const sales = stmt(
    "SELECT json_extract(data,'$.currency') currency,MAX(json_extract(data,'$.symbol')) symbol,COUNT(*) orderCount,COALESCE(SUM(CASE WHEN status<>'cancelled' AND COALESCE(json_extract(data,'$.payment_status'),'')<>'refunded' THEN json_extract(data,'$.total_in_cents') ELSE 0 END),0) orderValue,COALESCE(SUM(CASE WHEN status<>'cancelled' AND ((COALESCE(json_extract(data,'$.payment_method'),'cod')='cod' AND status='delivered') OR (json_extract(data,'$.payment_method')='paymob' AND json_extract(data,'$.payment_status')='paid')) THEN json_extract(data,'$.total_in_cents') ELSE 0 END),0) collected FROM orders WHERE created_at>=? GROUP BY currency",
  ).all(iso);
  const breakdown = (column) =>
    stmt(
      `SELECT ${column} label,COUNT(*) count FROM visits WHERE started_at>=? GROUP BY ${column} ORDER BY count DESC LIMIT 12`,
    ).all(since);
  const grouped = (sql, ...params) => stmt(sql).all(...params);
  const pages = grouped(
    "SELECT path label,COUNT(*) count FROM events WHERE at>=? AND type='page_view' GROUP BY path ORDER BY count DESC LIMIT 15",
    since,
  );
  const actions = grouped(
    "SELECT type label,COUNT(*) count FROM events WHERE at>=? AND type NOT IN ('page_view','heartbeat','page_exit') GROUP BY type ORDER BY count DESC",
    since,
  );
  const clicks = grouped(
    "SELECT label,COUNT(*) count FROM events WHERE at>=? AND type='click' GROUP BY label ORDER BY count DESC LIMIT 12",
    since,
  );
  const chartSince =
    days === 0
      ? Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - 364)
      : since;
  const daily = grouped(
    "SELECT strftime('%Y-%m-%d',started_at/1000,'unixepoch') day,COUNT(*) sessions,COUNT(DISTINCT visitor) visitors FROM visits WHERE started_at>=? GROUP BY day ORDER BY day",
    chartSince,
  );
  const checkout = stmt(
    "SELECT COUNT(*) count FROM visits WHERE started_at>=? AND checkout=1",
  ).get(since).count;
  const cart = stmt(
    "SELECT COUNT(*) count FROM visits WHERE started_at>=? AND cart=1",
  ).get(since).count;
  const converted = stmt(
    "SELECT COUNT(*) count FROM visits v WHERE started_at>=? AND EXISTS(SELECT 1 FROM orders o WHERE o.visit_id=v.id AND o.created_at>=?)",
  ).get(since, iso).count;
  const recent = grouped(
    "SELECT * FROM visits WHERE started_at>=? ORDER BY last_at DESC LIMIT 40 OFFSET ?",
    since,
    (page - 1) * 40,
  ).map((v) => ({
    ...v,
    visitor: v.visitor.slice(0, 8),
    journey: grouped(
      "SELECT at,type,path,label FROM events WHERE session=? AND type<>'heartbeat' ORDER BY at,id LIMIT 100",
      v.id,
    ),
  }));
  const revenueByCurrency = sales.map(({ orderCount, ...r }) => r);
  const value = {
    ...visits,
    journeyPage: page,
    journeyPages: Math.max(1, Math.ceil(visits.sessions / 40)),
    pageviews,
    active,
    returning,
    revenueByCurrency,
    bounce_rate: visits.sessions
      ? Math.round((bounce / visits.sessions) * 100)
      : 0,
    orders: sales.reduce((n, s) => n + s.orderCount, 0),
    revenue: sales.length === 1 ? sales[0].orderValue : 0,
    deliveredRevenue: sales.length === 1 ? sales[0].collected : 0,
    conversion: visits.sessions
      ? +((converted / visits.sessions) * 100).toFixed(1)
      : 0,
    devices: breakdown("device"),
    browsers: breakdown("browser"),
    countries: breakdown("country"),
    referrers: breakdown("referrer"),
    sources: breakdown("source"),
    mediums: breakdown("medium"),
    campaigns: breakdown("campaign"),
    entries: breakdown("entry"),
    exits: breakdown("exit"),
    pages,
    actions,
    clicks,
    daily,
    recent,
    funnel: [
      { label: "Visits", count: visits.sessions },
      { label: "Added to cart", count: cart },
      { label: "Checkout", count: checkout },
      { label: "Ordered", count: converted },
    ],
  };
  if (reportCache.size >= 32)
    reportCache.delete(reportCache.keys().next().value);
  reportCache.set(cacheKey, { value, until: Date.now() + 10000 });
  return value;
}

export function visitTimeline(id, page = 1) {
  if (!stmt("SELECT id FROM visits WHERE id=?").get(id))
    throw new HttpError("Visit not found.", 404);
  const total = stmt("SELECT COUNT(*) count FROM events WHERE session=?").get(
    id,
  ).count;
  return {
    page,
    pages: Math.max(1, Math.ceil(total / 100)),
    total,
    events: stmt(
      "SELECT at,type,path,label FROM events WHERE session=? ORDER BY at,id LIMIT 100 OFFSET ?",
    ).all(id, (page - 1) * 100),
  };
}
