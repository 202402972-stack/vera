import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "@/hooks/useStore";
import { useStoreScope } from "./StoreScope";
import { request } from "@/platform/api";
import DesignPreview from "@/components/admin/DesignPreview";
import { useLanguage } from "@/i18n/LanguageContext";
export function StorePreview() {
  const { baseStore } = useStore(),
    [error, setError] = useState("");
  return (
    <section>
      {error && <p role="alert">{error}</p>}
      <DesignPreview value={baseStore} onError={setError} />
    </section>
  );
}
export function StoreImports() {
  const scope = useStoreScope(),
    { language } = useLanguage(),
    t = (ar, en) => (language === "ar" ? ar : en),
    [jobs, setJobs] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    request("/import-jobs?storeId=" + scope.id)
      .then((d) => active && setJobs(d.jobs))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [scope.id]);
  return (
    <section className="v-panel">
      <h2>{t("سجل نقل هذا المتجر", "This store’s import history")}</h2>
      {error && <p role="alert">{error}</p>}
      {jobs?.length === 0 && (
        <p>
          {t(
            "لا توجد عمليات نقل مرتبطة؛ النقل الأولي ينشئ مسودة جديدة.",
            "No linked imports; initial import creates a new draft.",
          )}
        </p>
      )}
      {jobs?.map((j) => (
        <p key={j.id}>
          <Link to={"/workspace/import?job=" + j.id}>
            {j.sourceType} · {j.state}
          </Link>
        </p>
      ))}
      <Link to="/workspace/import">
        {t("افتح مساحة النقل", "Open import workspace")} ↗
      </Link>
    </section>
  );
}
