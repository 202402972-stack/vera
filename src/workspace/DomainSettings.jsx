import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Check,
  Copy,
  Globe2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { request } from "@/platform/api";
import "./domain.css";

const domainMessage = (english, language) =>
  language !== "ar"
    ? english
    : {
        "Enter a valid domain name.": "اكتب اسم دومين صحيحًا.",
        "Enter only the domain, without a path or port.":
          "اكتب الدومين فقط، من غير رابط صفحة أو رقم منفذ.",
        "Enter a domain you own, such as shop.example.com.":
          "اكتب دومين تملكه، مثل shop.example.com.",
        "This domain is already connected to another store.":
          "الدومين ده مرتبط بمتجر آخر.",
        "Too many attempts. Try again later.":
          "المحاولات كثيرة؛ حاول بعد قليل.",
      }[english] || `تعذر إكمال الطلب: ${english}`;

export default function DomainSettings({ store, onChange }) {
  const { language } = useLanguage();
  const t = (ar, en) => (language === "ar" ? ar : en);
  const [data, setData] = useState(null);
  const [hostname, setHostname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [checks, setChecks] = useState(null);
  const endpoint = `/stores/${store.id}/domain`;
  const apply = (value) => {
    setData(value);
    onChange?.(value.active?.hostname || null);
  };
  useEffect(() => {
    let live = true;
    setData(null);
    setError("");
    request(endpoint)
      .then((value) => live && setData(value))
      .catch((e) => live && setError(domainMessage(e.message, language)));
    return () => {
      live = false;
    };
  }, [endpoint, language]);
  async function run(action) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError(domainMessage(e.message, language));
    } finally {
      setBusy(false);
    }
  }
  async function copy(value) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(t("تم النسخ", "Copied"));
    } catch {
      setError(
        t(
          "تعذر النسخ؛ انسخ القيمة يدويًا.",
          "Copy failed; select the value manually.",
        ),
      );
    }
  }
  const pending = data?.pending;
  const builtIn = window.location.origin + store.url;
  return (
    <main className="domain-page" dir={language === "ar" ? "rtl" : "ltr"}>
      <Link
        className="domain-back domain-back-top"
        to={`/workspace/stores/${store.id}/overview`}
      >
        ← {t("إدارة المتجر", "Store workspace")}
      </Link>
      <div className="domain-heading">
        <div>
          <span className="domain-eyebrow">
            VÉRA / {t("عنوان متجرك", "YOUR STORE ADDRESS")}
          </span>
          <h1>{t("دومين يليق باسمك.", "An address of your own.")}</h1>
          <p>
            {t(
              "اربط دومين اشتريته من أي مزوّد. هنساعدك خطوة بخطوة، ورابط VÉRA الحالي يفضل محفوظ أثناء التجهيز.",
              "Connect a domain bought from any provider. Follow clear steps while your VÉRA address stays in place.",
            )}
          </p>
        </div>
        <Globe2 size={54} strokeWidth={1} aria-hidden="true" />
      </div>
      <div className="domain-columns">
        <section className="domain-card">
          <span className="domain-eyebrow">
            01 / {t("الرابط الحالي", "CURRENT ADDRESS")}
          </span>
          <h2>{t("رابط VÉRA محفوظ", "Your VÉRA address stays")}</h2>
          <div className="domain-value">
            <bdi>{builtIn}</bdi>
            <button
              type="button"
              onClick={() => copy(builtIn)}
              aria-label={t("نسخ الرابط الحالي", "Copy current address")}
            >
              <Copy size={17} />
            </button>
          </div>
          {data?.active && (
            <div className="domain-connected">
              <Check size={18} />
              <span>
                {t("الدومين المتصل", "Connected domain")}{" "}
                <a href={data.active.url} target="_blank" rel="noreferrer">
                  <bdi>{data.active.hostname}</bdi> <ArrowUpRight size={14} />
                </a>
              </span>
            </div>
          )}
          {data?.active && store.publicationState === "draft" && (
            <p className="domain-note">
              {t(
                "الدومين متصل، وظهور المتجر للزوار يبدأ بعد نشر المسودة.",
                "Domain connected. Visitors can see the store after you publish the draft.",
              )}
            </p>
          )}
          {data?.active && (
            <button
              className="domain-text-button"
              type="button"
              disabled={busy}
              onClick={() => {
                if (
                  !window.confirm(
                    t(
                      "فصل الدومين الحالي؟ رابط VÉRA سيظل محفوظًا حسب حالة المتجر.",
                      "Disconnect this domain? Your VÉRA address stays with the store.",
                    ),
                  )
                )
                  return;
                run(async () => {
                  apply(
                    await request(endpoint, "DELETE", {
                      hostname: data.active.hostname,
                    }),
                  );
                  setNotice(t("تم فصل الدومين", "Domain disconnected"));
                });
              }}
            >
              {t("فصل الدومين", "Disconnect domain")}
            </button>
          )}
        </section>
        <section className="domain-card domain-setup">
          <span className="domain-eyebrow">
            02 / {t("دومينك الخاص", "YOUR DOMAIN")}
          </span>
          <h2>
            {pending
              ? t("جهّز سجلات DNS", "Set up your DNS")
              : t("اكتب عنوانك الجديد", "Enter your new address")}
          </h2>
          {!data && !error && (
            <p role="status">
              {t("جارٍ تحميل الإعدادات…", "Loading domain settings…")}
            </p>
          )}
          {data && !data.configured && (
            <p className="domain-note" role="status">
              {t(
                "ربط الدومينات في الاستضافة يحتاج إعداد VÉRA أولًا. الميزة ظاهرة هنا، لكن التفعيل ينتظر إعداد مزوّد الشهادات وهدف DNS.",
                "The hosting connection still needs VÉRA setup. Activation waits for the certificate provider and DNS target.",
              )}
            </p>
          )}
          {!pending && data?.configured && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  apply(await request(endpoint, "PUT", { hostname }));
                  setHostname("");
                  setChecks(null);
                });
              }}
            >
              <label htmlFor="custom-domain">
                {t("الدومين", "Domain name")}
              </label>
              <input
                id="custom-domain"
                dir="ltr"
                placeholder="www.yourbrand.com"
                autoComplete="off"
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                required
              />
              <small>
                {t(
                  "الأفضل تبدأ بـ www. الدومين الأساسي يحتاج ALIAS أو ANAME عند مزوّد DNS.",
                  "We recommend www. A root domain needs ALIAS or ANAME at your DNS provider.",
                )}
              </small>
              <button className="domain-primary" disabled={busy}>
                {t("ابدأ الربط", "Start connecting")}
              </button>
            </form>
          )}
          {pending && (
            <>
              <p>
                {t(
                  "افتح لوحة الدومين عند المزوّد الذي اشتريت منه وأضف السجلين التاليين. انسخ القيم كما هي.",
                  "At your domain provider, add these two DNS records. Copy the values exactly.",
                )}
              </p>
              <div className="domain-record">
                <span>TXT · {t("إثبات الملكية", "Ownership")}</span>
                <bdi>{pending.txtName}</bdi>
                <div>
                  <code>{pending.txtValue}</code>
                  <button
                    type="button"
                    onClick={() => copy(pending.txtValue)}
                    aria-label={t("نسخ قيمة TXT", "Copy TXT value")}
                  >
                    <Copy size={17} />
                  </button>
                </div>
              </div>
              <div className="domain-record">
                <span>
                  {t("CNAME · توجيه المتجر", "CNAME · Store routing")}
                </span>
                <bdi>{pending.hostname}</bdi>
                <div>
                  <code>{data.target || "—"}</code>
                  <button
                    type="button"
                    onClick={() => copy(data.target)}
                    aria-label={t("نسخ هدف CNAME", "Copy CNAME target")}
                  >
                    <Copy size={17} />
                  </button>
                </div>
              </div>
              <p className="domain-note">
                {t(
                  "لو بتربط الدومين الأساسي من غير www، استخدم ALIAS/ANAME بنفس الهدف إذا المزوّد يدعمهم. انتشار DNS وشهادة HTTPS قد يحتاجان وقتًا.",
                  "For a root domain without www, use ALIAS/ANAME with the same target if your provider supports it. DNS and HTTPS can take time to become ready.",
                )}
              </p>
              <button
                className="domain-primary"
                type="button"
                disabled={busy || !data.configured}
                onClick={() =>
                  run(async () => {
                    const result = await request(
                      `${endpoint}/check`,
                      "POST",
                      {},
                    );
                    setChecks(result.checks);
                    apply(result);
                    if (result.active?.hostname === pending.hostname)
                      setNotice(
                        t(
                          "الدومين جاهز ويعمل الآن",
                          "Your domain is connected",
                        ),
                      );
                  })
                }
              >
                <RefreshCw size={17} />{" "}
                {t("تحقق من الاتصال", "Check connection")}
              </button>
              {checks && (
                <ul className="domain-checks">
                  <li>
                    {checks.ownership ? "✓" : "○"}{" "}
                    {t("إثبات الملكية", "Ownership record")}
                  </li>
                  <li>
                    {checks.pointsToTarget ? "✓" : "○"}{" "}
                    {t("توجيه DNS", "DNS routing")}
                  </li>
                  <li>
                    {checks.certificateReady ? "✓" : "○"}{" "}
                    {t("شهادة HTTPS", "HTTPS certificate")}
                  </li>
                  <li>
                    {checks.routingReady ? "✓" : "○"}{" "}
                    {t("وصول الزيارة للمتجر", "Store routing")}
                  </li>
                </ul>
              )}
              {checks?.providerRecords?.map((record) => (
                <div
                  className="domain-record"
                  key={`${record.name}:${record.value}`}
                >
                  <span>
                    {t(
                      "سجل تحقق إضافي للشهادة · TXT",
                      "Additional certificate record · TXT",
                    )}
                  </span>
                  <bdi>{record.name}</bdi>
                  <div>
                    <code>{record.value}</code>
                    <button
                      type="button"
                      onClick={() => copy(record.value)}
                      aria-label={t(
                        "نسخ سجل الشهادة",
                        "Copy certificate record",
                      )}
                    >
                      <Copy size={17} />
                    </button>
                  </div>
                </div>
              ))}
              <button
                className="domain-text-button"
                type="button"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    apply(
                      await request(endpoint, "DELETE", {
                        hostname: pending.hostname,
                      }),
                    );
                    setChecks(null);
                  })
                }
              >
                {t("إلغاء هذا الطلب", "Cancel this connection")}
              </button>
            </>
          )}
        </section>
      </div>
      <section className="domain-bottom">
        <ShieldCheck size={25} />
        <p>
          {t(
            "الدومين هيتفعّل فقط بعد إثبات الملكية، وصول DNS إلى VÉRA، وجهوزية شهادة HTTPS. متجرك ومسودته واشتراكه لا يتغيروا.",
            "Your domain goes live only after ownership, DNS routing, and its HTTPS certificate are ready. Store content, draft status, and billing stay as they are.",
          )}
        </p>
      </section>
      {error && (
        <p className="domain-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="domain-success" role="status">
          {notice}
        </p>
      )}
      <Link
        className="domain-back"
        to={`/workspace/stores/${store.id}/overview`}
      >
        ← {t("العودة لإدارة المتجر", "Back to store workspace")}
      </Link>
    </main>
  );
}
