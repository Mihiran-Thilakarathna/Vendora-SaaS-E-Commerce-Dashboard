import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import useScrollLock from "../../hooks/useScrollLock";
import { gsap, prefersReducedMotion } from "../../lib/gsap";

const SIZES = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };

/**
 * Shared dialog: portal, dimmed backdrop, Esc / backdrop to close, background scroll lock,
 * scroll containment inside the panel, and a short GSAP entrance.
 */
const Modal = ({
  open,
  onClose,
  title,
  description,
  eyebrow,
  size = "md",
  dismissible = true,
  footer,
  children,
  zIndex = 60,
}) => {
  const panelRef = useRef(null);
  const backdropRef = useRef(null);
  useScrollLock(open);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape" && dismissible) onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismissible, onClose]);

  useEffect(() => {
    if (!open || prefersReducedMotion()) return;
    gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.2, ease: "power1.out" });
    gsap.fromTo(
      panelRef.current,
      { opacity: 0, y: 24, scale: 0.97 },
      { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: "back.out(1.4)" }
    );
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      ref={backdropRef}
      className="fixed inset-0 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      style={{ zIndex }}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && dismissible) onClose?.();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        className={`flex max-h-[92dvh] w-full ${SIZES[size] || SIZES.md} flex-col overflow-hidden rounded-t-[26px] border border-white/10 bg-v-card shadow-2xl sm:rounded-[26px]`}
      >
        {title ? (
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/[0.06] px-5 py-4 sm:px-6">
            <div className="min-w-0">
              {eyebrow ? <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-v-accent">{eyebrow}</p> : null}
              <h2 className="mt-0.5 text-lg font-bold text-white sm:text-xl">{title}</h2>
              {description ? <p className="mt-1 text-sm text-white/50">{description}</p> : null}
            </div>
            {dismissible ? (
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-full border border-white/10 p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">{children}</div>

        {footer ? (
          <div className="shrink-0 border-t border-white/[0.06] bg-v-card px-5 py-4 sm:px-6">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
