import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  track,
  flush,
  visibilityChanged,
  trackingPageChanged,
} from "@/lib/analytics";
export default function AnalyticsTracker() {
  const { pathname } = useLocation();
  useEffect(() => {
    trackingPageChanged(pathname);
    if (pathname.startsWith("/admin")) return;
    track("page_view");
    flush();
    let maxScroll = 0;
    const click = (e) => {
      const element = e.target.closest("a,button");
      if (element)
        track(
          "click",
          (element.getAttribute("aria-label") || element.innerText || "").slice(
            0,
            100,
          ),
        );
    };
    const scroll = () => {
      const percent = Math.min(
        100,
        Math.round(
          ((window.scrollY + window.innerHeight) /
            Math.max(document.documentElement.scrollHeight, 1)) *
            100,
        ),
      );
      if (percent >= maxScroll + 25) {
        maxScroll = Math.floor(percent / 25) * 25;
        track("scroll", "depth", maxScroll);
      }
    };
    const exit = () => {
      track("page_exit");
      flush(true);
    };
    const visibility = () => {
      visibilityChanged();
      if (document.visibilityState === "hidden") exit();
    };
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        track("heartbeat");
        flush();
      }
    }, 15000);
    document.addEventListener("click", click);
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("pagehide", exit);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      track("page_exit", "", 0, pathname);
      flush(true);
      clearInterval(timer);
      document.removeEventListener("click", click);
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("pagehide", exit);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [pathname]);
  return null;
}
