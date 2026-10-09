import { db } from "../db.js";
import { inTenant, adminCookie } from "../tenant.js";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { sql, token, hash, owner, audit } from "./core.js";
const keys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);
export const cookie = (req, name) =>
  req.headers.cookie
    ?.split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith(name + "="))
    ?.slice(name.length + 1) || "";
export const cookieOptions = (req) => ({
  httpOnly: true,
  secure: req.secure,
  sameSite: "lax",
  path: "/",
});
export function currentUser(req) {
  const row = sql(
    "SELECT u.* FROM platform_sessions s JOIN platform_users u ON u.id=s.user_id WHERE s.hash=? AND s.expires>?",
  ).get(hash(cookie(req, "vera_session")), Date.now());
  return row
    ? {
        id: row.id,
        name: row.name,
        email: row.email,
        created: row.created,
        isOwner: owner(row),
      }
    : null;
}
export function requireUser(req, res, next) {
  req.user = currentUser(req);
  if (!req.user)
    return res.status(401).json({ error: "Please sign in with Google." });
  next();
}
export function requireOwner(req, res, next) {
  requireUser(req, res, () => {
    if (!req.user.isOwner)
      return res.status(403).json({ error: "Owner access required." });
    next();
  });
}
export function registerAuth(app, rate) {
  app.get("/api/platform/auth/google", rate, (req, res) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET)
      return res
        .status(503)
        .json({ error: "Google sign-in is not configured yet." });
    const state = token(),
      nonce = token(),
      verifier = token();
    const intent = JSON.stringify({
      intent: ["create", "import"].includes(req.query.intent)
        ? req.query.intent
        : "workspace",
      template: ["form", "gala", "atelier"].includes(req.query.template)
        ? req.query.template
        : null,
    });
    sql(
      "INSERT INTO platform_oauth(hash,nonce,verifier,intent,expires) VALUES(?,?,?,?,?)",
    ).run(hash(state), nonce, verifier, intent, Date.now() + 600000);
    res.cookie("vera_oauth", state, { ...cookieOptions(req), maxAge: 600000 });
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: process.env.PUBLIC_URL + "/api/platform/auth/callback",
      response_type: "code",
      scope: "openid email profile",
      state,
      nonce,
      code_challenge: Buffer.from(hash(verifier), "hex").toString("base64url"),
      code_challenge_method: "S256",
      prompt: "select_account",
    }).toString();
    res.redirect(url.toString());
  });
  app.get("/api/platform/auth/callback", rate, async (req, res) => {
    try {
      const state = typeof req.query.state === "string" ? req.query.state : "";
      if (!state || state !== cookie(req, "vera_oauth"))
        throw new Error("Invalid sign-in state.");
      const pending = sql(
        "DELETE FROM platform_oauth WHERE hash=? RETURNING *",
      ).get(hash(state));
      res.clearCookie("vera_oauth", cookieOptions(req));
      if (
        !pending ||
        pending.expires < Date.now() ||
        typeof req.query.code !== "string"
      )
        throw new Error("Sign-in expired.");
      const r = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          code: req.query.code,
          code_verifier: pending.verifier,
          grant_type: "authorization_code",
          redirect_uri: process.env.PUBLIC_URL + "/api/platform/auth/callback",
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) throw new Error("Google sign-in failed.");
      const result = await r.json();
      const { payload } = await jwtVerify(result.id_token, keys, {
        issuer: ["https://accounts.google.com", "accounts.google.com"],
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      if (
        payload.nonce !== pending.nonce ||
        !payload.sub ||
        payload.email_verified !== true ||
        typeof payload.email !== "string"
      )
        throw new Error("Unverified identity.");
      sql(
        "INSERT INTO platform_users(sub,email,name,created) VALUES(?,?,?,?) ON CONFLICT(sub) DO UPDATE SET email=excluded.email,name=excluded.name",
      ).run(
        payload.sub,
        payload.email,
        String(payload.name || payload.email).slice(0, 100),
        Date.now(),
      );
      const user = sql("SELECT * FROM platform_users WHERE sub=?").get(
        payload.sub,
      );
      const session = token();
      sql(
        "INSERT INTO platform_sessions(hash,user_id,expires) VALUES(?,?,?)",
      ).run(hash(session), user.id, Date.now() + 14 * 86400000);
      audit(user.id, "auth.login");
      res.cookie("vera_session", session, {
        ...cookieOptions(req),
        maxAge: 14 * 86400000,
      });
      res.redirect(
        (() => {
          let intent;
          try {
            intent = JSON.parse(pending.intent);
          } catch {
            intent = { intent: pending.intent };
          }
          return intent.intent === "create"
            ? "/workspace/new" +
                (intent.template ? "?template=" + intent.template : "")
            : intent.intent === "import"
              ? "/workspace/import"
              : "/workspace";
        })(),
      );
    } catch {
      res.redirect("/login?error=google");
    }
  });
  app.post("/api/platform/logout", requireUser, (req, res) => {
    const sessionHash = hash(cookie(req, "vera_session"));
    for (const bridge of sql(
      "SELECT b.*,s.slug FROM platform_admin_bridges b JOIN platform_stores s ON s.id=b.store_id WHERE b.platform_session=?",
    ).all(sessionHash)) {
      inTenant(bridge.store_id, `/s/${bridge.slug}`, () => {
        db.prepare("DELETE FROM admin_sessions WHERE token_hash=?").run(
          bridge.token_hash,
        );
        res.clearCookie(adminCookie(), {
          ...cookieOptions(req),
          path: `/s/${bridge.slug}`,
          sameSite: "strict",
        });
      });
    }
    sql("DELETE FROM platform_admin_bridges WHERE platform_session=?").run(
      sessionHash,
    );
    sql("DELETE FROM platform_sessions WHERE hash=?").run(
      hash(cookie(req, "vera_session")),
    );
    res.clearCookie("vera_session", cookieOptions(req));
    res.json({ ok: true });
  });
}
