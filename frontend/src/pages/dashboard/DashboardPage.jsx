import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Bar,
  BarChart,
  LineChart,
  CartesianGrid,
  Cell,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Target,
  CircleDollarSign,
  ArrowUpRight,
  X,
  SlidersHorizontal,
  CalendarDays,
  ChevronDown,
} from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import api from "../../services/api";
import { formatCurrencyCompact, formatCurrency } from "../../utils/formatCurrency";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";

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

const formatAxisSales = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("en-LK", { maximumFractionDigits: 0 });
};

const formatXAxisLabel = (label) => {
  if (!label) return "";
  const text = String(label);
  const parts = text.split(" ");
  if (parts.length >= 2) {
    return `${parts[0]} ${parts[1]}`;
  }
  return text;
};

const safeText = (value) => (value === null || value === undefined ? "" : String(value));

const formatDateKeyShort = (dateKey) => {
  if (!dateKey) return "";
  const [y, m, d] = String(dateKey).split("-");
  const dt = new Date(Number(y), Number(m) - 1, Number(d));
  if (Number.isNaN(dt.getTime())) return dateKey;
  return dt.toLocaleDateString("en-LK", { day: "numeric", month: "short" });
};

const buildEmptyWeekTrend = () => {
  const out = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (let i = 0; i < 7; i += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    const shortWeekday = dayNames[day.getDay()];
    const label = day.toLocaleDateString("en-LK", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    const y = day.getFullYear();
    const m = String(day.getMonth() + 1).padStart(2, "0");
    const d = String(day.getDate()).padStart(2, "0");
    out.push({
      day: shortWeekday,
      label,
      dateKey: `${y}-${m}-${d}`,
      sales: 0,
    });
  }
  return out;
};

const SalesBarTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-2xl border border-black/15 bg-v-accent px-4 py-2.5 text-black shadow-xl">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-black/55">{row.label}</p>
      <p className="text-lg font-bold tabular-nums">{formatCurrency(row.sales)}</p>
    </div>
  );
};

const cardShell =
  "rounded-[28px] border border-white/[0.08] bg-v-card p-5 shadow-v-card md:p-6";

