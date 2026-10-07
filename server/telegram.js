import { tenantId } from "./tenant.js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import {
  db,
  stmt,
  transaction,
  dataDir,
  getSetting,
  setSetting,
  decrypt,
  orderObject,
} from "./db.js";

const escape = (value) =>
  String(value ?? "").replace(
    /[&<>]/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char],
  );
const ltr = (value, order) =>
  order.language === "ar" ? "\u2066" + String(value) + "\u2069" : String(value);
const price = (cents, order) =>
  ltr(`${order.symbol}${(cents / 100).toFixed(2)} ${order.currency}`, order);
const labels = {
  en: {
    placed: "Placed",
    payment: "Payment: Cash on delivery",
    products: "PRODUCTS",
    unit: "Unit",
    line: "Line",
    subtotal: "Subtotal",
    discount: "Discount",
    tax: "Tax",
    delivery: "Delivery",
    total: "TOTAL",
    customer: "CUSTOMER & DELIVERY",
    name: "Name",
    phone: "Phone",
    email: "Email",
    address: "Address",
    map: "Map",
    notes: "Notes",
    instructions: "Delivery instructions",
    details: "Complete order details and product photos are in this image.",
  },
  ar: {
    placed: "تاريخ الطلب",
    payment: "الدفع: نقداً عند الاستلام",
    products: "المنتجات",
    unit: "سعر الوحدة",
    line: "المجموع",
    subtotal: "مجموع المنتجات",
    discount: "الخصم",
    tax: "الضريبة",
    delivery: "التوصيل",
    total: "الإجمالي",
    customer: "العميل وعنوان التوصيل",
    name: "الاسم",
    phone: "الهاتف",
    email: "البريد الإلكتروني",
    address: "العنوان",
    map: "الموقع",
    notes: "ملاحظات",
    instructions: "تعليمات التوصيل",
    details: "تفاصيل الطلب كاملة وصور المنتجات داخل هذه الصورة.",
  },
};
export function telegramConfig() {
  const value = getSetting("telegram", {});
  try {
    return { token: decrypt(value.token), chatId: value.chatId || "" };
  } catch {
    return {
      token: "",
      chatId: value.chatId || "",
      credentialsError:
        "Stored Telegram credentials could not be opened. Re-enter the bot token.",
    };
  }
}
async function imageBytes(url) {
  try {
    if (url?.startsWith("data:image/svg+xml;utf8,"))
      return Buffer.from(decodeURIComponent(url.slice(url.indexOf(",") + 1)));
    if (/^\/uploads\/[a-f0-9-]+\.webp$/.test(url))
      return await readFile(path.join(dataDir, url));
    if (/^\/assets\/[a-zA-Z0-9_.-]+$/.test(url))
      return await readFile(path.join(process.cwd(), "public", url));
  } catch {}
  return Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="300"><rect width="240" height="300" fill="#c9b9a3"/></svg>',
  );
}
export function orderText(order, html = false) {
  const clean = html ? escape : (v) => String(v ?? "");
  const c = order.customer;
  const l = labels[order.language === "ar" ? "ar" : "en"];
  return [
    `${clean(order.storeName)} · ${clean(order.number)}`,
    `${l.placed}: ${clean(ltr(order.created_at, order))}`,
    l.payment,
    "",
    l.products,
    ...order.items.flatMap((item) => [
      `${clean(item.title)} · ${clean(item.variant_title)} × ${item.quantity}`,
      `${l.unit}: ${clean(price(item.price_in_cents, order))} · ${l.line}: ${clean(price(item.total_in_cents, order))}`,
      `${item.product_id} / ${item.variant_id}`,
    ]),
    "",
    `${l.subtotal}: ${clean(price(order.subtotal_in_cents, order))}`,
    ...(order.discount_in_cents
      ? [
          `${l.discount} (${clean(order.coupon_code)}): −${clean(price(order.discount_in_cents, order))}`,
        ]
      : []),
    ...(order.tax_in_cents
      ? [`${l.tax}: ${clean(price(order.tax_in_cents, order))}`]
      : []),
    `${l.delivery}: ${clean(price(order.shipping_in_cents, order))}`,
    `${l.total}: ${clean(price(order.total_in_cents, order))}`,
    "",
    l.customer,
    `${l.name}: ${clean(c.name)}`,
    `${l.phone}: ${clean(ltr(c.phone, order))}`,
    c.email && `${l.email}: ${clean(ltr(c.email, order))}`,
    `${l.address}: ${clean(c.address)}`,
    [c.city, c.region, c.postalCode, c.country]
      .filter(Boolean)
      .map(clean)
      .join(", "),
    c.location && `${l.map}: ${clean(ltr(c.location, order))}`,
    c.notes && `${l.notes}: ${clean(c.notes)}`,
    order.delivery_note && `${l.instructions}: ${clean(order.delivery_note)}`,
  ]
    .filter((v) => v !== false && v !== undefined && v !== null)
    .join("\n");
}
async function collage(order) {
  const columns = Math.min(3, order.items.length),
    width = columns * 240,
    cells = [];
  for (let index = 0; index < order.items.length; index++) {
    let buffer;
    try {
      buffer = await sharp(await imageBytes(order.items[index].image))
        .resize(240, 300, { fit: "cover" })
        .jpeg()
        .toBuffer();
    } catch {
      buffer = await sharp({
        create: { width: 240, height: 300, channels: 3, background: "#c9b9a3" },
      })
        .jpeg()
        .toBuffer();
    }
    cells.push({
      input: buffer,
      left: (index % columns) * 240,
      top: Math.floor(index / columns) * 300,
    });
  }
  return sharp({
    create: {
      width,
      height: Math.ceil(cells.length / columns) * 300,
      channels: 3,
      background: "#f6f2eb",
    },
  })
    .composite(cells)
    .jpeg({ quality: 85 })
    .toBuffer();
}
let fontsReady = false;
function registerFonts() {
  if (fontsReady) return;
  for (const [file, name] of [
    ["font-6.ttf", "Store Body"],
    ["font-3.ttf", "Store Heading"],
    ["arabic-body.ttf", "Arabic Body"],
    ["arabic-heading.ttf", "Arabic Heading"],
  ]) {
    GlobalFonts.registerFromPath(
      path.join(process.cwd(), "public/assets", file),
      name,
    );
  }
  fontsReady = true;
}
// Arabic is shaped by Skia/HarfBuzz using the same locally bundled fonts as the site.
export async function receiptImage(order) {
  registerFonts();
  const ar = order.language === "ar",
    l = labels[ar ? "ar" : "en"],
    width = 900,
    pad = 38,
    body = ar ? "Arabic Body" : "Store Body",
    heading = ar ? "Arabic Heading" : "Store Heading";
  const measure = createCanvas(width, 100);
  const m = measure.getContext("2d");
  m.font = `22px "${body}"`;
  function wrap(text, maxWidth) {
    const lines = [];
    for (const paragraph of String(text || "").split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/)) {
        if (m.measureText(word).width > maxWidth) {
          if (line) {
            lines.push(line);
            line = "";
          }
          let chunk = "";
          for (const char of word) {
            if (m.measureText(chunk + char).width > maxWidth) {
              lines.push(chunk);
              chunk = "";
            }
            chunk += char;
          }
          line = chunk;
          continue;
        }
        const candidate = line ? `${line} ${word}` : word;
        if (m.measureText(candidate).width > maxWidth && line) {
          lines.push(line);
          line = word;
        } else line = candidate;
      }
      lines.push(line);
    }
    return lines;
  }
  const rows = order.items.map((item) => ({
    item,
    lines: wrap(
      `${item.title}\n${item.variant_title} × ${item.quantity}\n${l.unit}: ${price(item.price_in_cents, order)} · ${l.line}: ${price(item.total_in_cents, order)}\n${item.product_id} / ${item.variant_id}`,
      width - 2 * pad - 170,
    ),
  }));
  const c = order.customer;
  const details = [
    `${l.name}: ${c.name}`,
    `${l.phone}: ${ltr(c.phone, order)}`,
    c.email && `${l.email}: ${ltr(c.email, order)}`,
    `${l.address}: ${c.address}`,
    [c.city, c.region, c.postalCode, c.country].filter(Boolean).join(", "),
    c.location && `${l.map}: ${ltr(c.location, order)}`,
    c.notes && `${l.notes}: ${c.notes}`,
    order.delivery_note && `${l.instructions}: ${order.delivery_note}`,
  ]
    .filter(Boolean)
    .flatMap((text) => wrap(text, width - 2 * pad));
  m.font = `32px "${heading}"`;
  const headerLines = wrap(
    `${order.storeName} · ${order.number}`,
    width - 2 * pad,
  );
  m.font = `22px "${body}"`;
  const rowHeights = rows.map((row) =>
    Math.max(165, row.lines.length * 34 + 30),
  );
  const height =
    180 +
    headerLines.length * 40 +
    rowHeights.reduce((a, b) => a + b, 0) +
    details.length * 34 +
    (order.discount_in_cents ? 34 : 0) +
    (order.tax_in_cents ? 34 : 0) +
    260;
  const canvas = createCanvas(width, height),
    ctx = canvas.getContext("2d");
  ctx.fillStyle = "#faf8f4";
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = "top";
  ctx.direction = ar ? "rtl" : "ltr";
  ctx.textAlign = ar ? "right" : "left";
  const x = ar ? width - pad : pad;
  let y = pad;
  function drawLines(lines, size = 22, family = body, color = "#363630") {
    ctx.font = `${size}px "${family}"`;
    ctx.fillStyle = color;
    for (const line of lines) {
      ctx.fillText(line, x, y);
      y += size === 32 ? 40 : 34;
    }
  }
  drawLines(headerLines, 32, heading, "#655545");
  drawLines([`${l.placed}: ${ltr(order.created_at, order)}`, l.payment], 20);
  y += 20;
  for (let i = 0; i < rows.length; i++) {
    ctx.strokeStyle = "#dfd8cc";
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(width - pad, y);
    ctx.stroke();
    y += 15;
    const start = y;
    const photo = await loadImage(
      await sharp(await imageBytes(rows[i].item.image))
        .resize(120, 150, { fit: "cover" })
        .png()
        .toBuffer()
        .catch(() =>
          sharp({
            create: {
              width: 120,
              height: 150,
              channels: 3,
              background: "#c9b9a3",
            },
          })
            .png()
            .toBuffer(),
        ),
    );
    const imageX = ar ? width - pad - 120 : pad;
    ctx.drawImage(photo, imageX, y, 120, 150);
    ctx.font = `22px "${body}"`;
    ctx.fillStyle = "#363630";
    const textX = ar ? width - pad - 150 : pad + 150;
    for (const line of rows[i].lines) {
      ctx.fillText(line, textX, y);
      y += 34;
    }
    y = start + rowHeights[i];
  }
  y += 20;
  drawLines([
    `${l.subtotal}: ${price(order.subtotal_in_cents, order)}`,
    ...(order.discount_in_cents
      ? [
          `${l.discount} (${order.coupon_code}): −${price(order.discount_in_cents, order)}`,
        ]
      : []),
    ...(order.tax_in_cents
      ? [`${l.tax}: ${price(order.tax_in_cents, order)}`]
      : []),
    `${l.delivery}: ${price(order.shipping_in_cents, order)}`,
    `${l.total}: ${price(order.total_in_cents, order)}`,
  ]);
  y += 20;
  drawLines([l.customer], 32, heading, "#655545");
  drawLines(details);
  // Telegram permits a photo's combined width + height up to 10,000 pixels.
  const extra = Math.max(0, Math.ceil(height / 19) - width),
    photoWidth = width + extra;
  let processor = sharp(canvas.toBuffer("image/png"));
  if (extra)
    processor = processor.extend({
      left: Math.floor(extra / 2),
      right: Math.ceil(extra / 2),
      background: "#faf8f4",
    });
  const targetWidth =
    height + photoWidth > 9800
      ? Math.floor((photoWidth * 9800) / (height + photoWidth))
      : photoWidth;
  let output = await processor
    .resize({ width: targetWidth, withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toBuffer();
  if (output.length > 9.5 * 1024 * 1024)
    output = await sharp(output).jpeg({ quality: 65 }).toBuffer();
  return output;
}
export class TelegramError extends Error {
  constructor(message, retryAfter = 0, permanent = false) {
    super(message);
    this.retryAfter = retryAfter;
    this.permanent = permanent;
  }
}
export async function telegramApi(method, form, config = telegramConfig()) {
  let response;
  try {
    response = await fetch(
      `https://api.telegram.org/bot${config.token}/${method}`,
      { method: "POST", body: form, signal: AbortSignal.timeout(25000) },
    );
  } catch {
    throw new TelegramError("Telegram is temporarily unreachable.");
  }
  let body;
  try {
    body = await response.json();
  } catch {
    throw new TelegramError("Telegram returned an invalid response.");
  }
  if (!response.ok || !body.ok) {
    const message = String(body.description || "Telegram delivery failed.")
      .split(config.token || "\0")
      .join("[redacted]");
    throw new TelegramError(
      message,
      Math.max(0, Number(body.parameters?.retry_after) || 0) * 1000,
      [401, 403].includes(body.error_code || response.status),
    );
  }
  return body.result;
}
const jobs = new Map();
let stopping = false;
export function deliverPending() {
  if (stopping) return Promise.resolve();
  const id = tenantId();
  if (jobs.has(id)) return jobs.get(id);
  const config = telegramConfig();
  if (!config.token || !config.chatId) return Promise.resolve();
  const running = (async () => {
    const now = Date.now();
    stmt(
      "UPDATE orders SET telegram_status='pending',telegram_lease_until=0 WHERE telegram_status='sending' AND telegram_lease_until<=?",
    ).run(now);
    const rows = stmt(
      "SELECT id FROM orders WHERE telegram_status IN ('pending','failed') AND telegram_next_attempt<=? AND telegram_attempts<8 ORDER BY id LIMIT 25",
    ).all(now);
    for (const { id } of rows) {
      if (stopping) break;
      const wait = Math.max(
        0,
        getSetting("telegram_rate_until", 0) - Date.now(),
      );
      if (wait > 30000) break;
      if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
      if (stopping) break;
      const row = transaction(() => {
        const result = stmt(
          "UPDATE orders SET telegram_status='sending',telegram_lease_until=?,telegram_attempts=telegram_attempts+1 WHERE id=? AND telegram_status IN ('pending','failed') AND telegram_attempts<8",
        ).run(Date.now() + 120000, id);
        return result.changes
          ? stmt("SELECT * FROM orders WHERE id=?").get(id)
          : null;
      });
      if (!row) continue;
      try {
        const order = orderObject(row),
          full = orderText(order, true),
          short = full.length <= 1000,
          l = labels[order.language === "ar" ? "ar" : "en"];
        const form = new FormData();
        form.set("chat_id", config.chatId);
        form.set("parse_mode", "HTML");
        form.set(
          "caption",
          short
            ? full
            : `<b>${escape(order.storeName)} · ${escape(order.number)}</b>\n${escape(order.customer.name)} · ${escape(order.customer.phone)}\n${escape(price(order.total_in_cents, order))}\n${l.payment}\n${l.details}`,
        );
        form.set(
          "photo",
          new Blob([short ? await collage(order) : await receiptImage(order)], {
            type: "image/jpeg",
          }),
          `${order.number}.jpg`,
        );
        const result = await telegramApi("sendPhoto", form, config);
        if (process.env.NODE_ENV !== "test")
          setSetting("telegram_rate_until", Date.now() + 1100);
        stmt(
          "UPDATE orders SET telegram_status='sent',telegram_error=NULL,telegram_lease_until=0,telegram_message_id=?,telegram_sent_at=? WHERE id=?",
        ).run(result.message_id || null, new Date().toISOString(), id);
      } catch (error) {
        if (error.retryAfter)
          setSetting("telegram_rate_until", Date.now() + error.retryAfter);
        const message = String(error.message)
          .split(config.token)
          .join("[redacted]")
          .slice(0, 500);
        const delay = Math.max(
          error.retryAfter || 0,
          Math.min(3600000, 30000 * 2 ** (row.telegram_attempts - 1)),
        );
        stmt(
          "UPDATE orders SET telegram_status='failed',telegram_error=?,telegram_lease_until=0,telegram_attempts=?,telegram_next_attempt=? WHERE id=?",
        ).run(
          message,
          error.permanent ? 8 : row.telegram_attempts,
          Date.now() + delay,
          id,
        );
        if (error.retryAfter || error.permanent) break;
      }
    }
  })()
    .catch((error) => {
      console.error("Telegram queue failed:", error.name);
    })
    .finally(() => {
      jobs.delete(id);
    });
  jobs.set(id, running);
  return running;
}
export async function stopDelivery() {
  stopping = true;
  await Promise.allSettled(jobs.values());
}
