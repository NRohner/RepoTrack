import { useState, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import * as api from "@/lib/api";
import type { Issue, IssueType, Severity } from "@/lib/types";
import {
  STATUSES,
  SEVERITIES,
} from "@/lib/types";
import { VscBug } from "react-icons/vsc";
import { HiOutlineSparkles } from "react-icons/hi2";
import { GoTools } from "react-icons/go";
import { LuClipboardList } from "react-icons/lu";
import { IoClose } from "react-icons/io5";
import { StatusBadge, SeverityBadge } from "@/shared/components/StatusBadge";
import { TypeIcon } from "@/shared/components/TypeIcon";
import { SegmentedControl } from "@/shared/components/SegmentedControl";
import { IssueDetail } from "./IssueDetail";
import { NewIssueForm } from "./NewIssueForm";
import { KanbanBoard } from "./KanbanBoard";

type ViewTab = "all" | "bug" | "feature" | "improvement" | "task";
type LayoutMode = "table" | "kanban";

export function IssueBoard() {
  const issues = useAppStore((s) => s.issues);
  const setIssues = useAppStore((s) => s.setIssues);
  const updateIssueInStore = useAppStore((s) => s.updateIssueInStore);
  const removeIssueFromStore = useAppStore((s) => s.removeIssueFromStore);
  const addToast = useAppStore((s) => s.addToast);

  const [activeTab, setActiveTab] = useState<ViewTab>("all");
  const [layout, setLayout] = useState<LayoutMode>("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [severityFilter, setSeverityFilter] = useState<string>("");
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [sortCol, setSortCol] = useState<string>("updated_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showNewIssue, setShowNewIssue] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);

  const tabs: { key: ViewTab; label: string; icon: React.ReactNode | null }[] = [
    { key: "all", label: "All", icon: null },
    { key: "bug", label: "Bugs", icon: <VscBug className="w-3.5 h-3.5 text-red-500" /> },
    { key: "feature", label: "Features", icon: <HiOutlineSparkles className="w-3.5 h-3.5 text-purple-500" /> },
    { key: "improvement", label: "Improvements", icon: <GoTools className="w-3.5 h-3.5 text-amber-500" /> },
    { key: "task", label: "Tasks", icon: <LuClipboardList className="w-3.5 h-3.5 text-blue-500" /> },
  ];

  const allTags = useMemo(() => {
    const set = new Set<string>();
    issues.forEach((i) => i.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [issues]);

  const filteredIssues = useMemo(() => {
    let result = [...issues];
    if (activeTab !== "all") {
      result = result.filter((i) => i.type === activeTab);
    }
    if (statusFilter) {
      result = result.filter((i) => i.status === statusFilter);
    }
    if (severityFilter) {
      result = result.filter(
        (i) =>
          (i.severity === severityFilter) || (i.priority === severityFilter)
      );
    }
    if (tagFilter.length > 0) {
      result = result.filter((i) =>
        tagFilter.every((t) => i.tags.includes(t))
      );
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          i.id.toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      let valA: any, valB: any;
      switch (sortCol) {
        case "id":
          valA = a.id;
          valB = b.id;
          break;
        case "title":
          valA = a.title.toLowerCase();
          valB = b.title.toLowerCase();
          break;
        case "status":
          valA = a.status;
          valB = b.status;
          break;
        case "severity":
          const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
          valA = sevOrder[(a.severity || a.priority || "medium") as keyof typeof sevOrder] ?? 2;
          valB = sevOrder[(b.severity || b.priority || "medium") as keyof typeof sevOrder] ?? 2;
          break;
        case "votes":
          valA = a.votes || 0;
          valB = b.votes || 0;
          break;
        case "created_at":
          valA = a.created_at;
          valB = b.created_at;
          break;
        default:
          valA = a.updated_at;
          valB = b.updated_at;
      }
      if (valA < valB) return sortDir === "asc" ? -1 : 1;
      if (valA > valB) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return result;
  }, [issues, activeTab, statusFilter, severityFilter, tagFilter, searchQuery, sortCol, sortDir]);

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const handleInlineStatusChange = async (issue: Issue, newStatus: string) => {
    try {
      const updated = await api.updateIssue({ id: issue.id, status: newStatus });
      updateIssueInStore(updated);
      setInlineEditId(null);
    } catch (e: any) {
      addToast({ type: "error", message: e.toString() });
    }
  };

  const handleInlineSeverityChange = async (issue: Issue, level: Severity) => {
    try {
      const req: any = { id: issue.id };
      if (issue.type === "feature") {
        req.priority = level;
      } else {
        req.severity = level;
      }
      const updated = await api.updateIssue(req);
      updateIssueInStore(updated);
      setInlineEditId(null);
    } catch (e: any) {
      addToast({ type: "error", message: e.toString() });
    }
  };

  const handleBulkStatusUpdate = async (status: string) => {
    try {
      await api.bulkUpdateIssues({ ids: Array.from(selectedIds), status });
      const data = await api.getIssues();
      setIssues(data);
      setSelectedIds(new Set());
      addToast({ type: "success", message: `Updated ${selectedIds.size} issues` });
    } catch (e: any) {
      addToast({ type: "error", message: e.toString() });
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} issues? This cannot be undone.`)) return;
    try {
      for (const id of selectedIds) {
        await api.deleteIssue(id);
        removeIssueFromStore(id);
      }
      setSelectedIds(new Set());
      addToast({ type: "success", message: "Issues deleted" });
    } catch (e: any) {
      addToast({ type: "error", message: e.toString() });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredIssues.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredIssues.map((i) => i.id)));
    }
  };

  const statusOptions = STATUSES;

  const getStatusesForIssue = (_issue: Issue) => STATUSES;

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: issues.length };
    issues.forEach((i) => {
      counts[i.type] = (counts[i.type] || 0) + 1;
    });
    return counts;
  }, [issues]);

  const formatDate = (d: string) => {
    const now = Date.now();
    const date = new Date(d);
    const diffMs = now - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);

    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold dark:text-white">Issues</h1>
          <div className="flex items-center gap-2">
            {/* Layout toggle */}
            <SegmentedControl
              options={[
                { key: "table" as LayoutMode, label: "Table" },
                { key: "kanban" as LayoutMode, label: "Kanban" },
              ]}
              value={layout}
              onChange={setLayout}
              size="sm"
            />
            {/* New issue button */}
            <button
              onClick={() => setShowNewIssue(true)}
              className="flex items-center gap-2 px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white rounded-lg text-sm font-medium transition-all active:scale-[0.98] shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Issue
            </button>
          </div>
        </div>

        {/* Tabs */}
        <SegmentedControl
          options={tabs.map((tab) => ({
            key: tab.key,
            label: tab.label,
            icon: tab.icon ?? undefined,
            badge: tabCounts[tab.key] || 0,
          }))}
          value={activeTab}
          onChange={setActiveTab}
          variant="accent"
        />
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search issues..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 w-64"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
        >
          <option value="">All Statuses</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s.replace(/-/g, " ")}
            </option>
          ))}
        </select>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
        >
          <option value="">All Severity/Priority</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {allTags.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              if (e.target.value && !tagFilter.includes(e.target.value)) {
                setTagFilter([...tagFilter, e.target.value]);
              }
            }}
            className="px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
          >
            <option value="">Filter by tag...</option>
            {allTags.filter((t) => !tagFilter.includes(t)).map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}
        {/* Active filter chips */}
        {tagFilter.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-1 bg-accent-600/10 text-accent-500 rounded-full text-xs font-medium"
          >
            {tag}
            <button
              onClick={() => setTagFilter(tagFilter.filter((t) => t !== tag))}
              className="hover:text-accent-300"
            >
              <IoClose className="w-3.5 h-3.5" />
            </button>
          </span>
        ))}

        {/* Bulk actions */}
        {selectedIds.size > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-surface-400">
              {selectedIds.size} selected
            </span>
            <select
              onChange={(e) => e.target.value && handleBulkStatusUpdate(e.target.value)}
              className="px-2 py-1 rounded border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 dark:text-white text-xs"
              defaultValue=""
            >
              <option value="">Set status...</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>{s.replace(/-/g, " ")}</option>
              ))}
            </select>
            <button
              onClick={handleBulkDelete}
              className="px-2 py-1 text-xs bg-red-500/10 text-red-500 rounded hover:bg-red-500/20 transition-colors"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {layout === "table" ? (
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-medium text-surface-400 uppercase tracking-wider border-b border-surface-200 dark:border-surface-800">
                <th className="px-6 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredIssues.length && filteredIssues.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded"
                  />
                </th>
                <th className="px-3 py-3 cursor-pointer hover:text-surface-600 dark:hover:text-surface-300" onClick={() => handleSort("id")}>
                  ID {sortCol === "id" && (sortDir === "asc" ? "\u2191" : "\u2193")}
                </th>
                <th className="px-3 py-3 cursor-pointer hover:text-surface-600 dark:hover:text-surface-300" onClick={() => handleSort("title")}>
                  Title {sortCol === "title" && (sortDir === "asc" ? "\u2191" : "\u2193")}
                </th>
                <th className="px-3 py-3 w-8">Type</th>
                <th className="px-3 py-3 cursor-pointer hover:text-surface-600 dark:hover:text-surface-300" onClick={() => handleSort("severity")}>
                  {activeTab === "bug" ? "Severity" : activeTab === "feature" ? "Priority" : "Sev/Pri"}
                  {sortCol === "severity" && (sortDir === "asc" ? " \u2191" : " \u2193")}
                </th>
                <th className="px-3 py-3 cursor-pointer hover:text-surface-600 dark:hover:text-surface-300" onClick={() => handleSort("status")}>
                  Status {sortCol === "status" && (sortDir === "asc" ? "\u2191" : "\u2193")}
                </th>
                <th className="px-3 py-3">Tags</th>
                {(activeTab === "all" || activeTab === "feature") && (
                  <th className="px-3 py-3 cursor-pointer hover:text-surface-600 dark:hover:text-surface-300" onClick={() => handleSort("votes")}>
                    Votes {sortCol === "votes" && (sortDir === "asc" ? "\u2191" : "\u2193")}
                  </th>
                )}
                <th className="px-3 py-3 cursor-pointer hover:text-surface-600 dark:hover:text-surface-300" onClick={() => handleSort("updated_at")}>
                  Updated {sortCol === "updated_at" && (sortDir === "asc" ? "\u2191" : "\u2193")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
              {filteredIssues.map((issue) => (
                <tr
                  key={issue.id}
                  className="hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedIssue(issue)}
                >
                  <td className="px-6 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(issue.id)}
                      onChange={() => toggleSelect(issue.id)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-3 py-3 text-sm font-mono text-surface-500 dark:text-surface-400">{issue.id}</td>
                  <td className="px-3 py-3 text-sm font-medium dark:text-white max-w-md truncate">{issue.title}</td>
                  <td className="px-3 py-3 text-sm"><TypeIcon type={issue.type as IssueType} /></td>
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="relative">
                      <SeverityBadge
                        level={(issue.severity || issue.priority || "medium")}
                        onClick={() => setInlineEditId(inlineEditId === `sev-${issue.id}` ? null : `sev-${issue.id}`)}
                      />
                      {inlineEditId === `sev-${issue.id}` && (
                        <div className="absolute top-full left-0 mt-1 bg-white dark:bg-surface-800 rounded-lg shadow-xl border border-surface-200 dark:border-surface-700 py-1 z-20">
                          {SEVERITIES.map((s) => (
                            <button
                              key={s}
                              onClick={() => handleInlineSeverityChange(issue, s)}
                              className="block w-full text-left px-3 py-1.5 text-sm hover:bg-surface-100 dark:hover:bg-surface-700 capitalize dark:text-white"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="relative">
                      <StatusBadge
                        status={issue.status}
                        onClick={() => setInlineEditId(inlineEditId === `st-${issue.id}` ? null : `st-${issue.id}`)}
                      />
                      {inlineEditId === `st-${issue.id}` && (
                        <div className="absolute top-full left-0 mt-1 bg-white dark:bg-surface-800 rounded-lg shadow-xl border border-surface-200 dark:border-surface-700 py-1 z-20 min-w-[140px]">
                          {getStatusesForIssue(issue).map((s) => (
                            <button
                              key={s}
                              onClick={() => handleInlineStatusChange(issue, s)}
                              className="block w-full text-left px-3 py-1.5 text-sm hover:bg-surface-100 dark:hover:bg-surface-700 capitalize dark:text-white"
                            >
                              {s.replace(/-/g, " ")}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1 flex-wrap">
                      {issue.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="text-xs px-1.5 py-0.5 bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400 rounded">
                          {tag}
                        </span>
                      ))}
                      {issue.tags.length > 3 && (
                        <span className="text-xs text-surface-400">+{issue.tags.length - 3}</span>
                      )}
                    </div>
                  </td>
                  {(activeTab === "all" || activeTab === "feature") && (
                    <td className="px-3 py-3 text-sm text-surface-400">
                      {issue.votes != null && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" />
                          </svg>
                          {issue.votes}
                        </span>
                      )}
                    </td>
                  )}
                  <td className="px-3 py-3 text-sm text-surface-400">
                    {formatDate(issue.updated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <KanbanBoard
            issues={filteredIssues}
            activeTab={activeTab}
            onIssueClick={setSelectedIssue}
            onStatusChange={handleInlineStatusChange}
          />
        )}

        {filteredIssues.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-surface-400">
            <svg className="w-12 h-12 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-lg font-medium">No issues found</p>
            <p className="text-sm mt-1">
              {searchQuery || statusFilter || severityFilter
                ? "Try adjusting your filters"
                : "Create your first issue to get started"}
            </p>
          </div>
        )}
      </div>

      {/* Issue Detail Slide-over */}
      {selectedIssue && (
        <IssueDetail
          issue={selectedIssue}
          onClose={() => setSelectedIssue(null)}
          onUpdate={(updated) => {
            updateIssueInStore(updated);
            setSelectedIssue(updated);
          }}
          onDelete={(id) => {
            removeIssueFromStore(id);
            setSelectedIssue(null);
          }}
        />
      )}

      {/* New Issue Modal */}
      {showNewIssue && (
        <NewIssueForm
          defaultType={activeTab !== "all" ? (activeTab as IssueType) : "bug"}
          onClose={() => setShowNewIssue(false)}
          existingTags={allTags}
        />
      )}
    </div>
  );
}
