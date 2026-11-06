import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  Download,
  Loader2,
  Package,
  PiggyBank,
  RefreshCw,
  ShoppingBag,
  Trophy,
  TriangleAlert,
} from "lucide-react";
import api from "../../services/api";
import { formatCurrency } from "../../utils/formatCurrency";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import { gsap, useGSAP, prefersReducedMotion } from "../../lib/gsap";
import useStaggerReveal from "../../hooks/useStaggerReveal";
import SplitText from "../../components/reactbits/SplitText";
import CountUp from "../../components/reactbits/CountUp";
import SpotlightCard from "../../components/reactbits/SpotlightCard";
import Modal from "../../components/ui/Modal";
import StatusBadge from "../../components/ui/StatusBadge";
import { formatOrderDate, shortOrderId } from "../../utils/orderStatus";
import { downloadReportPdf } from "../../utils/reportPdf";

const EMPTY_ANALYTICS = {
  salesTrendData: [],
  totalRevenue: 0,
  previousWeekRevenue: 0,
  weekOverWeekChangePercent: null,
  ordersCount: 0,
  avgOrderValue: 0,
  totalCost: 0,
  grossProfit: 0,
  grossMarginPercent: null,
  costCoveragePercent: 0,
  lowStockCount: 0,
  statusBreakdown: [],
  topSellingProducts: [],
  periodLabel: "",
};

const ACCENT = "#e1fb15";

