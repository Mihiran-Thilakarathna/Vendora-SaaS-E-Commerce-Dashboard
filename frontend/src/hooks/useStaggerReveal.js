import { gsap, useGSAP, prefersReducedMotion } from "../lib/gsap";

/**
 * Staggered entrance for every `[data-reveal]` element inside `scopeRef`.
 * Re-runs when `dependencies` change (e.g. after data loads).
 */
const useStaggerReveal = (scopeRef, dependencies = [], { y = 28, stagger = 0.07, delay = 0 } = {}) => {
  useGSAP(
    () => {
      if (!scopeRef.current) return;
      const targets = gsap.utils.toArray("[data-reveal]", scopeRef.current);
      if (!targets.length || prefersReducedMotion()) return;
      gsap.from(targets, {
        opacity: 0,
        y,
        scale: 0.985,
        duration: 0.75,
        stagger,
        delay,
        ease: "power3.out",
        clearProps: "transform,opacity",
      });
    },
    { scope: scopeRef, dependencies }
  );
};

export default useStaggerReveal;
