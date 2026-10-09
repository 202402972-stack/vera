import React, { createContext, useContext, useEffect, useMemo } from "react";
import { Link as RouterLink, useLocation, useNavigate } from "react-router-dom";
import { createStoreApi, api as legacyApi } from "@/api/store";
import { storeUrl as legacyUrl } from "@/lib/store-scope";
const Context = createContext(null);
export function StoreScopeProvider({ store, children }) {
  const scope = useMemo(() => {
    const controller = new AbortController();
    return {
      ...store,
      storeId: store.id,
      publicBase: store.url,
      adminBase: `/workspace/stores/${store.id}`,
      apiBase: store.url + "/api",
      controller,
      api: createStoreApi(store.url, store.id, controller.signal),
    };
  }, [store]);
  useEffect(() => () => scope.controller.abort(), [scope]);
  return <Context.Provider value={scope}>{children}</Context.Provider>;
}
export const useStoreScope = () => useContext(Context);
export function useStoreApi() {
  return useStoreScope()?.api || legacyApi;
}
export function useStoreUrl() {
  const scope = useStoreScope();
  return scope ? (path) => scope.publicBase + path : legacyUrl;
}
function sectionUrl(scope, to) {
  if (typeof to !== "string") return to;
  if (to === "/") return scope.publicBase;
  if (!to.startsWith("/admin")) return to;
  const params = new URLSearchParams(to.split("?")[1]);
  const tab = params.get("tab") || "overview";
  params.delete("tab");
  return scope.adminBase + "/" + tab + (params.size ? "?" + params : "");
}
function canLeave() {
  return (
    !document.querySelector('[data-dirty="true"]') ||
    window.confirm(
      document.documentElement.lang === "ar"
        ? "تجاهل التعديلات غير المحفوظة؟"
        : "Discard unsaved changes?",
    )
  );
}
export function Link({ to, onClick, ...props }) {
  const scope = useStoreScope();
  return (
    <RouterLink
      to={scope ? sectionUrl(scope, to) : to}
      {...props}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented && !canLeave()) e.preventDefault();
      }}
    />
  );
}
export function useAdminNavigation() {
  const scope = useStoreScope(),
    location = useLocation(),
    navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  if (scope) params.set("tab", location.pathname.split("/")[4] || "overview");
  return [
    params,
    (next) => {
      if (scope)
        navigate(sectionUrl(scope, "/admin?" + new URLSearchParams(next)));
      else navigate({ search: "?" + new URLSearchParams(next) });
    },
  ];
}
