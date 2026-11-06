export const ORDER_STATUSES = ["Pending", "Processing", "Shipped", "Delivered"];

/** Same palette as the dashboard donut, so a status looks identical everywhere. */
export const STATUS_STYLES = {
  Pending: { dot: "#e1fb15", badge: "bg-v-accent/10 text-v-accent ring-v-accent/25" },
  Processing: { dot: "#32d583", badge: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/25" },
  Shipped: { dot: "#94a3b8", badge: "bg-slate-400/10 text-slate-300 ring-slate-400/25" },
  Delivered: { dot: "#7c5cfc", badge: "bg-violet-400/10 text-violet-300 ring-violet-400/25" },
};

export const formatOrderDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-LK", { day: "numeric", month: "short", year: "numeric" });
};

export const formatOrderTime = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-LK", { hour: "2-digit", minute: "2-digit" });
};

export const shortOrderId = (id) => `#${String(id || "").slice(-6).toUpperCase()}`;
