import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  LineChart, Line,
} from "recharts";
import type { ProjectStats } from "@/lib/types";

interface Props {
  stats: ProjectStats;
}

const PIE_COLORS = ["#ef4444", "#f97316", "#eab308", "#94a3b8"];

export function BugsDashboard({ stats }: Props) {
  const metrics = [
    { label: "Open Bugs", value: stats.open_bugs, color: "text-red-500" },
    { label: "Critical/High Open", value: stats.critical_high_bugs, color: "text-orange-500" },
    { label: "Resolved This Week", value: stats.resolved_this_week, color: "text-green-500" },
    { label: "Avg Resolution", value: `${stats.avg_resolution_days.toFixed(1)}d` },
    {
      label: "Oldest Open Bug",
      value: stats.oldest_open_bug ? stats.oldest_open_bug.id : "N/A",
      small: true,
    },
  ];

  const severityPieData = [
    { name: "Critical", value: stats.bugs_by_severity.critical },
    { name: "High", value: stats.bugs_by_severity.high },
    { name: "Medium", value: stats.bugs_by_severity.medium },
    { name: "Low", value: stats.bugs_by_severity.low },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
        {/* Bug Burndown */}
        <ChartCard title="Bug Burndown">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={stats.open_bugs_over_time}>
              <defs>
                <linearGradient id="bugBurnGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#64748b" tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} stroke="#64748b" />
              <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} />
              <Area type="monotone" dataKey="value" stroke="#ef4444" fill="url(#bugBurnGrad)" strokeWidth={2} name="Open Bugs" animationDuration={800} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Bugs by Severity */}
        <ChartCard title="Bugs by Severity">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={severityPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value" animationDuration={800}>
                {severityPieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Oldest Open Bugs */}
        <ChartCard title="Top 10 Oldest Open Bugs">
          <div className="p-4 max-h-[280px] overflow-y-auto">
            {stats.top_oldest_bugs.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-surface-400 border-b border-surface-200 dark:border-surface-700">
                    <th className="text-left py-2">ID</th>
                    <th className="text-left py-2">Title</th>
                    <th className="text-left py-2">Severity</th>
                    <th className="text-right py-2">Age</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.top_oldest_bugs.map((bug) => (
                    <tr key={bug.id} className="border-b border-surface-100 dark:border-surface-800">
                      <td className="py-2 font-mono text-accent-500 text-xs">{bug.id}</td>
                      <td className="py-2 dark:text-surface-300 truncate max-w-[200px]">{bug.title}</td>
                      <td className="py-2 capitalize text-xs">{bug.severity}</td>
                      <td className="py-2 text-right text-surface-400">{bug.age_days}d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-surface-400">No open bugs</p>
            )}
          </div>
        </ChartCard>

        {/* Bug Resolution Velocity */}
        <ChartCard title="Bug Resolution Velocity">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={stats.bug_velocity}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#64748b" />
              <YAxis tick={{ fontSize: 11 }} stroke="#64748b" />
              <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} />
              <Line type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} name="Resolved" animationDuration={800} />
            </LineChart>
          </ResponsiveContainer>
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
