import { importIssue, columnNames } from "./import-copy";
import { statusLabel } from "@/platform/PlatformUI";
import ImportItemReview from "./ImportItemReview";
import Connections from "./Connections";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { request } from "@/platform/api";
import "./workspace.css";
function ImportThumbnail({ jobId, item, index, language }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <span>{importIssue("IMAGE_PREVIEW_UNAVAILABLE", language)}</span>
  ) : (
    <img
      src={`/api/platform/import-jobs/${jobId}/images/${item.id}/${index}`}
      alt={item.data.title}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
export default function ImportWizard({ config }) {
  const { language } = useLanguage(),
    t = (ar, en) => (language === "ar" ? ar : en);
  const [jobs, setJobs] = useState([]),
    [job, setJob] = useState(null),
    [items, setItems] = useState([]),
    [page, setPage] = useState(0),
    [total, setTotal] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [csv, setCsv] = useState(""),
    [headers, setHeaders] = useState([]),
    [mapping, setMapping] = useState({}),
    [type, setType] = useState("csv"),
    [currency, setCurrency] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("job");
    if (id)
      request("/import-jobs/" + encodeURIComponent(id))
        .then(setJob)
        .catch((e) => setError(e.message));
  }, []);
  const jobId = job?.id,
    requestKey = useRef(crypto.randomUUID()),
    [connections, setConnections] = useState([]);
  const load = useCallback(
    async (signal) => {
      try {
        const r = await request("/import-jobs", "GET", undefined, { signal });
        setJobs(r.jobs);
        if (jobId) {
          const [j, i] = await Promise.all([
            request("/import-jobs/" + jobId, "GET", undefined, { signal }),
            request(
              `/import-jobs/${jobId}/items?page=${page}`,
              "GET",
              undefined,
              { signal },
            ),
          ]);
          setJob(j);
          setItems(i.items);
          setTotal(i.total);
        }
      } catch (e) {
        if (e.name !== "AbortError") setError(e.message);
      }
    },
    [jobId, page],
  );
  useEffect(() => {
    const c = new AbortController();
    let pending = false;
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try {
        await load(c.signal);
      } finally {
        pending = false;
      }
    };
    refresh();
    const timer = setInterval(refresh, 2000);
    return () => {
      clearInterval(timer);
      c.abort();
    };
  }, [load, revision]);
  const act = async (fn) => {
    setError("");
    setBusy(true);
    try {
      await fn();
      setRevision((n) => n + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  if (!config.user)
    return (
      <main className="v-workspace">
        <Link to="/login?intent=import">
          {t("سجّل الدخول للنقل", "Sign in to import")}
        </Link>
      </main>
    );
  return (
    <main className="v-workspace">
      <span className="v-eyebrow">VÉRA / IMPORT</span>
      <h1>
        {t("انقل بيانات متجرك المتاحة", "Bring your available store data")}
      </h1>
      <p>
        {t(
          "حتى ٥٠٠ منتج، ٤٠ متغيرًا لكل منتج، ١٠ ميجابايت للملف/الصورة. الرابط لا يضمن نقل كل البيانات؛ الأسعار والمخزون تحتاج مراجعتك.",
          "Up to 500 products, 40 variants per product, 10 MB per file/image. A link does not guarantee all data; review prices and inventory.",
        )}
      </p>
      <Connections onChange={setConnections} />
      {error && (
        <p className="v-alert" role="alert">
          {importIssue(error, language)}
          <button onClick={() => setRevision((n) => n + 1)}>
            {t("إعادة المحاولة", "Retry")}
          </button>
        </p>
      )}
      {!job ? (
        <>
          <form
            className="v-panel"
            onSubmit={(e) => {
              e.preventDefault();
              const form = Object.fromEntries(new FormData(e.currentTarget));
              act(async () => {
                const result = await request("/import-jobs", "POST", {
                  ...form,
                  sourceType: type,
                  csv,
                  mapping,
                  currency,
                  locale: language,
                  ownsContent: true,
                  requestKey: requestKey.current,
                });
                setJob(result);
                requestKey.current = crypto.randomUUID();
              });
            }}
          >
            <label className="v-field">
              {t("المصدر", "Source")}
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="csv">VÉRA CSV</option>
                <option value="shopify-csv">Shopify CSV</option>
                <option value="woocommerce-csv">WooCommerce CSV</option>
                <option value="shopify-url">
                  Shopify URL · {t("أفضل جهد", "Best effort")}
                </option>
                {[...new Set(connections.map((c) => c.provider))].map(
                  (provider) => (
                    <option key={provider} value={provider + "-api"}>
                      {provider} API
                    </option>
                  ),
                )}
              </select>
            </label>
            {type.endsWith("-api") ? (
              <label className="v-field">
                {t("الاتصال المصرح", "Authorized connection")}
                <select name="connectionId" required>
                  {connections
                    .filter((c) => type === c.provider + "-api")
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.domain}
                      </option>
                    ))}
                </select>
              </label>
            ) : type === "shopify-url" ? (
              <label className="v-field">
                {t("رابط المتجر العام", "Public store URL")}
                <input
                  name="sourceUrl"
                  type="url"
                  required
                  placeholder="https://your-store.com"
                />
              </label>
            ) : (
              <label className="v-field">
                CSV UTF-8
                <input
                  type="file"
                  accept=".csv,text/csv"
                  required
                  onChange={(e) =>
                    act(async () => {
                      const file = e.target.files[0];
                      if (file.size > 10 * 1024 * 1024)
                        throw Error(t("الحد ١٠ ميجابايت", "10 MB limit"));
                      const text = await file.text();
                      setCsv(text);
                      setHeaders(
                        (
                          await request("/import-csv/headers", "POST", {
                            csv: text,
                          })
                        ).headers,
                      );
                    })
                  }
                />
              </label>
            )}
            {headers.length > 0 && (
              <details>
                <summary>{t("مطابقة الأعمدة", "Column mapping")}</summary>
                <div className="v-form-grid">
                  {[
                    "id",
                    "title",
                    "description",
                    "image",
                    "price",
                    "currency",
                    "stock",
                    "sku",
                    "variantId",
                    "option1",
                    "optionName1",
                    "option2",
                    "optionName2",
                    "option3",
                    "optionName3",
                    "parent",
                    "type",
                    "category",
                  ].map((k) => (
                    <label className="v-field" key={k}>
                      {t(...columnNames[k])}
                      <select
                        value={mapping[k] || ""}
                        onChange={(e) =>
                          setMapping({ ...mapping, [k]: e.target.value })
                        }
                      >
                        <option value="">
                          {t("كشف تلقائي", "Detect automatically")}
                        </option>
                        {headers.map((h) => (
                          <option key={h}>{h}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </details>
            )}
            <label className="v-field">
              {t(
                "عملة المصدر عند غيابها؛ أكدها من المصدر",
                "Source currency when missing; confirm from source",
              )}
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="">{t("تحتاج مراجعة", "Review required")}</option>
                {["USD", "EGP", "EUR", "GBP", "SAR", "AED"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              <input type="checkbox" required />
              {t(
                "أملك المحتوى أو لدي إذن بنقله",
                "I own the content or have permission to import it",
              )}
            </label>
            <button className="v-button" disabled={busy}>
              {t("اقرأ المصدر", "Read source")}
            </button>
          </form>
          <section className="v-panel">
            <h2>{t("عملياتك السابقة", "Previous imports")}</h2>
            {jobs.map((j) => (
              <button
                className="import-job-row"
                key={j.id}
                onClick={() => setJob(j)}
              >
                {j.sourceType} · {statusLabel(j.state, t)} ·{" "}
                {new Date(j.created).toLocaleDateString()}
              </button>
            ))}
          </section>
        </>
      ) : (
        <>
          <section className="v-panel">
            <h2>{t("تقرير النقل", "Import report")}</h2>
            <p>
              {statusLabel(job.state, t)} · {job.completeness} · {total}{" "}
              {t("منتجًا مكتشفًا", "products discovered")}
            </p>
            <p>
              {Object.entries(job.counts)
                .map(([k, v]) => k + ": " + v)
                .join(" · ")}
            </p>
            {job.error && (
              <p role="alert">
                {importIssue(job.error, language)} ·{" "}
                {t(
                  "استخدم CSV أو الربط الرسمي عند حجب المصدر.",
                  "Use CSV or an official connection when the source blocks access.",
                )}
              </p>
            )}
            <div className="v-actions">
              <button onClick={() => setJob(null)}>
                {t("كل العمليات", "All imports")}
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  act(() =>
                    request(`/import-jobs/${job.id}/cancel`, "POST", {}),
                  )
                }
              >
                {t("إلغاء", "Cancel")}
              </button>
              {["partial", "failed"].includes(job.state) && (
                <button
                  onClick={() =>
                    act(() =>
                      request(`/import-jobs/${job.id}/retry`, "POST", {}),
                    )
                  }
                >
                  {t("أعد الفاشل فقط", "Retry failed only")}
                </button>
              )}
              <a href={"/api/platform/import-jobs/" + job.id + "/report"}>
                {t("تنزيل التقرير", "Download report")}
              </a>
              {job.targetStoreId && (
                <Link to={`/workspace/stores/${job.targetStoreId}/products`}>
                  {t("إدارة المسودة", "Manage draft")}
                </Link>
              )}
            </div>
          </section>
          <section className="v-panel">
            <h2>{t("راجع العناصر", "Review items")}</h2>
            {items.map((i) => (
              <article className="import-item" key={i.id}>
                <h3>{i.data.title || i.data.externalId}</h3>
                <div className="import-images">
                  {i.data.images.slice(0, 3).map((url, index) => (
                    <ImportThumbnail
                      key={url}
                      jobId={job.id}
                      item={i}
                      index={index}
                      language={language}
                    />
                  ))}
                </div>
                <p>
                  {i.data.variants.length} {t("متغيرات", "variants")} ·{" "}
                  {i.data.currency || t("عملة غير معروفة", "Unknown currency")}{" "}
                  · {statusLabel(i.state, t)}
                </p>
                <p>
                  {i.issues
                    .map((code) => importIssue(code, language))
                    .join(" · ")}
                </p>
                <p>
                  {(i.data.warnings || [])
                    .map((code) => importIssue(code, language))
                    .join(" · ")}
                </p>
                {!["imported", "importing"].includes(i.state) &&
                  ["awaiting_review", "partial"].includes(job.state) && (
                    <ImportItemReview
                      item={i}
                      busy={busy}
                      onSave={(body) =>
                        act(() =>
                          request(
                            `/import-jobs/${job.id}/selection`,
                            "PATCH",
                            body,
                          ),
                        )
                      }
                    />
                  )}
              </article>
            ))}
            <div className="v-actions">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                {t("السابق", "Previous")}
              </button>
              <span>{page + 1}</span>
              <button
                disabled={(page + 1) * 25 >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                {t("التالي", "Next")}
              </button>
            </div>
          </section>
          {job.state === "awaiting_review" && !job.targetStoreId && (
            <form
              className="v-panel"
              onSubmit={(e) => {
                e.preventDefault();
                const form = Object.fromEntries(new FormData(e.currentTarget));
                act(() =>
                  request(`/import-jobs/${job.id}/commit`, "POST", form),
                );
              }}
            >
              <h2>
                {t(
                  "مسودة جديدة للعناصر المحددة",
                  "New draft for selected items",
                )}
              </h2>
              <div className="v-form-grid">
                <label className="v-field">
                  {t("الاسم", "Name")}
                  <input name="name" required minLength={2} />
                </label>
                <label className="v-field">
                  {t("العنوان", "Address")}
                  <input
                    name="slug"
                    required
                    pattern="[a-z0-9][a-z0-9-]{1,38}[a-z0-9]"
                  />
                </label>
                <label className="v-field">
                  {t("القالب", "Template")}
                  <select name="template">
                    {config.templates.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="v-field">
                  {t(
                    "عملة المتجر؛ لا تحويل تلقائي للأسعار",
                    "Store currency; prices are not automatically converted",
                  )}
                  <select name="currency">
                    {["USD", "EGP", "EUR", "GBP", "SAR", "AED"].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
              </div>
              <button className="v-button" disabled={busy}>
                {t("اعتمد النقل إلى مسودة", "Import into draft")}
              </button>
            </form>
          )}
        </>
      )}
    </main>
  );
}
