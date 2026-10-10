import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useCopy } from "./PlatformUI";

export default function MerchantPreview() {
  const t = useCopy();
  const root = useRef(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(true);
  const [hidden, setHidden] = useState(false);
  const slides = [
    ["welcome", t("هوية متجرك", "Your store identity")],
    ["login", t("الدخول إلى مساحتك", "Enter your studio")],
    ["dashboard", t("إدارة تفاصيل متجرك", "Manage every detail")],
  ];

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motion = () => setReduced(media.matches);
    const visibility = () => setHidden(document.hidden);
    motion();
    visibility();
    media.addEventListener("change", motion);
    document.addEventListener("visibilitychange", visibility);
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { threshold: 0.25 },
    );
    observer.observe(root.current);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", motion);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);

  const playing =
    visible && !paused && !hovered && !focused && !reduced && !hidden;
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setActive((n) => (n + 1) % 3), 5000);
    return () => window.clearInterval(timer);
  }, [playing]);

  const choose = (index) => {
    setActive((index + slides.length) % slides.length);
    setPaused(true);
  };

  return (
    <figure
      ref={root}
      className="v-merchant-preview"
      aria-label={t("معاينة مساحة التاجر", "Merchant studio preview")}
      aria-roledescription={t("عرض شرائح", "carousel")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          choose(active + (event.key === "ArrowRight" ? 1 : -1));
        }
      }}
    >
      <div className="v-merchant-stage">
        {slides.map(([file, label], index) => (
          <div
            key={file}
            className={`v-merchant-slide${active === index ? " is-active" : ""}`}
            aria-hidden={active !== index}
          >
            <img
              src={`/platform/assets/merchant-${file}.webp`}
              alt={label}
              width="800"
              height="1200"
              loading="lazy"
              decoding="async"
            />
          </div>
        ))}
      </div>
      <figcaption>
        <span
          className="v-merchant-label"
          aria-live={playing ? "off" : "polite"}
        >
          {slides[active][1]}
        </span>
        <div className="v-merchant-controls" dir="ltr">
          <button
            type="button"
            onClick={() => choose(active - 1)}
            aria-label={t("الشاشة السابقة", "Previous screen")}
          >
            <ChevronLeft size={18} />
          </button>
          <div className="v-merchant-dots">
            {slides.map(([file, label], index) => (
              <button
                key={file}
                type="button"
                onClick={() => choose(index)}
                aria-label={label}
                aria-pressed={active === index}
              >
                <span />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => choose(active + 1)}
            aria-label={t("الشاشة التالية", "Next screen")}
          >
            <ChevronRight size={18} />
          </button>
          {!reduced && (
            <button
              type="button"
              onClick={() => setPaused((value) => !value)}
              aria-label={
                paused
                  ? t("تشغيل العرض", "Play slideshow")
                  : t("إيقاف العرض", "Pause slideshow")
              }
            >
              {paused ? <Play size={16} /> : <Pause size={16} />}
            </button>
          )}
        </div>
        <small>
          {t("تصوّر توضيحي لمساحة التاجر", "Merchant studio design preview")}
        </small>
      </figcaption>
    </figure>
  );
}
