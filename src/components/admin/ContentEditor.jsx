import { useLanguage, localizeView } from "@/i18n/LanguageContext";
import { localizeSettings, updateStoreContent } from "@/i18n/content";
import React, { useState, useEffect } from "react";
import {
  Type,
  Image,
  BookOpen,
  LayoutGrid,
  Mail,
  Link as LinkIcon,
  Plus,
  Trash2,
  Save,
  ShieldCheck,
  Banknote,
} from "lucide-react";
import { api, jsonRequest } from "@/api/store";
import { useStore } from "@/hooks/useStore";
import { Button } from "@/components/ui/button";
import { Panel, Field, ImagePicker, Notice, SaveButton, Busy } from "./AdminUI";
export default function ContentEditor({ section = "content", notify }) {
  const { t, language } = useLanguage();
  const { setStore } = useStore();
  const [savedValue, setSavedValue] = useState("");
  const [deliveryFeeText, setDeliveryFeeText] = useState("0.00");
  const [rawValue, setValue] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    api("/admin/store")
      .then((data) => {
        setValue(data);
        setSavedValue(JSON.stringify(data));
        setDeliveryFeeText((data.checkout.shippingInCents / 100).toFixed(2));
      })
      .catch((e) => setError(e.message));
  }, []);
  const value = rawValue ? localizeSettings(rawValue, language) : null;
  const update = (group, key, v) =>
    setValue((prev) => updateStoreContent(prev, language, group, key, v));
  const field = (
    group,
    key,
    label,
    hint,
    max,
    multiline = false,
    extra = {},
  ) => (
    <Field
      label={label}
      hint={hint}
      value={group ? value[group][key] : value[key]}
      onChange={(v) => update(group, key, v)}
      maxLength={max}
      multiline={multiline}
      {...extra}
    />
  );
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const data = await api("/admin/store", jsonRequest("PUT", rawValue));
      setValue(data);
      setSavedValue(JSON.stringify(data));
      setDeliveryFeeText((data.checkout.shippingInCents / 100).toFixed(2));
      setStore(data);
      notify("Store content saved. Your storefront is up to date.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!value)
    return localizeView(error ? <Notice error>{error}</Notice> : <Busy />, t);
  return localizeView(
    <form
      onSubmit={save}
      data-dirty={JSON.stringify(rawValue) !== savedValue}
      className="space-y-6"
    >
      <Notice>
        {language === "ar"
          ? "Editing Arabic copy. Switch language to edit English. Images, stock and prices are shared."
          : "Editing English copy. Switch language to edit Arabic. Images, stock and prices are shared."}
      </Notice>
      {error && (
        <Notice error>
          {error}{" "}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              api("/admin/store")
                .then((data) => {
                  setValue(data);
                  setSavedValue(JSON.stringify(data));
                  setDeliveryFeeText(
                    (data.checkout.shippingInCents / 100).toFixed(2),
                  );
                  setError("");
                })
                .catch((e) => setError(e.message))
            }
          >
            Reload latest data
          </Button>
        </Notice>
      )}
      {section === "content" ? (
        <>
          <div className="grid lg:grid-cols-2 gap-6">
            <Panel
              title="Store identity"
              subtitle="Your name appears in the header, footer, browser titles and order receipts."
              icon={Type}
            >
              {field(
                null,
                "name",
                "Store name",
                "Aim for 2–4 words, close to the original 20-character name. Maximum 65 characters.",
                65,
                false,
                {
                  required: true,
                },
              )}
              {field(
                null,
                "tagline",
                "Browser title tagline",
                "Keep this short: approximately 4–8 words.",
                120,
              )}
              {field(
                null,
                "metaDescription",
                "Search engine description",
                "Recommended: 140–160 characters. This does not change the visible layout.",
                300,
                true,
              )}
            </Panel>
            <Panel title="Keep the original proportions" icon={Image}>
              <Notice>
                The editor uses the existing design. Keep captions near the
                original lengths for the same line breaks and visual balance.
                Longer copy wraps within the original layout; it may change the
                section height.
              </Notice>
              <ul className="text-sm space-y-4 text-muted-foreground">
                <li>
                  <strong className="text-foreground">Hero heading:</strong> the
                  original has 4 words / 30 characters. Aim for 4–7 words.
                </li>
                <li>
                  <strong className="text-foreground">Hero caption:</strong> the
                  original has 23 words. Aim for 20–30 words.
                </li>
                <li>
                  <strong className="text-foreground">Story:</strong> the
                  original has 60 words. Aim for 50–70 words.
                </li>
                <li>
                  <strong className="text-foreground">Product images:</strong>{" "}
                  exactly 4:5, matching both card and detail views.
                </li>
                <li>
                  <strong className="text-foreground">Hero image:</strong> fills
                  a responsive panel. Use a centred subject with room around its
                  edges.
                </li>
              </ul>
            </Panel>
          </div>
          <Panel
            title="Hero section"
            subtitle="Every visible word in your opening section."
            icon={Image}
          >
            <div className="grid lg:grid-cols-2 gap-8">
              <div>
                {field(
                  "hero",
                  "title",
                  "Hero heading",
                  "4–7 words recommended. Original: “Handcrafted Alpaca Wool Luxury”.",
                  100,
                  false,
                  {
                    required: true,
                  },
                )}
                {field(
                  "hero",
                  "text",
                  "Hero caption",
                  "20–30 words recommended; about 150–220 characters.",
                  650,
                  true,
                  {
                    required: true,
                  },
                )}
                {field(
                  "hero",
                  "button",
                  "Button text",
                  "2–3 words. This button scrolls to your collection.",
                  30,
                  false,
                  {
                    required: true,
                  },
                )}
              </div>
              <div>
                <ImagePicker
                  label="Hero photograph"
                  value={value.hero.image}
                  kind="hero"
                  onChange={(v) => update("hero", "image", v)}
                  onError={setError}
                />
                {field(
                  "hero",
                  "alt",
                  "Image description",
                  "Describe the photograph for visitors using screen readers.",
                  200,
                  false,
                  {
                    required: true,
                  },
                )}
              </div>
            </div>
          </Panel>
          <Panel title="About / story" icon={BookOpen}>
            {field(
              "story",
              "title",
              "Section heading",
              "2–4 words recommended.",
              80,
              false,
              {
                required: true,
              },
            )}
            {field(
              "story",
              "text",
              "Your story",
              "50–70 words recommended. Plain text keeps the original typography.",
              2400,
              true,
              {
                required: true,
              },
            )}
          </Panel>
          <Panel title="Collection introduction" icon={LayoutGrid}>
            <div className="grid md:grid-cols-2 gap-6">
              {field(
                "collection",
                "title",
                "Collection heading",
                "2–4 words recommended.",
                80,
                false,
                {
                  required: true,
                },
              )}
              {field(
                "collection",
                "text",
                "Collection caption",
                "Aim for 10–14 words, approximately the length of the original.",
                250,
                false,
                {
                  required: true,
                },
              )}
            </div>
          </Panel>
        </>
      ) : (
        <>
          <Panel
            title="Footer & contact"
            subtitle="Manage every piece of contact information and footer text."
            icon={Mail}
          >
            <div className="grid md:grid-cols-2 gap-6">
              {field(
                "footer",
                "email",
                "Email address",
                "Shown exactly as entered.",
                200,
                false,
                {
                  type: "email",
                },
              )}
              {field(
                "footer",
                "phone",
                "Phone number",
                "Include your country code.",
                60,
                false,
                { type: "tel" },
              )}
              {field(
                "footer",
                "location",
                "Location",
                "A short city / country is closest to the original design.",
                200,
              )}
              {field(
                "footer",
                "rights",
                "Copyright text",
                "The year and store name are added automatically.",
                150,
              )}
            </div>
            {field(
              "footer",
              "text",
              "Footer caption",
              "Aim for 15–22 words, matching the original.",
              500,
              true,
              {
                required: true,
              },
            )}
          </Panel>
          <Panel title="Links & social media" icon={LinkIcon}>
            <Notice>
              Use a full https:// URL for social media. Internal links use paths
              such as /, /shop, /about or /contact. Social links appear only
              when you add them.
            </Notice>
            {[
              ["quickLinks", "Quick links"],
              ["socials", "Social media"],
            ].map(([key, label]) => (
              <div key={key} className="mb-8">
                <h3 className="text-xl mb-4">{label}</h3>
                {value.footer[key].map((link, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto] items-start gap-3"
                  >
                    <Field
                      label="Label"
                      value={link.label}
                      onChange={(v) =>
                        update(
                          "footer",
                          key,
                          value.footer[key].map((x, n) =>
                            n === i
                              ? {
                                  ...x,
                                  label: v,
                                }
                              : x,
                          ),
                        )
                      }
                      maxLength={40}
                      required
                    />
                    <Field
                      label="Link"
                      value={link.path}
                      onChange={(v) =>
                        update(
                          "footer",
                          key,
                          value.footer[key].map((x, n) =>
                            n === i
                              ? {
                                  ...x,
                                  path: v,
                                }
                              : x,
                          ),
                        )
                      }
                      maxLength={500}
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mt-6"
                      aria-label={`Remove ${link.label || "link"}`}
                      onClick={() =>
                        update(
                          "footer",
                          key,
                          value.footer[key].filter((_, n) => n !== i),
                        )
                      }
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  disabled={value.footer[key].length >= 12}
                  onClick={() =>
                    update("footer", key, [
                      ...value.footer[key],
                      {
                        label: "",
                        path: key === "socials" ? "https://" : "/",
                      },
                    ])
                  }
                >
                  <Plus size={16} className="mr-2" /> Add {label.toLowerCase()}{" "}
                  link
                </Button>
              </div>
            ))}
          </Panel>
          <Panel title="Checkout settings" icon={Banknote}>
            <div className="grid sm:grid-cols-3 gap-6">
              {field(
                "checkout",
                "currency",
                "Currency code",
                "Three letters, for example USD, EUR or GBP. Updates the catalogue currency; does not convert prices.",
                3,
                false,
                {
                  required: true,
                  pattern: "[A-Z]{3}",
                },
              )}
              {field(
                "checkout",
                "symbol",
                "Currency symbol",
                "For example $, € or £.",
                8,
                false,
                {
                  required: true,
                },
              )}
              <Field
                label="Delivery fee"
                type="number"
                min="0"
                step="0.01"
                value={deliveryFeeText}
                onChange={(v) => {
                  setDeliveryFeeText(v);
                  update(
                    "checkout",
                    "shippingInCents",
                    Math.round(Number(v) * 100),
                  );
                }}
                hint="0 means free delivery. Added once per order."
              />
            </div>
            {field(
              "checkout",
              "deliveryNote",
              "Delivery / confirmation note",
              "Shown at checkout and on the confirmation page. Do not promise email delivery unless you handle it yourself.",
              500,
              true,
              {
                required: true,
              },
            )}
          </Panel>
          <Panel title="Store policies" icon={ShieldCheck}>
            {field(
              "pages",
              "shipping",
              "Shipping & delivery",
              "Publish the delivery policy for your market.",
              12000,
              true,
            )}
            {field(
              "pages",
              "returns",
              "Returns & exchanges",
              "Describe eligibility, time limits and how customers request a return.",
              12000,
              true,
            )}
            {field(
              "pages",
              "privacy",
              "Privacy Policy",
              "Review for your store and jurisdiction. First-party analytics respect Do Not Track and Global Privacy Control.",
              12000,
              true,
              {
                required: true,
              },
            )}
            {field(
              "pages",
              "terms",
              "Terms of Service",
              "Describe delivery, cancellation and returns for your store.",
              12000,
              true,
              {
                required: true,
              },
            )}
          </Panel>
        </>
      )}
      <div className="sticky bottom-4 flex items-center justify-between bg-card/95 backdrop-blur border border-border rounded-xl p-4 shadow-lg">
        <p className="text-xs text-muted-foreground">
          Changes go live when you save.
        </p>
        <SaveButton busy={busy} />
      </div>
    </form>,
    t,
  );
}
