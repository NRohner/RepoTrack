import { useMemo, useState } from "react";
import type { Issue, IssueType } from "@/lib/types";
import { STATUS_COLORS } from "@/lib/types";
import { SeverityBadge } from "@/shared/components/StatusBadge";
import { TypeIcon } from "@/shared/components/TypeIcon";

interface KanbanBoardProps {
  issues: Issue[];
  activeTab: string;
  onIssueClick: (issue: Issue) => void;
  onStatusChange: (issue: Issue, newStatus: string) => void;
}

const COLUMNS = [
  { key: "open", label: "Open" },
  { key: "in-progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
  { key: "wont-fix", label: "Wont Fix", collapsed: true },
];

export function KanbanBoard({ issues, activeTab, onIssueClick, onStatusChange }: KanbanBoardProps) {
  const [collapsedCols, setCollapsedCols] = useState<Set<string>>(
    () => new Set(COLUMNS.filter((c) => c.collapsed).map((c) => c.key))
  );

  const toggleCollapse = (key: string) => {
    setCollapsedCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const columns = useMemo(() => {
    return COLUMNS.map((col) => ({
      key: col.key,
      label: col.label,
      issues: issues.filter((i) => i.status === col.key),
    }));
  }, [issues]);

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

    if (columnKey !== issue.status) {
      onStatusChange(issue, columnKey);
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
      {columns.map((column) => {
        const isCollapsed = collapsedCols.has(column.key);
        return (
          <div
            key={column.key}
            className={`flex flex-col ${isCollapsed ? "w-12" : "min-w-[280px] w-[280px]"} shrink-0 transition-all`}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.key)}
          >
            {/* Column header */}
            <button
              onClick={() => toggleCollapse(column.key)}
              className="flex items-center justify-between mb-3 px-1 py-1 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            >
              {isCollapsed ? (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs font-semibold text-surface-400 [writing-mode:vertical-lr] rotate-180">
                    {column.label}
                  </span>
                  <span className="text-xs bg-surface-200 dark:bg-surface-700 text-surface-500 px-1.5 py-0.5 rounded-full">
                    {column.issues.length}
                  </span>
                </div>
              ) : (
                <>
                  <h3 className="text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider capitalize">
                    {column.label}
                  </h3>
                  <span className="text-xs bg-surface-200 dark:bg-surface-800 text-surface-500 px-2 py-0.5 rounded-full">
                    {column.issues.length}
                  </span>
                </>
              )}
            </button>

            {/* Cards */}
            {!isCollapsed && (
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
                          <TypeIcon type={issue.type as IssueType} className="w-3.5 h-3.5" />
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
            )}
          </div>
        );
      })}
    </div>
  );
}
