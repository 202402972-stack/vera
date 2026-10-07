import { Palette, Type, Megaphone, Sparkles, ArrowUpRight } from "lucide-react";
import { useLanguage, localizeView } from "@/i18n/LanguageContext";
import { localizeSettings, updateStoreContent } from "@/i18n/content";
import { brandPresets } from "@/data/brand";
import { brandTokens, contrast } from "@/lib/brand";
import useSettingsEditor from "@/hooks/useSettingsEditor";
import { Panel, Field, ImagePicker, Notice, Busy, SaveButton } from "./AdminUI";
import { Button } from "@/components/ui/button";

export default function BrandStudio({ notify }) {
  const { t, language } = useLanguage();
  const { value, setValue, error, setError, busy, dirty, reload, save } =
    useSettingsEditor(notify);
  if (!value) return error ? <Notice error>{error}</Notice> : <Busy />;
  const b = value.brand,
    visible = localizeSettings(value, language);
  const set = (key, v) =>
    setValue((prev) => ({ ...prev, brand: { ...prev.brand, [key]: v } }));
  const minimumContrast = Math.min(
    ...["foreground", "muted", "primary"].flatMap((ink) =>
      ["surface", "background"].map((surface) => contrast(b[ink], b[surface])),
    ),
  );
  return localizeView(
    <form onSubmit={save} data-dirty={dirty} className="space-y-6">
      <div className="workspace-heading">
        <div>
          <p className="admin-section-label">MAKE IT YOURS</p>
          <h1>Your brand, beautifully expressed.</h1>
          <p>A complete identity, carried through every customer touchpoint.</p>
        </div>
        <span className="workspace-tag">
          <Sparkles size={14} /> Brand studio
        </span>
      </div>
      {error && (
        <Notice error>
          {error}{" "}
          <button type="button" className="underline" onClick={reload}>
            Reload latest data
          </button>
        </Notice>
      )}
      <div className="brand-studio-grid">
        <div className="space-y-6">
          <Panel
            title="Brand identity"
            subtitle="Edit the name in the selected language. Your logo is shared."
            icon={Type}
          >
            <Field
              label="Store name"
              value={visible.name}
              required
              maxLength={65}
              onChange={(v) =>
                setValue((prev) =>
                  updateStoreContent(prev, language, null, "name", v),
                )
              }
            />
            <ImagePicker
              kind="logo"
              label="Brand logo"
              value={b.logo}
              onChange={(v) => set("logo", v)}
              onError={setError}
            />
            {b.logo && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => set("logo", "")}
              >
                Use text wordmark
              </Button>
            )}
          </Panel>
          <Panel
            title="Signature palette"
            subtitle="Curated foundations. Refine every color below."
            icon={Palette}
          >
            <div className="palette-presets">
              {Object.entries(brandPresets).map(([key, preset]) => (
                <button
                  type="button"
                  key={key}
                  className={`palette-preset ${b.primary === preset.primary ? "selected" : ""}`}
                  onClick={() =>
                    setValue((prev) => ({
                      ...prev,
                      brand: { ...prev.brand, ...preset },
                    }))
                  }
                  aria-pressed={b.primary === preset.primary}
                >
                  <span className="palette-swatches">
                    {[preset.primary, preset.background, preset.foreground].map(
                      (color) => (
                        <i key={color} style={{ background: color }} />
                      ),
                    )}
                  </span>
                  <span>{t(preset.name)}</span>
                </button>
              ))}
            </div>
            <div className="color-fields">
              {[
                ["primary", "Accent"],
                ["button", "Button fill"],
                ["background", "Canvas"],
                ["surface", "Surface"],
                ["foreground", "Text"],
                ["muted", "Secondary text"],
              ].map(([key, label]) => (
                <label className="color-field" key={key}>
                  <span>{t(label)}</span>
                  <span>
                    <input
                      aria-label={t(label)}
                      type="color"
                      value={b[key]}
                      onChange={(e) => set(key, e.target.value)}
                    />
                    <code>{b[key].toUpperCase()}</code>
                  </span>
                </label>
              ))}
            </div>
            <p
              className={`contrast-note ${minimumContrast < 4.5 ? "invalid" : ""}`}
            >
              {t("Minimum text contrast")}: {minimumContrast.toFixed(2)}:1 ·{" "}
              {minimumContrast >= 4.5
                ? "WCAG AA"
                : t("Choose darker text or a lighter surface.")}
            </p>
            <div className="grid sm:grid-cols-2 gap-4 mt-5">
              <Field label="Heading style">
                <select
                  aria-label={t("Heading style")}
                  value={b.headingStyle}
                  onChange={(e) => set("headingStyle", e.target.value)}
                >
                  <option value="serif">Editorial serif</option>
                  <option value="sans">Modern sans</option>
                </select>
              </Field>
              <Field label="Corners">
                <select
                  aria-label={t("Corners")}
                  value={b.radius}
                  onChange={(e) => set("radius", e.target.value)}
                >
                  <option value="soft">Soft</option>
                  <option value="sharp">Architectural</option>
                </select>
              </Field>
            </div>
          </Panel>
          <Panel title="Announcement & layout" icon={Megaphone}>
            <label className="setting-switch">
              <span>
                <strong>Announcement bar</strong>
                <small>A short message above the store navigation.</small>
              </span>
              <input
                type="checkbox"
                checked={b.announcement.enabled}
                onChange={(e) =>
                  set("announcement", {
                    ...b.announcement,
                    enabled: e.target.checked,
                  })
                }
              />
            </label>
            <Field
              label={language === "ar" ? "Arabic announcement" : "Announcement"}
              value={b.announcement[language === "ar" ? "textAr" : "text"]}
              maxLength={180}
              onChange={(v) =>
                set("announcement", {
                  ...b.announcement,
                  [language === "ar" ? "textAr" : "text"]: v,
                })
              }
            />
            <Field
              label="Announcement link"
              value={b.announcement.link}
              maxLength={500}
              onChange={(v) =>
                set("announcement", { ...b.announcement, link: v })
              }
            />
            <label className="setting-switch">
              <span>
                <strong>Brand story section</strong>
                <small>Show your story on the homepage.</small>
              </span>
              <input
                type="checkbox"
                checked={b.showStory}
                onChange={(e) => set("showStory", e.target.checked)}
              />
            </label>
          </Panel>
        </div>
        <aside className="brand-preview-column">
          <div className="preview-label">
            <span>LIVE PREVIEW</span>
            <span>{dirty ? "Unsaved changes" : "Published"}</span>
          </div>
          <div className="brand-preview" style={brandTokens(b)}>
            {b.announcement.enabled && (
              <div className="preview-announcement">
                {language === "ar"
                  ? b.announcement.textAr || b.announcement.text
                  : b.announcement.text}
              </div>
            )}
            <div className="preview-wordmark">
              {b.logo ? <img src={b.logo} alt={visible.name} /> : visible.name}
              <span>{visible.tagline}</span>
            </div>
            <img
              src={value.hero.image}
              alt={visible.hero.alt}
              className="preview-hero-image"
            />
            <div className="preview-copy">
              <span className="preview-eyebrow">{visible.tagline}</span>
              <h2>{visible.hero.title}</h2>
              <p>{visible.hero.text}</p>
              <span className="preview-cta">
                {visible.hero.button}
                <ArrowUpRight size={15} />
              </span>
            </div>
            <div className="preview-footer">
              {visible.name} · {visible.footer.rights}
            </div>
          </div>
          <p className="admin-hint mt-3">
            Preview uses your actual content. Publish to update the storefront.
          </p>
        </aside>
      </div>
      <div className="editor-savebar">
        <span>
          {dirty
            ? "You have unpublished changes."
            : "Your brand is up to date."}
        </span>
        <SaveButton busy={busy} disabled={!dirty || minimumContrast < 4.5}>
          Publish brand
        </SaveButton>
      </div>
    </form>,
    t,
  );
}
