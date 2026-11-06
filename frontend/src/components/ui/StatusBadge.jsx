import { STATUS_STYLES } from "../../utils/orderStatus";

const StatusBadge = ({ status, className = "" }) => {
  const style = STATUS_STYLES[status] || { dot: "#737373", badge: "bg-white/5 text-white/60 ring-white/10" };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${style.badge} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: style.dot }} />
      {status}
    </span>
  );
};

export default StatusBadge;
