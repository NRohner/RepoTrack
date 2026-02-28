import { useState, useCallback } from "react";
import * as api from "@/lib/api";
import { useAppStore } from "@/lib/store";
import type { IssueType, Severity, CreateIssueRequest } from "@/lib/types";
import { SEVERITIES } from "@/lib/types";
import { TypeIcon } from "@/shared/components/TypeIcon";
import { SegmentedControl } from "@/shared/components/SegmentedControl";
import { IoClose } from "react-icons/io5";

interface NewIssueFormProps {
  defaultType: IssueType;
  onClose: () => void;
  existingTags: string[];
}

const TYPE_OPTIONS: { key: IssueType; label: string }[] = [
  { key: "bug", label: "Bug" },
  { key: "feature", label: "Feature" },
  { key: "improvement", label: "Improvement" },
  { key: "task", label: "Task" },
];

const BUG_TEMPLATE = `## Summary

## Steps to Reproduce

1.
2.
3.

## Expected Behavior

## Actual Behavior

## Environment

`;

const FEATURE_TEMPLATE = `## Problem Statement

Describe the user problem...

## Proposed Solution

## Alternatives Considered

`;

export function NewIssueForm({ defaultType, onClose, existingTags }: NewIssueFormProps) {
  const addIssueToStore = useAppStore((s) => s.addIssueToStore);
  const addToast = useAppStore((s) => s.addToast);
  const [closing, setClosing] = useState(false);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 250);
  }, [onClose]);

  const [issueType, setIssueType] = useState<IssueType>(defaultType);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<Severity>("medium");
  const [priority, setPriority] = useState<Severity>("medium");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [stepsToReproduce, setStepsToReproduce] = useState("");
  const [expectedBehavior, setExpectedBehavior] = useState("");
  const [actualBehavior, setActualBehavior] = useState("");
  const [environment, setEnvironment] = useState("");
  const [useCase, setUseCase] = useState("");
  const [acceptanceCriteria, setAcceptanceCriteria] = useState("");
  const [roadmapQuarter, setRoadmapQuarter] = useState("Backlog");
  const [linkedFiles, setLinkedFiles] = useState<string[]>([]);
  const [fileInput, setFileInput] = useState("");
  const [timeEstimate, setTimeEstimate] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);

  const quarters = ["Backlog", "Q1 2026", "Q2 2026", "Q3 2026", "Q4 2026", "Q1 2027", "Q2 2027"];

  const applyTemplate = (type: string) => {
    if (type === "bug") setDescription(BUG_TEMPLATE);
    else if (type === "feature") setDescription(FEATURE_TEMPLATE);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      addToast({ type: "error", message: "Title is required" });
      return;
    }
    setSubmitting(true);
    try {
      const request: CreateIssueRequest = {
        title: title.trim(),
        description,
        issue_type: issueType,
        severity: issueType !== "feature" ? severity : undefined,
        priority: issueType === "feature" ? priority : undefined,
        tags,
        steps_to_reproduce: issueType === "bug" ? stepsToReproduce || undefined : undefined,
        expected_behavior: issueType === "bug" ? expectedBehavior || undefined : undefined,
        actual_behavior: issueType === "bug" ? actualBehavior || undefined : undefined,
        environment: issueType === "bug" ? environment || undefined : undefined,
        use_case: issueType === "feature" ? useCase || undefined : undefined,
        acceptance_criteria: issueType === "feature" ? acceptanceCriteria || undefined : undefined,
        roadmap_quarter: issueType === "feature" ? roadmapQuarter || undefined : undefined,
        linked_files: linkedFiles,
        time_estimate_hours: timeEstimate ? parseFloat(timeEstimate) : undefined,
      };
      const issue = await api.createIssue(request);
      addIssueToStore(issue);
      addToast({ type: "success", message: `${issue.id} created` });
      onClose();
    } catch (e: any) {
      addToast({ type: "error", message: e.toString() });
    } finally {
      setSubmitting(false);
    }
  };

  const addTag = (tag: string) => {
    const t = tag.trim().toLowerCase();
    if (t && !tags.includes(t)) {
      setTags([...tags, t]);
    }
    setTagInput("");
    setShowTagSuggestions(false);
  };

  const addLinkedFile = () => {
    if (fileInput.trim() && !linkedFiles.includes(fileInput.trim())) {
      setLinkedFiles([...linkedFiles, fileInput.trim()]);
      setFileInput("");
    }
  };

  const filteredTagSuggestions = existingTags.filter(
    (t) => t.includes(tagInput.toLowerCase()) && !tags.includes(t)
  );

  return (
    <>
      <div className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 ${closing ? "animate-backdrop-out" : "animate-backdrop-in"}`} onClick={handleClose} />
      <div className={`fixed inset-y-0 right-0 w-full max-w-2xl bg-white dark:bg-surface-900 shadow-2xl z-50 flex flex-col border-l border-surface-200 dark:border-surface-800 ${closing ? "animate-slide-out-right" : "animate-slide-in-right"}`}>
        <div className="px-6 py-4 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold dark:text-white">New Issue</h2>
          <button onClick={handleClose} className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Type selector */}
          <SegmentedControl
            options={TYPE_OPTIONS.map((opt) => ({
              key: opt.key,
              label: opt.label,
              icon: <TypeIcon type={opt.key} className="w-4 h-4" />,
            }))}
            value={issueType}
            onChange={setIssueType}
            size="md"
          />

          {/* Template */}
          <div className="flex gap-2">
            <button
              onClick={() => applyTemplate(issueType)}
              className="text-xs text-accent-500 hover:text-accent-400 font-medium"
            >
              Use Template
            </button>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium dark:text-surface-300 mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="Short summary of the issue"
              className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium dark:text-surface-300 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={6}
              placeholder="Detailed description (Markdown supported)"
              className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
          </div>

          {/* Severity/Priority */}
          <div className="grid grid-cols-2 gap-4">
            {issueType !== "feature" && (
              <div>
                <label className="block text-sm font-medium dark:text-surface-300 mb-1">Severity</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as Severity)}
                  className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 dark:text-white capitalize focus:outline-none focus:ring-2 focus:ring-accent-500"
                >
                  {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            {issueType === "feature" && (
              <div>
                <label className="block text-sm font-medium dark:text-surface-300 mb-1">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Severity)}
                  className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 dark:text-white capitalize focus:outline-none focus:ring-2 focus:ring-accent-500"
                >
                  {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium dark:text-surface-300 mb-1">Time Estimate (hours)</label>
              <input
                type="number"
                value={timeEstimate}
                onChange={(e) => setTimeEstimate(e.target.value)}
                min="0"
                step="0.5"
                placeholder="Optional"
                className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium dark:text-surface-300 mb-1">Tags</label>
            <div className="flex flex-wrap gap-1 mb-2">
              {tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent-600/10 text-accent-500 rounded-full text-xs font-medium">
                  {tag}
                  <button onClick={() => setTags(tags.filter((t) => t !== tag))} className="hover:text-accent-300"><IoClose className="w-3.5 h-3.5" /></button>
                </span>
              ))}
            </div>
            <div className="relative">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => { setTagInput(e.target.value); setShowTagSuggestions(true); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && tagInput) { e.preventDefault(); addTag(tagInput); }
                }}
                onFocus={() => setShowTagSuggestions(true)}
                onBlur={() => setTimeout(() => setShowTagSuggestions(false), 200)}
                placeholder="Add a tag..."
                className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
              />
              {showTagSuggestions && filteredTagSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg shadow-lg z-10 max-h-32 overflow-y-auto">
                  {filteredTagSuggestions.map((tag) => (
                    <button key={tag} onMouseDown={() => addTag(tag)} className="block w-full text-left px-3 py-1.5 text-sm hover:bg-surface-100 dark:hover:bg-surface-700 dark:text-white">
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bug-specific fields */}
          {issueType === "bug" && (
            <>
              <div>
                <label className="block text-sm font-medium dark:text-surface-300 mb-1">Steps to Reproduce</label>
                <textarea value={stepsToReproduce} onChange={(e) => setStepsToReproduce(e.target.value)} rows={3} placeholder="1. Go to...\n2. Click on...\n3. Observe..." className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium dark:text-surface-300 mb-1">Expected Behavior</label>
                  <textarea value={expectedBehavior} onChange={(e) => setExpectedBehavior(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium dark:text-surface-300 mb-1">Actual Behavior</label>
                  <textarea value={actualBehavior} onChange={(e) => setActualBehavior(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium dark:text-surface-300 mb-1">Environment</label>
                <input type="text" value={environment} onChange={(e) => setEnvironment(e.target.value)} placeholder="e.g., Chrome 122, macOS 14.3, Node 20" className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-500" />
              </div>
            </>
          )}

          {/* Feature-specific fields */}
          {issueType === "feature" && (
            <>
              <div>
                <label className="block text-sm font-medium dark:text-surface-300 mb-1">Use Case</label>
                <textarea value={useCase} onChange={(e) => setUseCase(e.target.value)} rows={3} placeholder="Describe the problem this feature would solve..." className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-500" />
              </div>
              <div>
                <label className="block text-sm font-medium dark:text-surface-300 mb-1">Acceptance Criteria</label>
                <textarea value={acceptanceCriteria} onChange={(e) => setAcceptanceCriteria(e.target.value)} rows={3} placeholder="- [ ] Criterion one\n- [ ] Criterion two" className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent-500" />
              </div>
              <div>
                <label className="block text-sm font-medium dark:text-surface-300 mb-1">Roadmap Quarter</label>
                <select value={roadmapQuarter} onChange={(e) => setRoadmapQuarter(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500">
                  {quarters.map((q) => <option key={q} value={q}>{q}</option>)}
                </select>
              </div>
            </>
          )}

          {/* Linked Files */}
          <div>
            <label className="block text-sm font-medium dark:text-surface-300 mb-1">Linked Files</label>
            <div className="flex flex-wrap gap-1 mb-2">
              {linkedFiles.map((f) => (
                <span key={f} className="inline-flex items-center gap-1 px-2 py-0.5 bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400 rounded text-xs font-mono">
                  {f}
                  <button onClick={() => setLinkedFiles(linkedFiles.filter((lf) => lf !== f))} className="hover:text-red-500"><IoClose className="w-3.5 h-3.5" /></button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={fileInput}
                onChange={(e) => setFileInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLinkedFile(); } }}
                placeholder="src/components/example.tsx"
                className="flex-1 px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 dark:text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent-500"
              />
              <button onClick={addLinkedFile} className="px-3 py-2 bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 rounded-lg text-sm transition-colors dark:text-white">
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-surface-200 dark:border-surface-800 flex justify-between items-center shrink-0">
          <p className="text-xs text-surface-400">
            Ctrl+Enter to submit
          </p>
          <div className="flex gap-3">
            <button onClick={handleClose} className="px-4 py-2 text-sm font-medium text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !title.trim()}
              className="px-6 py-2 bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-all active:scale-[0.98]"
            >
              {submitting ? "Creating..." : "Create Issue"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
