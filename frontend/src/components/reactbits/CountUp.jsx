import { useEffect, useRef } from "react";
import { gsap, prefersReducedMotion } from "../../lib/gsap";

/**
 * CountUp — tweens a number from its previous value to `value`.
 * Re-animates smoothly whenever the value changes (e.g. live refresh).
 * Pattern adapted from React Bits (reactbits.dev, MIT).
 */
const CountUp = ({
  value = 0,
  format = (n) => Math.round(n).toLocaleString(),
  duration = 1.4,
  delay = 0,
  className = "",
}) => {
  const elRef = useRef(null);
  const state = useRef({ n: 0 });

  useEffect(() => {
    const el = elRef.current;
    const target = Number(value) || 0;
    if (!el) return undefined;
    if (prefersReducedMotion()) {
      state.current.n = target;
      el.textContent = format(target);
      return undefined;
    }
    const tween = gsap.to(state.current, {
      n: target,
      duration,
      delay,
      ease: "power3.out",
      onUpdate: () => {
        el.textContent = format(state.current.n);
      },
    });
    return () => tween.kill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <span ref={elRef} className={`tabular-nums ${className}`}>
      {format(0)}
    </span>
  );
};

export default CountUp;
