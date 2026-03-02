import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  FunnelChart, Funnel, LabelList, Cell,
} from "recharts";
import type { ProjectStats } from "@/lib/types";
import { useAppStore } from "@/lib/store";

interface Props {
  stats: ProjectStats;
}

const FUNNEL_COLORS = ["#8b5cf6", "#6366f1", "#22c55e"];

export function FeaturesDashboard({ stats }: Props) {
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
    { label: "Total Features", value: stats.open_features + stats.completed_features_this_month },
    { label: "Open", value: stats.open_features, color: "text-blue-500" },
    { label: "Completed This Month", value: stats.completed_features_this_month, color: "text-green-500" },
    { label: "Most Voted", value: stats.most_voted_feature ? stats.most_voted_feature.slice(0, 25) : "N/A", small: true },
    { label: "Total Votes", value: stats.total_votes, color: "text-purple-500" },
  ];

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
        {/* Feature Funnel */}
        <ChartCard title="Feature Funnel">
          <div className="p-4">
            {stats.feature_funnel.some((f) => f.count > 0) ? (
              <div className="space-y-2">
                {stats.feature_funnel.map((step, i) => {
                  const maxCount = Math.max(...stats.feature_funnel.map((f) => f.count), 1);
                  const widthPercent = Math.max(20, (step.count / maxCount) * 100);
                  return (
                    <div key={step.stage} className="flex items-center gap-3">
                      <span className="text-xs text-surface-400 w-24 text-right capitalize">{step.stage.replace(/-/g, " ")}</span>
                      <div className="flex-1">
                        <div
                          className="h-8 rounded-lg flex items-center px-3 transition-all"
                          style={{
                            width: `${widthPercent}%`,
                            backgroundColor: FUNNEL_COLORS[i % FUNNEL_COLORS.length],
                          }}
                        >
                          <span className="text-white text-sm font-medium">{step.count}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-surface-400">No features yet</p>
            )}
          </div>
        </ChartCard>

        {/* Top 10 Most Voted */}
        <ChartCard title="Top 10 Most Voted Features">
          <div className="p-4 max-h-[320px] overflow-y-auto">
            {stats.top_voted_features.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-surface-400 border-b border-surface-200 dark:border-surface-700">
                    <th className="text-left py-2">ID</th>
                    <th className="text-left py-2">Title</th>
                    <th className="text-center py-2">Votes</th>
                    <th className="text-left py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.top_voted_features.map((feat) => (
                    <tr key={feat.id} className="border-b border-surface-100 dark:border-surface-800">
                      <td className="py-2 font-mono text-accent-500 text-xs">{feat.id}</td>
                      <td className="py-2 dark:text-surface-300 truncate max-w-[200px]">{feat.title}</td>
                      <td className="py-2 text-center">
                        <span className="inline-flex items-center gap-1 text-purple-500 font-medium">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" />
                          </svg>
                          {feat.votes}
                        </span>
                      </td>
                      <td className="py-2 capitalize text-xs">{feat.status.replace(/-/g, " ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-surface-400">No features yet</p>
            )}
          </div>
        </ChartCard>

        {/* Features by Quarter */}
        <ChartCard title="Feature Roadmap by Quarter">
          <div className="p-4">
            {stats.features_by_quarter.length > 0 ? (
              <div className="space-y-4">
                {stats.features_by_quarter.map((group) => (
                  <div key={group.quarter}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium dark:text-white">{group.quarter}</span>
                      <span className="text-xs text-surface-400">
                        {group.features.length} features, {group.total_votes} votes
                      </span>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {group.features.map((f) => (
                        <span key={f.id} className="text-xs px-2 py-1 bg-accent-600/10 text-accent-500 rounded" title={f.title}>
                          {f.id}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-surface-400">No features yet</p>
            )}
          </div>
        </ChartCard>

        {/* Features by Tag */}
        <ChartCard title="Feature Requests by Tag">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={stats.features_by_tag.slice(0, 10)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="#64748b" />
              <YAxis dataKey="tag" type="category" tick={{ fontSize: 11 }} stroke="#64748b" width={80} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="count" fill="#6366f1" radius={[0, 4, 4, 0]} animationDuration={800} name="Features" />
            </BarChart>
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
