import { storeBase, storeKey } from "@/lib/store-scope";
let queue = [],
  session,
  visitor,
  lastActivity = 0,
  visibleSince = document.visibilityState === "visible" ? Date.now() : null,
  duration = 0,
  metadata = {};
const allowed = () =>
  navigator.doNotTrack !== "1" && !navigator.globalPrivacyControl;
const visibleDuration = () =>
  duration + (visibleSince === null ? 0 : Date.now() - visibleSince);
function identity() {
  if (!allowed()) return false;
  const now = Date.now();
  if (session && now - lastActivity < 1800000) return true;
  if (session) flush(true);
  try {
    visitor = localStorage.getItem(storeKey("store-visitor")) || crypto.randomUUID();
    localStorage.setItem(storeKey("store-visitor"), visitor);
    const prior = JSON.parse(sessionStorage.getItem(storeKey("store-visit")) || "null");
    const resumed = prior && now - prior.at < 1800000;
    session = resumed ? prior.id : crypto.randomUUID();
    duration = resumed ? Number(prior.duration) || 0 : 0;
    visibleSince = document.visibilityState === "visible" ? now : null;
    lastActivity = now;
    const params = new URLSearchParams(window.location.search);
    metadata = resumed
      ? prior.metadata || {}
      : {
          referrer: document.referrer,
          source: params.get("utm_source"),
          medium: params.get("utm_medium"),
          campaign: params.get("utm_campaign"),
        };
    return true;
  } catch {
    return false;
  }
}
function persist() {
  try {
    sessionStorage.setItem(
      storeKey("store-visit"),
      JSON.stringify({
        id: session,
        at: lastActivity,
        duration: visibleDuration(),
        metadata,
      }),
    );
  } catch {}
}
export function analyticsIdentity() {
  return identity() ? { session, visitor } : null;
}
export function track(type, label = "", value = 0, pathOverride) {
  const path = pathOverride || window.location.pathname.slice(storeBase.length);
  if (type === "heartbeat" && Date.now() - lastActivity >= 1800000) return;
  if (path.startsWith("/admin") || !identity()) return;
  // Passive liveness must not keep an unattended tab alive forever.
  if (type !== "heartbeat") lastActivity = Date.now();
  persist();
  queue.push({
    id: crypto.randomUUID(),
    at: Date.now(),
    type,
    path,
    label: String(label).slice(0, 180),
    value,
  });
  if (queue.length >= 20) void flush();
}
export function flush(beacon = false) {
  if (!queue.length || !session || !allowed()) return Promise.resolve();
  const events = queue.splice(0, 25);
  const body = JSON.stringify({
    session,
    visitor,
    ...metadata,
    duration: visibleDuration(),
    events,
  });
  if (
    beacon &&
    navigator.sendBeacon &&
    navigator.sendBeacon(
      `${storeBase}/api/analytics`,
      new Blob([body], { type: "application/json" }),
    )
  )
    return Promise.resolve();
  return fetch(`${storeBase}/api/analytics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  })
    .then((response) => {
      if (!response.ok) throw new Error("Analytics request failed");
    })
    .catch(() => {
      queue = [...events, ...queue].slice(-100);
    });
}
export function visibilityChanged() {
  if (document.visibilityState === "hidden") {
    if (visibleSince !== null) duration += Date.now() - visibleSince;
    visibleSince = null;
    persist();
  } else {
    visibleSince = Date.now();
    if (Date.now() - lastActivity >= 1800000) session = null;
  }
}

// Pause elapsed storefront time while the same SPA is displaying its dashboard.
export function trackingPageChanged(path) {
  if (visibleSince !== null) duration += Math.max(0, Date.now() - visibleSince);
  visibleSince =
    !path.startsWith("/admin") && document.visibilityState === "visible"
      ? Date.now()
      : null;
}
