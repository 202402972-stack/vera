import React, { useState } from "react";
import { api, jsonRequest } from "@/api/store";
import { useLanguage } from "@/i18n/LanguageContext";
export default function PasswordPanel() {
  const { language } = useLanguage();
  const ar = language === "ar";
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      await api(
        "/admin/password",
        jsonRequest("POST", {
          currentPassword: data.get("current"),
          password: data.get("password"),
        }),
      );
      window.dispatchEvent(new Event("admin-session-expired"));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="rounded-2xl border p-5 bg-white">
      <h2 className="text-xl mb-2">
        {ar ? "كلمة مرور إدارة المتجر" : "Store dashboard password"}
      </h2>
      <p className="text-sm mb-4">
        {ar
          ? "بعد تغييرها، سيتم تسجيل خروج جلسات إدارة المتجر."
          : "Changing the password signs out all store dashboard sessions."}
      </p>
      <form onSubmit={submit} className="grid gap-3 max-w-md">
        <label>
          {ar ? "كلمة المرور الحالية" : "Current password"}
          <input
            className="flex w-full rounded-md border px-3 py-2"
            name="current"
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
          />
        </label>
        <label>
          {ar
            ? "كلمة مرور جديدة — ١٢ حرفًا على الأقل"
            : "New password — at least 12 characters"}
          <input
            className="flex w-full rounded-md border px-3 py-2"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <button
          className="rounded-md bg-primary text-primary-foreground px-4 py-2 disabled:opacity-50"
          disabled={busy}
        >
          {busy ? "…" : ar ? "تغيير كلمة المرور" : "Change password"}
        </button>
      </form>
    </section>
  );
}
