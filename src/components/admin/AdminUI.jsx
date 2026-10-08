import { useUploads } from "./UploadContext";
import useModal from "@/hooks/useModal";
import { useLanguage, localizeView } from "@/i18n/LanguageContext";
import React, { useId, useState } from "react";
import {
  Loader2,
  Upload,
  Info,
  X,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/api/store";
export function Field({
  label,
  hint,
  value,
  onChange,
  multiline = false,
  type = "text",
  maxLength,
  children,
  ...props
}) {
  const { t } = useLanguage();
  const id = useId();
  const Control = multiline ? "textarea" : "input";
  return localizeView(
    <div className="admin-field">
      <label htmlFor={id}>{label}</label>
      {children || (
        <Control
          id={id}
          dir={
            ["email", "tel", "number", "url"].includes(type) ? "ltr" : "auto"
          }
          type={type}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={`${id}-hint`}
          maxLength={maxLength}
          rows={multiline ? 4 : undefined}
          {...props}
        />
      )}
      <div className="admin-hint" id={`${id}-hint`}>
        {hint}
        {multiline && maxLength && (
          <span className="float-right">
            {String(value || "").length}/{maxLength}
          </span>
        )}
      </div>
    </div>,
    t,
  );
}
export function Panel({
  title,
  subtitle,
  icon: Icon,
  children,
  action,
  className = "",
}) {
  const { t } = useLanguage();
  return localizeView(
    <section className={`admin-panel ${className}`}>
      <div className="admin-panel-heading">
        <div>
          {title && (
            <h2>
              {Icon && <Icon size={20} />} {title}
            </h2>
          )}
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>,
    t,
  );
}
export function Notice({ children, error = false }) {
  const { t } = useLanguage();
  return localizeView(
    <div
      className={`admin-notice ${error ? "is-error" : ""}`}
      role={error ? "alert" : "status"}
    >
      {error ? <AlertCircle size={18} /> : <Info size={18} />}
      <div>{children}</div>
    </div>,
    t,
  );
}
export function Busy() {
  const { t } = useLanguage();
  return localizeView(
    <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
      <Loader2 size={24} className="animate-spin" /> Loading…
    </div>,
    t,
  );
}
export function SaveButton({ busy, children = "Save changes", ...props }) {
  const { t } = useLanguage();
  const [uploadCount] = useUploads();
  return localizeView(
    <Button
      type="submit"
      {...props}
      disabled={busy || uploadCount > 0 || props.disabled}
    >
      {busy ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <CheckCircle2 className="mr-2 h-4 w-4" />
      )}
      {children}
    </Button>,
    t,
  );
}
export function ImagePicker({
  value,
  onChange,
  kind = "product",
  label = "Image",
  onError,
}) {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [uploadCount, setUploadCount] = useUploads();
  const id = useId();
  async function upload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setBusy(true);
    setUploadCount((count) => count + 1);
    try {
      const body = new FormData();
      body.set("image", file);
      body.set("kind", kind);
      const data = await api("/admin/upload", {
        method: "POST",
        body,
      });
      onChange(data.url);
    } catch (err) {
      onError?.(err.message);
    } finally {
      setBusy(false);
      setUploadCount((count) => Math.max(0, count - 1));
      e.target.value = "";
    }
  }
  return localizeView(
    <div className="admin-image-picker">
      <div
        className={`admin-image-preview ${kind === "hero" ? "hero" : kind === "logo" ? "logo" : ""}`}
      >
        {value ? <img src={value} alt={label} /> : <Upload size={28} />}
      </div>
      <div className="flex-1">
        <strong className="text-sm">{label}</strong>
        <p className="admin-hint my-2">
          {kind === "original"
            ? "Original proportions, up to 1800 px. JPG, PNG, WebP or AVIF, up to 10 MB."
            : kind === "logo"
              ? "Transparent PNG or WebP recommended. Your logo keeps its proportions, up to 640 × 240 px."
              : kind === "wide"
                ? "Recommended: 1,800 × 1,200 px (3:2). Adjust the desktop and mobile focal positions in Store design."
                : kind === "hero"
                  ? "Recommended: 1,600 × 1,800 px. Keep the subject centred; the existing responsive hero crops the image to fill its panel."
                  : "800 × 1,000 px (4:5 portrait). Used in cards, product gallery, cart and order receipts."}{" "}
          {kind === "original"
            ? "Images keep their original proportions without cropping."
            : kind === "logo"
              ? "JPG, PNG, WebP or AVIF, up to 10 MB. Logos are resized without cropping."
              : "JPG, PNG, WebP or AVIF, up to 10 MB. Uploads are automatically cropped and compressed."}
        </p>
        <label htmlFor={id} className="admin-upload-button">
          {busy ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Upload size={16} />
          )}{" "}
          {busy ? "Preparing image…" : "Choose image"}
        </label>
        <input
          id={id}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          className="sr-only"
          onChange={upload}
          disabled={busy || uploadCount > 0}
        />
      </div>
    </div>,
    t,
  );
}
export function ConfirmDialog({
  title,
  children,
  onConfirm,
  onClose,
  busy = false,
}) {
  const { t } = useLanguage();
  const close = () => {
    if (!busy) onClose();
  };
  const modalRef = useModal(true, close);
  return localizeView(
    <div className="admin-modal-backdrop" onClick={close}>
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="admin-modal max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl">{title}</h2>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={close}
            aria-label="Close dialog"
          >
            <X size={18} />
          </Button>
        </div>
        <div className="text-sm text-muted-foreground mb-6">{children}</div>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={close}>
            Keep it
          </Button>
          <Button
            type="button"
            className="bg-destructive hover:bg-destructive/90"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Deleting…" : "Delete product"}
          </Button>
        </div>
      </div>
    </div>,
    t,
  );
}
