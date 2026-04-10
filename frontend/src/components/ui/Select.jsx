import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

const normalizeOptions = (options) => {
  return (options || []).map((opt) => {
    if (typeof opt === "string" || typeof opt === "number") {
      return { value: String(opt), label: String(opt) };
    }
    return { value: String(opt.value), label: String(opt.label ?? opt.value), disabled: Boolean(opt.disabled) };
  });
};

const useOutsideClick = (refs, onOutside) => {
  useEffect(() => {
    const handler = (e) => {
      const target = e.target;
      const hit = refs.some((r) => r.current && r.current.contains(target));
      if (!hit) onOutside();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [refs, onOutside]);
};

export default function Select({
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled = false,
  className = "",
  buttonClassName = "",
  menuClassName = "",
  optionClassName = "",
  compact = false,
  ariaLabel,
}) {
  const id = useId();
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);

  const normalized = useMemo(() => normalizeOptions(options), [options]);
  const selected = normalized.find((o) => o.value === String(value ?? "")) || null;

  useOutsideClick([btnRef, menuRef], () => setOpen(false));

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const baseBtn =
    "relative flex w-full items-center justify-between gap-3 border border-white/10 bg-v-surface text-white/90 outline-none transition hover:border-white/15 focus:border-v-accent/45 focus:shadow-[0_0_0_1px_rgba(225,251,21,0.12)]";
  const sizeBtn = compact ? "rounded-xl px-3 py-2 text-sm" : "rounded-2xl px-4 py-2.5 text-sm";
  const baseMenu =
    "mt-2 overflow-hidden rounded-2xl border border-white/10 bg-v-card shadow-v-card ring-1 ring-black/30";

  return (
    <div className={`relative ${className}`}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        aria-label={ariaLabel}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`${baseBtn} ${sizeBtn} ${disabled ? "opacity-60" : ""} ${buttonClassName}`}
      >
        <span className={`min-w-0 truncate ${selected ? "text-white" : "text-white/55"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={18}
          strokeWidth={2}
          className={`shrink-0 text-white/55 transition ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          ref={menuRef}
          id={`${id}-listbox`}
          role="listbox"
          className={`${baseMenu} absolute left-0 right-0 z-[80] ${menuClassName}`}
        >
          <ul className="max-h-72 overflow-auto p-1">
            {normalized.map((opt) => {
              const isSelected = selected?.value === opt.value;
              const isDisabled = Boolean(opt.disabled);
              return (
                <li key={opt.value} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    disabled={isDisabled}
                    onClick={() => {
                      if (isDisabled) return;
                      onChange?.(opt.value);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${
                      isDisabled
                        ? "cursor-not-allowed opacity-50"
                        : isSelected
                          ? "bg-v-accent text-black"
                          : "text-white/80 hover:bg-white/[0.06] hover:text-white"
                    } ${optionClassName}`}
                  >
                    <span className="min-w-0 truncate">{opt.label}</span>
                    {isSelected ? (
                      <span className="text-xs font-extrabold" aria-hidden>
                        ✓
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

