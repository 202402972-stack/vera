import dns from "node:dns/promises";
import { randomBytes } from "node:crypto";
import { domainToASCII } from "node:url";
import { rawDb } from "../db.js";
import { safeFetch } from "../imports/safe-fetch.js";
import { audit, sql } from "./core.js";

const platformHost = (() => {
  try {
    return new URL(process.env.PUBLIC_URL).hostname.toLowerCase();
  } catch {
    return "";
  }
})();
const target = (process.env.CUSTOM_DOMAIN_CNAME_TARGET || "")
  .trim()
  .toLowerCase()
  .replace(/\.$/, "");
const zone = process.env.CLOUDFLARE_ZONE_ID || "";
export const domainProviderReady = Boolean(
  target &&
  zone &&
  process.env.CLOUDFLARE_API_TOKEN &&
  (process.env.DOMAIN_PROXY_SECRET || "").length >= 32,
);
const claim = (storeId) => ({
  active: sql(
    "SELECT * FROM platform_domains WHERE store_id=? AND state='active' ORDER BY activated_at DESC LIMIT 1",
  ).get(storeId),
  pending: sql(
    "SELECT * FROM platform_domains WHERE store_id=? AND state='pending' ORDER BY created_at DESC LIMIT 1",
  ).get(storeId),
});
const safeRow = (row) =>
  row && {
    hostname: row.hostname,
    state: row.state,
    createdAt: row.created_at,
    checkedAt: row.checked_at,
    activatedAt: row.activated_at,
    txtName: `_vera-verification.${row.hostname}`,
    txtValue: `vera-site-verification=${row.verification_token}`,
    url: `https://${row.hostname}`,
  };
const state = (storeId) => {
  const rows = claim(storeId);
  return {
    configured: domainProviderReady,
    target: target || null,
    active: safeRow(rows.active),
    pending: safeRow(rows.pending),
  };
};

export function normalizeDomain(input) {
  if (typeof input !== "string" || input.length > 253)
    throw Error("Enter a valid domain name.");
  let name = input.trim().toLowerCase().replace(/\.$/, "");
  if (/^https?:\/\//.test(name)) {
    const parsed = new URL(name);
    if (
      parsed.username ||
      parsed.password ||
      parsed.port ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    )
      throw Error("Enter only the domain, without a path or port.");
    name = parsed.hostname;
  }
  const ascii = domainToASCII(name);
  const labels = ascii.split(".");
  if (
    !ascii ||
    ascii.length > 253 ||
    labels.length < 2 ||
    labels.some((x) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(x)) ||
    labels.at(-1).length < 2 ||
    /^\d+$/.test(labels.at(-1)) ||
    ascii === platformHost ||
    ascii.endsWith(`.${platformHost}`) ||
    ascii === target ||
    ascii.endsWith(`.${target}`)
  )
    throw Error("Enter a domain you own, such as shop.example.com.");
  return ascii;
}

async function cloudflare(path, method = "GET", body) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zone}/custom_hostnames${path}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(12000),
    },
  );
  const data = await response.json();
  if (!response.ok || !data.success)
    throw Error(
      data.errors?.[0]?.message ||
        "Domain certificate provider is unavailable.",
    );
  return data.result;
}
async function release(row) {
  if (!row?.provider_id) return;
  if (!domainProviderReady)
    throw Error(
      "Domain provider settings are required before disconnecting this hostname.",
    );
  await cloudflare(`/${encodeURIComponent(row.provider_id)}`, "DELETE");
}
async function dnsStatus(row) {
  const txt = await dns
    .resolveTxt(`_vera-verification.${row.hostname}`)
    .catch(() => []);
  const ownership = txt.some(
    (parts) =>
      parts.join("") === `vera-site-verification=${row.verification_token}`,
  );
  const cname = await dns.resolveCname(row.hostname).catch(() => []);
  let pointsToTarget = cname.some(
    (name) => name.toLowerCase().replace(/\.$/, "") === target,
  );
  if (!pointsToTarget && target) {
    const [host4, target4, host6, target6] = await Promise.all([
      dns.resolve4(row.hostname).catch(() => []),
      dns.resolve4(target).catch(() => []),
      dns.resolve6(row.hostname).catch(() => []),
      dns.resolve6(target).catch(() => []),
    ]);
    pointsToTarget = [...host4, ...host6].some((ip) =>
      [...target4, ...target6].includes(ip),
    );
  }
  return { ownership, pointsToTarget };
}

export function activeDomain(hostname) {
  return sql(
    "SELECT s.* FROM platform_domains d JOIN platform_stores s ON s.id=d.store_id WHERE d.hostname=? AND d.state='active'",
  ).get(hostname);
}
export function pendingDomain(hostname) {
  return sql(
    "SELECT verification_token FROM platform_domains WHERE hostname=? AND state='pending'",
  ).get(hostname);
}
export function isPlatformHost(hostname) {
  return (
    !hostname ||
    hostname === platformHost ||
    ["localhost", "127.0.0.1", "::1"].includes(hostname)
  );
}

