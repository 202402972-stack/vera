import { useStoreApi, useStoreUrl } from "@/workspace/StoreScope";
import PasswordPanel from "./PasswordPanel";

import { useLanguage, localizeView } from "@/i18n/LanguageContext";
import React, { useEffect, useState } from "react";
import { Send, Download, Database, ShieldCheck, Unplug } from "lucide-react";
import { jsonRequest } from "@/api/store";
import { Button } from "@/components/ui/button";
import { Panel, Field, Notice, Busy, SaveButton } from "./AdminUI";
export default function IntegrationsPanel({ notify, defaultPassword }) {
  const storeUrl = useStoreUrl();
  const api = useStoreApi();
  const { t } = useLanguage();
  const [config, setConfig] = useState(null),
    [token, setToken] = useState(""),
    [chatId, setChatId] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    api("/admin/telegram")
      .then((c) => {
        setConfig(c);
        setChatId(c.chatId);
      })
      .catch((e) => setError(e.message));
  }, [api]);
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const c = await api(
        "/admin/telegram",
        jsonRequest("PUT", {
          token,
          chatId,
        }),
      );
      setConfig(c);
      setToken("");
      notify(
        "Telegram settings saved. Pending orders will be delivered automatically.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function test() {
    setBusy(true);
    setError("");
    try {
      await api("/admin/telegram/test", {
        method: "POST",
      });
      notify("Test message delivered to Telegram.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function disconnect() {
    setBusy(true);
    try {
      await api("/admin/telegram", {
        method: "DELETE",
      });
      setConfig({
        configured: false,
        hasToken: false,
        chatId: "",
      });
      setChatId("");
      setToken("");
      notify(
        "Telegram disconnected. Orders continue to save in your dashboard.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!config)
    return localizeView(error ? <Notice error>{error}</Notice> : <Busy />, t);
  return localizeView(
    <div className="space-y-6">
      <PasswordPanel />
      {error && <Notice error>{error}</Notice>}
      {config.credentialsError && (
        <Notice error>{config.credentialsError}</Notice>
      )}
      <div className="grid lg:grid-cols-2 gap-6">
        <Panel
          title="Telegram notifications"
          subtitle="One organized notification for each order."
          icon={Send}
        >
          <div className="mb-5">
            <span
              className={`admin-status ${config.configured ? "sent" : "pending"}`}
            >
              {config.configured ? "Connected" : "Not connected yet"}
            </span>
          </div>
          <form onSubmit={save}>
            <Field
              label="Bot token"
              type="password"
              autoComplete="new-password"
              value={token}
              onChange={setToken}
              maxLength={200}
              placeholder={
                config.hasToken
                  ? "Saved securely · leave blank to keep it"
                  : "123456789:AA…"
              }
              hint="Create your bot with @BotFather. The token is encrypted on the server and never returned to the browser."
            />
            <Field
              label="Chat ID / channel username"
              value={chatId}
              onChange={setChatId}
              maxLength={80}
              placeholder="123456789 or -1001234567890"
              hint="Use your numeric chat ID, a group ID (often negative), or @channel. Start a private chat with the bot or add it to your group first."
            />
            <div className="flex flex-wrap gap-3">
              <SaveButton busy={busy}>Save connection</SaveButton>
              <Button
                type="button"
                variant="outline"
                onClick={test}
                disabled={busy || !config.configured}
              >
                <Send size={15} className="mr-2" /> Send test
              </Button>
            </div>
          </form>
          {config.hasToken && (
            <button
              className="admin-action-button mt-4"
              disabled={busy}
              onClick={disconnect}
            >
              <Unplug size={14} /> Disconnect Telegram
            </button>
          )}
        </Panel>
        <Panel title="How to connect" icon={Send}>
          <ol className="list-decimal pl-5 space-y-4 text-sm text-muted-foreground">
            <li>
              Open Telegram, message{" "}
              <a
                href="https://t.me/BotFather"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-foreground"
              >
                @BotFather
              </a>
              , and use /newbot. Copy the token here.
            </li>
            <li>
              Start a conversation with your new bot. For a group, add the bot
              and give it permission to post messages.
            </li>
            <li>
              Get your numeric chat ID from Telegram’s getUpdates API after
              sending your bot a message. A group chat ID usually begins with a
              minus sign.
            </li>
            <li>
              Save your connection, then send a test message. Pending orders are
              sent automatically.
            </li>
          </ol>
          <Notice>
            Short orders arrive as one photo message with a full caption. Longer
            orders arrive as one photo receipt containing product images, item
            identifiers, quantities, prices and all customer and delivery
            details. Full product descriptions remain in the dashboard order
            record.
          </Notice>
          <p className="text-xs text-muted-foreground">
            Failed deliveries retry automatically up to eight times. The Orders
            section shows delivery status and lets you retry. Orders remain
            saved throughout.
          </p>
        </Panel>
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <Panel title="Data & deployment" icon={Database}>
          <p className="text-sm text-muted-foreground mb-5">
            The database, uploaded images and encryption key all live in one
            data directory. Use one running service instance with a persistent
            volume mounted at /data on Railway.
          </p>
          <Notice>
            A Railway deployment without a persistent volume loses runtime data
            when the container is replaced. The included Dockerfile and
            railway.json configure the app; attaching storage is a Railway
            platform setting.
          </Notice>
          <a
            href={storeUrl("/api/admin/export")}
            className="inline-flex gap-2 items-center text-sm border border-border rounded-lg px-4 py-3"
          >
            <Download size={16} /> Download data export
          </a>
          <p className="admin-hint mt-3">
            The JSON export includes content, products, orders and analytics.
            For a complete restorable backup, copy the data volume, including
            uploads and .encryption-key. Bot credentials are intentionally
            excluded from the export.
          </p>
        </Panel>
        <Panel title="Dashboard access" icon={ShieldCheck}>
          <p className="text-sm text-muted-foreground mb-4">
            Set ADMIN_PASSWORD in Railway to choose your dashboard password. No
            other application variables are required.
          </p>
          {defaultPassword ? (
            <Notice>
              The fallback password is active. Set ADMIN_PASSWORD before opening
              your store to the public.
            </Notice>
          ) : (
            <Notice>
              Change your dashboard password using the form above.
            </Notice>
          )}
          <p className="text-xs text-muted-foreground">
            Sign-in uses a server-side session in an HttpOnly cookie, expires
            after seven days, and is rate limited. Passwords and Telegram tokens
            are never exposed through the public store API.
          </p>
        </Panel>
      </div>
    </div>,
    t,
  );
}
