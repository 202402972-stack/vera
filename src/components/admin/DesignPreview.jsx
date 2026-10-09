import React, { useEffect, useRef, useState } from "react";
import { useStoreApi, useStoreUrl } from "@/workspace/StoreScope";
import { useLanguage } from "@/i18n/LanguageContext";
import { jsonRequest } from "@/api/store";
export default function DesignPreview({ value, onError }) {
  const api = useStoreApi(),
    url = useStoreUrl(),
    { language } = useLanguage(),
    t = (ar, en) => (language === "ar" ? ar : en);
  const frame = useRef(null),
    container = useRef(null),
    [width, setWidth] = useState(390),
    [available, setAvailable] = useState(390),
    [ready, setReady] = useState(0);
  useEffect(() => {
    const o = new ResizeObserver(([r]) => setAvailable(r.contentRect.width));
    o.observe(container.current);
    return () => o.disconnect();
  }, []);
  useEffect(() => {
    if (!value) return;
    const c = new AbortController(),
      timer = setTimeout(
        () =>
          api("/admin/design-preview", {
            ...jsonRequest("POST", value),
            signal: c.signal,
          })
            .then((data) => {
              if (!c.signal.aborted)
                frame.current?.contentWindow?.postMessage(
                  { type: "vera-design-preview", version: 1, settings: data },
                  window.location.origin,
                );
            })
            .catch((e) => {
              if (!c.signal.aborted) onError?.(e.message);
            }),
        350,
      );
    return () => {
      c.abort();
      clearTimeout(timer);
    };
  }, [value, ready, api, onError]);
  const scale = Math.min(1, available / width);
  return (
    <section className="design-preview">
      <div className="design-preview-tools">
        <button type="button" onClick={() => setWidth(1440)}>
          {t("ديسكتوب", "Desktop")}
        </button>
        <button type="button" onClick={() => setWidth(390)}>
          {t("موبايل", "Mobile")}
        </button>
        <span dir="ltr">
          {width}px · {Math.round(scale * 100)}%
        </span>
      </div>
      <div
        ref={container}
        className="design-preview-canvas"
        style={{ height: 844 * scale }}
      >
        <iframe
          ref={frame}
          title={t("معاينة تعديلات المسودة", "Draft design preview")}
          src={url("/?preview=1&designPreview=1")}
          onLoad={() => setReady((n) => n + 1)}
          style={{
            width,
            height: 844,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        />
      </div>
    </section>
  );
}
