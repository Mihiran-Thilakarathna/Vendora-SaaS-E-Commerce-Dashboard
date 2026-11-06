import { useRef } from "react";
import { gsap, SplitText as GSAPSplitText, useGSAP, prefersReducedMotion } from "../../lib/gsap";

/**
 * SplitText — character / word reveal powered by GSAP's SplitText plugin.
 * Pattern adapted from React Bits (reactbits.dev, MIT).
 */
const SplitText = ({
  text,
  as: Tag = "span",
  className = "",
  splitType = "chars",
  delay = 0,
  stagger = 0.03,
  duration = 0.9,
  from = { opacity: 0, y: 40, rotateX: -60 },
  ease = "power4.out",
}) => {
  const ref = useRef(null);

  useGSAP(
    () => {
      if (!ref.current || prefersReducedMotion()) return undefined;
      const split = new GSAPSplitText(ref.current, {
        type: splitType === "words" ? "words" : "words,chars",
        wordsClass: "inline-block",
        charsClass: "inline-block will-change-transform",
      });
      const targets = splitType === "words" ? split.words : split.chars;
      gsap.set(ref.current, { perspective: 600 });
      gsap.from(targets, { ...from, duration, ease, stagger, delay });
      return () => split.revert();
    },
    { scope: ref, dependencies: [text] }
  );

  return (
    <Tag ref={ref} className={className} aria-label={text}>
      {text}
    </Tag>
  );
};

export default SplitText;
