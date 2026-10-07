import { storeUrl } from "@/lib/store-scope";
import { useSearchParams } from "react-router-dom";
import useModal from "@/hooks/useModal";
import ResponsiveTable from "./ResponsiveTable";
import { useLanguage, localizeView } from "@/i18n/LanguageContext";
import React, { useEffect, useState, useCallback } from "react";
import {
  Package,
  Search,
  Download,
  RefreshCw,
  Send,
  X,
  MapPin,
  Phone,
  Mail,
  Banknote,
  Clock,
  Truck,
} from "lucide-react";
import { api, jsonRequest, formatCurrency } from "@/api/store";
import { Button } from "@/components/ui/button";
import { Panel, Field, Notice, Busy, SaveButton } from "./AdminUI";
export default function OrdersPanel({ notify }) {
  const { t, date, language } = useLanguage();
  const [params, setParams] = useSearchParams();
  const orderId = params.get("order");
  const [data, setData] = useState(null),
    [page, setPage] = useState(1),
    [status, setStatus] = useState(""),
    [search, setSearch] = useState(""),
    [query, setQuery] = useState(""),
    [error, setError] = useState(""),
    [selected, setSelected] = useState(null),
    [nextStatus, setNextStatus] = useState(""),
    [busy, setBusy] = useState(false);
  const [tracking, setTracking] = useState({
    carrier: "",
    number: "",
    url: "",
  });
  function closeOrder() {
    if (busy) return;
    setSelected(null);
    setError("");
    if (orderId)
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.delete("order");
          return next;
        },
        { replace: true },
      );
  }
  useEffect(() => {
    if (!orderId) {
      setSelected(null);
      return;
    }
    const controller = new AbortController();
    api(`/admin/orders/${encodeURIComponent(orderId)}`, {
      signal: controller.signal,
    })
      .then((order) => {
        if (controller.signal.aborted) return;
        setSelected(order);
        setNextStatus(order.status);
        setTracking(order.tracking || { carrier: "", number: "", url: "" });
        setError("");
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [orderId]);
  const modalRef = useModal(!!selected, () => {
    closeOrder();
  });
  const reload = useCallback(async () => {
    try {
      setData(
        await api(
          `/admin/orders?page=${page}&status=${status}&search=${encodeURIComponent(query)}`,
        ),
      );
    } catch (e) {
      setError(e.message);
    }
  }, [page, status, query]);
  useEffect(() => {
    reload();
  }, [reload]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    const timer = setInterval(reload, 15000);
    return () => clearInterval(timer);
  }, [reload]);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const order = await api(
        `/admin/orders/${selected.id}`,
        jsonRequest("PATCH", {
          status: nextStatus,
          expected_status: selected.status,
          tracking,
        }),
      );
      setSelected(order);
      await reload();
      notify("Order status updated.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    setBusy(true);
    try {
      await api(`/admin/orders/${selected.id}/telegram`, {
        method: "POST",
      });
      setSelected({
        ...selected,
        telegram_status: "pending",
      });
      await reload();
      notify("Telegram delivery queued.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return localizeView(error ? <Notice error>{error}</Notice> : <Busy />, t);
  const money = (value, o) =>
    formatCurrency(value, {
      symbol: o.symbol,
      decimal_digits: 2,
    });
  const summaries = [
    ["new", "New orders", Package],
    ["processing", "Preparing", Clock],
    ["shipped", "On the way", Truck],
    ["delivered", "Delivered", Banknote],
  ];
  return localizeView(
    <div className="space-y-6">
      {error && !selected && <Notice error>{error}</Notice>}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaries.map(([key, label, Icon]) => (
          <div className="admin-panel admin-stat" key={key}>
            <div className="flex justify-between items-center">
              <span className="stat-label">{label}</span>
              <Icon size={18} className="text-primary" />
            </div>
            <span className="stat-value">
              {data.summary.find((x) => x.status === key)?.count || 0}
            </span>
          </div>
        ))}
      </div>
      <Panel
        title="Orders"
        subtitle="Every order is saved here, even if Telegram is not configured or is temporarily unavailable."
        icon={Package}
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={reload}
              aria-label="Refresh orders"
            >
              <RefreshCw size={15} />
            </Button>
            <Button variant="outline" asChild>
              <a href={storeUrl(`/api/admin/orders-export?lang=${language}`)}>
                <Download size={15} className="mr-2" /> CSV
              </a>
            </Button>
          </div>
        }
      >
        <div className="grid sm:grid-cols-[1fr_200px] gap-4 mb-5">
          <input
            aria-label="Search orders"
            placeholder="Search by order number, customer or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            aria-label="Filter orders by status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {["new", "processing", "shipped", "delivered", "cancelled"].map(
              (s) => (
                <option key={s} value={s}>
                  {s[0].toUpperCase() + s.slice(1)}
                </option>
              ),
            )}
          </select>
        </div>
        <div className="admin-table-wrap">
          <ResponsiveTable>
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Status</th>
                <th>Telegram</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.orders.map((o) => (
                <tr key={o.id}>
                  <td className="whitespace-nowrap">
                    <strong>{o.number}</strong>
                    <p className="text-[10px] text-muted-foreground">
                      {date(o.created_at)}
                    </p>
                  </td>
                  <td>
                    <strong>{o.customer.name}</strong>
                    <p className="text-[10px] text-muted-foreground">
                      {o.customer.city} ·{" "}
                      <bdi dir="ltr">{o.customer.phone}</bdi>
                    </p>
                  </td>
                  <td className="whitespace-nowrap">
                    {money(o.total_in_cents, o)}
                    <p className="text-[10px] text-muted-foreground">
                      Cash on delivery
                    </p>
                  </td>
                  <td>
                    <span className={`admin-status ${o.status}`}>
                      {o.status}
                    </span>
                  </td>
                  <td>
                    <span className={`admin-status ${o.telegram_status}`}>
                      {o.telegram_status}
                    </span>
                  </td>
                  <td>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setParams((current) => {
                          const next = new URLSearchParams(current);
                          next.set("order", String(o.id));
                          return next;
                        })
                      }
                    >
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </ResponsiveTable>
        </div>
        {!data.orders.length && (
          <div className="admin-empty">
            <Package size={32} className="mx-auto mb-4 opacity-40" />
            Orders appear here as soon as a customer completes checkout.
          </div>
        )}
        <div className="flex justify-between items-center mt-5 text-xs text-muted-foreground">
          <span>
            {data.total} orders · Page {page} of {data.pages || 1}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= data.pages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </Panel>
      {selected && (
        <div
          className="admin-modal-backdrop"
          onClick={() => {
            closeOrder();
          }}
        >
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Order ${selected.number}`}
            className="admin-modal max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="admin-section-label">Order details</p>
                <h2 className="text-3xl">{selected.number}</h2>
                <p className="text-xs text-muted-foreground">
                  {date(selected.created_at)}
                </p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  closeOrder();
                }}
                aria-label="Close order"
              >
                <X size={20} />
              </Button>
            </div>
            {error && <Notice error>{error}</Notice>}
            <div className="grid sm:grid-cols-2 gap-6 mb-6">
              <div className="bg-muted rounded-xl p-4">
                <h3 className="text-xl mb-3">Customer & delivery</h3>
                <p className="text-sm font-semibold">
                  {selected.customer.name}
                </p>
                <a
                  href={`tel:${selected.customer.phone}`}
                  className="flex items-center gap-2 text-xs mt-2"
                >
                  <Phone size={13} />
                  <bdi dir="ltr">{selected.customer.phone}</bdi>
                </a>
                {selected.customer.email && (
                  <a
                    href={`mailto:${selected.customer.email}`}
                    className="flex items-center gap-2 text-xs mt-2"
                  >
                    <Mail size={13} />
                    <bdi dir="ltr">{selected.customer.email}</bdi>
                  </a>
                )}
                <p className="text-xs text-muted-foreground mt-3 whitespace-pre-line">
                  {selected.customer.address}
                  <br />
                  {selected.customer.city}, {selected.customer.region}{" "}
                  {selected.customer.postalCode}
                  <br />
                  {selected.customer.country}
                </p>
                {selected.customer.location && (
                  <a
                    href={selected.customer.location}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-xs underline mt-2"
                  >
                    <MapPin size={13} /> Delivery map
                  </a>
                )}
                {selected.customer.notes && (
                  <p className="text-xs mt-4">
                    <strong>Notes:</strong> {selected.customer.notes}
                  </p>
                )}
              </div>
              <div className="bg-muted rounded-xl p-4">
                <h3 className="text-xl mb-3">Payment & notification</h3>
                <p className="text-sm flex items-center gap-2">
                  <Banknote size={16} /> Cash on delivery
                </p>
                <p className="text-xs text-muted-foreground mt-3">
                  {selected.delivery_note}
                </p>
                <p className="text-xs mt-4">
                  Telegram:{" "}
                  <span className={`admin-status ${selected.telegram_status}`}>
                    {selected.telegram_status}
                  </span>
                </p>
                {selected.telegram_error && (
                  <p className="text-xs text-destructive mt-2">
                    {selected.telegram_error}
                  </p>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={resend}
                  disabled={busy}
                >
                  <Send size={14} className="mr-2" />
                  {selected.telegram_status === "sent"
                    ? "Send another copy"
                    : "Retry Telegram delivery"}
                </Button>
              </div>
            </div>
            <h3 className="text-xl mb-4">Products</h3>
            {selected.items.map((item) => (
              <div
                key={item.variant_id}
                className="flex gap-4 border-t border-border py-4"
              >
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-16 h-20 rounded-lg object-cover"
                />
                <div className="flex-1">
                  <strong className="text-sm">{item.title}</strong>
                  <p className="text-xs text-muted-foreground">
                    {item.variant_title} · {item.quantity} ×{" "}
                    {money(item.price_in_cents, selected)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {item.subtitle}
                  </p>
                  <details className="text-xs mt-2">
                    <summary className="cursor-pointer text-muted-foreground">
                      Full product information
                    </summary>
                    <p className="mt-2">
                      {item.description?.replace(/<[^>]*>/g, "")}
                    </p>
                    {item.additional_info?.map((info, i) => (
                      <p key={i}>
                        <strong>{info.title}:</strong>{" "}
                        {info.description.replace(/<[^>]*>/g, "")}
                      </p>
                    ))}
                    <p className="text-muted-foreground mt-2">
                      Product: {item.product_id} · Style: {item.variant_id}
                    </p>
                  </details>
                </div>
                <strong className="text-sm">
                  {money(item.total_in_cents, selected)}
                </strong>
              </div>
            ))}
            <div className="border-t border-border py-5 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{money(selected.subtotal_in_cents, selected)}</span>
              </div>
              {!!selected.discount_in_cents && (
                <div className="flex justify-between">
                  <span>
                    {t("Discount")} · {selected.coupon_code}
                  </span>
                  <span>−{money(selected.discount_in_cents, selected)}</span>
                </div>
              )}
              {!!selected.tax_in_cents && (
                <div className="flex justify-between">
                  <span>
                    {language === "ar"
                      ? selected.tax_label_ar
                      : selected.tax_label}
                  </span>
                  <span>{money(selected.tax_in_cents, selected)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Delivery</span>
                <span>{money(selected.shipping_in_cents, selected)}</span>
              </div>
              <div className="flex justify-between text-lg font-semibold">
                <span>Total · {selected.currency}</span>
                <span>{money(selected.total_in_cents, selected)}</span>
              </div>
            </div>
            {!!selected.history?.length && (
              <section
                className="order-history"
                aria-label={t("Order history")}
              >
                <h3 className="text-xl mb-4">Order history</h3>
                <ol>
                  {selected.history.map((entry, index) => (
                    <li key={`${entry.at}-${index}`}>
                      <span className={`admin-status ${entry.status}`}>
                        {t(entry.status)}
                      </span>
                      <time dateTime={entry.at}>{date(entry.at)}</time>
                    </li>
                  ))}
                </ol>
              </section>
            )}
            <form onSubmit={save} className="border-t border-border pt-5">
              <h3 className="text-xl mb-4">Shipment tracking</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field
                  label="Carrier"
                  maxLength={80}
                  value={tracking.carrier}
                  onChange={(v) => setTracking({ ...tracking, carrier: v })}
                />
                <Field
                  label="Tracking number"
                  maxLength={120}
                  value={tracking.number}
                  onChange={(v) => setTracking({ ...tracking, number: v })}
                />
              </div>
              <Field
                label="Tracking URL"
                hint="An HTTPS link shown on the customer's private order page."
                type="url"
                maxLength={500}
                value={tracking.url}
                onChange={(v) => setTracking({ ...tracking, url: v })}
              />
              <h3 className="text-xl mb-4">Order status</h3>
              <label
                htmlFor="order-status"
                className="text-xs font-semibold block mb-2"
              >
                Update order status
              </label>
              <div className="flex gap-3">
                <select
                  id="order-status"
                  value={nextStatus}
                  onChange={(e) => setNextStatus(e.target.value)}
                  disabled={["cancelled", "delivered"].includes(
                    selected.status,
                  )}
                >
                  {[
                    "new",
                    "processing",
                    "shipped",
                    "delivered",
                    "cancelled",
                  ].map((s) => (
                    <option value={s} key={s}>
                      {s[0].toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
                <SaveButton
                  busy={busy}
                  disabled={
                    busy ||
                    (nextStatus === selected.status &&
                      JSON.stringify(tracking) ===
                        JSON.stringify(
                          selected.tracking || {
                            carrier: "",
                            number: "",
                            url: "",
                          },
                        ))
                  }
                >
                  Update
                </SaveButton>
              </div>
              {nextStatus === "cancelled" &&
                selected.status !== "cancelled" && (
                  <p className="text-xs text-destructive mt-3">
                    Cancellation restores tracked stock. Cancelled orders cannot
                    be reopened.
                  </p>
                )}
              {nextStatus === "delivered" &&
                selected.status !== "delivered" && (
                  <p className="text-xs text-muted-foreground mt-3">
                    Delivered orders are final and count toward collected
                    revenue.
                  </p>
                )}
            </form>
          </div>
        </div>
      )}
    </div>,
    t,
  );
}
