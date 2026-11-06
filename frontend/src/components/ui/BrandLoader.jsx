/**
 * Branded loading state: the Vendora mark inside a rotating gradient ring, a soft breathing
 * glow, and an indeterminate progress bar. Pure CSS (no JS timers), and it calms down for
 * visitors who prefer reduced motion.
 */
const BrandLoader = ({ label = "Loading", hint, fullScreen = false, className = "" }) => (
  <div
    role="status"
    aria-live="polite"
    className={`flex flex-col items-center justify-center px-6 text-center ${
      fullScreen ? "min-h-[100dvh] bg-v-page" : "min-h-[50vh]"
    } ${className}`}
  >
    <div className="relative h-[88px] w-[88px]">
      <span className="v-loader-glow absolute inset-2 rounded-full bg-v-accent/25 blur-xl" aria-hidden />
      <svg viewBox="0 0 88 88" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <linearGradient id="vLoaderArc" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e1fb15" />
            <stop offset="100%" stopColor="#4ade80" />
          </linearGradient>
        </defs>
        <circle cx="44" cy="44" r="40" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3" />
        <circle
          className="v-loader-arc"
          cx="44"
          cy="44"
          r="40"
          fill="none"
          stroke="url(#vLoaderArc)"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-[14px] flex items-center justify-center rounded-full border border-white/10 bg-v-card/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <img src="/vendora-logo.png" alt="" className="v-loader-mark h-8 w-8 object-contain" />
      </span>
    </div>

    <p className="mt-6 text-sm font-semibold text-white/85">
      {label}
      <span className="v-loader-dots" aria-hidden />
    </p>
    {hint ? <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-white/40">{hint}</p> : null}

    <div className="mt-5 h-[3px] w-40 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
      <span className="v-loader-bar block h-full w-1/3 rounded-full bg-gradient-to-r from-transparent via-v-accent to-transparent" />
    </div>
    <span className="sr-only">{label}</span>
  </div>
);

export default BrandLoader;
