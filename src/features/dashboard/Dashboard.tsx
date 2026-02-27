import { useState, useEffect } from "react";
import * as api from "@/lib/api";
import { useAppStore } from "@/lib/store";
import type { ProjectStats } from "@/lib/types";
import { SegmentedControl } from "@/shared/components/SegmentedControl";
import { OverviewDashboard } from "./OverviewDashboard";
import { BugsDashboard } from "./BugsDashboard";
import { FeaturesDashboard } from "./FeaturesDashboard";

type DashboardTab = "overview" | "bugs" | "features";

export function Dashboard() {
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<DashboardTab>("overview");
  const addToast = useAppStore((s) => s.addToast);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await api.getProjectStats();
      setStats(data);
    } catch (e: any) {
      addToast({ type: "error", message: `Failed to load stats: ${e}` });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 animate-shimmer bg-surface-200 dark:bg-surface-800 rounded" />
        <div className="grid grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 animate-shimmer bg-surface-200 dark:bg-surface-800 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-64 animate-shimmer bg-surface-200 dark:bg-surface-800 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const tabs: { key: DashboardTab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "bugs", label: "Bugs" },
    { key: "features", label: "Features" },
  ];

  return (
    <div className="h-full overflow-auto">
      <div className="px-6 py-4 border-b border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-xl font-bold dark:text-white">Dashboard</h1>
        <SegmentedControl
          options={tabs.map((t) => ({ key: t.key, label: t.label }))}
          value={tab}
          onChange={setTab}
          size="sm"
        />
      </div>
      <div className="p-6">
        {tab === "overview" && <OverviewDashboard stats={stats} />}
        {tab === "bugs" && <BugsDashboard stats={stats} />}
        {tab === "features" && <FeaturesDashboard stats={stats} />}
      </div>
    </div>
  );
}
