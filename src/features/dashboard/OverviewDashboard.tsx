import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
  BarChart, Bar,
} from "recharts";
import type { ProjectStats, IssueType } from "@/lib/types";
import { useAppStore } from "@/lib/store";
import { TypeIcon } from "@/shared/components/TypeIcon";

interface Props {
  stats: ProjectStats;
}

const STATUS_CHART_COLORS = [
  "#6366f1", "#8b5cf6", "#3b82f6", "#22c55e", "#eab308",
  "#ef4444", "#64748b", "#f97316", "#06b6d4", "#ec4899",
];

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#94a3b8",
};

export function OverviewDashboard({ stats }: Props) {
  const isDark = useAppStore((s) => s.resolvedTheme) === "dark";
  const tooltipStyle = {
    contentStyle: {
      backgroundColor: isDark ? "#1e293b" : "#ffffff",
      border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
      borderRadius: 8,
    },
    labelStyle: { color: isDark ? "#e2e8f0" : "#1e293b" },
  };

  const metrics = [
    { label: "Total Issues", value: stats.total_issues },
    { label: "Open Bugs", value: stats.open_bugs, color: "text-red-500" },
    { label: "Open Features", value: stats.open_features, color: "text-blue-500" },
    { label: "Resolved This Week", value: stats.resolved_this_week, color: "text-green-500" },
    { label: "Avg Resolution", value: `${stats.avg_resolution_days.toFixed(1)}d` },
    { label: "Most Voted", value: stats.most_voted_feature ? `${stats.most_voted_feature.slice(0, 20)}...` : "N/A", small: true },
  ];

  const severityData = [
    { level: "Critical", bugs: stats.bugs_by_severity.critical, features: stats.features_by_priority.critical },
    { level: "High", bugs: stats.bugs_by_severity.high, features: stats.features_by_priority.high },
    { level: "Medium", bugs: stats.bugs_by_severity.medium, features: stats.features_by_priority.medium },
    { level: "Low", bugs: stats.bugs_by_severity.low, features: stats.features_by_priority.low },
  ];

  return (
    <div className="space-y-6">
      {/* Metrics strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className="bg-white dark:bg-surface-900 rounded-xl p-4 border border-surface-200 dark:border-surface-800">
            <p className="text-xs text-surface-400 font-medium uppercase tracking-wider">{m.label}</p>
            <p className={`text-2xl font-bold mt-1 ${m.color || "dark:text-white"} ${m.small ? "text-sm mt-2" : ""}`}>
              {m.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Burndown chart */}
        <ChartCard title="Open Issues Over Time">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={mergeTimeSeries(stats.open_bugs_over_time, stats.open_features_over_time)}>
              <defs>
                <linearGradient id="bugGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="featGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#64748b" tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} stroke="#64748b" />
              <Tooltip {...tooltipStyle} />
              <Legend />
              <Area type="monotone" dataKey="bugs" stroke="#ef4444" fill="url(#bugGrad)" strokeWidth={2} name="Bugs" animationDuration={800} />
              <Area type="monotone" dataKey="features" stroke="#6366f1" fill="url(#featGrad)" strokeWidth={2} name="Features" animationDuration={800} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Status donut */}
        <ChartCard title="Issues by Status">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={stats.all_by_status}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={2}
                dataKey="count"
                nameKey="status"
                animationDuration={800}
              >
                {stats.all_by_status.map((entry, index) => (
                  <Cell key={entry.status} fill={STATUS_CHART_COLORS[index % STATUS_CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} itemStyle={{ color: isDark ? "#e2e8f0" : "#1e293b" }} />
              <Legend formatter={(value) => <span className="text-xs capitalize">{value.replace(/-/g, " ")}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Severity/Priority bar chart */}
        <ChartCard title="Issues by Severity / Priority">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={severityData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="#64748b" />
              <YAxis dataKey="level" type="category" tick={{ fontSize: 11 }} stroke="#64748b" width={70} />
              <Tooltip {...tooltipStyle} />
              <Legend />
              <Bar dataKey="bugs" fill="#ef4444" name="Bugs" radius={[0, 4, 4, 0]} animationDuration={800} />
              <Bar dataKey="features" fill="#6366f1" name="Features" radius={[0, 4, 4, 0]} animationDuration={800} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Resolution time distribution */}
        <ChartCard title="Resolution Time Distribution">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stats.resolution_time_buckets}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis dataKey="bucket" tick={{ fontSize: 10 }} stroke="#64748b" />
              <YAxis tick={{ fontSize: 11 }} stroke="#64748b" />
              <Tooltip {...tooltipStyle} />
              <Legend />
              <Bar dataKey="bugs" stackId="a" fill="#ef4444" name="Bugs" animationDuration={800} />
              <Bar dataKey="features" stackId="a" fill="#6366f1" name="Features" radius={[4, 4, 0, 0]} animationDuration={800} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Tag breakdown */}
        <ChartCard title="Tag Breakdown">
          <div className="flex flex-wrap gap-2 p-4">
            {stats.tag_breakdown.slice(0, 20).map((tag) => {
              const maxCount = Math.max(...stats.tag_breakdown.map((t) => t.count));
              const size = Math.max(60, (tag.count / maxCount) * 120);
              const color = tag.open_bugs > tag.features
                ? "bg-red-500/15 text-red-400 border-red-500/30"
                : tag.features > tag.resolved
                ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                : "bg-green-500/15 text-green-400 border-green-500/30";
              return (
                <div
                  key={tag.tag}
                  className={`rounded-lg border px-3 py-2 flex flex-col items-center justify-center ${color}`}
                  style={{ minWidth: size, minHeight: size * 0.6 }}
                >
                  <span className="text-sm font-medium">{tag.tag}</span>
                  <span className="text-xs opacity-75">{tag.count}</span>
                </div>
              );
            })}
            {stats.tag_breakdown.length === 0 && (
              <p className="text-sm text-surface-400">No tags used yet</p>
            )}
          </div>
        </ChartCard>

        {/* Activity Feed */}
        <ChartCard title="Recent Activity">
          <div className="max-h-[280px] overflow-y-auto p-4 space-y-2">
            {stats.activity_feed.length > 0 ? (
              stats.activity_feed.map((entry, i) => (
                <div key={i} className="flex items-start gap-3 text-sm">
                  <span className="shrink-0 mt-0.5">
                    <TypeIcon type={entry.issue_type as IssueType} className="w-3.5 h-3.5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-accent-500 text-xs">{entry.issue_id}</span>{" "}
                    <span className="dark:text-surface-300">{entry.action}</span>
                    {entry.user_display_name && entry.user_display_name !== "anon" && (
                      <span className="text-surface-400"> by {entry.user_display_name}</span>
                    )}
                    <p className="text-xs text-surface-400 truncate">{entry.issue_title}</p>
                  </div>
                  <span className="text-xs text-surface-400 shrink-0">
                    {new Date(entry.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-surface-400">No activity recorded yet</p>
            )}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-surface-100 dark:border-surface-800">
        <h3 className="text-sm font-semibold dark:text-white">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function mergeTimeSeries(
  bugs: { date: string; value: number }[],
  features: { date: string; value: number }[]
) {
  const map = new Map<string, { date: string; bugs: number; features: number }>();
  for (const b of bugs) {
    map.set(b.date, { date: b.date, bugs: b.value, features: 0 });
  }
  for (const f of features) {
    const existing = map.get(f.date);
    if (existing) {
      existing.features = f.value;
    } else {
      map.set(f.date, { date: f.date, bugs: 0, features: f.value });
    }
  }
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}
