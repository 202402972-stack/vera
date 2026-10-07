import { useLocation } from "react-router-dom";
import { useLayoutEffect } from "react";
const ScrollToTop = () => {
  const { pathname, hash } = useLocation();
  useLayoutEffect(() => {
    if(hash){const frame=requestAnimationFrame(()=>document.getElementById(hash.slice(1))?.scrollIntoView({behavior:"instant"}));return()=>cancelAnimationFrame(frame);}
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant",
    });
  }, [pathname,hash]);
  return null;
};
export default ScrollToTop;
