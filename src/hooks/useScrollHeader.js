import { useEffect, useRef, useState } from "react";

// Hide only on compact screens; small direction changes do not flicker the header.
export default function useScrollHeader(enabled) {
  const headerRef = useRef(null);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    setHidden(false);
    if (!enabled) return;
    const compact = window.matchMedia("(max-width: 1023px)");
    let previous = window.scrollY,
      travel = 0,
      direction = 0,
      frame = 0;
    const update = () => {
      frame = 0;
      const y = Math.max(0, window.scrollY),
        delta = y - previous;
      previous = y;
      if (
        !compact.matches ||
        y < 80 ||
        (headerRef.current?.contains(document.activeElement) &&
          document.activeElement.matches(":focus-visible"))
      ) {
        setHidden(false);
        travel = 0;
        return;
      }
      if (Math.sign(delta) !== direction) travel = 0;
      direction = Math.sign(delta);
      travel += Math.abs(delta);
      if (travel > 12) setHidden(delta > 0);
    };
    const scroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const resize = () => {
      travel = 0;
      setHidden(false);
      previous = window.scrollY;
    };
    window.addEventListener("scroll", scroll, { passive: true });
    compact.addEventListener("change", resize);
    return () => {
      window.removeEventListener("scroll", scroll);
      compact.removeEventListener("change", resize);
      cancelAnimationFrame(frame);
    };
  }, [enabled]);
  return { headerRef, hidden, reveal: () => setHidden(false) };
}
