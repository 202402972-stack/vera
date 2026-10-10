import React, { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ExternalLink,
} from "lucide-react";
import { Button, useCopy } from "./PlatformUI";

const portraits = {
  gala: "/assets/gala-fashion-2.jpg",
  atelier: "/platform/assets/hero.jpg",
  form: "/assets/form-hero.webp",
};

export default function LandingCollection({ templates }) {
  const t = useCopy();
  const [active, setActive] = useState(0);
  const cards = useRef([]);
  const scrollTarget = useRef(null);
  const selected = templates[active] || templates[0];
  function select(index, scroll = false) {
    setActive(index);
    if (scroll && window.matchMedia("(max-width: 767px)").matches) {
      scrollTarget.current = index;
      cards.current[index]?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }
  function followScroll(event) {
    const track = event.currentTarget.getBoundingClientRect();
    const center = track.left + track.width / 2;
    const distances = cards.current.map((card) => {
      const box = card.getBoundingClientRect();
      return Math.abs(box.left + box.width / 2 - center);
    });
    const index = distances.indexOf(Math.min(...distances));
    if (scrollTarget.current !== null && scrollTarget.current !== index) return;
    scrollTarget.current = null;
    setActive(index);
  }
  if (!selected) return null;
  return (
    <>
      <section id="templates" className="v-section v-collection">
        <div className="v-section-heading">
          <span className="v-hero-badge">
            ✦ {t("شخصيتك أولًا", "Distinctly yours")}
          </span>
          <h2>
            {t(
              "ثلاث هويات. مساحة لعلامتك.",
              "Three characters. Your own space.",
            )}
          </h2>
          <span className="v-ghost-title" aria-hidden="true">
            {t("تشبهك أنت", "Made for you")}
          </span>
        </div>
        <div
          className="v-collection-track"
          aria-label={t("قوالب المتاجر", "Store templates")}
          onScroll={followScroll}
          onPointerDown={() => {
            scrollTarget.current = null;
          }}
        >
          {templates.map((template, i) => (
            <article
              key={template.id}
              ref={(el) => {
                cards.current[i] = el;
              }}
              className={i === active ? "is-selected" : ""}
            >
              <button
                className="v-portrait"
                onClick={() => select(i)}
                aria-pressed={i === active}
                aria-controls="store-preview"
                aria-label={t("اختيار ", "Select ") + template.name}
              >
                <img
                  src={portraits[template.id] || template.image}
                  alt=""
                  width="360"
                  height="430"
                  loading="lazy"
                />
                <span className="v-portrait-index" aria-hidden="true">
                  0{i + 1}
                </span>
              </button>
              <h3>{template.name}</h3>
              <p>{t(template.descriptionAr, template.description)}</p>
              <a
                className="v-text-link"
                href="#store-preview"
                onClick={() => select(i)}
              >
                {t("شاهد القالب", "View the template")}{" "}
                <ArrowUpRight size={16} aria-hidden="true" />
              </a>
            </article>
          ))}
        </div>
        <div className="v-collection-controls">
          <button
            onClick={() =>
              select((active + templates.length - 1) % templates.length, true)
            }
            aria-label={t("القالب السابق", "Previous template")}
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            {templates.map((template, i) => (
              <button
                key={template.id}
                className={active === i ? "is-active" : ""}
                onClick={() => select(i, true)}
                aria-label={template.name}
                aria-pressed={active === i}
              >
                <span />
              </button>
            ))}
          </div>
          <button
            onClick={() => select((active + 1) % templates.length, true)}
            aria-label={t("القالب التالي", "Next template")}
          >
            <ArrowRight size={20} />
          </button>
        </div>
      </section>
      <section id="store-preview" className="v-store-showcase">
        <div className="v-section-heading">
          <h2>
            {t("متجر يلفت النظر.", "Beautifully considered.")}{" "}
            <em>{t("وتفاصيل تعمل.", "Ready for business.")}</em>
          </h2>
          <p>
            {t("استكشف تجربة ", "Explore ")}
            {selected.name}
            {t("، ثم أضف لمستك الخاصة.", ", then make it your own.")}
          </p>
          <div className="v-actions">
            <Button to={"/login?intent=create&template=" + selected.id}>
              {t("ابدأ بهذا القالب", "Make it yours")}{" "}
              <ArrowUpRight size={16} />
            </Button>
            <a
              className="v-text-link"
              href={"/demo/" + selected.id}
              target="_blank"
              rel="noreferrer"
            >
              {t("جرّب المتجر", "Explore the store")} <ExternalLink size={15} />
            </a>
          </div>
        </div>
        <div className="v-showcase-stage">
          <div className="v-showcase-wings" aria-hidden="true">
            <img src={selected.image} alt="" loading="lazy" />
            <img src={selected.image} alt="" loading="lazy" />
          </div>
          <div className="v-showcase-device" key={selected.id}>
            <div className="v-laptop-screen">
              <img
                src={selected.image}
                alt={t("معاينة متجر ", "Storefront preview: ") + selected.name}
                width="1440"
                height="1000"
                loading="lazy"
              />
            </div>
            <div className="v-laptop-base" />
          </div>
        </div>
      </section>
    </>
  );
}
