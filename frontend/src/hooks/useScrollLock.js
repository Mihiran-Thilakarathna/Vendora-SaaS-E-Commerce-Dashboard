import { useEffect } from "react";

let locks = 0;
let saved = { overflow: "", paddingRight: "" };

/**
 * Prevents the page behind an open modal from scrolling.
 * Ref-counted so stacked modals (e.g. a confirm dialog over a form) unlock correctly,
 * and pads the body by the scrollbar width so the layout doesn't jump.
 */
const useScrollLock = (active) => {
  useEffect(() => {
    if (!active) return undefined;
    const body = document.body;
    if (locks === 0) {
      saved = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
      const scrollbar = window.innerWidth - document.documentElement.clientWidth;
      body.style.overflow = "hidden";
      if (scrollbar > 0) body.style.paddingRight = `${scrollbar}px`;
    }
    locks += 1;
    return () => {
      locks -= 1;
      if (locks === 0) {
        body.style.overflow = saved.overflow;
        body.style.paddingRight = saved.paddingRight;
      }
    };
  }, [active]);
};

export default useScrollLock;
