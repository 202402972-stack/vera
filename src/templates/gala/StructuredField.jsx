import React from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { ImagePicker } from "@/components/admin/AdminUI";
import { galaDefaults } from "@/data/gala";
import { MoveUp, MoveDown, Trash2, Plus } from "lucide-react";
const blankTemplates = {
  socials: { label: "", path: "https://" },
  testimonials: {
    name: "",
    title: { en: "", ar: "" },
    body: { en: "", ar: "" },
    rating: 5,
  },
  navigation: galaDefaults.navigation[0],
  faq: galaDefaults.faq[0],
  productFaq: galaDefaults.productFaq[0],
  services: galaDefaults.services[0],
  footerColumns: galaDefaults.footerColumns[0],
  links: galaDefaults.footerColumns[0].links[0],
  optionValues: { name: "Size", value: "" },
  relatedIds: "",
  bundleIds: "",
  recommendedIds: "",
  trendingIds: "",
  lookbookIds: "",
  collectionIds: "",
};
const human = (s) =>
  s.replace(/([A-Z])/g, " $1").replace(/^./, (x) => x.toUpperCase());
export function StructuredField({
  value,
  onChange,
  label,
  path = "",
  onError = () => {},
  options = {},
}) {
  const { language } = useLanguage(),
    copy = (en, ar) => (language === "ar" ? ar : en);
  const key = path.split(".").at(-1);
  const title = label || human(key);
  if (typeof value === "boolean")
    return (
      <label className="gs-toggle">
        <span>{title}</span>
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
        />
      </label>
    );
  if (Array.isArray(value)) {
    const fixed = ["sections", "images", "positions"].includes(key);
    return (
      <fieldset className="gs-array">
        <legend>{title}</legend>
        {value.map((item, i) => (
          <div className="gs-array-item" key={i}>
            <div className="gs-array-tools">
              <span>{i + 1}</span>
              <button
                type="button"
                disabled={!i}
                aria-label={copy("Move up", "تحريك لأعلى")}
                onClick={() => {
                  const a = [...value];
                  [a[i - 1], a[i]] = [a[i], a[i - 1]];
                  onChange(a);
                }}
              >
                <MoveUp size={14} />
              </button>
              <button
                type="button"
                disabled={i === value.length - 1}
                aria-label={copy("Move down", "تحريك لأسفل")}
                onClick={() => {
                  const a = [...value];
                  [a[i + 1], a[i]] = [a[i], a[i + 1]];
                  onChange(a);
                }}
              >
                <MoveDown size={14} />
              </button>
              {!fixed && (
                <button
                  type="button"
                  aria-label={copy("Remove item", "حذف العنصر")}
                  onClick={() => onChange(value.filter((_, j) => j !== i))}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
            <StructuredField
              value={item}
              path={path + "." + i}
              label={typeof item === "object" ? undefined : `${title} ${i + 1}`}
              onError={onError}
              options={options}
              onChange={(next) =>
                onChange(value.map((x, j) => (j === i ? next : x)))
              }
            />
          </div>
        ))}
        {!fixed && (
          <button
            type="button"
            className="gs-add"
            onClick={() =>
              onChange([
                ...value,
                structuredClone(blankTemplates[key] ?? value[0] ?? ""),
              ])
            }
          >
            <Plus size={15} />
            {copy("Add item", "إضافة عنصر")}
          </button>
        )}
      </fieldset>
    );
  }
  if (value && typeof value === "object")
    return (
      <fieldset className="gs-object">
        <legend>{title}</legend>
        {Object.entries(value).map(([k, v]) => (
          <StructuredField
            key={k}
            path={path + "." + k}
            label={k === "en" ? "English" : k === "ar" ? "العربية" : human(k)}
            value={v}
            options={options}
            onError={onError}
            onChange={(next) => onChange({ ...value, [k]: next })}
          />
        ))}
      </fieldset>
    );
  if (/(^|\.)(images|storyImage)(\.|$)/.test(path) || key === "image")
    return (
      <ImagePicker
        kind="original"
        value={value}
        onChange={onChange}
        onError={onError}
        label={title}
      />
    );
  if (/^#[a-f\d]{6}$/i.test(value) && path.includes("palette"))
    return (
      <label className="gs-colour">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <span>
          {title}
          <small>{value}</small>
        </span>
      </label>
    );
  const choices =
    key === "body" && path.includes("typography")
      ? ["Albert", "System"]
      : key === "heading"
        ? ["Reference", "Serif", "Sans"]
        : key === "cardRatio"
          ? ["portrait", "square", "landscape"]
          : key === "icon"
            ? ["truck", "lock", "return", "chat"]
            : key === "menu"
              ? ["", "products", "collections"]
              : null;
  const idSource = /Ids\.\d+$/.test(path)
    ? path.includes("collectionIds")
      ? options.collections
      : options.products
    : null;
  if (choices || idSource)
    return (
      <label className="gs-field">
        {title}
        <select value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{copy("Choose…", "اختر…")}</option>
          {(choices || idSource).map((c) => (
            <option
              key={typeof c === "string" ? c : c.id}
              value={typeof c === "string" ? c : c.id}
            >
              {typeof c === "string" ? c : c.title || c.name}
            </option>
          ))}
        </select>
      </label>
    );
  const long =
    typeof value === "string" &&
    (value.length > 100 || ["text", "body", "answer"].includes(key));
  const Tag = long ? "textarea" : "input";
  return (
    <label className="gs-field">
      {title}
      <Tag
        value={value ?? ""}
        type={typeof value === "number" ? "number" : "text"}
        step={typeof value === "number" ? "any" : undefined}
        readOnly={key === "id" && path.startsWith("sections")}
        onChange={(e) =>
          onChange(
            typeof value === "number" ? Number(e.target.value) : e.target.value,
          )
        }
      />
    </label>
  );
}
