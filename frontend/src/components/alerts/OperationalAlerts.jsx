import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Package,
} from "lucide-react";
import api from "../../services/api";

const OperationalAlerts = ({ userRole }) => {
  const [payload, setPayload] = useState({ threshold: 10, count: 0, items: [] });
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [fetchError, setFetchError] = useState("");

  const load = useCallback(async () => {
    setFetchError("");
    try {
      const { data } = await api.get("/products/alerts/low-stock");
      const next = data.data || { threshold: 10, count: 0, items: [] };
      setPayload(next);
    } catch {
      setFetchError("Could not load stock alerts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 90_000);
    return () => window.clearInterval(id);
  }, [load]);

  const { threshold, count, items } = payload;
  const isAdmin = userRole === "Admin";
  const remaining = Math.max(0, count - items.length);

  if (loading) {
    return (
      <div
        className="mb-8 animate-pulse rounded-[28px] border border-white/[0.08] bg-v-card p-5 shadow-v-card"
        aria-hidden
      >
        <div className="h-4 w-40 rounded-full bg-white/10" />
        <div className="mt-3 h-3 w-full max-w-md rounded-full bg-white/[0.06]" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="mb-8 rounded-[28px] border border-red-400/35 bg-red-500/10 px-5 py-3.5 text-sm text-red-100 shadow-v-card">
        {fetchError}
      </div>
    );
  }

  if (count === 0) {
    return (
      <div className="mb-8 flex items-center gap-4 rounded-[28px] border border-v-green/25 bg-v-green/10 px-5 py-4 shadow-v-card">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-v-green/20 text-v-green">
          <CheckCircle2 size={22} strokeWidth={2} />
        </div>
        <div>
          <p className="text-sm font-bold text-white">All clear</p>
          <p className="text-xs text-white/50">
            No products below {threshold} units — inventory looks healthy.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8 overflow-hidden rounded-[28px] border border-amber-400/40 bg-gradient-to-br from-amber-500/15 via-v-card to-v-elevated shadow-[0_0_48px_-8px_rgba(251,191,36,0.25)]">
      <div className="relative px-5 py-4 sm:px-6 sm:py-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(251,191,36,0.14),transparent_55%)]" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/25 text-amber-100 ring-1 ring-amber-400/50">
              <BellRing size={22} className="text-amber-200" />
              <span className="animate-alert-blink absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-v-accent px-1 text-[10px] font-extrabold text-black ring-2 ring-v-page">
                {count > 99 ? "99+" : count}
              </span>
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold tracking-tight text-amber-50">
                  Low stock alert
                </h2>
                <span className="rounded-full border border-amber-400/40 bg-amber-400/15 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-amber-100/90">
                  Action needed
                </span>
              </div>
              <p className="mt-1 max-w-xl text-sm text-amber-100/65">
                {count} product{count === 1 ? "" : "s"} under {threshold} units. Restock before orders
                outpace availability.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            {isAdmin ? (
              <Link
                to="/inventory"
                className="inline-flex items-center gap-2 rounded-full bg-v-accent px-4 py-2.5 text-sm font-bold text-black shadow-v-glow transition hover:bg-v-accent-hover"
              >
                <Package size={16} strokeWidth={2.5} />
                Open inventory
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-black/30 px-3.5 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-500/15"
              aria-expanded={expanded}
            >
              {expanded ? (
                <>
                  Hide list <ChevronUp size={14} />
                </>
              ) : (
                <>
                  Show items <ChevronDown size={14} />
                </>
              )}
            </button>
          </div>
        </div>

        {expanded ? (
          <ul className="relative mt-4 space-y-2 border-t border-amber-400/20 pt-4">
            {items.map((row) => (
              <li
                key={row._id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-v-surface/80 px-3 py-2.5 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <AlertTriangle
                    size={16}
                    className="shrink-0 text-amber-300/90"
                    aria-hidden
                  />
                  <span className="truncate font-medium text-white/90">{row.name}</span>
                  {row.category ? (
                    <span className="hidden shrink-0 text-xs text-white/40 sm:inline">
                      · {row.category}
                    </span>
                  ) : null}
                </div>
                <span className="shrink-0 rounded-lg bg-amber-500/20 px-2 py-1 text-xs font-semibold tabular-nums text-amber-100">
                  {row.stockQuantity} left
                </span>
              </li>
            ))}
            {remaining > 0 ? (
              <li className="px-1 text-center text-xs text-amber-100/50">
                + {remaining} more not shown — {isAdmin ? "open inventory for the full list." : "ask an admin to review inventory."}
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
    </div>
  );
};

export default OperationalAlerts;
