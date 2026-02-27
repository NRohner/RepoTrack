import { useState, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import * as api from "@/lib/api";
import type { Issue, Severity } from "@/lib/types";
import { STATUSES, SEVERITIES } from "@/lib/types";
import { StatusBadge, SeverityBadge } from "@/shared/components/StatusBadge";

const QUARTERS = ["Backlog", "Q1 2026", "Q2 2026", "Q3 2026", "Q4 2026", "Q1 2027", "Q2 2027"];

export function Roadmap() {
  const issues = useAppStore((s) => s.issues);
  const updateIssueInStore = useAppStore((s) => s.updateIssueInStore);
  const addToast = useAppStore((s) => s.addToast);
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [tagFilter, setTagFilter] = useState<string>("");
  const [collapsedCols, setCollapsedCols] = useState<Set<string>>(new Set());
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const features = useMemo(() => {
    let result = issues.filter((i) => i.type === "feature");
    if (priorityFilter) result = result.filter((i) => i.priority === priorityFilter);
    if (statusFilter) result = result.filter((i) => i.status === statusFilter);
    if (tagFilter) result = result.filter((i) => i.tags.includes(tagFilter));
    return result;
  }, [issues, priorityFilter, statusFilter, tagFilter]);

  const columnData = useMemo(() => {
    return QUARTERS.map((quarter) => {
      const quarterFeatures = features.filter(
        (f) => (f.roadmap_quarter || "Backlog") === quarter
      );
      const totalVotes = quarterFeatures.reduce((sum, f) => sum + (f.votes || 0), 0);
      return { quarter, features: quarterFeatures, totalVotes };
    });
  }, [features]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    features.forEach((f) => f.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [features]);

  const handleDragStart = (e: React.DragEvent, issueId: string) => {
    e.dataTransfer.setData("issue-id", issueId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(issueId);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverCol(null);
  };

  const handleDragOver = (e: React.DragEvent, quarter: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(quarter);
  };

  const handleDragLeave = (e: React.DragEvent, quarter: string) => {
    const relatedTarget = e.relatedTarget as Node | null;
    if (relatedTarget && (e.currentTarget as Node).contains(relatedTarget)) return;
    if (dragOverCol === quarter) setDragOverCol(null);
  };

  const handleDrop = async (e: React.DragEvent, quarter: string) => {
    e.preventDefault();
    setDragOverCol(null);
    setDraggingId(null);
    const issueId = e.dataTransfer.getData("issue-id");
    const issue = issues.find((i) => i.id === issueId);
    if (!issue || issue.roadmap_quarter === quarter) return;

    try {
      const updated = await api.updateIssue({
        id: issue.id,
        roadmap_quarter: quarter,
      });
      updateIssueInStore(updated);
    } catch (e: any) {
      addToast({ type: "error", message: e.toString() });
    }
  };

  const handleVote = async (issueId: string) => {
    try {
      const newVotes = await api.voteIssue(issueId);
      const issue = issues.find((i) => i.id === issueId);
      if (issue) {
        updateIssueInStore({ ...issue, votes: newVotes });
      }
    } catch (e: any) {
      addToast({ type: "error", message: e.toString() });
    }
  };

  const toggleCollapse = (quarter: string) => {
    setCollapsedCols((prev) => {
      const next = new Set(prev);
      if (next.has(quarter)) next.delete(quarter);
      else next.add(quarter);
      return next;
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 flex items-center justify-between">
        <h1 className="text-xl font-bold dark:text-white">Feature Roadmap</h1>
        <div className="flex items-center gap-3">
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 dark:text-white text-sm"
          >
            <option value="">All Priorities</option>
            {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 dark:text-white text-sm"
          >
            <option value="">All Statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace(/-/g, " ")}</option>
            ))}
          </select>
          {allTags.length > 0 && (
            <select
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 dark:text-white text-sm"
            >
              <option value="">All Tags</option>
              {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-4 p-6 h-full min-w-max">
          {columnData.map((col) => {
            const collapsed = collapsedCols.has(col.quarter);
            return (
              <div
                key={col.quarter}
                className={`flex flex-col ${collapsed ? "w-12" : "min-w-[280px] w-[280px]"} shrink-0 transition-all rounded-xl ${
                  dragOverCol === col.quarter
                    ? "bg-accent-500/10 ring-2 ring-accent-500/40"
                    : ""
                }`}
                onDragOver={(e) => handleDragOver(e, col.quarter)}
                onDragLeave={(e) => handleDragLeave(e, col.quarter)}
                onDrop={(e) => handleDrop(e, col.quarter)}
              >
                {/* Column header */}
                <button
                  onClick={() => toggleCollapse(col.quarter)}
                  className="flex items-center justify-between mb-3 px-2 py-1 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
                >
                  {collapsed ? (
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs font-semibold text-surface-400 [writing-mode:vertical-lr] rotate-180">
                        {col.quarter}
                      </span>
                      <span className="text-xs bg-surface-200 dark:bg-surface-700 text-surface-500 px-1.5 py-0.5 rounded-full">
                        {col.features.length}
                      </span>
                    </div>
                  ) : (
                    <>
                      <div>
                        <h3 className="text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                          {col.quarter}
                        </h3>
                        <p className="text-xs text-surface-400 mt-0.5">
                          {col.features.length} features &middot; {col.totalVotes} votes
                        </p>
                      </div>
                      <span className="text-xs bg-surface-200 dark:bg-surface-700 text-surface-500 px-2 py-0.5 rounded-full">
                        {col.features.length}
                      </span>
                    </>
                  )}
                </button>

                {/* Cards */}
                {!collapsed && (
                  <div className="flex-1 space-y-2 overflow-y-auto pr-1">
                    {col.features.map((feature) => (
                      <div
                        key={feature.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, feature.id)}
                        onDragEnd={handleDragEnd}
                        className={`bg-white dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-700 p-3 cursor-grab hover:border-accent-500/50 hover:shadow-md transition-all active:cursor-grabbing ${
                          draggingId === feature.id ? "opacity-40" : ""
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-mono text-accent-500">{feature.id}</span>
                          <StatusBadge status={feature.status} />
                        </div>
                        <p className="text-sm font-medium dark:text-white mb-2 line-clamp-2">{feature.title}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <SeverityBadge level={(feature.priority || "medium")} />
                            {feature.tags.slice(0, 1).map((tag) => (
                              <span key={tag} className="text-xs px-1.5 py-0.5 bg-surface-100 dark:bg-surface-800 text-surface-400 rounded">{tag}</span>
                            ))}
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleVote(feature.id); }}
                            className="flex items-center gap-1 px-2 py-0.5 rounded bg-accent-600/10 text-accent-500 hover:bg-accent-600/20 text-xs font-medium transition-colors"
                          >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" />
                            </svg>
                            {feature.votes || 0}
                          </button>
                        </div>
                      </div>
                    ))}
                    {col.features.length === 0 && (
                      <div className="border-2 border-dashed border-surface-200 dark:border-surface-700 rounded-lg p-4 text-center text-sm text-surface-400">
                        Drop features here
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
