interface StatusBadgeProps {
  status: string;
  onClick?: () => void;
  className?: string;
}

const STATUS_BG: Record<string, string> = {
  open: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  "in-progress": "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  completed: "bg-green-500/15 text-green-500 border-green-500/30",
  "wont-fix": "bg-gray-500/15 text-gray-400 border-gray-500/30",
};

export function StatusBadge({ status, onClick, className = "" }: StatusBadgeProps) {
  const colorClass = STATUS_BG[status] || "bg-gray-500/15 text-gray-400 border-gray-500/30";
  const label = status.replace(/-/g, " ");

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold capitalize border whitespace-nowrap transition-all
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