export function registerDomains(app, requireUser, rate, owned) {
  const path = "/api/platform/stores/:id/domain";
  app.get(path, requireUser, owned, (req, res) =>
    res.json(state(req.store.id)),
  );
  app.put(path, requireUser, rate, owned, async (req, res) => {
    try {
      const hostname = normalizeDomain(req.body.hostname);
      const existing = sql(
        "SELECT * FROM platform_domains WHERE hostname=?",
      ).get(hostname);
      if (existing) {
        const reusable =
          existing.state === "retired" ||
          (existing.state === "pending" &&
            existing.created_at < Date.now() - 7 * 86400000);
        if (existing.store_id !== req.store.id && !reusable)
          return res.status(409).json({
            error: "This domain is already connected to another store.",
          });
        if (existing.store_id === req.store.id && !reusable)
          return res.json(state(req.store.id));
        await release(existing);
        sql("DELETE FROM platform_domains WHERE id=?").run(existing.id);
      }
      const old = claim(req.store.id).pending;
      if (old) await release(old);
      rawDb.exec("BEGIN IMMEDIATE");
      try {
        sql(
          "DELETE FROM platform_domains WHERE store_id=? AND state='pending'",
        ).run(req.store.id);
        sql(
          "INSERT INTO platform_domains(store_id,hostname,verification_token,created_at) VALUES(?,?,?,?)",
        ).run(
          req.store.id,
          hostname,
          randomBytes(20).toString("hex"),
          Date.now(),
        );
        audit(req.user.id, "domain.claimed", req.store.id, hostname);
        rawDb.exec("COMMIT");
      } catch (error) {
        rawDb.exec("ROLLBACK");
        throw error;
      }
      res.status(201).json(state(req.store.id));
    } catch (error) {
      res
        .status(error.message.includes("UNIQUE") ? 409 : 400)
        .json({ error: error.message });
    }
  });
  app.post(`${path}/check`, requireUser, rate, owned, async (req, res) => {
    const row = claim(req.store.id).pending;
    if (!row)
      return res
        .status(404)
        .json({ error: "No domain is awaiting connection." });
    try {
      const checks = await dnsStatus(row);
      sql("UPDATE platform_domains SET checked_at=? WHERE id=?").run(
        Date.now(),
        row.id,
      );
      if (!checks.ownership || !domainProviderReady)
        return res.json({ ...state(req.store.id), checks });
      let providerId = row.provider_id;
      if (!providerId) {
        const created = await cloudflare("", "POST", {
          hostname: row.hostname,
          ssl: {
            method: "http",
            type: "dv",
            settings: { min_tls_version: "1.2" },
          },
        });
        providerId = created.id;
        sql(
          "UPDATE platform_domains SET provider_id=? WHERE id=? AND state='pending'",
        ).run(providerId, row.id);
      }
      const provisioned = await cloudflare(
        `/${encodeURIComponent(providerId)}`,
      );
      const providerRecords = [];
      const ownershipRecord = provisioned.ownership_verification;
      if (
        ownershipRecord?.type === "txt" &&
        ownershipRecord.name &&
        ownershipRecord.value
      )
        providerRecords.push({
          name: ownershipRecord.name,
          value: ownershipRecord.value,
        });
      for (const record of provisioned.ssl?.validation_records || [])
        if (record.txt_name && record.txt_value)
          providerRecords.push({
            name: record.txt_name,
            value: record.txt_value,
          });
      const certificateReady =
        provisioned.status === "active" && provisioned.ssl?.status === "active";
      let routingReady = false;
      if (checks.pointsToTarget && certificateReady) {
        const challengeUrl = `https://${row.hostname}/.well-known/vera-domain-check`;
        try {
          const reached = await safeFetch(challengeUrl, {
            maxBytes: 200,
            types: ["text/plain"],
          });
          routingReady =
            reached.url === challengeUrl &&
            reached.buffer.toString() === row.verification_token;
        } catch {
          /* Wait until the edge route is reachable. */
        }
      }
      if (checks.pointsToTarget && certificateReady && routingReady) {
        const old = claim(req.store.id).active;
        rawDb.exec("BEGIN IMMEDIATE");
        try {
          sql(
            "UPDATE platform_domains SET state='retired' WHERE store_id=? AND state='active'",
          ).run(req.store.id);
          sql(
            "UPDATE platform_domains SET state='active',activated_at=? WHERE id=? AND state='pending'",
          ).run(Date.now(), row.id);
          audit(req.user.id, "domain.activated", req.store.id, row.hostname);
          rawDb.exec("COMMIT");
        } catch (error) {
          rawDb.exec("ROLLBACK");
          throw error;
        }
        if (old) {
          try {
            await release(old);
            sql("DELETE FROM platform_domains WHERE id=?").run(old.id);
          } catch {
            console.error("Old custom domain needs provider cleanup");
          }
        }
      }
      res.json({
        ...state(req.store.id),
        checks: { ...checks, certificateReady, routingReady, providerRecords },
      });
    } catch (error) {
      res
        .status(503)
        .json({ error: error.message || "Domain check failed. Try again." });
    }
  });
  app.delete(path, requireUser, rate, owned, async (req, res) => {
    const hostname = req.body.hostname;
    const row = sql(
      "SELECT * FROM platform_domains WHERE store_id=? AND hostname=? AND state IN ('pending','active')",
    ).get(req.store.id, hostname);
    if (!row) return res.status(404).json({ error: "Domain not found." });
    try {
      await release(row);
      sql("DELETE FROM platform_domains WHERE id=?").run(row.id);
      audit(req.user.id, "domain.disconnected", req.store.id, row.hostname);
      res.json(state(req.store.id));
    } catch (error) {
      res.status(503).json({ error: error.message });
    }
  });
}