const dateInputValue = (date) => {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const rangeFromPreset = (presetId) => {
  const now = new Date();
  const end = dateInputValue(now);
  if (presetId === "today") {
    return { startDate: end, endDate: end, label: "Today" };
  }
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

const DashboardPage = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [analytics, setAnalytics] = useState(EMPTY_ANALYTICS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState(() => rangeFromPreset("last7"));
  const [customRange, setCustomRange] = useState(() => rangeFromPreset("last7"));
  const [rangePickerOpen, setRangePickerOpen] = useState(false);
  const [toolsPanelOpen, setToolsPanelOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfFilename, setPdfFilename] = useState("vendora-report.pdf");
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const toast = useToast();

  const isAdmin = user?.role === "Admin";

  const loadDashboard = useCallback(
    async ({ silent = false, range } = {}) => {
      if (!silent) setLoading(true);
      setError("");
      try {
        const queryRange = range || selectedRange;
        const { data } = await api.get("/orders/analytics/summary", {
          params: {
            startDate: queryRange.startDate,
            endDate: queryRange.endDate,
          },
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

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const closePdfPreview = () => {
    setPdfOpen(false);
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl("");
    }
  };

  const downloadBlobUrl = (blobUrl, filename) => {
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const generateReportPdf = async () => {
    setPdfGenerating(true);
    try {
      const reportTitle = `${safeText(selectedRange?.label || "Dashboard")} performance report`;
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `vendora-report-${stamp}.pdf`;

      const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const marginX = 40;
      let y = 52;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(reportTitle, marginX, y);
      y += 18;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(90);
      doc.text(`Generated: ${new Date().toLocaleString()}`, marginX, y);
      y += 20;
      doc.setTextColor(0);

      const kpis = [
        ["Total revenue", formatCurrency(totalRevenue)],
        ["Prior week", formatCurrency(previousWeekRevenue)],
        ["Avg order", ordersCount > 0 ? formatCurrency(avgOrderValue) : "—"],
        ["Low-stock products (<10 units)", safeText(lowStockCount)],
        ["Orders in range", safeText(ordersCount)],
      ];

      autoTable(doc, {
        startY: y,
        head: [["Metric", "Value"]],
        body: kpis,
        styles: { fontSize: 10, cellPadding: 6 },
        headStyles: { fillColor: [20, 20, 20], textColor: 255 },
        columnStyles: { 0: { cellWidth: pageWidth * 0.55 }, 1: { cellWidth: pageWidth * 0.35 } },
        margin: { left: marginX, right: marginX },
      });

      y = doc.lastAutoTable.finalY + 18;

      if (statusBreakdown?.length) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("Orders by status", marginX, y);
        y += 8;

        autoTable(doc, {
          startY: y,
          head: [["Status", "Count", "Percent"]],
          body: statusBreakdown.map((s) => {
            const pct = ordersCount ? Math.round((Number(s.count || 0) / ordersCount) * 1000) / 10 : 0;
            return [safeText(s.name), safeText(s.count ?? 0), `${pct}%`];
          }),
          styles: { fontSize: 10, cellPadding: 6 },
          headStyles: { fillColor: [235, 252, 21], textColor: 0 },
          margin: { left: marginX, right: marginX },
        });

        y = doc.lastAutoTable.finalY + 18;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Order value by day", marginX, y);
      y += 8;

      autoTable(doc, {
        startY: y,
        head: [["Date", "Order value"]],
        body: (trendRows || []).map((row) => [safeText(row.label), formatCurrency(row.sales || 0)]),
        styles: { fontSize: 10, cellPadding: 6 },
        headStyles: { fillColor: [20, 20, 20], textColor: 255 },
        columnStyles: { 1: { halign: "right" } },
        margin: { left: marginX, right: marginX },
      });

      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);

      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(url);
      setPdfFilename(filename);
      setPdfOpen(true);

      // Also trigger a proper download immediately
      downloadBlobUrl(url, filename);
    } catch (e) {
      toast.error("PDF failed", e?.message || "Could not generate the report PDF.");
    } finally {
      setPdfGenerating(false);
    }
  };

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
    const rows = Array.isArray(trendRows) ? trendRows : [];
    const activeDays = rows.filter((row) => Number(row.sales) > 0).length;
    const peak = rows.reduce(
      (best, row) => {
        const sales = Number(row.sales) || 0;
        if (sales > best.sales) return { label: row.label || "—", sales };
        return best;
      },
      { label: "—", sales: 0 }
    );
    return { activeDays, peakLabel: peak.label, peakSales: peak.sales };
  }, [trendRows]);

  const todayKey = useMemo(() => {
    const n = new Date();
    const y = n.getFullYear();
    const m = String(n.getMonth() + 1).padStart(2, "0");
    const d = String(n.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  const currentDayIndex = trendRows.findIndex((row) => row.dateKey === todayKey);
  const highlightBarIndex = currentDayIndex >= 0 ? currentDayIndex : Math.max(0, trendRows.length - 1);

  const growthLabel =
    weekOverWeekChangePercent !== null && weekOverWeekChangePercent !== undefined
      ? `${weekOverWeekChangePercent > 0 ? "+" : ""}${weekOverWeekChangePercent}%`
      : Number(totalRevenue) > 0 && Number(previousWeekRevenue) === 0
        ? "New"
        : "—";
  const statusCounts = useMemo(() => {
    const map = new Map();
    (statusBreakdown || []).forEach((item) => {
      map.set(String(item.name || "").toLowerCase(), Number(item.count) || 0);
    });
    return map;
  }, [statusBreakdown]);
  const completedOrders =
    (statusCounts.get("completed") || 0) + (statusCounts.get("delivered") || 0);
  const cancelledOrders =
    (statusCounts.get("cancelled") || 0) + (statusCounts.get("canceled") || 0);
  const openOrders = Math.max(ordersCount - completedOrders - cancelledOrders, 0);
  const fulfillmentRate = ordersCount
    ? Math.round((completedOrders / ordersCount) * 1000) / 10
    : 0;
  const isDenseTimeline = trendRows.length > 14;
  const xAxisInterval = trendRows.length > 21 ? 3 : trendRows.length > 10 ? 1 : 0;
  const rangeDaysLabel = `${trendRows.length}-day`;
  const selectedPeriodLabel = selectedRange?.label || `${trendRows.length} days`;

  const subNav = [
    { label: "Overview", to: "/dashboard", end: true },
    { label: "Orders", to: "/orders" },
    ...(isAdmin ? [{ label: "Inventory", to: "/inventory" }] : []),
  ];

  const applyRange = (nextRange) => {
    setSelectedRange(nextRange);
    setCustomRange(nextRange);
    setRangePickerOpen(false);
    loadDashboard({ silent: false, range: nextRange });
  };

  if (loading) {
    return (
      <div className="flex min-h-[45vh] items-center justify-center">
        <div
          className="h-11 w-11 animate-spin rounded-full border-2 border-white/15 border-t-v-accent"
          aria-hidden
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-white md:text-5xl lg:text-[52px] lg:leading-[1.05]">
            Dashboard
          </h1>
          <p className="mt-2 max-w-xl truncate whitespace-nowrap text-sm text-white/50 md:text-base">
            Real-time insights into your revenue, orders, and inventory.
          </p>

          <nav className="mt-6 flex flex-wrap gap-6 border-b border-white/[0.06] pb-0.5">
            {subNav.map((tab) => {
              const active = tab.end
                ? location.pathname === tab.to
                : location.pathname.startsWith(tab.to);
              return (
                <Link
                  key={tab.to + tab.label}
                  to={tab.to}
                  className={`relative pb-3 text-sm font-semibold transition ${
                    active ? "text-white" : "text-white/45 hover:text-white/80"
                  }`}
                >
                  {tab.label}
                  {active ? (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-v-accent" />
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <div className="relative flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setRangePickerOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-v-surface px-3 py-1.5 text-xs font-medium text-white/80 hover:text-white"
            >
              <CalendarDays size={14} />
              {selectedRange.label}
              <ChevronDown size={13} className={rangePickerOpen ? "rotate-180" : ""} />
            </button>
            <button
              type="button"
              onClick={() => setToolsPanelOpen((v) => !v)}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-v-surface text-white/55 hover:border-v-accent/35 hover:text-white ${
                toolsPanelOpen ? "border-v-accent/50 text-v-accent" : ""
              }`}
              aria-expanded={toolsPanelOpen}
              aria-label="Dashboard tools"
            >
              <SlidersHorizontal size={17} />
            </button>
            {rangePickerOpen ? (
              <div className="absolute right-0 top-11 z-40 w-[310px] rounded-2xl border border-white/10 bg-v-card p-3 shadow-2xl">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/45">Quick ranges</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    { id: "today", label: "Today" },
                    { id: "last7", label: "Last 7 days" },
                    { id: "last30", label: "Last 30 days" },
                    { id: "thisMonth", label: "This month" },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyRange(rangeFromPreset(preset.id))}
                      className="rounded-full border border-white/12 px-3 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/10"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="text-[11px] text-white/50">
                    Start date
                    <input
                      type="date"
                      value={customRange.startDate}
                      onChange={(e) =>
                        setCustomRange((prev) => ({
                          ...prev,
                          startDate: e.target.value,
                          label: "Custom range",
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-white/12 bg-v-surface px-2.5 py-2 text-xs text-white outline-none focus:border-v-accent/45"
                    />
                  </label>
                  <label className="text-[11px] text-white/50">
                    End date
                    <input
                      type="date"
                      value={customRange.endDate}
                      onChange={(e) =>
                        setCustomRange((prev) => ({
                          ...prev,
                          endDate: e.target.value,
                          label: "Custom range",
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-white/12 bg-v-surface px-2.5 py-2 text-xs text-white outline-none focus:border-v-accent/45"
                    />
                  </label>
                </div>
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setRangePickerOpen(false)}
                    className="rounded-full border border-white/12 px-3 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/10"
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
                    className="rounded-full bg-v-accent px-3 py-1.5 text-xs font-bold text-black"
                  >
                    Apply
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-v-accent px-5 py-2.5 text-sm font-bold text-black shadow-v-glow transition hover:bg-v-accent-hover"
          >
            Full report
            <ArrowUpRight size={17} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {toolsPanelOpen ? (
        <div className="rounded-[20px] border border-white/[0.08] bg-v-surface/90 p-4 shadow-v-card">
          <p className="text-sm font-bold text-white">Dashboard tools</p>
          <p className="mt-1 text-xs text-white/50">
            Analytics use your selected date range. Use refresh to pull latest numbers, or jump to
            orders / inventory.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                loadDashboard({ silent: false });
                toast.success("Refreshed", "Latest analytics loaded.");
              }}
              className="rounded-full bg-v-accent px-4 py-2 text-xs font-bold text-black"
            >
              Refresh data
            </button>
            <Link
              to="/orders"
              className="inline-flex items-center rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white/80 hover:bg-white/5"
            >
              Open orders
            </Link>
            {isAdmin ? (
              <Link
                to="/inventory"
                className="inline-flex items-center rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white/80 hover:bg-white/5"
              >
                Open inventory
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {/* Top metric strip — Stockify-style row */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <article className={cardShell}>
          <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
            Total sales
          </p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums text-v-accent md:text-4xl">
            {formatCurrencyCompact(totalRevenue)}
          </p>
          <p className="mt-1 text-xs text-white/40">{selectedPeriodLabel} order value</p>
          <div className="mt-4 h-14 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendRows} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                <Bar dataKey="sales" radius={[6, 6, 2, 2]} maxBarSize={18}>
                  {trendRows.map((entry, index) => (
                    <Cell
                      key={entry.dateKey || index}
                      fill={index === highlightBarIndex ? "#e1fb15" : "#2f2f2f"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="relative overflow-hidden rounded-[28px] border border-v-accent/35 bg-v-accent p-5 text-black shadow-v-glow md:p-6">
          <div className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full bg-black/10 blur-2xl" />
          <p className="text-xs font-bold uppercase tracking-wider text-black/50">Selected period</p>
          <p className="mt-2 text-4xl font-extrabold tabular-nums md:text-5xl">{ordersCount}</p>
          <p className="mt-1 text-sm font-semibold text-black/65">Orders in range</p>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-black/10 pt-4">
            <span className="rounded-full bg-black/10 px-3 py-1 text-xs font-bold">
              Avg {ordersCount > 0 ? formatCurrencyCompact(avgOrderValue) : "—"}
            </span>
            <span
              className="rounded-full bg-black/10 px-3 py-1 text-xs font-bold"
              title="Revenue change vs the previous period of the same length (week-over-week style). “—” means no prior revenue to compare."
            >
              Growth {growthLabel}
            </span>
          </div>
        </article>

        <article className={cardShell}>
          <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
            Order status
          </p>
          <p className="mt-1 text-lg font-bold text-white">Mix this period</p>
          <div className="mt-2 flex items-center gap-4">
            <div className="h-[130px] w-[130px] shrink-0">
              {ordersCount > 0 && statusBreakdown.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusBreakdown}
                      dataKey="count"
                      nameKey="name"
                      innerRadius={38}
                      outerRadius={58}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {statusBreakdown.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/15 text-center text-xs text-white/40">
                  No data
                </div>
              )}
            </div>
            <ul className="min-w-0 flex-1 space-y-2">
              {statusBreakdown.length ? (
                statusBreakdown.slice(0, 4).map((item) => {
                  const pct = ordersCount
                    ? Math.round((item.count / ordersCount) * 1000) / 10
                    : 0;
                  return (
                    <li
                      key={item.name}
                      className="flex items-center justify-between gap-2 text-xs font-medium"
                    >
                      <span className="flex items-center gap-2 truncate text-white/70">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        {item.name}
                      </span>
                      <span className="shrink-0 tabular-nums text-white">{pct}%</span>
                    </li>
                  );
                })
              ) : (
                <li className="text-xs text-white/40">No orders yet.</li>
              )}
            </ul>
          </div>
        </article>
      </section>

      <section>
        <article className={cardShell}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
                Profitability snapshot
              </p>
              <h3 className="mt-1 text-2xl font-bold text-white">Net profit / Gross margin</h3>
              <p className="mt-1 text-xs text-white/45">
                Based on product cost prices and quantities in the selected date range.
              </p>
            </div>
            <span className="rounded-full border border-white/12 bg-v-surface px-3 py-1 text-xs font-semibold text-white/80">
              Margin {grossMarginPercent === null ? "—" : `${grossMarginPercent}%`} · Coverage{" "}
              {costCoveragePercent}%
            </span>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-white/[0.08] bg-v-surface px-4 py-3">
              <p className="text-xs text-white/45">Revenue</p>
              <p className="mt-1 text-xl font-bold text-v-accent">{formatCurrency(totalRevenue)}</p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-v-surface px-4 py-3">
              <p className="text-xs text-white/45">Estimated cost</p>
              <p className="mt-1 text-xl font-bold text-white">{formatCurrency(totalCost)}</p>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-v-surface px-4 py-3">
              <p className="text-xs text-white/45">Net profit</p>
              <p
                className={`mt-1 text-xl font-bold ${
                  grossProfit >= 0 ? "text-v-green" : "text-red-300"
                }`}
              >
                {formatCurrency(grossProfit)}
              </p>
            </div>
          </div>
        </article>
      </section>

      <section>
        <article className={`${cardShell} h-fit self-start`}>
          <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
                Sales trends
              </p>
              <h2 className="mt-1 text-2xl font-bold text-white md:text-3xl">Daily performance</h2>
              {periodLabel ? (
                <p className="mt-1 text-xs text-white/40">{periodLabel}</p>
              ) : null}
            </div>
            <span className="rounded-full border border-v-accent/30 bg-v-accent/10 px-3 py-1 text-xs font-semibold text-v-accent">
              {rangeDaysLabel} view
            </span>
          </div>

          <div className="h-[220px] w-full md:h-[260px] lg:h-[280px]">
            {isDenseTimeline ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendRows} margin={{ top: 8, right: 8, left: 4, bottom: 4 }}>
                  <CartesianGrid stroke="#2a2a2a" strokeDasharray="4 4" vertical={false} />
                  <XAxis
                    dataKey="dateKey"
                    tickFormatter={formatDateKeyShort}
                    axisLine={false}
                    tickLine={false}
                    interval={xAxisInterval}
                    minTickGap={14}
                    tick={{ fill: "#737373", fontSize: 9 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={formatAxisSales}
                    tick={{ fill: "#737373", fontSize: 11 }}
                    width={68}
                  />
                  <Tooltip cursor={{ stroke: "#444", strokeWidth: 1 }} content={<SalesBarTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="sales"
                    stroke="#e1fb15"
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 4, fill: "#e1fb15" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendRows} barCategoryGap="20%">
                  <CartesianGrid stroke="#2a2a2a" strokeDasharray="4 4" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickFormatter={formatXAxisLabel}
                    axisLine={false}
                    tickLine={false}
                    interval={xAxisInterval}
                    minTickGap={8}
                    tick={{ fill: "#737373", fontSize: 10 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={formatAxisSales}
                    tick={{ fill: "#737373", fontSize: 11 }}
                    width={68}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    content={<SalesBarTooltip />}
                  />
                  <Bar dataKey="sales" radius={[14, 14, 6, 6]} maxBarSize={52}>
                    {trendRows.map((entry, index) => (
                      <Cell
                        key={entry.dateKey || `${entry.label}-${index}`}
                        fill={index === highlightBarIndex ? "#e1fb15" : "#2f2f2f"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <article className={cardShell}>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
              Operations
            </p>
            <p className="mt-1 text-lg font-bold text-white">Health</p>
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-2xl border border-white/[0.06] bg-v-surface px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-white/45">Fulfillment</p>
                  <p className="mt-1 text-lg font-bold text-v-green">{fulfillmentRate}%</p>
                </div>
                <div className="rounded-2xl border border-white/[0.06] bg-v-surface px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-white/45">Open orders</p>
                  <p className="mt-1 text-lg font-bold text-white">{openOrders}</p>
                </div>
              </div>
              {statusBreakdown.length ? (
                statusBreakdown.map((item) => {
                  const pct = ordersCount
                    ? Math.round((item.count / ordersCount) * 1000) / 10
                    : 0;
                  return (
                    <div
                      key={item.name}
                      className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-v-surface px-3 py-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-sm text-white/75">{item.name}</span>
                      </div>
                      <span className="text-sm font-bold tabular-nums text-white">
                        {item.count}{" "}
                        <span className="text-xs font-medium text-white/40">({pct}%)</span>
                      </span>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-white/40">No status breakdown.</p>
              )}
              <div className="rounded-2xl border border-red-400/25 bg-red-500/10 px-3 py-2.5 text-xs text-red-100">
                Products currently below 10 units in inventory:{" "}
                <strong className="text-white">{lowStockCount}</strong>
              </div>
            </div>
        </article>
        <article className={cardShell}>
          <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
            Top selling products
          </p>
          <p className="mt-1 text-lg font-bold text-white">Top 3-5 items by units sold</p>
          <div className="mt-4 space-y-2">
            {topSellingProducts.length ? (
              topSellingProducts.slice(0, 5).map((item, index) => (
                <Link
                  key={`${item.productId || item.name}-${index}`}
                  to={`/orders?search=${encodeURIComponent(item.name || "")}`}
                  className="flex items-center justify-between rounded-2xl border border-white/[0.06] bg-v-surface px-3 py-2.5"
                  title={`View orders containing ${item.name}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{item.name}</p>
                    <p className="text-xs text-white/45">{formatCurrency(item.revenue || 0)}</p>
                  </div>
                  <span className="rounded-full bg-v-accent/15 px-2.5 py-1 text-xs font-bold text-v-accent">
                    {item.quantitySold} sold
                  </span>
                </Link>
              ))
            ) : (
              <p className="text-sm text-white/45">No product sales in this period.</p>
            )}
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <article className={cardShell}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
                Average order
              </p>
              <h3 className="mt-2 text-3xl font-extrabold tabular-nums text-v-accent md:text-4xl">
                {ordersCount > 0 ? formatCurrencyCompact(avgOrderValue) : "—"}
              </h3>
              <p className="mt-2 text-sm text-white/45">
                {ordersCount > 0 ? `Across ${ordersCount} order(s) in selected range.` : "No orders in this range."}
              </p>
            </div>
            <div className="rounded-2xl bg-v-accent/15 p-3 text-v-accent">
              <CircleDollarSign size={22} strokeWidth={2} />
            </div>
          </div>
        </article>

        <article className={cardShell}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/45">
                Sales activity
              </p>
              <h3 className="mt-2 text-3xl font-extrabold tabular-nums text-v-green md:text-4xl">
                {salesActivity.activeDays}/{trendRows.length}
              </h3>
              <p className="mt-2 text-sm text-white/45">
                Active sales days in the current selected window.
              </p>
              <p className="mt-3 text-xs text-white/55">
                Peak day: <span className="font-semibold text-white/80">{salesActivity.peakLabel}</span>{" "}
                ({formatCurrency(salesActivity.peakSales)})
              </p>
            </div>
            <div className="rounded-2xl bg-v-green/15 p-3 text-v-green">
              <Target size={22} strokeWidth={2} />
            </div>
          </div>
        </article>
      </section>

      {reportOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-title"
          onClick={() => setReportOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && setReportOpen(false)}
        >
          <div
            className={`max-h-[90vh] w-full max-w-2xl overflow-y-auto ${cardShell} !shadow-2xl`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-v-accent">
                  Export-ready
                </p>
                <h3 id="report-title" className="mt-1 text-2xl font-extrabold text-white">
                  {selectedRange.label} performance report
                </h3>
                <p className="mt-1 text-sm text-white/50">
                  Same numbers as the dashboard: daily order totals and status counts from the API.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReportOpen(false)}
                className="rounded-full border border-white/15 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
                aria-label="Close report"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-6 space-y-6">
              <div>
                <h4 className="text-sm font-semibold text-white/80">Order value by day</h4>
                <div className="mt-2 overflow-hidden rounded-2xl border border-white/[0.08] bg-v-surface">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-white/45">
                      <tr>
                        <th className="px-3 py-2.5">Date</th>
                        <th className="px-3 py-2.5 text-right">Order value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trendRows.map((row) => (
                        <tr key={row.dateKey || row.label} className="border-t border-white/[0.06]">
                          <td className="px-3 py-2.5 text-white">{row.label}</td>
                          <td className="px-3 py-2.5 text-right font-semibold text-v-accent">
                            {formatCurrency(row.sales)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-white/[0.08] bg-v-surface p-3">
                  <p className="text-xs text-white/45">Total revenue ({trendRows.length}d)</p>
                  <p className="mt-1 font-bold text-v-accent">{formatCurrency(totalRevenue)}</p>
                </div>
                <div className="rounded-2xl border border-white/[0.08] bg-v-surface p-3">
                  <p className="text-xs text-white/45">Prior week</p>
                  <p className="mt-1 font-bold text-white">{formatCurrency(previousWeekRevenue)}</p>
                </div>
                <div className="rounded-2xl border border-white/[0.08] bg-v-surface p-3">
                  <p className="text-xs text-white/45">Avg order</p>
                  <p className="mt-1 font-bold text-white">
                    {ordersCount > 0 ? formatCurrency(avgOrderValue) : "—"}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/[0.08] bg-v-surface p-3">
                  <p className="text-xs text-white/45">Low-stock products (&lt;10 units)</p>
                  <p className="mt-1 font-bold text-v-green">{lowStockCount}</p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-white/80">Orders by status</h4>
                <ul className="mt-2 space-y-2">
                  {statusBreakdown.length ? (
                    statusBreakdown.map((item) => {
                      const pct = ordersCount
                        ? Math.round((item.count / ordersCount) * 1000) / 10
                        : 0;
                      return (
                        <li
                          key={item.name}
                          className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-v-surface px-3 py-2 text-sm"
                        >
                          <span className="text-white/75">{item.name}</span>
                          <span className="font-semibold text-white">
                            {item.count} ({pct}%)
                          </span>
                        </li>
                      );
                    })
                  ) : (
                    <li className="rounded-2xl border border-white/[0.08] bg-v-surface px-3 py-2 text-sm text-white/45">
                      No orders in period.
                    </li>
                  )}
                </ul>
              </div>
              
              <div className="mt-8">
                <button
                  type="button"
                  onClick={generateReportPdf}
                  disabled={pdfGenerating}
                  className="w-full rounded-xl bg-v-accent px-6 py-3 text-sm font-bold text-black shadow-v-glow transition hover:bg-v-accent-hover"
                >
                  {pdfGenerating ? "Generating…" : "Download full report"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {pdfOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pdf-title"
          onClick={closePdfPreview}
          onKeyDown={(e) => e.key === "Escape" && closePdfPreview()}
        >
          <div
            className={`max-h-[90vh] w-full max-w-4xl overflow-hidden ${cardShell} !shadow-2xl`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-v-accent">Preview</p>
                <h3 id="pdf-title" className="mt-1 text-2xl font-extrabold text-white">
                  Report PDF
                </h3>
                <p className="mt-1 text-sm text-white/50">{pdfFilename}</p>
              </div>
              <div className="flex items-center gap-2">
                {pdfUrl ? (
                  <button
                    type="button"
                    onClick={() => downloadBlobUrl(pdfUrl, pdfFilename)}
                    className="rounded-full bg-v-accent px-4 py-2 text-xs font-extrabold text-black shadow-v-glow transition hover:bg-v-accent-hover"
                  >
                    Download
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={closePdfPreview}
                  className="rounded-full border border-white/15 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
                  aria-label="Close PDF preview"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="mt-4 h-[72vh] overflow-hidden rounded-2xl border border-white/10 bg-white">
              {pdfUrl ? (
                <iframe title="Report PDF" src={pdfUrl} className="h-full w-full" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-black/60">
                  PDF preview not available.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default DashboardPage;
