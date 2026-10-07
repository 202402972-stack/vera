export const storeBase =
  window.location.pathname.match(/^\/(?:s|demo)\/[^/]+(?=\/|$)/)?.[0] || "";
export const storeUrl = (path) => storeBase + path;
export const storeKey = (key) => (storeBase ? `${storeBase}:${key}` : key);
