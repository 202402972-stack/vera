import { tenantId, tenantSQL } from "./tenant.js";
import { DatabaseSync } from "node:sqlite";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import path from "node:path";
import { dataDir, orderObject } from "./db.js";
let running = 0;
const headers = [
  "Order",
  "Created",
  "Status",
  "Customer",
  "Phone",
  "Email",
  "Address",
  "City",
  "Region",
  "Postal code",
  "Country",
  "Map",
  "Notes",
  "Items",
  "Currency",
  "Subtotal",
  "Delivery",
  "Total",
  "Telegram",
  "Discount code",
  "Discount",
  "Tax",
  "Carrier",
  "Tracking number",
  "Tracking URL",
];
const arabicHeaders = [
  "الطلب",
  "التاريخ",
  "الحالة",
  "العميل",
  "الهاتف",
  "البريد الإلكتروني",
  "العنوان",
  "المدينة",
  "المنطقة",
  "الرمز البريدي",
  "الدولة",
  "الخريطة",
  "الملاحظات",
  "المنتجات",
  "العملة",
  "المجموع الفرعي",
  "التوصيل",
  "الإجمالي",
  "تيليغرام",
  "كود الخصم",
  "الخصم",
  "الضريبة",
  "شركة الشحن",
  "رقم التتبع",
  "رابط التتبع",
];
const cell = (value) =>
  '"' +
  String(value ?? "")
    .replace(/^[\u0000-\u0020]*[=+@-]/, (match) => "'" + match)
    .replaceAll('"', '""') +
  '"';
function* rows(connection, sql, map = (x) => x) {
  let comma = false;
  for (const row of connection.prepare(sql).iterate()) {
    if (comma) yield ",";
    yield JSON.stringify(map(row));
    comma = true;
  }
}
function* jsonExport(connection) {
  const store = JSON.parse(
    connection.prepare("SELECT value FROM settings WHERE key='store'").get()
      .value,
  );
  yield '{"format":"alpaca-store-v1","exported_at":' +
    JSON.stringify(new Date().toISOString()) +
    ',"store":' +
    JSON.stringify(store) +
    ',"collections":' +
    (connection
      .prepare("SELECT value FROM settings WHERE key='collections'")
      .get()?.value || "[]") +
    ',"products":[';
  yield* rows(
    connection,
    "SELECT data,version FROM products ORDER BY position,id",
    (row) => ({ ...JSON.parse(row.data), _version: row.version }),
  );
  yield '],"orders":[';
  yield* rows(connection, "SELECT * FROM orders ORDER BY id", orderObject);
  yield '],"discounts":[';
  yield* rows(connection, "SELECT * FROM discounts ORDER BY code", (row) => ({
    ...JSON.parse(row.data),
    used: row.used,
    _version: row.version,
  }));
  yield '],"order_history":[';
  yield* rows(connection, "SELECT * FROM order_history ORDER BY id");
  yield '],"analytics":{"visits":[';
  yield* rows(connection, "SELECT * FROM visits");
  yield '],"events":[';
  yield* rows(connection, "SELECT * FROM events");
  yield "]}}";
}
function* csvExport(connection, arabic) {
  yield "\ufeff" +
    (arabic ? arabicHeaders : headers).map(cell).join(",") +
    "\r\n";
  for (const row of connection
    .prepare("SELECT * FROM orders ORDER BY id DESC")
    .iterate()) {
    const o = orderObject(row),
      c = o.customer;
    yield [
      o.number,
      o.created_at,
      o.status,
      c.name,
      c.phone,
      c.email,
      c.address,
      c.city,
      c.region,
      c.postalCode,
      c.country,
      c.location,
      c.notes,
      o.items
        .map((i) => `${i.title} (${i.variant_title}) x${i.quantity}`)
        .join("; "),
      o.currency,
      o.subtotal_in_cents / 100,
      o.shipping_in_cents / 100,
      o.total_in_cents / 100,
      o.telegram_status,
      o.coupon_code || "",
      (o.discount_in_cents || 0) / 100,
      (o.tax_in_cents || 0) / 100,
      o.tracking?.carrier || "",
      o.tracking?.number || "",
      o.tracking?.url || "",
    ]
      .map(cell)
      .join(",") + "\r\n";
  }
}
// A separate read transaction gives a consistent export without holding all history
// in memory or blocking the application's WAL writer while a download is slow.
export const exportData = (csv) => async (req, res, next) => {
  if (running >= 2)
    return res
      .status(429)
      .json({ error: "An export is already running. Try again shortly." });
  let connection;
  running++;
  try {
    const namespace = tenantId();
    const rawConnection = new DatabaseSync(path.join(dataDir, "store.sqlite"), {
      readOnly: true,
    });
    connection = {
      prepare: (sql) => rawConnection.prepare(tenantSQL(sql, namespace)),
      exec: (sql) => rawConnection.exec(sql),
      close: () => rawConnection.close(),
    };
    connection.exec("PRAGMA busy_timeout=5000; BEGIN");
    res
      .set(
        "Content-Disposition",
        `attachment; filename="${csv ? "orders.csv" : "store-backup.json"}"`,
      )
      .type(csv ? "text/csv" : "application/json");
    const iterator = csv
      ? csvExport(connection, req.query.lang === "ar")
      : jsonExport(connection);
    await pipeline(Readable.from(iterator, { objectMode: false }), res);
  } catch (error) {
    if (!res.headersSent && !res.destroyed) next(error);
  } finally {
    if (connection) {
      try {
        connection.exec("ROLLBACK");
      } finally {
        connection.close();
      }
    }
    running--;
  }
};
