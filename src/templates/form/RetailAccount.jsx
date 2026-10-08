import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, jsonRequest, formatCurrency } from "@/api/store";
import { useCopy } from "./FormShell";
export default function RetailAccount() {
  const [params, setParams] = useSearchParams();
  const t = useCopy(),
    [customer, setCustomer] = useState(null),
    [orders, setOrders] = useState([]),
    [mode, setMode] = useState("login"),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [checking, setChecking] = useState(true),
    [tracked, setTracked] = useState(null);
  const load = async () => {
    const s = await api("/retail/session");
    setCustomer(s.customer);
    window.dispatchEvent(new Event("shopper-session-changed"));
    if (s.customer) setOrders((await api("/retail/orders")).orders);
    else setOrders([]);
  };
  useEffect(() => {
    load()
      .catch((e) => setError(e.message))
      .finally(() => setChecking(false));
  }, []);
  const act = async (fn) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const credentials = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget));
    await act(async () => {
      await api(
        "/retail/" + (mode === "register" ? "register" : "login"),
        jsonRequest("POST", body),
      );
      await load();
      window.dispatchEvent(new Event("shopper-session-changed"));
    });
  };
  if (params.get("recover"))
    return (
      <section className="form-section form-account">
        <h1>{t("Reset your password", "إعادة تعيين كلمة المرور")}</h1>
        {error && <p role="alert">{error}</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const password = new FormData(e.currentTarget).get("password");
            act(async () => {
              await api(
                "/retail/recover",
                jsonRequest("POST", { token: params.get("recover"), password }),
              );
              setParams({});
              setMessage(
                t(
                  "Password reset. Sign in with your new password.",
                  "تم تغيير كلمة المرور. سجّل الدخول باستخدامها.",
                ),
              );
            });
          }}
        >
          <label>
            {t("New password", "كلمة المرور الجديدة")}
            <input
              type="password"
              name="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
            />
          </label>
          <button disabled={busy} className="form-button">
            {t("Reset password", "تغيير كلمة المرور")}
          </button>
        </form>
      </section>
    );
  return (
    <section className="form-section form-account">
      <span className="form-eyebrow">{t("Your space", "مساحتك")}</span>
      <h1>
        {customer
          ? t("Welcome, ", "أهلًا، ") + customer.name
          : t("Your account", "حسابك")}
      </h1>
      {error && (
        <p role="alert" className="form-account-message">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="form-account-message">
          {message}
        </p>
      )}
      {checking ? (
        <p>{t("Loading…", "جارٍ التحميل…")}</p>
      ) : customer ? (
        <>
          <button
            className="form-text-link"
            disabled={busy}
            onClick={() =>
              act(async () => {
                await api("/retail/logout", jsonRequest("POST", {}));
                await load();
              })
            }
          >
            {t("Sign out", "تسجيل الخروج")}
          </button>
          <h2 style={{ marginTop: 35 }}>{t("Your orders", "طلباتك")}</h2>
          {!orders.length && (
            <p>
              {t(
                "No orders yet. Your next discovery starts here.",
                "لا توجد طلبات بعد. اكتشف مجموعتنا وابدأ رحلتك.",
              )}{" "}
              <Link to="/shop">{t("Explore", "اكتشف")}</Link>
            </p>
          )}
          {orders.map((order) => (
            <Order
              key={order.id}
              order={order}
              busy={busy}
              act={act}
              refresh={load}
              notify={setMessage}
            />
          ))}
          <details>
            <summary>
              {t(
                "Add a guest order to your account",
                "إضافة طلب سابق إلى حسابك",
              )}
            </summary>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                let token = new FormData(e.currentTarget).get("token").trim();
                if (token.includes("#"))
                  try {
                    token = new URL(token).hash.slice(1);
                  } catch {}
                act(async () => {
                  await api("/retail/claim", jsonRequest("POST", { token }));
                  await load();
                  setMessage(
                    t(
                      "Order added to your account.",
                      "تمت إضافة الطلب إلى حسابك.",
                    ),
                  );
                });
              }}
            >
              <label>
                {t(
                  "Secure receipt link or token",
                  "رابط الإيصال الآمن أو رمزه",
                )}
                <input name="token" required maxLength={1000} />
              </label>
              <small>
                {t(
                  "The order must use the same email as your account.",
                  "يجب أن يكون بريد الطلب مطابقًا لبريد حسابك.",
                )}
              </small>
              <button className="form-button" disabled={busy}>
                {t("Add order", "إضافة الطلب")}
              </button>
            </form>
          </details>
          <details>
            <summary>{t("Change your password", "تغيير كلمة المرور")}</summary>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const body = Object.fromEntries(new FormData(e.currentTarget));
                act(async () => {
                  await api("/retail/password", jsonRequest("POST", body));
                  await load();
                  setMessage(
                    t(
                      "Password changed. Sign in again.",
                      "تغيّرت كلمة المرور. سجّل الدخول مجددًا.",
                    ),
                  );
                });
              }}
            >
              <label>
                {t("Current password", "كلمة المرور الحالية")}
                <input
                  name="currentPassword"
                  type="password"
                  required
                  autoComplete="current-password"
                  minLength={12}
                />
              </label>
              <label>
                {t("New password", "كلمة المرور الجديدة")}
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="new-password"
                  minLength={12}
                  maxLength={128}
                />
              </label>
              <button className="form-button" disabled={busy}>
                {t("Save password", "حفظ كلمة المرور")}
              </button>
            </form>
          </details>
        </>
      ) : (
        <div className="form-account-grid">
          <form onSubmit={credentials}>
            <h2>
              {mode === "register"
                ? t("Create an account", "إنشاء حساب")
                : t("Welcome back", "أهلًا بعودتك")}
            </h2>
            {mode === "register" && (
              <label>
                {t("Your name", "اسمك")}
                <input
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={120}
                />
              </label>
            )}
            <label>
              {t("Email", "البريد الإلكتروني")}
              <input
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={200}
              />
            </label>
            <label>
              {t("Password", "كلمة المرور")}
              <input
                name="password"
                type="password"
                autoComplete={
                  mode === "register" ? "new-password" : "current-password"
                }
                required
                minLength={12}
                maxLength={128}
              />
            </label>
            <button className="form-button" disabled={busy}>
              {mode === "register"
                ? t("Create account", "إنشاء الحساب")
                : t("Sign in", "تسجيل الدخول")}
            </button>
            <button
              type="button"
              className="form-text-link"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
            >
              {mode === "login"
                ? t("New here? Create an account", "أول زيارة؟ أنشئ حسابًا")
                : t(
                    "Already have an account? Sign in",
                    "لديك حساب؟ سجّل الدخول",
                  )}
            </button>
            <small>
              {t(
                "Need help accessing your account? Contact the store.",
                "تحتاج مساعدة في الدخول؟ تواصل مع المتجر.",
              )}{" "}
              <Link to="/contact">{t("Contact", "تواصل معنا")}</Link>
            </small>
          </form>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              let token = new FormData(e.currentTarget).get("token").trim();
              try {
                if (token.includes("#")) token = new URL(token).hash.slice(1);
              } catch {}
              act(async () =>
                setTracked(
                  await api("/retail/track", jsonRequest("POST", { token })),
                ),
              );
            }}
          >
            <h2>{t("Track a guest order", "تتبع طلب بدون حساب")}</h2>
            <p>
              {t(
                "Use the secure receipt link or token saved when you placed your order.",
                "استخدم رابط التأكيد الآمن أو رمز الإيصال الذي حصلت عليه عند الطلب.",
              )}
            </p>
            <label>
              {t("Receipt link or token", "رابط الإيصال أو رمزه")}
              <input name="token" required maxLength={1000} />
            </label>
            <button disabled={busy} className="form-button">
              {t("Find my order", "عرض الطلب")}
            </button>
          </form>
        </div>
      )}
      {tracked && <Order order={tracked} guest />}
    </section>
  );
}
function Order({ order, guest = false, busy, act, refresh, notify }) {
  const t = useCopy(),
    [action, setAction] = useState(""),
    money = (v) =>
      formatCurrency(v, { symbol: order.symbol, decimal_digits: 2 });
  const labels = {
    new: t("Received", "تم الاستلام"),
    confirmed: t("Confirmed", "مؤكد"),
    processing: t("Preparing", "قيد التجهيز"),
    shipped: t("Shipped", "تم الشحن"),
    delivered: t("Delivered", "تم التسليم"),
    cancelled: t("Cancelled", "ملغي"),
    pending: t("Pending", "قيد التأكيد"),
    paid: t("Paid", "مدفوع"),
    cod: t("Cash on delivery", "الدفع عند الاستلام"),
    failed: t("Payment failed", "فشل الدفع"),
    expired: t("Payment expired", "انتهت مهلة الدفع"),
    refunded: t("Refunded", "تم رد المبلغ"),
    received_after_cancellation: t(
      "Payment received; contact the store",
      "وصل الدفع بعد الإلغاء؛ تواصل مع المتجر",
    ),
    return: t("Return", "استرجاع"),
    exchange: t("Exchange", "استبدال"),
    requested: t("Requested", "قيد المراجعة"),
    approved: t("Approved", "موافق عليه"),
    rejected: t("Rejected", "مرفوض"),
    received: t("Received", "تم الاستلام"),
    closed: t("Closed", "مغلق"),
  };
  return (
    <article className="form-order">
      <header>
        <strong>{order.number}</strong>
        <span>
          {labels[order.status] || order.status} · {money(order.total_in_cents)}
        </span>
      </header>
      <p>
        {new Date(order.created_at).toLocaleDateString()} ·{" "}
        {labels[order.payment_status] ||
          labels[order.payment_method] ||
          order.payment_status}
      </p>
      <ul>
        {order.items.map((i) => (
          <li key={i.variant_id}>
            {i.title} · {i.variant_title} × {i.quantity}
          </li>
        ))}
      </ul>
      {(order.tracking?.url || order.tracking?.number) && (
        <p>
          {order.tracking.number && (
            <span>
              {order.tracking.carrier} · {order.tracking.number}{" "}
            </span>
          )}
          {order.tracking.url && (
            <a href={order.tracking.url} target="_blank" rel="noreferrer">
              {t("Track shipment", "تتبع الشحنة")} — {order.tracking.carrier}
            </a>
          )}
        </p>
      )}
      {order.history?.length > 0 && (
        <p>
          {order.history.map((h) => labels[h.status] || h.status).join(" → ")}
        </p>
      )}
      {order.returns?.map((r) => (
        <p key={r.id}>
          {t("Request", "الطلب")}: {labels[r.type] || r.type} ·{" "}
          {labels[r.status] || r.status}
          {r.note && ` — ${r.note}`}
        </p>
      ))}
      {!guest && order.status === "delivered" && (
        <>
          <button
            className="form-text-link"
            onClick={() => setAction(action === "return" ? "" : "return")}
          >
            {t("Request return / exchange", "طلب استرجاع / استبدال")}
          </button>
          {" · "}
          <button
            className="form-text-link"
            onClick={() => setAction(action === "review" ? "" : "review")}
          >
            {t("Write a review", "كتابة تقييم")}
          </button>
          {action && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const data = Object.fromEntries(new FormData(e.currentTarget));
                act(async () => {
                  await api(
                    "/retail/" + (action === "review" ? "reviews" : "returns"),
                    jsonRequest("POST", {
                      ...data,
                      orderId: order.id,
                      rating: Number(data.rating),
                    }),
                  );
                  setAction("");
                  await refresh();
                  notify(
                    t("Your request has been submitted.", "تم إرسال طلبك."),
                  );
                });
              }}
            >
              {action === "review" ? (
                <>
                  <label>
                    {t("Product", "المنتج")}
                    <select name="productId">
                      {[
                        ...new Map(
                          order.items.map((i) => [i.product_id, i]),
                        ).values(),
                      ].map((i) => (
                        <option key={i.product_id} value={i.product_id}>
                          {i.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t("Rating", "التقييم")}
                    <select name="rating">
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t("Your review", "رأيك")}
                    <textarea name="body" required maxLength={2000} />
                  </label>
                  <small>
                    {t(
                      "Reviews are published after moderation.",
                      "تُنشر التقييمات بعد المراجعة.",
                    )}
                  </small>
                </>
              ) : (
                <>
                  <label>
                    {t("Request type", "نوع الطلب")}
                    <select name="type">
                      <option value="return">{t("Return", "استرجاع")}</option>
                      <option value="exchange">
                        {t("Exchange", "استبدال")}
                      </option>
                    </select>
                  </label>
                  <label>
                    {t(
                      "Reason and requested items",
                      "السبب والمنتجات المطلوبة",
                    )}
                    <textarea name="reason" required maxLength={2000} />
                  </label>
                  <small>
                    {t(
                      "The store will review eligibility under its returns policy.",
                      "سيراجع المتجر الطلب وفق سياسة الاسترجاع.",
                    )}
                  </small>
                </>
              )}
              <button className="form-button" disabled={busy}>
                {t("Submit request", "إرسال الطلب")}
              </button>
            </form>
          )}
        </>
      )}
    </article>
  );
}
