import { useMemo } from "react";
import type { Issue } from "@/lib/types";
import { TYPE_ICONS, STATUS_COLORS } from "@/lib/types";
import { StatusBadge, SeverityBadge } from "@/shared/components/StatusBadge";

interface KanbanBoardProps {
  issues: Issue[];
  activeTab: string;
  onIssueClick: (issue: Issue) => void;
  onStatusChange: (issue: Issue, newStatus: string) => void;
}

const BUG_COLUMNS = ["open", "in-progress", "resolved", "closed"];
const FEATURE_COLUMNS = ["proposed", "under-review", "planned", "in-progress", "completed"];
const ALL_COLUMNS = [
  { key: "new", label: "New", statuses: ["open", "proposed"] },
  { key: "review", label: "In Review", statuses: ["under-review"] },
  { key: "planned", label: "Planned", statuses: ["planned"] },
  { key: "active", label: "In Progress", statuses: ["in-progress"] },
  { key: "done", label: "Done", statuses: ["resolved", "completed", "closed"] },
];

export function KanbanBoard({ issues, activeTab, onIssueClick, onStatusChange }: KanbanBoardProps) {
  const columns = useMemo(() => {
    if (activeTab === "bug") {
      return BUG_COLUMNS.map((status) => ({
        key: status,
        label: status.replace(/-/g, " "),
        issues: issues.filter((i) => i.status === status),
      }));
    }
    if (activeTab === "feature") {
      return FEATURE_COLUMNS.map((status) => ({
        key: status,
        label: status.replace(/-/g, " "),
        issues: issues.filter((i) => i.status === status),
      }));
    }
    return ALL_COLUMNS.map((col) => ({
      key: col.key,
      label: col.label,
      issues: issues.filter((i) => col.statuses.includes(i.status)),
    }));
  }, [issues, activeTab]);

  const handleDragStart = (e: React.DragEvent, issue: Issue) => {
    e.dataTransfer.setData("issue-id", issue.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, columnKey: string) => {
    e.preventDefault();
    const issueId = e.dataTransfer.getData("issue-id");
    const issue = issues.find((i) => i.id === issueId);
    if (!issue) return;

    let targetStatus = columnKey;
    if (activeTab === "all") {
      const col = ALL_COLUMNS.find((c) => c.key === columnKey);
      if (col) {
        // Pick the appropriate status based on issue type
        if (issue.type === "bug") {
          targetStatus = col.statuses.find((s) =>
            ["open", "in-progress", "resolved", "closed"].includes(s)
          ) || col.statuses[0];
        } else {
          targetStatus = col.statuses.find((s) =>
            ["proposed", "under-review", "planned", "in-progress", "completed"].includes(s)
          ) || col.statuses[0];
        }
      }
    }
    if (targetStatus !== issue.status) {
      onStatusChange(issue, targetStatus);
    }
  };

  const timeSince = (dateStr: string) => {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  return (
    <div className="flex gap-4 p-6 h-full overflow-x-auto">
      {columns.map((column) => (
        <div
          key={column.key}
          className="flex flex-col min-w-[280px] w-[280px] shrink-0"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, column.key)}
        >
          {/* Column header */}
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider capitalize">
              {column.label}
            </h3>
            <span className="text-xs bg-surface-200 dark:bg-surface-800 text-surface-500 px-2 py-0.5 rounded-full">
              {column.issues.length}
            </span>
          </div>

          {/* Cards */}
          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            {column.issues.map((issue) => (
              <div
                key={issue.id}
                draggable
                onDragStart={(e) => handleDragStart(e, issue)}
                onClick={() => onIssueClick(issue)}
                className="bg-white dark:bg-surface-900 rounded-lg border border-surface-200 dark:border-surface-700 p-3 cursor-pointer hover:border-accent-500/50 hover:shadow-lg transition-all group"
              >
                <div className="flex items-start gap-2">
                  <div
                    className={`w-1 h-full min-h-[40px] rounded-full shrink-0 ${
                      STATUS_COLORS[issue.status] || "bg-gray-500"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-xs">{TYPE_ICONS[issue.type as keyof typeof TYPE_ICONS]}</span>
                      <span className="text-xs text-surface-400 font-mono">{issue.id}</span>
                    </div>
                    <p className="text-sm font-medium dark:text-white line-clamp-2">{issue.title}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <SeverityBadge level={(issue.severity || issue.priority || "medium")} />
                      {issue.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="text-xs px-1.5 py-0.5 bg-surface-100 dark:bg-surface-800 text-surface-400 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs text-surface-400">
                      <span>{timeSince(issue.created_at)} ago</span>
                      {issue.votes != null && issue.votes > 0 && (
                        <span className="flex items-center gap-0.5">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" />
                          </svg>
                          {issue.votes}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
