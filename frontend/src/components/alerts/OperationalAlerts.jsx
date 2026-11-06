import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ChevronDown, Package, X } from "lucide-react";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";

/** How long "dismiss" hides the banner, unless the low-stock situation changes first. */
const SNOOZE_MS = 2 * 60 * 60 * 1000;
const snoozeKey = (storeId) => `vendora_lowstock_snooze_${storeId || "default"}`;

/** Identifies the current low-stock situation, so a change (new item, lower stock) re-shows the banner. */
const signatureOf = ({ count, items }) =>
  `${count}|${(items || [])
    .map((i) => `${i._id}:${i.stockQuantity}`)
    .sort()
    .join(",")}`;

const readSnooze = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
};

/**
 * Compact low-stock banner shown above page content.
 * One line by default; the affected products expand on demand. Hidden when stock is healthy.
 * It can be dismissed, but only for a while: it returns after SNOOZE_MS, or sooner if the
 * set of low-stock products (or their quantities) changes.
 */
const OperationalAlerts = ({ userRole }) => {
  const { user } = useAuth();
  const storeKey = snoozeKey(user?.store?._id);

  const [payload, setPayload] = useState({ threshold: 10, count: 0, items: [] });
  const [expanded, setExpanded] = useState(false);
  const [snooze, setSnooze] = useState(() => readSnooze(storeKey));
  const [now, setNow] = useState(() => Date.now());
  const [entered, setEntered] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/products/alerts/low-stock");
      setPayload(data.data || { threshold: 10, count: 0, items: [] });
    } catch {
      /* non-critical: the banner simply stays hidden */
    }
    setNow(Date.now());
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 90_000);
    return () => window.clearInterval(id);
  }, [load]);

  useEffect(() => {
    setSnooze(readSnooze(storeKey));
  }, [storeKey]);

  const { threshold, count, items } = payload;
  const signature = useMemo(() => signatureOf(payload), [payload]);
  const snoozed = Boolean(snooze && snooze.signature === signature && snooze.until > now);
  const visible = count > 0 && !snoozed;

  // Slide in smoothly the first time it has something to show.
  useEffect(() => {
    if (!visible) {
      setEntered(false);
      return undefined;
    }
    const id = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(id);
  }, [visible]);

  const dismiss = () => {
    const next = { signature, until: Date.now() + SNOOZE_MS };
    try {
      localStorage.setItem(storeKey, JSON.stringify(next));
    } catch {
      /* storage unavailable: dismiss just lasts for this page view */
    }
    setEntered(false);
    // Let the collapse animation play before unmounting.
    window.setTimeout(() => {
      setSnooze(next);
      setExpanded(false);
    }, 450);
  };

  if (!visible) return null;

  const isAdmin = userRole === "Admin";
  const remaining = Math.max(0, count - items.length);

  return (
    <div
      className={`grid transition-[grid-template-rows,opacity,margin] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        entered ? "mb-6 grid-rows-[1fr] opacity-100" : "mb-0 grid-rows-[0fr] opacity-0"
      }`}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          role="status"
          className="overflow-hidden rounded-2xl border border-amber-400/25 bg-gradient-to-r from-amber-400/[0.09] via-amber-400/[0.05] to-transparent"
        >
          {/* Phones: message on top, actions underneath. Wider screens: one line. */}
          <div className="flex items-start gap-3 px-3 py-3 sm:items-center sm:px-4">
            {/* Animated warning mark: a soft ripple plus an occasional gentle nudge. */}
            <span className="v-alert-ring relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-amber-300">
              <AlertTriangle size={17} className="v-alert-icon" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <p className="min-w-0 pt-0.5 text-sm text-white/80 sm:flex-1 sm:pt-0">
                <span className="font-semibold text-amber-200">
                  {count} product{count === 1 ? "" : "s"} low on stock
                </span>
                <span className="text-white/50"> · below {threshold} units</span>
              </p>
              <div className="-ml-3 flex items-center gap-1.5 sm:ml-0">
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  aria-expanded={expanded}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-amber-100/80 transition hover:bg-amber-400/10"
                >
                  {expanded ? "Hide list" : "View"}
                  <ChevronDown size={14} className={`transition-transform duration-300 ${expanded ? "rotate-180" : ""}`} />
                </button>
                {isAdmin ? (
                  <Link
                    to="/inventory?filter=low"
                    className="inline-flex items-center gap-1.5 rounded-full bg-amber-300 px-3 py-1.5 text-xs font-bold text-black transition hover:bg-amber-200"
                  >
                    <Package size={13} /> Restock
                  </Link>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss for 2 hours"
              title="Dismiss for 2 hours. It comes back sooner if stock changes."
              className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-amber-100/60 transition hover:bg-amber-400/10 hover:text-amber-100"
            >
              <X size={16} />
            </button>
          </div>

          {/* Product list: opens and closes smoothly */}
          <div
            className={`grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            }`}
          >
            <div className="min-h-0 overflow-hidden">
              <ul className="grid gap-2 border-t border-amber-400/15 px-3 py-3 sm:grid-cols-2 sm:px-4 lg:grid-cols-3">
                {items.map((row) => (
                  <li
                    key={row._id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-black/20 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 truncate text-white/85">{row.name}</span>
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-amber-200">
                      {row.stockQuantity} left
                    </span>
                  </li>
                ))}
                {remaining > 0 ? (
                  <li className="px-1 py-2 text-xs text-white/40">
                    +{remaining} more{isAdmin ? " in inventory" : ""}
                  </li>
                ) : null}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OperationalAlerts;
