import { useStoreApi } from "@/workspace/StoreScope";
import { Truck, Settings2, Receipt, Tag, Plus, Pencil } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { useLanguage, localizeView } from "@/i18n/LanguageContext";
import { jsonRequest, formatCurrency } from "@/api/store";
import useSettingsEditor from "@/hooks/useSettingsEditor";
import { Panel, Field, Notice, Busy, SaveButton } from "./AdminUI";
import { Button } from "@/components/ui/button";

function Amount({ value, onChange, ...props }) {
  return (
    <Field
      type="number"
      min="0"
      max="1000000"
      step="0.01"
      value={value == null ? "" : value / 100}
      onChange={(v) => onChange(v === "" ? null : Math.round(Number(v) * 100))}
      {...props}
    />
  );
}
function Discounts({ currency, symbol, notify }) {
  const api = useStoreApi();
  const { t } = useLanguage();
  const [discounts, setDiscounts] = useState([]),
    [editor, setEditor] = useState(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const reload = useCallback(
    () =>
      api("/admin/discounts")
        .then((d) => setDiscounts(d.discounts))
        .catch((e) => setError(e.message)),
    [api],
  );
  useEffect(() => {
    reload();
  }, [reload]);
  const update = (key, v) => setEditor((old) => ({ ...old, [key]: v }));
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(
        `/admin/discounts/${encodeURIComponent(editor.code.toUpperCase())}`,
        jsonRequest("PUT", editor),
      );
      await reload();
      setEditor(null);
      notify("Discount saved.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return localizeView(
    <Panel
      title="Discount codes"
      subtitle="Validated on the server, with atomic usage limits."
      icon={Tag}
      action={
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            setEditor({
              code: "",
              type: "percent",
              value: 10,
              minimumInCents: 0,
              maxUses: null,
              expiresAt: null,
              active: true,
            })
          }
        >
          <Plus size={15} /> Add discount
        </Button>
      }
    >
      {error && <Notice error>{error}</Notice>}
      <div className="discount-list">
        {discounts.map((d) => (
          <div className="discount-row" key={d.code}>
            <div className="discount-code-icon">
              <Tag size={18} />
            </div>
            <div>
              <strong>{d.code}</strong>
              <p>
                {d.type === "percent"
                  ? `${d.value}%`
                  : formatCurrency(d.value, {
                      symbol: d.currency === currency ? symbol : d.currency,
                    })}{" "}
                · {d.used} {t("redemptions")}
                {d.maxUses ? ` / ${d.maxUses}` : ""}
              </p>
            </div>
            <span
              className={`admin-status ${d.active ? "published" : "cancelled"}`}
            >
              {d.active ? "Active" : "Inactive"}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`${t("Edit")} ${d.code}`}
              onClick={() => setEditor(d)}
            >
              <Pencil size={15} />
            </Button>
          </div>
        ))}
        {!discounts.length && (
          <p className="admin-empty">
            Create your first offer when your brand is ready.
          </p>
        )}
      </div>
      {editor && (
        <form onSubmit={save} className="discount-editor" data-dirty="true">
          <h3 className="text-xl mb-4">
            {editor._version ? "Edit discount" : "New discount"}
          </h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field
              label="Discount code"
              value={editor.code}
              required
              maxLength={32}
              pattern="[A-Za-z0-9_-]{3,32}"
              disabled={!!editor._version}
              onChange={(v) => update("code", v.toUpperCase())}
            />
            <Field label="Discount type">
              <select
                aria-label={t("Discount type")}
                value={editor.type}
                onChange={(e) =>
                  setEditor({
                    ...editor,
                    type: e.target.value,
                    value: e.target.value === "percent" ? 10 : 1000,
                  })
                }
              >
                <option value="percent">Percentage</option>
                <option value="fixed">Fixed amount</option>
              </select>
            </Field>
            {editor.type === "percent" ? (
              <Field
                label="Discount percentage"
                type="number"
                min="1"
                max="100"
                value={editor.value}
                required
                onChange={(v) => update("value", Number(v))}
              />
            ) : (
              <Amount
                label="Discount amount"
                required
                value={editor.value}
                onChange={(v) => update("value", v)}
              />
            )}
            <Amount
              label="Minimum spend"
              required
              value={editor.minimumInCents}
              onChange={(v) => update("minimumInCents", v)}
            />
            <Field
              label="Maximum redemptions"
              type="number"
              min="1"
              max="1000000"
              hint="Leave blank for unlimited use."
              value={editor.maxUses ?? ""}
              onChange={(v) => update("maxUses", v ? Number(v) : null)}
            />
            <Field
              label="Expires at (UTC)"
              type="datetime-local"
              value={editor.expiresAt?.slice(0, 16) || ""}
              onChange={(v) => update("expiresAt", v ? `${v}:00.000Z` : null)}
            />
          </div>
          <label className="setting-switch">
            <strong>Active discount</strong>
            <input
              type="checkbox"
              checked={editor.active}
              onChange={(e) => update("active", e.target.checked)}
            />
          </label>
          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditor(null)}
            >
              Cancel
            </Button>
            <SaveButton busy={busy}>Save discount</SaveButton>
          </div>
        </form>
      )}
    </Panel>,
    t,
  );
}
export default function CommercePanel({ notify }) {
  const { t } = useLanguage();
  const { value, setValue, error, busy, dirty, reload, save } =
    useSettingsEditor(notify);
  if (!value) return error ? <Notice error>{error}</Notice> : <Busy />;
  const c = value.commerce,
    update = (key, v) =>
      setValue((old) => ({ ...old, commerce: { ...old.commerce, [key]: v } }));
  return localizeView(
    <div className="space-y-6">
      <div className="workspace-heading">
        <div>
          <p className="admin-section-label">THE BUSINESS DETAILS</p>
          <h1>Built around the way you sell.</h1>
          <p>Delivery, pricing and promotions, connected to your checkout.</p>
        </div>
      </div>
      <form onSubmit={save} data-dirty={dirty} className="space-y-6">
        {error && (
          <Notice error>
            {error}{" "}
            <button type="button" className="underline" onClick={reload}>
              Reload latest data
            </button>
          </Notice>
        )}
        <div className="grid lg:grid-cols-2 gap-6">
          <Panel title="Delivery & order rules" icon={Truck}>
            <Amount
              label="Delivery fee"
              required
              value={value.checkout.shippingInCents}
              onChange={(v) =>
                setValue((old) => ({
                  ...old,
                  checkout: { ...old.checkout, shippingInCents: v },
                }))
              }
            />
            <Amount
              label="Free delivery from"
              hint="Leave blank to disable. Threshold applies after discounts."
              value={c.freeShippingOverInCents}
              onChange={(v) => update("freeShippingOverInCents", v)}
            />
            <Amount
              label="Minimum order amount"
              required
              value={c.minimumOrderInCents}
              onChange={(v) => update("minimumOrderInCents", v)}
            />
            <Field
              label="Delivery countries"
              multiline
              hint="One country name per line, in the language your customers use. Leave blank to accept any country."
              value={c.allowedCountries.join("\n")}
              onChange={(v) => update("allowedCountries", v.split("\n"))}
            />
          </Panel>
          <div className="space-y-6">
            <Panel title="Tax" icon={Receipt}>
              <Field
                label="Tax rate (%)"
                type="number"
                min="0"
                max="100"
                step="0.01"
                required
                value={c.taxRateBps / 100}
                onChange={(v) =>
                  update("taxRateBps", Math.round(Number(v) * 100))
                }
              />
              <Field
                label="Tax label"
                value={c.taxLabel}
                maxLength={40}
                required
                onChange={(v) => update("taxLabel", v)}
              />
              <Field
                label="Arabic tax label"
                value={c.taxLabelAr}
                maxLength={40}
                required
                onChange={(v) => update("taxLabelAr", v)}
              />
              <p className="admin-hint">
                Added to discounted merchandise. Delivery is excluded. Configure
                the rate required for your market; this is a single-rate tax
                model.
              </p>
            </Panel>
            <Panel title="Store availability" icon={Settings2}>
              <label className="setting-switch">
                <span>
                  <strong>Accept new orders</strong>
                  <small>Customers can browse while ordering is paused.</small>
                </span>
                <input
                  type="checkbox"
                  checked={c.acceptingOrders}
                  onChange={(e) => update("acceptingOrders", e.target.checked)}
                />
              </label>
              <Field
                label="Low-stock alert threshold"
                type="number"
                min="0"
                max="10000"
                required
                value={c.lowStockThreshold}
                onChange={(v) => update("lowStockThreshold", Number(v))}
              />
            </Panel>
          </div>
        </div>
        <div className="editor-savebar">
          <span>
            {dirty
              ? "You have unpublished changes."
              : "Commerce settings are up to date."}
          </span>
          <SaveButton busy={busy} disabled={!dirty}>
            Publish settings
          </SaveButton>
        </div>
      </form>
      <Discounts
        currency={value.checkout.currency}
        symbol={value.checkout.symbol}
        notify={notify}
      />
    </div>,
    t,
  );
}
