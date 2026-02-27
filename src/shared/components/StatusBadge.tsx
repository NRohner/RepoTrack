import { STATUS_COLORS } from "@/lib/types";

interface StatusBadgeProps {
  status: string;
  onClick?: () => void;
  className?: string;
}

export function StatusBadge({ status, onClick, className = "" }: StatusBadgeProps) {
  const colorClass = STATUS_COLORS[status] || "bg-gray-500";
  const label = status.replace(/-/g, " ");

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white capitalize transition-all
        ${colorClass} ${onClick ? "cursor-pointer hover:opacity-80 active:scale-95" : ""} ${className}`}
    >
      {label}
    </span>
  );
}

interface SeverityBadgeProps {
  level: string;
  onClick?: () => void;
  className?: string;
}

const SEVERITY_BG: Record<string, string> = {
  critical: "bg-red-500/15 text-red-500 border-red-500/30",
  high: "bg-orange-500/15 text-orange-500 border-orange-500/30",
  medium: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  low: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

export function SeverityBadge({ level, onClick, className = "" }: SeverityBadgeProps) {
  const colorClass = SEVERITY_BG[level] || "bg-gray-500/15 text-gray-400 border-gray-500/30";

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold capitalize border transition-all
        ${colorClass} ${onClick ? "cursor-pointer hover:opacity-80 active:scale-95" : ""} ${className}`}
    >
      {level}
    </span>
  );
}