const formatAxisSales = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}K`;
  return String(Math.round(n));
};

const formatDateKeyShort = (dateKey) => {
  if (!dateKey) return "";
  const [y, m, d] = String(dateKey).split("-");
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  if (Number.isNaN(dt.getTime())) return dateKey;
  return dt.toLocaleDateString("en-LK", { day: "numeric", month: "short" });
};

const dateInputValue = (date) => {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const buildEmptyWeekTrend = () => {
  const out = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);
  for (let i = 0; i < 7; i += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    out.push({
      label: day.toLocaleDateString("en-LK", { weekday: "short", day: "numeric", month: "short" }),
      dateKey: dateInputValue(day),
      sales: 0,
    });
  }
  return out;
};

const PRESETS = [
  { id: "today", label: "Today" },
  { id: "last7", label: "Last 7 days" },
  { id: "last30", label: "Last 30 days" },
  { id: "thisMonth", label: "This month" },
];

const rangeFromPreset = (presetId) => {
  const now = new Date();
  const end = dateInputValue(now);
  if (presetId === "today") return { startDate: end, endDate: end, label: "Today" };
  if (presetId === "last30") {
    const start = new Date(now);
    start.setDate(start.getDate() - 29);
    return { startDate: dateInputValue(start), endDate: end, label: "Last 30 days" };
  }
  if (presetId === "thisMonth") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { startDate: dateInputValue(start), endDate: end, label: "This month" };
  }
  const start = new Date(now);
  start.setDate(start.getDate() - 6);
  return { startDate: dateInputValue(start), endDate: end, label: "Last 7 days" };
};

const pctOf = (part, total) => (total ? Math.round((Number(part || 0) / total) * 1000) / 10 : 0);

const SalesTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-2xl border border-black/10 bg-v-accent px-4 py-2.5 text-black shadow-xl">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-black/55">{row.label}</p>
      <p className="text-lg font-bold tabular-nums">{formatCurrency(row.sales)}</p>
    </div>
  );
};

const card = "rounded-[28px] border border-white/[0.07] bg-v-card p-5 shadow-v-card md:p-6";
const eyebrow = "text-[11px] font-bold uppercase tracking-[0.14em] text-white/40";

/** Animated progress bar: width tweens with GSAP whenever `value` changes. */
const Meter = ({ value, color = ACCENT, className = "h-2" }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    const width = `${Math.max(0, Math.min(100, value))}%`;
    if (prefersReducedMotion()) gsap.set(ref.current, { width });
    else gsap.to(ref.current, { width, duration: 1.2, ease: "power3.out", delay: 0.2 });
  }, [value]);
  return (
    <div className={`w-full overflow-hidden rounded-full bg-white/[0.06] ${className}`}>
      <div ref={ref} className="h-full w-0 rounded-full" style={{ background: color }} />
    </div>
  );
};

const GrowthChip = ({ percent, dark = false }) => {
  if (percent === null || percent === undefined) {
    return (
      <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${dark ? "bg-black/10 text-black/60" : "bg-white/[0.06] text-white/45"}`}>
        No prior data
      </span>
    );
  }
  const up = percent >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  const tone = dark
    ? "bg-black/15 text-black"
    : up
      ? "bg-v-green/15 text-v-green"
      : "bg-red-400/15 text-red-300";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${tone}`}>
      <Icon size={13} strokeWidth={2.6} />
      {up ? "+" : ""}
      {percent}%
    </span>
  );
};

const DashboardSkeleton = () => (
  <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
    <div className="h-14 w-72 animate-pulse rounded-2xl bg-white/[0.05]" />
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-40 animate-pulse rounded-[28px] bg-white/[0.04]" />
      ))}
    </div>
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="h-80 animate-pulse rounded-[28px] bg-white/[0.04] xl:col-span-2" />
      <div className="h-80 animate-pulse rounded-[28px] bg-white/[0.04]" />
    </div>
  </div>
);

const DashboardPage = () => {
  const { user } = useAuth();
  const toast = useToast();
  const rootRef = useRef(null);

  const [analytics, setAnalytics] = useState(EMPTY_ANALYTICS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [pdfGenerating, setPdfGenerating] = useState(false);
  // The report's own range. Opening the dialog starts it at the dashboard's current range.
  const [reportRange, setReportRange] = useState(() => rangeFromPreset("last7"));
  const [reportCustom, setReportCustom] = useState(() => rangeFromPreset("last7"));
  const [reportData, setReportData] = useState(null); // analytics for the chosen report period
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [selectedRange, setSelectedRange] = useState(() => rangeFromPreset("last7"));
  const [customRange, setCustomRange] = useState(() => rangeFromPreset("last7"));
  const [rangePickerOpen, setRangePickerOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [recentOrders, setRecentOrders] = useState(null); // null = loading
  const rangeRef = useRef(null);

  const isAdmin = user?.role === "Admin";

  const loadDashboard = useCallback(
    async ({ silent = false, range } = {}) => {
      if (!silent) setLoading(true);
      setError("");
      try {
        const queryRange = range || selectedRange;
        const { data } = await api.get("/orders/analytics/summary", {
          params: { startDate: queryRange.startDate, endDate: queryRange.endDate },
        });
        const payload = data.data || {};
        setAnalytics({
          ...EMPTY_ANALYTICS,
          ...payload,
          salesTrendData:
            Array.isArray(payload.salesTrendData) && payload.salesTrendData.length
              ? payload.salesTrendData
              : buildEmptyWeekTrend(),
        });
        setLastUpdated(new Date());
      } catch (err) {
        const message = err?.response?.data?.message || "Failed to load dashboard analytics.";
        setError(message);
        if (!silent) toast.error("Dashboard load failed", message);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [selectedRange, toast]
  );

  useEffect(() => {
    loadDashboard({ range: selectedRange });
    const intervalId = window.setInterval(() => loadDashboard({ silent: true }), 30000);
    return () => window.clearInterval(intervalId);
  }, [loadDashboard, selectedRange]);

  const loadRecentOrders = useCallback(async () => {
    try {
      const { data } = await api.get("/orders", { params: { limit: 6 } });
      const list = Array.isArray(data.data) ? data.data : [];
      setRecentOrders(
        [...list].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 6)
      );
    } catch {
      setRecentOrders([]);
    }
  }, []);

  useEffect(() => {
    loadRecentOrders();
  }, [loadRecentOrders]);

  // Close the date-range popover on outside click or Escape.
  useEffect(() => {
    if (!rangePickerOpen) return undefined;
    const onDown = (e) => {
      if (rangeRef.current && !rangeRef.current.contains(e.target)) setRangePickerOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setRangePickerOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [rangePickerOpen]);

  // Load data for the report's range whenever the dialog is open and the range changes.
  useEffect(() => {
    if (!reportOpen) return undefined;
    let cancelled = false;
    const range = reportRange;
    setReportLoading(true);
    setReportError("");
    api
      .get("/orders/analytics/summary", { params: { startDate: range.startDate, endDate: range.endDate } })
      .then(({ data }) => {
        if (cancelled) return;
        const payload = data.data || {};
        setReportData({
          ...EMPTY_ANALYTICS,
          ...payload,
          salesTrendData: Array.isArray(payload.salesTrendData) ? payload.salesTrendData : [],
          range,
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setReportData(null);
        setReportError(err?.response?.data?.message || "Could not load report data.");
      })
      .finally(() => {
        if (!cancelled) setReportLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reportOpen, reportRange]);

  useStaggerReveal(rootRef, [loading]);

  const {
    salesTrendData,
    totalRevenue,
    previousWeekRevenue,
    weekOverWeekChangePercent,
    ordersCount,
    avgOrderValue,
    totalCost,
    grossProfit,
    grossMarginPercent,
    costCoveragePercent,
    lowStockCount,
    statusBreakdown,
    topSellingProducts,
    periodLabel,
  } = analytics;

  const trendRows = useMemo(
    () => (salesTrendData.length > 0 ? salesTrendData : buildEmptyWeekTrend()),
    [salesTrendData]
  );

  const salesActivity = useMemo(() => {
    const activeDays = trendRows.filter((row) => Number(row.sales) > 0).length;
    const peak = trendRows.reduce(
      (best, row) => (Number(row.sales) > best.sales ? { label: row.label || "—", sales: Number(row.sales) } : best),
      { label: "—", sales: 0 }
    );
    return { activeDays, peakLabel: peak.label, peakSales: peak.sales };
  }, [trendRows]);

  const statusCounts = useMemo(() => {
    const map = new Map();
    (statusBreakdown || []).forEach((item) => map.set(String(item.name || "").toLowerCase(), Number(item.count) || 0));
    return map;
  }, [statusBreakdown]);

  const completedOrders = (statusCounts.get("completed") || 0) + (statusCounts.get("delivered") || 0);
  const cancelledOrders = (statusCounts.get("cancelled") || 0) + (statusCounts.get("canceled") || 0);
  const openOrders = Math.max(ordersCount - completedOrders - cancelledOrders, 0);
  const fulfillmentRate = pctOf(completedOrders, ordersCount);
  const maxSold = Math.max(1, ...topSellingProducts.map((p) => Number(p.quantitySold) || 0));
  const costShare = totalRevenue > 0 ? Math.min(100, (totalCost / totalRevenue) * 100) : 0;

  const applyRange = (nextRange) => {
    setSelectedRange(nextRange);
    setCustomRange(nextRange);
    setRangePickerOpen(false);
  };

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([loadDashboard({ silent: true }), loadRecentOrders()]);
    setRefreshing(false);
    toast.success("Refreshed", "Latest analytics loaded.");
  };

  const openReport = () => {
    setReportRange(selectedRange);
    setReportCustom(selectedRange);
    setReportOpen(true);
  };

  const pickReportRange = (range) => {
    setReportRange(range);
    setReportCustom(range);
  };

  const applyReportCustom = () => {
    if (!reportCustom.startDate || !reportCustom.endDate) {
      toast.error("Invalid range", "Please select both start and end dates.");
      return;
    }
    if (reportCustom.endDate < reportCustom.startDate) {
      toast.error("Invalid range", "End date must be after start date.");
      return;
    }
    pickReportRange({ startDate: reportCustom.startDate, endDate: reportCustom.endDate, label: "Custom range" });
  };

  const generateReportPdf = async () => {
    if (!reportData) return;
    setPdfGenerating(true);
    try {
      const filename = await downloadReportPdf({
        data: reportData,
        periodName: reportData.range.label,
        range: reportData.range,
        storeName: user?.store?.name || "",
      });
      toast.success("Report downloaded", filename);
    } catch (e) {
      toast.error("PDF failed", e?.message || "Could not generate the report PDF.");
    } finally {
      setPdfGenerating(false);
    }
  };

  if (loading) return <DashboardSkeleton />;

  const kpis = [
    {
      key: "revenue",
      label: "Total revenue",
      icon: CircleDollarSign,
      value: totalRevenue,
      format: (n) => formatCurrency(Math.round(n)),
      foot: <GrowthChip percent={weekOverWeekChangePercent} />,
      sub: `vs ${formatCurrency(previousWeekRevenue)} prior`,
    },
    {
      key: "profit",
      label: "Net profit",
      icon: PiggyBank,
      value: grossProfit,
      format: (n) => formatCurrency(Math.round(n)),
      tone: grossProfit >= 0 ? "text-v-green" : "text-red-300",
      foot: (
        <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-bold text-white/70">
          Margin {grossMarginPercent === null ? "—" : `${grossMarginPercent}%`}
        </span>
      ),
      sub: `Cost coverage ${costCoveragePercent}%`,
    },
    {
      key: "aov",
      label: "Average order",
      icon: ShoppingBag,
      value: avgOrderValue,
      format: (n) => (ordersCount > 0 ? formatCurrency(Math.round(n)) : "—"),
      foot: (
        <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-[11px] font-bold text-white/70">
          {salesActivity.activeDays}/{trendRows.length} active days
        </span>
      ),
      sub: `Peak ${formatCurrency(salesActivity.peakSales)}`,
    },
  ];

  return (
    <div ref={rootRef} className="space-y-6">
      {/* ---------- Header ---------- */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white md:text-5xl">
            <SplitText text="Overview" />
          </h1>
          <p data-reveal className="mt-2 text-sm text-white/45">
            {periodLabel || "Revenue, orders and inventory at a glance"}
            {lastUpdated ? (
              <span className="ml-2 inline-flex items-center gap-1.5 text-white/35">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-v-green opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-v-green" />
                </span>
                Live · {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            ) : null}
          </p>
        </div>

        <div data-reveal className="flex flex-wrap items-center gap-2">
          <div ref={rangeRef} className="relative">
            <button
              type="button"
              onClick={() => setRangePickerOpen((v) => !v)}
              aria-expanded={rangePickerOpen}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-v-surface px-4 py-2.5 text-sm font-semibold text-white/85 transition hover:border-white/20"
            >
              <CalendarDays size={16} className="text-v-accent" />
              {selectedRange.label}
              <ChevronDown size={14} className={`transition ${rangePickerOpen ? "rotate-180" : ""}`} />
            </button>
            {rangePickerOpen ? (
              <div className="absolute left-0 top-12 z-40 w-[310px] rounded-3xl border border-white/10 bg-v-card p-4 shadow-2xl sm:left-auto sm:right-0">
                <p className={eyebrow}>Quick ranges</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyRange(rangeFromPreset(preset.id))}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        selectedRange.label === preset.label
                          ? "border-v-accent bg-v-accent text-black"
                          : "border-white/10 text-white/75 hover:bg-white/10"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {["startDate", "endDate"].map((field) => (
                    <label key={field} className="text-[11px] text-white/50">
                      {field === "startDate" ? "Start date" : "End date"}
                      <input
                        type="date"
                        value={customRange[field]}
                        onChange={(e) => setCustomRange((prev) => ({ ...prev, [field]: e.target.value, label: "Custom range" }))}
                        className="mt-1 w-full rounded-xl border border-white/10 bg-v-surface px-2.5 py-2 text-xs text-white outline-none [color-scheme:dark] focus:border-v-accent/45"
                      />
                    </label>
                  ))}
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setRangePickerOpen(false)}
                    className="rounded-full border border-white/10 px-3.5 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!customRange.startDate || !customRange.endDate) {
                        toast.error("Invalid range", "Please select both start and end dates.");
                        return;
                      }
                      if (customRange.endDate < customRange.startDate) {
                        toast.error("Invalid range", "End date must be after start date.");
                        return;
                      }
                      applyRange({ ...customRange, label: "Custom range" });
                    }}
                    className="rounded-full bg-v-accent px-3.5 py-1.5 text-xs font-bold text-black"
                  >
                    Apply
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-v-surface text-white/70 transition hover:border-v-accent/40 hover:text-v-accent"
            aria-label="Refresh data"
            title="Refresh data"
          >
            <RefreshCw size={17} className={refreshing ? "animate-spin" : ""} />
          </button>

          <button
            type="button"
            onClick={openReport}
            className="inline-flex items-center gap-2 rounded-full bg-v-accent px-5 py-2.5 text-sm font-bold text-black shadow-v-glow transition hover:bg-v-accent-hover"
          >
            <Download size={16} />
            Export report
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</p>
      ) : null}

      {/* ---------- KPI row ---------- */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SpotlightCard
          data-reveal
          spotlightColor="rgba(0,0,0,0.10)"
          borderColor="rgba(0,0,0,0.25)"
          className="rounded-[28px] bg-v-accent p-5 text-black shadow-v-glow md:p-6"
        >
          <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/40 blur-3xl" />
          <div className="relative flex items-start justify-between">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-black/55">Orders</p>
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/10">
              <Package size={17} />
            </span>
          </div>
          <p className="relative mt-3 text-5xl font-extrabold">
            <CountUp value={ordersCount} />
          </p>
          <div className="relative mt-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-black/10 px-2.5 py-1 text-[11px] font-bold">{openOrders} open</span>
            <span className="rounded-full bg-black/10 px-2.5 py-1 text-[11px] font-bold">{completedOrders} delivered</span>
          </div>
        </SpotlightCard>

        {kpis.map(({ key, label, icon: Icon, value, format, tone, foot, sub }) => (
          <SpotlightCard key={key} data-reveal className={card}>
            <div className="flex items-start justify-between">
              <p className={eyebrow}>{label}</p>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.05] text-v-accent">
                <Icon size={17} />
              </span>
            </div>
            <p className={`mt-3 text-[26px] font-extrabold leading-tight ${tone || "text-white"}`}>
              <CountUp value={value} format={format} />
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {foot}
              <span className="text-[11px] text-white/35">{sub}</span>
            </div>
          </SpotlightCard>
        ))}
      </section>

      {/* ---------- Trend + status ---------- */}
      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SpotlightCard data-reveal className={`${card} xl:col-span-2`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className={eyebrow}>Sales trend</p>
              <h2 className="mt-1 text-2xl font-bold text-white">Daily order value</h2>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-white/40">Peak day</p>
              <p className="text-sm font-bold text-v-accent">
                {salesActivity.peakSales > 0 ? `${formatDateKeyShort(trendRows.find((r) => r.label === salesActivity.peakLabel)?.dateKey)} · ${formatCurrency(salesActivity.peakSales)}` : "—"}
              </p>
            </div>
          </div>
          <div className="mt-5 h-[260px] w-full md:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendRows} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#232323" strokeDasharray="4 6" vertical={false} />
                <XAxis
                  dataKey="dateKey"
                  tickFormatter={formatDateKeyShort}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={18}
                  tick={{ fill: "#737373", fontSize: 11 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={formatAxisSales}
                  tick={{ fill: "#737373", fontSize: 11 }}
                  width={48}
                />
                <Tooltip cursor={{ stroke: "#444", strokeDasharray: "4 4" }} content={<SalesTooltip />} />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke={ACCENT}
                  strokeWidth={2.5}
                  fill="url(#salesFill)"
                  dot={trendRows.length <= 14 ? { r: 3, fill: "#0a0a0a", stroke: ACCENT, strokeWidth: 2 } : false}
                  activeDot={{ r: 6, fill: ACCENT, stroke: "#0a0a0a", strokeWidth: 3 }}
                  animationDuration={1400}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SpotlightCard>

        <SpotlightCard data-reveal className={card}>
          <p className={eyebrow}>Order status</p>
          <h2 className="mt-1 text-2xl font-bold text-white">Pipeline mix</h2>
          <div className="relative mx-auto mt-4 h-[190px] w-[190px]">
            {ordersCount > 0 && statusBreakdown.length ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusBreakdown}
                      dataKey="count"
                      nameKey="name"
                      innerRadius={64}
                      outerRadius={90}
                      paddingAngle={4}
                      cornerRadius={8}
                      stroke="none"
                      animationDuration={1200}
                    >
                      {statusBreakdown.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-extrabold text-white">
                    <CountUp value={ordersCount} />
                  </span>
                  <span className="text-[11px] text-white/40">orders</span>
                </div>
              </>
            ) : (
              <div className="flex h-full items-center justify-center rounded-full border border-dashed border-white/15 text-xs text-white/40">
                No orders yet
              </div>
            )}
          </div>
          <ul className="mt-5 space-y-2.5">
            {statusBreakdown.map((item) => (
              <li key={item.name} className="flex items-center gap-3 text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="flex-1 text-white/70">{item.name}</span>
                <span className="font-bold tabular-nums text-white">{item.count}</span>
                <span className="w-12 text-right text-xs tabular-nums text-white/40">{pctOf(item.count, ordersCount)}%</span>
              </li>
            ))}
          </ul>
        </SpotlightCard>
      </section>

      {/* ---------- Products, profitability, health ---------- */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <SpotlightCard data-reveal className={card}>
          <div className="flex items-center justify-between">
            <div>
              <p className={eyebrow}>Best sellers</p>
              <h2 className="mt-1 text-xl font-bold text-white">Top products</h2>
            </div>
            <Trophy size={20} className="text-v-accent" />
          </div>
          <div className="mt-5 space-y-4">
            {topSellingProducts.length ? (
              topSellingProducts.slice(0, 5).map((item, index) => (
                <Link
                  key={`${item.productId || item.name}-${index}`}
                  to={`/orders?search=${encodeURIComponent(item.name || "")}`}
                  className="group block"
                  title={`View orders containing ${item.name}`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold ${
                        index === 0 ? "bg-v-accent text-black" : "bg-white/[0.06] text-white/60"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-white transition group-hover:text-v-accent">
                      {item.name}
                    </p>
                    <span className="text-xs font-bold tabular-nums text-white/70">{item.quantitySold} sold</span>
                  </div>
                  <div className="mt-2 flex items-center gap-3 pl-10">
                    <Meter value={(Number(item.quantitySold) / maxSold) * 100} color={index === 0 ? ACCENT : "#3f3f3f"} className="h-1.5" />
                    <span className="shrink-0 text-[11px] tabular-nums text-white/40">{formatCurrency(item.revenue || 0)}</span>
                  </div>
                </Link>
              ))
            ) : (
              <p className="text-sm text-white/45">No product sales in this period.</p>
            )}
          </div>
        </SpotlightCard>

        <SpotlightCard data-reveal className={card}>
          <p className={eyebrow}>Profitability</p>
          <h2 className="mt-1 text-xl font-bold text-white">Revenue vs cost</h2>
          <div className="mt-5 h-[150px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={[
                  { name: "Revenue", value: totalRevenue, fill: ACCENT },
                  { name: "Cost", value: totalCost, fill: "#3f3f3f" },
                  { name: "Profit", value: Math.max(grossProfit, 0), fill: "#4ade80" },
                ]}
                layout="vertical"
                margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
                barCategoryGap={10}
              >
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} width={62} tick={{ fill: "#a3a3a3", fontSize: 12 }} />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                  formatter={(v) => formatCurrency(v)}
                  contentStyle={{ background: "#181818", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, color: "#fff" }}
                  itemStyle={{ color: "#fff" }}
                  labelStyle={{ color: "#a3a3a3" }}
                />
                <Bar dataKey="value" radius={[6, 10, 10, 6]} animationDuration={1200}>
                  {["Revenue", "Cost", "Profit"].map((n, i) => (
                    <Cell key={n} fill={[ACCENT, "#3f3f3f", "#4ade80"][i]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4">
            <div className="mb-1.5 flex justify-between text-[11px] text-white/45">
              <span>Cost share of revenue</span>
              <span className="tabular-nums">{Math.round(costShare)}%</span>
            </div>
            <Meter value={costShare} color="linear-gradient(90deg,#e1fb15,#4ade80)" />
          </div>
        </SpotlightCard>

        <SpotlightCard data-reveal className={`${card} lg:col-span-2 xl:col-span-1`}>
          <div className="flex items-center justify-between">
            <div>
              <p className={eyebrow}>Operations</p>
              <h2 className="mt-1 text-xl font-bold text-white">Health check</h2>
            </div>
            <Activity size={20} className="text-v-green" />
          </div>
          <div className="mt-5 space-y-5">
            <div>
              <div className="mb-1.5 flex items-end justify-between">
                <span className="text-sm text-white/60">Fulfillment rate</span>
                <span className="text-2xl font-extrabold text-v-green">
                  <CountUp value={fulfillmentRate} format={(n) => `${n.toFixed(1)}%`} />
                </span>
              </div>
              <Meter value={fulfillmentRate} color="#4ade80" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/[0.06] bg-v-surface p-3.5">
                <p className="text-[11px] uppercase tracking-wide text-white/40">Open orders</p>
                <p className="mt-1 text-2xl font-extrabold text-white">
                  <CountUp value={openOrders} />
                </p>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-v-surface p-3.5">
                <p className="text-[11px] uppercase tracking-wide text-white/40">Active days</p>
                <p className="mt-1 text-2xl font-extrabold text-white">
                  {salesActivity.activeDays}
                  <span className="text-sm text-white/35">/{trendRows.length}</span>
                </p>
              </div>
            </div>
            <Link
              to={isAdmin ? "/inventory" : "/orders"}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition ${
                lowStockCount > 0
                  ? "border-amber-400/35 bg-amber-400/[0.08] hover:bg-amber-400/[0.12]"
                  : "border-v-green/25 bg-v-green/[0.06]"
              }`}
            >
              <TriangleAlert size={18} className={lowStockCount > 0 ? "text-amber-300" : "text-v-green"} />
              <span className="flex-1 text-sm text-white/75">
                {lowStockCount > 0 ? (
                  <>
                    <strong className="text-white">{lowStockCount}</strong> product{lowStockCount === 1 ? "" : "s"} below 10 units
                  </>
                ) : (
                  "Stock levels look healthy"
                )}
              </span>
              <ArrowUpRight size={16} className="text-white/40" />
            </Link>
          </div>
        </SpotlightCard>
      </section>

      {/* ---------- Recent orders ---------- */}
      <SpotlightCard data-reveal className={card}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className={eyebrow}>Activity</p>
            <h2 className="mt-1 text-xl font-bold text-white">Recent orders</h2>
          </div>
          <Link
            to="/orders"
            className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3.5 py-1.5 text-xs font-semibold text-white/70 transition hover:border-white/20 hover:text-white"
          >
            View all <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="mt-4 overflow-x-auto">
          {recentOrders === null ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-white/[0.04]" />
              ))}
            </div>
          ) : recentOrders.length ? (
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-white/35">
                <tr>
                  <th className="pb-2 font-semibold">Order</th>
                  <th className="pb-2 font-semibold">Customer</th>
                  <th className="pb-2 font-semibold">Date</th>
                  <th className="pb-2 font-semibold">Status</th>
                  <th className="pb-2 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order._id} className="border-t border-white/[0.05]">
                    <td className="py-3 font-mono text-xs text-white/50">{shortOrderId(order._id)}</td>
                    <td className="py-3 font-medium text-white">{order.customerName}</td>
                    <td className="py-3 text-white/55">{formatOrderDate(order.createdAt)}</td>
                    <td className="py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="py-3 text-right font-semibold tabular-nums text-white">
                      {formatCurrency(order.totalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="py-6 text-center text-sm text-white/45">No orders yet.</p>
          )}
        </div>
      </SpotlightCard>

      {/* ---------- Report modal ---------- */}
      <Modal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        eyebrow="Export report"
        title={`${reportRange.label} performance report`}
        description={
          reportData?.range
            ? `${formatDateKeyShort(reportData.range.startDate)} to ${formatDateKeyShort(reportData.range.endDate)}`
            : "Choose a period for the report"
        }
        size="lg"
        footer={
          <button
            type="button"
            onClick={generateReportPdf}
            disabled={pdfGenerating || reportLoading || !reportData}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-v-accent px-6 py-3 text-sm font-bold text-black shadow-v-glow transition hover:bg-v-accent-hover disabled:opacity-60"
          >
            {pdfGenerating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {pdfGenerating ? "Generating…" : "Download PDF report"}
          </button>
        }
      >
        {/* Report period: same options as the dashboard's range picker */}
        <p className={eyebrow}>Report period</p>
        <div role="radiogroup" aria-label="Report period" className="mt-2 flex flex-wrap gap-2">
          {PRESETS.map((preset) => {
            const selected = reportRange.label === preset.label;
            return (
              <button
                key={preset.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => pickReportRange(rangeFromPreset(preset.id))}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                  selected ? "border-v-accent bg-v-accent text-black" : "border-white/10 text-white/75 hover:bg-white/10"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
          {reportRange.label === "Custom range" ? (
            <span className="rounded-full border border-v-accent bg-v-accent px-3.5 py-1.5 text-xs font-semibold text-black">
              Custom range
            </span>
          ) : null}
        </div>
        <div className="mt-3 grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_1fr_auto]">
          {["startDate", "endDate"].map((field) => (
            <label key={field} className="min-w-0 text-[11px] text-white/50">
              {field === "startDate" ? "Start date" : "End date"}
              <input
                type="date"
                value={reportCustom[field]}
                onChange={(e) => setReportCustom((prev) => ({ ...prev, [field]: e.target.value }))}
                className="mt-1 w-full min-w-0 rounded-xl border border-white/10 bg-v-surface px-2.5 py-2 text-xs text-white outline-none [color-scheme:dark] focus:border-v-accent/45"
              />
            </label>
          ))}
          <button
            type="button"
            onClick={applyReportCustom}
            className="col-span-2 rounded-xl border border-white/15 px-4 py-2 text-xs font-bold text-white transition hover:border-v-accent/50 hover:text-v-accent sm:col-span-1"
          >
            Use these dates
          </button>
        </div>

        {reportLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-white/40" aria-label="Loading report" />
          </div>
        ) : reportError ? (
          <p className="mt-6 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {reportError}
          </p>
        ) : reportData ? (
          <>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Revenue", formatCurrency(reportData.totalRevenue), "text-v-accent"],
                ["Orders", String(reportData.ordersCount), "text-white"],
                ["Net profit", formatCurrency(reportData.grossProfit), "text-v-green"],
                ["Low stock", String(reportData.lowStockCount), "text-amber-300"],
              ].map(([k, v, tone]) => (
                <div key={k} className="rounded-2xl border border-white/[0.08] bg-v-surface p-3">
                  <p className="text-xs text-white/45">{k}</p>
                  <p className={`mt-1 truncate font-bold ${tone}`}>{v}</p>
                </div>
              ))}
            </div>

            <h4 className="mt-6 text-sm font-semibold text-white/80">Order value by day</h4>
            <div className="mt-2 max-h-72 overflow-y-auto rounded-2xl border border-white/[0.08]">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-[#1c1c1c] text-xs uppercase tracking-wide text-white/45">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">Date</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Order value</th>
                  </tr>
                </thead>
                <tbody className="bg-v-surface">
                  {reportData.salesTrendData.map((row) => (
                    <tr key={row.dateKey || row.label} className="border-t border-white/[0.06]">
                      <td className="px-3 py-2.5 text-white">{row.label}</td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-v-accent">
                        {formatCurrency(row.sales)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </Modal>
    </div>
  );
};

export default DashboardPage;
