import { AsyncLocalStorage } from "node:async_hooks";
export const tenantContext = new AsyncLocalStorage();
export const tenantId = () => tenantContext.getStore()?.id || 0;
export const tenantPath = () => tenantContext.getStore()?.base || "/";
export const adminCookie = () =>
  tenantId() ? `store_admin_${tenantId()}` : "store_admin";
export function inTenant(id, base, fn) {
  if (!Number.isSafeInteger(id) || id < 1)
    throw new Error("Invalid tenant identity");
  return tenantContext.run({ id, base }, fn);
}
const identifiers = new Set([
  "settings",
  "products",
  "orders",
  "admin_sessions",
  "visits",
  "events",
  "discounts",
  "order_history",
  "subscribers",
  "variant_lookup",
  "shoppers", "shopper_sessions", "retail_reviews", "retail_returns",
]);
export function registerTenantIdentifiers(names) { for(const name of names) identifiers.add(name); }
export function tenantSQL(sql, id = tenantId(), extra = []) {
  if (!id) return sql;
  if (!Number.isSafeInteger(id) || id < 1)
    throw new Error("Invalid tenant identity");
  const names = new Set([...identifiers, ...extra]);
  // Tokenize SQL: never rewrite literals, comments, parameters, or partial identifiers.
  return sql.replace(
    /'(?:''|[^'])*'|--[^\n]*|\/\*[\s\S]*?\*\/|"(?:""|[^"])*"|\[[^\]]*\]|`[^`]*`|[A-Za-z_][A-Za-z_0-9]*/g,
    (token) => {
      const plain = /^['/\-]/.test(token)
        ? null
        : token.replace(/^["`\[]|["`\]]$/g, "");
      return names.has(plain) ? `"t_${id}_${plain}"` : token;
    },
  );
}
