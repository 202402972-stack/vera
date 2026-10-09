import { statfs } from "node:fs/promises";
import { dataDir } from "../db.js";
import { sql, publicStore, audit } from "./core.js";
import { requireOwner } from "./auth.js";
import { readiness } from "./onboarding.js";
import { jobReport } from "../imports/jobs.js";
const pageOf = (q) => Math.max(0, Math.min(10000, Math.floor(Number(q) || 0)));
const merchantActivity =
  "(SELECT max(at) FROM (SELECT at FROM platform_audit WHERE actor=u.id UNION ALL SELECT at FROM platform_funnel_events WHERE owner_id=u.id))";
function merchantFilter(query) {
  const q = "%" + String(query.q || "").slice(0, 100) + "%",
    since = Number(query.since) || 0;
  const activity = merchantActivity;
  let where = "WHERE (u.name LIKE ? OR u.email LIKE ?) AND u.created>=?",
    args = [q, q, since];
  if (query.until) {
    where += " AND u.created<=?";
    args.push(Number(query.until) || Date.now());
  }
  if (query.activity === "active") {
    where += " AND " + activity + ">=?";
    args.push(Date.now() - 30 * 86400000);
  } else if (query.activity === "inactive") {
    where += " AND " + activity + "<?";
    args.push(Date.now() - 30 * 86400000);
  } else if (query.activity === "unknown")
    where += " AND " + activity + " IS NULL";
  return { where, args };
}
export function registerOwner(app) {
  app.get("/api/platform/owner/overview", requireOwner, (_req, res) => {
    const since = Date.now() - 7 * 86400000;
    const live = sql(
      "SELECT count(*) n FROM platform_stores WHERE publication_state='published' AND paused=0 AND suspended=0 AND max(trial_until,access_until)>?",
    ).get(Date.now()).n;
    const eventCounts = sql(
      "SELECT action,count(*) n FROM platform_funnel_events WHERE at>=? GROUP BY action",
    ).all(since);
    const cohort = sql(
      "SELECT owner_id,min(at) started FROM platform_funnel_events WHERE action='draft_created' GROUP BY owner_id HAVING started>=?",
    ).all(since);
    const completed = cohort.filter((c) => {
      const row = sql(
        "SELECT min(at) published FROM platform_funnel_events WHERE owner_id=? AND action='store_published'",
      ).get(c.owner_id);
      return (
        row.published &&
        row.published >= c.started &&
        row.published <= c.started + 7 * 86400000
      );
    }).length;
    const bottlenecks = {};
    for (const s of sql(
      "SELECT * FROM platform_stores WHERE publication_state='draft'",
    ).all())
      for (const c of readiness(s).checks.filter((c) => !c.ready))
        bottlenecks[c.id] = (bottlenecks[c.id] || 0) + 1;
    const selected = sql(
        "SELECT count(*) n FROM platform_import_items WHERE selected=1",
      ).get().n,
      imported = sql(
        "SELECT count(*) n FROM platform_import_items WHERE selected=1 AND state='imported'",
      ).get().n;
    const revenue = sql(
      "SELECT currency,sum(amount) amount FROM platform_paymob_payments WHERE status='paid' GROUP BY currency",
    ).all();
    res.json({
      since,
      until: Date.now(),
      cohort: {
        since,
        until: Date.now(),
        windowDays: 7,
        owners: cohort.length,
        completed,
        ratio: cohort.length ? completed / cohort.length : null,
        ongoing: true,
      },
      importSuccess: {
        selected,
        imported,
        ratio: selected ? imported / selected : null,
      },
      bottlenecks,
      weeklyGrowth: {
        current: sql(
          "SELECT count(*) n FROM platform_users WHERE created>=?",
        ).get(since).n,
        previous: sql(
          "SELECT count(*) n FROM platform_users WHERE created>=? AND created<?",
        ).get(since - 7 * 86400000, since).n,
      },
      counts: {
        newAccounts: sql(
          "SELECT count(*) n FROM platform_users WHERE created>=?",
        ).get(since).n,
        liveStores: live,
        drafts: sql(
          "SELECT count(*) n FROM platform_stores WHERE publication_state='draft'",
        ).get().n,
        activeSubscriptions: sql(
          "SELECT count(*) n FROM platform_stores WHERE billing_status='active' AND access_until>?",
        ).get(Date.now()).n,
        failedSubscriptions: sql(
          "SELECT count(*) n FROM platform_stores WHERE billing_status IN ('failed','past_due','unpaid','incomplete')",
        ).get().n,
        importsNeedingReview: sql(
          "SELECT count(*) n FROM platform_import_jobs WHERE state IN ('failed','partial','awaiting_review')",
        ).get().n,
      },
      events: eventCounts,
      revenue,
      definitions: {
        liveStores: "Published, not paused/suspended, with valid entitlement",
        revenue:
          "Confirmed Paymob payments; currencies separate, refunded transactions excluded",
        events: "Recorded events since this release; no invented history",
        MRR: null,
      },
    });
  });
  app.get("/api/platform/owner/merchants", requireOwner, (req, res) => {
    const page = pageOf(req.query.page),
      { where, args } = merchantFilter(req.query),
      activity = merchantActivity;
    res.json({
      page,
      total: sql("SELECT count(*) n FROM platform_users u " + where).get(
        ...args,
      ).n,
      items: sql(
        "SELECT u.id,u.name,u.email,u.created," +
          activity +
          " lastActivity,(SELECT count(*) FROM platform_stores WHERE owner_id=u.id) stores FROM platform_users u " +
          where +
          " ORDER BY u.id DESC LIMIT 25 OFFSET ?",
      ).all(...args, page * 25),
    });
  });
  app.get(
    "/api/platform/owner/merchants/:merchantId",
    requireOwner,
    (req, res) => {
      const user = sql(
        "SELECT id,name,email,created FROM platform_users WHERE id=?",
      ).get(Number(req.params.merchantId));
      if (!user) return res.status(404).json({ error: "Merchant not found." });
      res.json({
        user,
        contactStatus: "No outbound contact history is recorded",
        subscriptions: sql(
          "SELECT slug,billing_status,access_until,billing_plan_snapshot FROM platform_stores WHERE owner_id=? AND subscription IS NOT NULL",
        ).all(user.id),
        events: sql(
          "SELECT action,at,store_id FROM platform_funnel_events WHERE owner_id=? ORDER BY id DESC LIMIT 100",
        ).all(user.id),
        stores: sql("SELECT * FROM platform_stores WHERE owner_id=?")
          .all(user.id)
          .map(publicStore),
        activity: sql(
          "SELECT * FROM platform_audit WHERE actor=? ORDER BY id DESC LIMIT 100",
        ).all(user.id),
      });
    },
  );
  app.get("/api/platform/owner/stores", requireOwner, (req, res) => {
    const page = pageOf(req.query.page),
      where = ["(s.name LIKE ? OR s.slug LIKE ? OR u.email LIKE ?)"],
      q = "%" + String(req.query.q || "").slice(0, 100) + "%",
      args = [q, q, q];
    for (const [query, column, values] of [
      ["template", "template", ["gala", "form", "atelier"]],
      ["publication", "publication_state", ["draft", "published"]],
      [
        "billing",
        "billing_status",
        [
          "active",
          "trial",
          "trialing",
          "failed",
          "past_due",
          "unpaid",
          "canceled",
          "paid",
        ],
      ],
    ])
      if (values.includes(req.query[query])) {
        where.push("s." + column + "=?");
        args.push(req.query[query]);
      }
    if (["0", "1"].includes(req.query.suspended)) {
      where.push("s.suspended=?");
      args.push(Number(req.query.suspended));
    }
    if (req.query.since) {
      where.push("s.created>=?");
      args.push(Number(req.query.since) || 0);
    }
    if (req.query.until) {
      where.push("s.created<=?");
      args.push(Number(req.query.until) || Date.now());
    }
    const from =
      " FROM platform_stores s JOIN platform_users u ON u.id=s.owner_id WHERE " +
      where.join(" AND ");
    res.json({
      page,
      total: sql("SELECT count(*) n" + from).get(...args).n,
      items: sql(
        "SELECT s.*,u.email" + from + " ORDER BY s.id DESC LIMIT 25 OFFSET ?",
      )
        .all(...args, page * 25)
        .map((s) => ({
          ...publicStore(s),
          email: s.email,
          readiness: readiness(s),
          history: sql(
            "SELECT action,at FROM platform_audit WHERE store_id=? AND action IN ('store.created','store.published','store.paused','store.resumed','store.suspended','store.restored') ORDER BY id DESC LIMIT 10",
          ).all(s.id),
        })),
    });
  });
  app.get("/api/platform/owner/activity", requireOwner, (req, res) => {
    const page = pageOf(req.query.page),
      q = "%" + String(req.query.q || "").slice(0, 100) + "%",
      since = Number(req.query.since) || 0;
    const args = [q, q, since],
      filters = ["(a.action LIKE ? OR u.email LIKE ?)", "a.at>=?"];
    for (const [key, col] of [
      ["actor", "actor"],
      ["store", "store_id"],
      ["action", "action"],
    ])
      if (req.query[key]) {
        filters.push("a." + col + "=?");
        args.push(
          key === "action"
            ? String(req.query[key]).slice(0, 100)
            : Number(req.query[key]),
        );
      }
    if (req.query.until) {
      filters.push("a.at<=?");
      args.push(Number(req.query.until) || Date.now());
    }
    const from =
      " FROM platform_audit a LEFT JOIN platform_users u ON u.id=a.actor WHERE " +
      filters.join(" AND ");
    res.json({
      page,
      total: sql("SELECT count(*) n" + from).get(...args).n,
      items: sql(
        "SELECT a.*,u.email" + from + " ORDER BY a.id DESC LIMIT 25 OFFSET ?",
      ).all(...args, page * 25),
    });
  });
  app.get("/api/platform/owner/imports", requireOwner, async (req, res) => {
    const page = pageOf(req.query.page),
      conditions = [
        "(j.source_type LIKE ? OR j.source_url LIKE ? OR u.email LIKE ?)",
      ],
      q = "%" + String(req.query.q || "").slice(0, 100) + "%",
      args = [q, q, q];
    if (req.query.state) {
      conditions.push("j.state=?");
      args.push(String(req.query.state).slice(0, 40));
    }
    if (req.query.since) {
      conditions.push("j.created>=?");
      args.push(Number(req.query.since) || 0);
    }
    if (req.query.until) {
      conditions.push("j.created<=?");
      args.push(Number(req.query.until) || Date.now());
    }
    const from =
        " FROM platform_import_jobs j JOIN platform_users u ON u.id=j.owner_id WHERE " +
        conditions.join(" AND "),
      disk = await statfs(dataDir);
    res.json({
      page,
      total: sql("SELECT count(*) n" + from).get(...args).n,
      metrics: {
        active: sql(
          "SELECT count(*) n FROM platform_import_jobs WHERE state IN ('queued','detecting','scanning','importing')",
        ).get().n,
        oldestActive: sql(
          "SELECT min(updated) at FROM platform_import_jobs WHERE state IN ('queued','detecting','scanning','importing')",
        ).get().at,
        freeBytes: disk.bavail * disk.bsize,
        totalBytes: disk.blocks * disk.bsize,
      },
      items: sql(
        "SELECT j.*,u.email" +
          from +
          " ORDER BY j.created DESC LIMIT 25 OFFSET ?",
      )
        .all(...args, page * 25)
        .map((j) => ({
          ...jobReport(j),
          ownerId: j.owner_id,
          email: j.email,
          durationMs: j.updated - j.created,
        })),
    });
  });
  app.get("/api/platform/owner/subscriptions", requireOwner, (req, res) => {
    const page = pageOf(req.query.page),
      q = "%" + String(req.query.q || "").slice(0, 100) + "%",
      args = [q, q],
      filters = [
        "s.subscription IS NOT NULL",
        "(s.name LIKE ? OR u.email LIKE ?)",
      ];
    if (req.query.status) {
      filters.push("s.billing_status=?");
      args.push(String(req.query.status).slice(0, 40));
    }
    const from =
      " FROM platform_stores s JOIN platform_users u ON u.id=s.owner_id WHERE " +
      filters.join(" AND ");
    res.json({
      page,
      total: sql("SELECT count(*) n" + from).get(...args).n,
      items: sql(
        "SELECT s.*,u.email" + from + " ORDER BY s.id DESC LIMIT 25 OFFSET ?",
      )
        .all(...args, page * 25)
        .map((s) => {
          const plan = JSON.parse(s.billing_plan_snapshot || "null");
          return {
            id: s.id,
            store: s.name,
            email: s.email,
            status: s.billing_status,
            provider: plan?.provider || null,
            amount: plan?.amount_minor ?? null,
            currency: plan?.currency || null,
            plan: plan?.id || null,
            until: s.access_until,
            created: s.created,
            payments: sql(
              "SELECT id,amount,currency,status,created FROM platform_paymob_payments WHERE store_id=? ORDER BY created DESC LIMIT 10",
            ).all(s.id),
          };
        }),
    });
  });
  app.post(
    "/api/platform/owner/imports/:jobId/retry",
    requireOwner,
    (req, res) => {
      const job = sql("SELECT * FROM platform_import_jobs WHERE id=?").get(
        req.params.jobId,
      );
      if (!job) return res.status(404).json({ error: "Import not found." });
      if (!["partial", "failed"].includes(job.state))
        return res
          .status(409)
          .json({ error: "Only failed imports can be retried." });
      if (
        typeof req.body.reason !== "string" ||
        req.body.reason.trim().length < 3 ||
        req.body.reason.length > 500
      )
        return res
          .status(400)
          .json({ error: "A reason of 3–500 characters is required." });
      if (
        job.target_store_id &&
        sql("SELECT suspended FROM platform_stores WHERE id=?").get(
          job.target_store_id,
        )?.suspended
      )
        return res.status(409).json({ error: "Store is suspended." });
      sql(
        "UPDATE platform_import_items SET state='review' WHERE job_id=? AND state='failed'",
      ).run(job.id);
      sql(
        "UPDATE platform_import_jobs SET state=?,attempts=0,lease=0,error=NULL,updated=? WHERE id=?",
      ).run(job.target_store_id ? "importing" : "queued", Date.now(), job.id);
      audit(
        req.user.id,
        "owner.import_retried",
        job.target_store_id,
        JSON.stringify({ jobId: job.id, reason: req.body.reason.trim() }),
      );
      res.json({ ok: true });
    },
  );
  app.get("/api/platform/owner/merchants-export", requireOwner, (req, res) => {
    const { where, args } = merchantFilter(req.query),
      rows = sql(
        "SELECT u.name,u.email,u.created FROM platform_users u " +
          where +
          " ORDER BY u.id DESC LIMIT 1000",
      ).all(...args);
    const cell = (v) =>
      '"' +
      String(v)
        .replace(/^[=+@\-\t\r]/, "'$&")
        .replaceAll('"', '""') +
      '"';
    audit(
      req.user.id,
      "owner.merchants_exported",
      null,
      JSON.stringify({ count: rows.length }),
    );
    res
      .type("text/csv")
      .set("Content-Disposition", 'attachment; filename="merchants.csv"')
      .send(
        "\uFEFFname,email,created\n" +
          rows
            .map((r) =>
              [r.name, r.email, new Date(r.created).toISOString()]
                .map(cell)
                .join(","),
            )
            .join("\n"),
      );
  });
}
