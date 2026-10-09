export async function request(path, method = "GET", body, options = {}) {
  const r = await fetch("/api/platform" + path, {
    method,
    credentials: "same-origin",
    signal: options.signal,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Please try again.");
  return data;
}
