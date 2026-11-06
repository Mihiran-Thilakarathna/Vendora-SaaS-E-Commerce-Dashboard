import { forwardRef, useRef } from "react";

/**
 * SpotlightCard — a card with a soft radial light that follows the cursor,
 * plus a matching border glow. Pattern adapted from React Bits (reactbits.dev, MIT).
 */
const SpotlightCard = forwardRef(
  (
    {
      as: Tag = "article",
      className = "",
      spotlightColor = "rgba(225, 251, 21, 0.10)",
      borderColor = "rgba(225, 251, 21, 0.35)",
      children,
      ...rest
    },
    forwardedRef
  ) => {
    const localRef = useRef(null);

    const setRefs = (node) => {
      localRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    };

    const onMove = (e) => {
      const el = localRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      el.style.setProperty("--sx", `${e.clientX - rect.left}px`);
      el.style.setProperty("--sy", `${e.clientY - rect.top}px`);
    };

    return (
      <Tag
        ref={setRefs}
        onMouseMove={onMove}
        className={`v-spotlight group relative isolate overflow-hidden ${className}`}
        style={{ "--spot": spotlightColor, "--spot-border": borderColor }}
        {...rest}
      >
        {children}
      </Tag>
    );
  }
);

SpotlightCard.displayName = "SpotlightCard";

export default SpotlightCard;
