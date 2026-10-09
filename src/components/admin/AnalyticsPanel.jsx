import { useStoreApi } from "@/workspace/StoreScope";
import ResponsiveTable from "./ResponsiveTable";
import { useLanguage, localizeView } from "@/i18n/LanguageContext";
import React, {
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from "react";
import {
  Users,
  Eye,
  Activity,
  ShoppingBag,
  TrendingUp,
  Clock,
  MousePointer2,
  ArrowDownRight,
  Globe,
  Smartphone,
  Monitor,
  MapPin,
  Route,
  RefreshCw,
  ArrowUpRight,
  BarChart3,
  Package,
  Search,
} from "lucide-react";

import { useStore } from "@/hooks/useStore";
import { Button } from "@/components/ui/button";
import { Panel, Notice, Busy } from "./AdminUI";
const number = (value) => Number(value || 0).toLocaleString();
function Breakdown({ title, icon: Icon, items, note }) {
  const { t, date } = useLanguage();
  const total = items.reduce((n, row) => n + row.count, 0);
  return localizeView(
    <Panel title={title} icon={Icon}>
      {!items.length ? (
        <div className="admin-empty">No data for this period yet.</div>
      ) : (
        <div className="space-y-4">
          {items.map((row, i) => (
            <div key={i}>
              <div className="analytics-breakdown-row mb-2 text-xs">
                <span
                  className="analytics-breakdown-label"
                  title={row.label || "Direct / untagged"}
                >
                  {row.label || "Direct / untagged"}
                </span>
                <span className="analytics-breakdown-count text-muted-foreground">
                  {number(row.count)} ·{" "}
                  {Math.round((row.count / Math.max(total, 1)) * 100)}%
                </span>
              </div>
              <div className="admin-bar">
                <div
                  className="admin-bar-fill"
                  style={{
                    width: `${(row.count / Math.max(total, 1)) * 100}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      {note && <p className="admin-hint mt-4">{note}</p>}
    </Panel>,
    t,
  );
}
function TrafficChart({ daily, days }) {
  const { t, date } = useLanguage();
  const [hover, setHover] = useState(null);
  const points = useMemo(() => {
    const lookup = new Map(daily.map((d) => [d.day, d]));
    return Array.from(
      {
        length: days,
      },
      (_, i) => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - (days - 1 - i));
        const day = d.toISOString().slice(0, 10);
        return (
          lookup.get(day) || {
            day,
            visitors: 0,
            sessions: 0,
          }
        );
      },
    );
  }, [daily, days]);
  const maximum = Math.max(1, ...points.map((p) => p.visitors));
  const w = 900,
    h = 200,
    pad = 20;
  const xy = points.map((p, i) => [
    pad + (i / (points.length - 1)) * (w - pad * 2),
    h - pad - (p.visitors / maximum) * (h - pad * 2),
  ]);
  const path = xy.map(([x, y], i) => `${i ? "L" : "M"} ${x} ${y}`).join(" ");
  return localizeView(
    <>
      <div className="flex items-center justify-between mb-6 text-xs">
        <span className="flex items-center gap-2 text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-primary" /> Unique visitors
          per day
        </span>
        <span className="text-muted-foreground">
          {hover == null
            ? "Move over the chart to explore"
            : `${points[hover].day}: ${points[hover].visitors} visitors · ${points[hover].sessions} visits`}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full min-h-[140px]"
        role="img"
        aria-label="Daily unique visitor chart"
      >
        <defs>
          <linearGradient id="traffic-fill" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="hsl(var(--primary))"
              stopOpacity=".3"
            />
            <stop
              offset="100%"
              stopColor="hsl(var(--primary))"
              stopOpacity=".02"
            />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((n, i) => (
          <g key={i}>
            <line
              x1={pad}
              x2={w - pad}
              y1={h - pad - n * (h - pad * 2)}
              y2={h - pad - n * (h - pad * 2)}
              stroke="hsl(var(--border))"
              strokeDasharray="3 5"
            />
            <text
              x={1}
              y={h - pad - n * (h - pad * 2) - 5}
              fontSize="10"
              fill="hsl(var(--muted-foreground))"
            >
              {Math.round(n * maximum)}
            </text>
          </g>
        ))}
        <path
          d={`${path} L ${w - pad} ${h - pad} L ${pad} ${h - pad} Z`}
          fill="url(#traffic-fill)"
        />
        <path
          d={path}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <rect
            key={p.day}
            x={xy[i][0] - Math.max(3, w / points.length / 2)}
            y="0"
            width={Math.max(6, w / points.length)}
            height={h}
            fill="transparent"
            onPointerDown={() => setHover(i)}
            tabIndex={0}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <title>
              {p.day}: {p.visitors} visitors; {p.sessions} visits
            </title>
          </rect>
        ))}
        {hover != null && (
          <circle
            cx={xy[hover][0]}
            cy={xy[hover][1]}
            r="5"
            fill="hsl(var(--primary-dark))"
          />
        )}
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground mt-2">
        <span>{points[0].day}</span>
        <span>{points.at(-1).day}</span>
      </div>
    </>,
    t,
  );
}
export default function AnalyticsPanel({ compact = false }) {
  const api = useStoreApi();
  const { t, date } = useLanguage();
  const { store } = useStore();
  const [visitPage, setVisitPage] = useState(1),
    [eventPage, setEventPage] = useState(1),
    [timeline, setTimeline] = useState(null);
  const [data, setData] = useState(null),
    [days, setDays] = useState(30),
    [error, setError] = useState(""),
    [journey, setJourney] = useState(null);
  const journeyRef = useRef(null);
  useEffect(() => {
    setJourney(null);
    setEventPage(1);
  }, [visitPage, days]);
  useEffect(() => {
    if (!journey) return;
    let current = true;
    setTimeline(null);
    api(
      `/admin/analytics/visits/${encodeURIComponent(journey)}?page=${eventPage}`,
    )
      .then((result) => {
        if (current) setTimeline(result);
      })
      .catch((e) => {
        if (current) setError(e.message);
      });
    return () => {
      current = false;
    };
  }, [journey, eventPage, api]);
  useEffect(() => {
    if (journey)
      journeyRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
  }, [journey]);
  const reload = useCallback(async () => {
    try {
      setData(await api(`/admin/analytics?days=${days}&page=${visitPage}`));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, [api, days, visitPage]);
  useEffect(() => {
    reload();
    const timer = setInterval(reload, 30000);
    return () => clearInterval(timer);
  }, [reload]);
  if (!data)
    return localizeView(error ? <Notice error>{error}</Notice> : <Busy />, t);
  const currency = data.revenueByCurrency?.[0];
  const money = (value) =>
    `${currency?.symbol || store.checkout.symbol}${(value / 100).toFixed(2)}`;
  const revenueValue =
    data.revenueByCurrency?.length > 1 ? "Multiple" : money(data.revenue);
  const collectedValue =
    data.revenueByCurrency?.length > 1
      ? "Multiple"
      : money(data.deliveredRevenue);
  const stats = [
    [
      "Unique visitors",
      number(data.visitors),
      Users,
      `${number(data.returning)} returning visitors`,
    ],
    [
      "Page views",
      number(data.pageviews),
      Eye,
      `${number(data.sessions)} visits`,
    ],
    ["Active now", number(data.active), Activity, "Seen in the last 5 minutes"],
    ["Orders", number(data.orders), ShoppingBag, "Includes cancelled orders"],
    [
      "Order value",
      revenueValue,
      TrendingUp,
      "Excludes cancelled orders; not yet collected",
    ],
    [
      "Collected revenue",
      collectedValue,
      BanknoteIcon,
      "Delivered COD and verified online payments",
    ],
    [
      "Conversion rate",
      `${data.conversion}%`,
      ArrowUpRight,
      "Visits with a tracked order",
    ],
    [
      "Avg. visit length",
      `${Math.round(data.avg_duration / 1000)}s`,
      Clock,
      `${data.bounce_rate}% bounce rate`,
    ],
  ];
  return localizeView(
    <div className="admin-analytics space-y-6">
      {error && <Notice error>{error}</Notice>}
      <div className="analytics-hero">
        <div>
          <p className="admin-section-label">Your store, at a glance</p>
          <h2 className="text-3xl">
            {compact ? "Welcome to your boutique." : "Understand every visit."}
          </h2>
        </div>
        <div className="analytics-controls">
          <select
            aria-label="Analytics period"
            value={days}
            onChange={(e) => {
              setDays(Number(e.target.value));
              setVisitPage(1);
            }}
          >
            {[0, 7, 30, 90, 365].map((d) => (
              <option key={d} value={d}>
                {d === 0 ? "All time" : `${t("Last")} ${d} ${t("days")}`}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            onClick={reload}
            aria-label="Refresh analytics"
          >
            <RefreshCw size={16} />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(([label, value, Icon, note]) => (
          <div className="admin-panel admin-stat" key={label}>
            <div className="flex items-center justify-between">
              <span className="stat-label">{label}</span>
              <Icon className="text-primary" size={18} />
            </div>
            <span className="stat-value">{value}</span>
            <p className="text-[10px] text-muted-foreground">{note}</p>
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-[1.8fr_1fr] gap-6">
        <Panel
          title="Store traffic"
          subtitle="First-party data, stored in your own database."
          icon={BarChart3}
        >
          <TrafficChart daily={data.daily} days={days || 365} />
          {days === 0 && (
            <p className="admin-hint">
              Chart shows the last 365 days; totals include all time.
            </p>
          )}
        </Panel>
        <Panel
          title="Shopping journey"
          subtitle="Unique visits at each stage; stages can span reporting dates."
          icon={ShoppingBag}
        >
          <div className="space-y-5">
            {data.funnel.map((stage, i) => (
              <div key={stage.label}>
                <div className="flex justify-between mb-2 text-xs">
                  <span>
                    <span className="text-muted-foreground mr-2">0{i + 1}</span>
                    {stage.label}
                  </span>
                  <strong>{number(stage.count)}</strong>
                </div>
                <div
                  className="admin-bar"
                  style={{
                    height: 10,
                  }}
                >
                  <div
                    className="admin-bar-fill"
                    style={{
                      width: `${(stage.count / Math.max(data.funnel[0].count, 1)) * 100}%`,
                      opacity: 1 - i * 0.15,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      {data.revenueByCurrency?.length > 1 && (
        <Panel
          title="Revenue by currency"
          subtitle="Historical orders retain their currency. Values in different currencies are never added together."
          icon={TrendingUp}
        >
          <div className="grid sm:grid-cols-3 gap-6">
            {data.revenueByCurrency.map((c) => (
              <div key={c.currency}>
                <strong>{c.currency}</strong>
                <p className="text-xs mt-2">
                  Order value: {c.symbol}
                  {(c.orderValue / 100).toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Collected: {c.symbol}
                  {(c.collected / 100).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      )}
      {!compact && (
        <>
          <div className="analytics-breakdowns grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <Breakdown title="Popular pages" icon={Eye} items={data.pages} />
            <Breakdown
              title="Entry pages"
              icon={ArrowUpRight}
              items={data.entries}
            />
            <Breakdown
              title="Exit pages"
              icon={ArrowDownRight}
              items={data.exits}
              note="Last observed page. A closed browser may not deliver its final beacon."
            />
            <Breakdown
              title="Traffic sources"
              icon={Globe}
              items={data.referrers}
            />
            <Breakdown title="Devices" icon={Smartphone} items={data.devices} />
            <Breakdown title="Browsers" icon={Monitor} items={data.browsers} />
            <Breakdown
              title="Campaign sources"
              icon={TrendingUp}
              items={data.sources}
              note="Uses utm_source in incoming links."
            />
            <Breakdown
              title="Campaign mediums"
              icon={TrendingUp}
              items={data.mediums || []}
              note="Uses utm_medium in incoming links."
            />
            <Breakdown
              title="Campaigns"
              icon={TrendingUp}
              items={data.campaigns}
              note="Uses utm_campaign in incoming links."
            />
            <Breakdown
              title="Countries"
              icon={MapPin}
              items={data.countries}
              note="Only available when the hosting proxy supplies a country header. Railway does not normally supply one; Unknown is expected. No external geolocation service is used."
            />
            <Breakdown
              title="Store interactions"
              icon={MousePointer2}
              items={data.actions}
              note="Includes cart changes, checkout attempts, orders and scroll depth events."
            />
            <Breakdown
              title="Most-used controls"
              icon={MousePointer2}
              items={data.clicks}
            />
          </div>
          <Panel
            title="Visitor journeys"
            subtitle="Anonymous sessions, entry and exit pages, and the actions in between. Select a visit to see its timeline."
            icon={Route}
          >
            <div className="admin-table-wrap">
              <ResponsiveTable>
                <thead>
                  <tr>
                    <th>Visitor / time</th>
                    <th>Entry → exit</th>
                    <th>Source</th>
                    <th>Device</th>
                    <th>Length</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <strong>{v.visitor}</strong>
                        <p className="text-[10px] text-muted-foreground">
                          {date(v.started_at)}
                        </p>
                      </td>
                      <td className="max-w-[220px]">
                        <span className="block truncate">{v.entry}</span>
                        <span className="text-muted-foreground block truncate">
                          → {v.exit}
                        </span>
                      </td>
                      <td>{v.referrer}</td>
                      <td>
                        {v.device}
                        <span className="text-[10px] text-muted-foreground block">
                          {v.browser}
                        </span>
                      </td>
                      <td>{Math.round(v.duration / 1000)}s</td>
                      <td>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEventPage(1);
                            setJourney(journey === v.id ? null : v.id);
                          }}
                        >
                          Timeline
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </ResponsiveTable>
            </div>
            {!data.recent.length && (
              <div className="admin-empty">
                Visit the storefront to start collecting analytics.
              </div>
            )}
            {data.journeyPages > 1 && (
              <div className="flex justify-between items-center gap-3 mt-5 text-xs">
                <span>
                  {data.sessions} visits · Page {data.journeyPage} of{" "}
                  {data.journeyPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={visitPage <= 1}
                    onClick={() => setVisitPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={visitPage >= data.journeyPages}
                    onClick={() => setVisitPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
            {journey && (
              <div ref={journeyRef} className="bg-muted rounded-xl p-5 mt-5">
                <div className="flex justify-between mb-5">
                  <h3 className="text-xl">Visit timeline</h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setJourney(null)}
                  >
                    Close
                  </Button>
                </div>
                {!timeline && <Busy />}
                <ol className="admin-journey">
                  {(timeline?.events || []).map((event, i) => (
                    <li key={i}>
                      <div className="flex justify-between">
                        <strong className="capitalize">
                          {event.type.replaceAll("_", " ")}
                        </strong>
                        <span className="text-muted-foreground text-[10px]">
                          {date(event.at, { timeStyle: "short" })}
                        </span>
                      </div>
                      <span className="text-muted-foreground">
                        {event.path}
                        {event.label && ` · ${event.label}`}
                      </span>
                    </li>
                  ))}
                </ol>
                {timeline?.pages > 1 && (
                  <div className="flex justify-between gap-3">
                    <span>
                      {timeline.page} of {timeline.pages}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={eventPage <= 1}
                        onClick={() => setEventPage((p) => p - 1)}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={eventPage >= timeline.pages}
                        onClick={() => setEventPage((p) => p + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Panel>
        </>
      )}
      <Notice>
        Analytics measure browser activity observed by this store. Visitors who
        block tracking or enable Do Not Track / Global Privacy Control are
        excluded. Browser identifiers can reset, visit length is approximate,
        and country data depends on the host. Admin activity and checkout field
        contents are not tracked.
      </Notice>
    </div>,
    t,
  );
}
function BanknoteIcon(props) {
  const { t, date } = useLanguage();
  return localizeView(<TrendingUp {...props} />, t);
}
