import { useState, useCallback, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { IoClose } from "react-icons/io5";
import { open as dialogOpen } from "@tauri-apps/plugin-dialog";
import * as api from "@/lib/api";
import { useAppStore } from "@/lib/store";
import type { Issue, Severity, IssueType, Attachment } from "@/lib/types";
import { STATUSES, SEVERITIES } from "@/lib/types";
import { StatusBadge, SeverityBadge } from "@/shared/components/StatusBadge";
import { TypeIcon } from "@/shared/components/TypeIcon";

interface IssueDetailProps {
  issue: Issue;
  onClose: () => void;
  onUpdate: (issue: Issue) => void;
  onDelete: (id: string) => void;
}

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "svg"];

function isImageFile(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTENSIONS.includes(ext);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentThumbnail({ issueId, attachment, onClick }: { issueId: string; attachment: Attachment; onClick: () => void }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isImageFile(attachment.filename)) return;
    let cancelled = false;
    api.getAttachmentData(issueId, attachment.id).then((url) => {
      if (!cancelled) setDataUrl(url);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [issueId, attachment.id, attachment.filename]);

  if (!dataUrl) return null;

  return (
    <img
      src={dataUrl}
      alt={attachment.filename}
      className="max-h-32 rounded mb-2 cursor-pointer hover:opacity-80 transition-opacity object-contain"
      onClick={onClick}
    />
  );
}

export function IssueDetail({ issue, onClose, onUpdate, onDelete }: IssueDetailProps) {
  const addToast = useAppStore((s) => s.addToast);
  const activeProject = useAppStore((s) => s.activeProject);
  const issues = useAppStore((s) => s.issues);
  const [closing, setClosing] = useState(false);
  const [lightboxAttachment, setLightboxAttachment] = useState<Attachment | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    issues.forEach((i) => i.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [issues]);

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 250);
  }, [onClose]);

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(issue.title);
  const [editDesc, setEditDesc] = useState(issue.description);
  const [editTags, setEditTags] = useState<string[]>(issue.tags);
  const [tagInput, setTagInput] = useState("");
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [editSteps, setEditSteps] = useState(issue.steps_to_reproduce || "");
  const [editExpected, setEditExpected] = useState(issue.expected_behavior || "");
  const [editActual, setEditActual] = useState(issue.actual_behavior || "");
  const [editEnvironment, setEditEnvironment] = useState(issue.environment || "");
  const [editUseCase, setEditUseCase] = useState(issue.use_case || "");
  const [editAcceptance, setEditAcceptance] = useState(issue.acceptance_criteria || "");
  const [editRoadmap, setEditRoadmap] = useState(issue.roadmap_quarter || "");
  const [newComment, setNewComment] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [votePulse, setVotePulse] = useState(false);

  const statusOptions = STATUSES;

  const handleSave = async () => {
    try {
      const req: any = {
        id: issue.id,
        title: editTitle,
        description: editDesc,
        tags: editTags,
      };
      if (issue.type === "bug") {
        req.steps_to_reproduce = editSteps;
        req.expected_behavior = editExpected;
        req.actual_behavior = editActual;
        req.environment = editEnvironment;
      }
      if (issue.type === "feature") {
        req.use_case = editUseCase;
        req.acceptance_criteria = editAcceptance;
        req.roadmap_quarter = editRoadmap || null;
      }
      const updated = await api.updateIssue(req);
      onUpdate(updated);
      setEditing(false);
      addToast({ type: "success", message: "Issue updated" });
    } catch (e: any) {
      addToast({ type: "error", message: e.toString() });
    }
  };

  const handleStatusChange = async (status: string) => {
    try {
      const updated = await api.updateIssue({ id: issue.id, status });
      onUpdate(updated);
    } catch (e: any) {
      addToast({ type: "error", message: e.toString() });
    }
  };

  const handleSeverityChange = async (level: Severity) => {
    try {
      const req: any = { id: issue.id };
      if (issue.type === "feature") req.priority = level;
      else req.severity = level;
      const updated = await api.updateIssue(req);
      onUpdate(updated);
    } catch (e: any) {
      addToast({ type: "error", message: e.toString() });
    }
  };

  const handleVote = async () => {
    try {
      const newVotes = await api.voteIssue(issue.id);
      setVotePulse(true);
      setTimeout(() => setVotePulse(false), 300);
      onUpdate({ ...issue, votes: newVotes });
    } catch (e: any) {
      addToast({ type: "error", message: e.toString() });
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      const comment = await api.addComment(issue.id, newComment.trim());
      onUpdate({ ...issue, comments: [...issue.comments, comment] });
      setNewComment("");
      addToast({ type: "success", message: "Comment added" });
    } catch (e: any) {
      addToast({ type: "error", message: e.toString() });
    }
  };

  const handleDelete = async () => {
    try {
      await api.deleteIssue(issue.id);
      onDelete(issue.id);
      addToast({ type: "success", message: "Issue deleted" });
    } catch (e: any) {
      addToast({ type: "error", message: e.toString() });
    }
  };

  const [attachDelConfirm, setAttachDelConfirm] = useState<string | null>(null);

  const handleAttachFiles = async () => {
    try {
      const selected = await dialogOpen({ multiple: true });
      if (!selected) return;
      const paths = Array.isArray(selected) ? selected : [selected];
      for (const filePath of paths) {
        const attachment = await api.addAttachment(issue.id, filePath);
        const updatedAttachments = [...(issue.attachments || []), attachment];
        onUpdate({ ...issue, attachments: updatedAttachments });
        // Update issue reference for subsequent iterations
        issue = { ...issue, attachments: updatedAttachments };
      }
      addToast({ type: "success", message: `${paths.length} file(s) attached` });
    } catch (e: any) {
      addToast({ type: "error", message: e.toString() });
    }
  };

  const handleRemoveAttachment = async (attachmentId: string) => {
    try {
      await api.removeAttachment(issue.id, attachmentId);
      const updatedAttachments = (issue.attachments || []).filter((a) => a.id !== attachmentId);
      onUpdate({ ...issue, attachments: updatedAttachments });
      setAttachDelConfirm(null);
      addToast({ type: "success", message: "Attachment removed" });
    } catch (e: any) {
      addToast({ type: "error", message: e.toString() });
    }
  };

  const handleOpenAttachment = async (attachmentId: string) => {
    try {
      await api.openAttachment(issue.id, attachmentId);
    } catch (e: any) {
      addToast({ type: "error", message: e.toString() });
    }
  };

  const handlePreviewAttachment = async (attachment: Attachment) => {
    if (!isImageFile(attachment.filename)) {
      handleOpenAttachment(attachment.id);
      return;
    }
    try {
      const dataUrl = await api.getAttachmentData(issue.id, attachment.id);
      setLightboxAttachment(attachment);
      setLightboxUrl(dataUrl);
    } catch (e: any) {
      addToast({ type: "error", message: e.toString() });
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const addTag = (tag: string) => {
    const t = tag.trim().toLowerCase();
    if (t && !editTags.includes(t)) {
      setEditTags([...editTags, t]);
    }
    setTagInput("");
    setShowTagSuggestions(false);
  };

  const filteredTagSuggestions = allTags.filter(
    (t) => t.includes(tagInput.toLowerCase()) && !editTags.includes(t)
  );

  const quarters = ["Backlog", "Q1 2026", "Q2 2026", "Q3 2026", "Q4 2026", "Q1 2027", "Q2 2027"];

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-40 ${closing ? "animate-backdrop-out" : "animate-backdrop-in"}`}
        onClick={handleClose}
      />
      {/* Panel */}
      <div className={`fixed inset-y-0 right-0 w-full max-w-2xl bg-white dark:bg-surface-900 shadow-2xl z-50 flex flex-col overflow-hidden border-l border-surface-200 dark:border-surface-800 ${closing ? "animate-slide-out-right" : "animate-slide-in-right"}`}>
        {/* Header */}
        <div className="px-6 py-4 border-b border-surface-200 dark:border-surface-800 flex items-start justify-between shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-mono text-accent-500 font-semibold">{issue.id}</span>
              <TypeIcon type={issue.type as IssueType} className="w-4 h-4" />
              {issue.type === "feature" && (
                <button
                  onClick={handleVote}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg bg-accent-600/10 text-accent-500 hover:bg-accent-600/20 transition-all text-sm font-medium ${
                    votePulse ? "animate-vote-pulse" : ""
                  }`}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" />
                  </svg>
                  {issue.votes || 0}
                </button>
              )}
            </div>
            {editing ? (
              <input
                type="text"
                spellCheck
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="text-xl font-bold dark:text-white w-full bg-transparent border-b-2 border-accent-500 outline-none pb-1"
              />
            ) : (
              <h2 className="text-xl font-bold dark:text-white">{issue.title}</h2>
            )}
            <div className="flex items-center gap-2 mt-2">
              <select
                value={issue.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="px-2 py-1 rounded-full text-xs font-medium bg-surface-100 dark:bg-surface-800 dark:text-white border-0 outline-none cursor-pointer"
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>{s.replace(/-/g, " ")}</option>
                ))}
              </select>
              <select
                value={(issue.severity || issue.priority || "medium")}
                onChange={(e) => handleSeverityChange(e.target.value as Severity)}
                className="px-2 py-1 rounded text-xs font-medium bg-surface-100 dark:bg-surface-800 dark:text-white border-0 outline-none cursor-pointer capitalize"
              >
                {SEVERITIES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-400 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">Description</h3>
              <button
                onClick={() => {
                  if (editing) handleSave();
                  else setEditing(true);
                }}
                className="text-xs text-accent-500 hover:text-accent-400 font-medium"
              >
                {editing ? "Save" : "Edit"}
              </button>
            </div>
            {editing ? (
              <textarea
                spellCheck
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={8}
                className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
              />
            ) : issue.description ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{issue.description}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm italic text-surface-400">No description</p>
            )}
          </div>

          {/* Bug-specific fields */}
          {issue.type === "bug" && (
            <>
              <Section title="Steps to Reproduce" editing={editing}>
                {editing ? (
                  <textarea spellCheck value={editSteps} onChange={(e) => setEditSteps(e.target.value)} rows={4} className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-500" />
                ) : issue.steps_to_reproduce ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{issue.steps_to_reproduce}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm italic text-surface-400">Not provided</p>
                )}
              </Section>
              <Section title="Expected Behavior" editing={editing}>
                {editing ? (
                  <textarea spellCheck value={editExpected} onChange={(e) => setEditExpected(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-500" />
                ) : issue.expected_behavior ? (
                  <p className="text-sm dark:text-surface-300">{issue.expected_behavior}</p>
                ) : (
                  <p className="text-sm italic text-surface-400">Not provided</p>
                )}
              </Section>
              <Section title="Actual Behavior" editing={editing}>
                {editing ? (
                  <textarea spellCheck value={editActual} onChange={(e) => setEditActual(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-500" />
                ) : issue.actual_behavior ? (
                  <p className="text-sm dark:text-surface-300">{issue.actual_behavior}</p>
                ) : (
                  <p className="text-sm italic text-surface-400">Not provided</p>
                )}
              </Section>
              <Section title="Environment" editing={editing}>
                {editing ? (
                  <input type="text" value={editEnvironment} onChange={(e) => setEditEnvironment(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-500" />
                ) : issue.environment ? (
                  <p className="text-sm dark:text-surface-300 font-mono">{issue.environment}</p>
                ) : (
                  <p className="text-sm italic text-surface-400">Not provided</p>
                )}
              </Section>
            </>
          )}

          {/* Feature-specific fields */}
          {issue.type === "feature" && (
            <>
              <Section title="Use Case" editing={editing}>
                {editing ? (
                  <textarea spellCheck value={editUseCase} onChange={(e) => setEditUseCase(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-500" />
                ) : issue.use_case ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{issue.use_case}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm italic text-surface-400">Not provided</p>
                )}
              </Section>
              <Section title="Acceptance Criteria" editing={editing}>
                {editing ? (
                  <textarea spellCheck value={editAcceptance} onChange={(e) => setEditAcceptance(e.target.value)} rows={4} className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-500" />
                ) : issue.acceptance_criteria ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{issue.acceptance_criteria}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm italic text-surface-400">Not provided</p>
                )}
              </Section>
              <Section title="Roadmap Quarter" editing={editing}>
                {editing ? (
                  <select value={editRoadmap} onChange={(e) => setEditRoadmap(e.target.value)} className="px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-500">
                    <option value="">None</option>
                    {quarters.map((q) => <option key={q} value={q}>{q}</option>)}
                  </select>
                ) : (
                  <p className="text-sm dark:text-surface-300">{issue.roadmap_quarter || "Not assigned"}</p>
                )}
              </Section>
            </>
          )}

          {/* Metadata sidebar */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-surface-50 dark:bg-surface-800 rounded-xl">
            <div>
              <p className="text-xs text-surface-400 mb-0.5">Created by</p>
              <p className="text-xs dark:text-surface-300 font-medium">
                {issue.created_by?.display_name || "anon"}
                {issue.created_by?.provider && issue.created_by.provider !== "anon" && (
                  <span className="ml-1 text-surface-400 capitalize">({issue.created_by.provider})</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-surface-400 mb-0.5">Tags</p>
              {editing ? (
                <div>
                  <div className="flex flex-wrap gap-1 mb-1.5">
                    {editTags.map((t) => (
                      <span key={t} className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 bg-accent-600/10 text-accent-500 rounded-full font-medium">
                        {t}
                        <button onClick={() => setEditTags(editTags.filter((tag) => tag !== t))} className="hover:text-accent-300"><IoClose className="w-3 h-3" /></button>
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
                      className="w-full px-2 py-1 rounded-md border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-700 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-accent-500"
                    />
                    {showTagSuggestions && tagInput && filteredTagSuggestions.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-lg shadow-lg z-10 max-h-32 overflow-y-auto">
                        {filteredTagSuggestions.map((tag) => (
                          <button key={tag} onMouseDown={() => addTag(tag)} className="block w-full text-left px-3 py-1.5 text-xs hover:bg-surface-100 dark:hover:bg-surface-600 dark:text-white">
                            {tag}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {issue.tags.length > 0 ? issue.tags.map((t) => (
                    <span key={t} className="text-xs px-2 py-0.5 bg-surface-200 dark:bg-surface-700 rounded dark:text-surface-300">{t}</span>
                  )) : <span className="text-xs text-surface-400">None</span>}
                </div>
              )}
            </div>
            <div>
              <p className="text-xs text-surface-400 mb-0.5">Linked Files</p>
              {issue.linked_files.length > 0 ? issue.linked_files.map((f) => (
                <p key={f} className="text-xs font-mono text-accent-500">{f}</p>
              )) : <span className="text-xs text-surface-400">None</span>}
            </div>
            <div>
              <p className="text-xs text-surface-400 mb-0.5">Created</p>
              <p className="text-xs dark:text-surface-300">{formatDate(issue.created_at)}</p>
            </div>
            <div>
              <p className="text-xs text-surface-400 mb-0.5">Updated</p>
              <p className="text-xs dark:text-surface-300">{formatDate(issue.updated_at)}</p>
            </div>
            {issue.time_estimate_hours != null && (
              <div>
                <p className="text-xs text-surface-400 mb-0.5">Estimate</p>
                <p className="text-xs dark:text-surface-300">{issue.time_estimate_hours}h</p>
              </div>
            )}
            {issue.time_spent_hours != null && (
              <div>
                <p className="text-xs text-surface-400 mb-0.5">Time Spent</p>
                <p className="text-xs dark:text-surface-300">{issue.time_spent_hours}h</p>
              </div>
            )}
          </div>

          {/* Attachments */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">
                Attachments ({(issue.attachments || []).length})
              </h3>
              {activeProject?.storage_format === "directory" ? (
                <button
                  onClick={handleAttachFiles}
                  className="text-xs text-accent-500 hover:text-accent-400 font-medium flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  Attach File
                </button>
              ) : null}
            </div>
            {activeProject?.storage_format !== "directory" ? (
              <p className="text-xs text-surface-400 italic">Upgrade to directory format to attach files</p>
            ) : (issue.attachments || []).length === 0 ? (
              <p className="text-xs text-surface-400">No attachments</p>
            ) : (
              <div className="space-y-2">
                {(issue.attachments || []).map((att) => (
                  <div key={att.id} className="p-2 bg-surface-50 dark:bg-surface-800/50 rounded-lg">
                    <AttachmentThumbnail
                      issueId={issue.id}
                      attachment={att}
                      onClick={() => handlePreviewAttachment(att)}
                    />
                    <div className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-surface-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      <button
                        onClick={() => handlePreviewAttachment(att)}
                        className="text-xs text-accent-500 hover:text-accent-400 font-medium truncate"
                        title={att.filename}
                      >
                        {att.filename}
                      </button>
                      <span className="text-xs text-surface-400 shrink-0">{formatFileSize(att.size_bytes)}</span>
                      <div className="ml-auto shrink-0">
                        {attachDelConfirm === att.id ? (
                          <span className="flex items-center gap-1">
                            <button
                              onClick={() => setAttachDelConfirm(null)}
                              className="text-xs text-surface-400 hover:text-surface-600"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleRemoveAttachment(att.id)}
                              className="text-xs text-red-500 hover:text-red-400 font-medium"
                            >
                              Remove
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setAttachDelConfirm(att.id)}
                            className="p-0.5 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-400 hover:text-red-500 transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Comments */}
          <div>
            <h3 className="text-sm font-semibold text-surface-400 uppercase tracking-wider mb-3">
              Comments ({issue.comments.length})
            </h3>
            <div className="space-y-3 mb-4">
              {issue.comments.map((comment) => (
                <div key={comment.id} className="p-3 bg-surface-50 dark:bg-surface-800/50 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-surface-400">{comment.id}</span>
                      <span className="text-xs font-medium dark:text-surface-300">{comment.created_by?.display_name || "anon"}</span>
                    </div>
                    <span className="text-xs text-surface-400">{formatDate(comment.created_at)}</span>
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{comment.text}</ReactMarkdown>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <textarea
                spellCheck
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                rows={2}
                className="flex-1 px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-500 resize-none"
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleAddComment();
                }}
              />
              <button
                onClick={handleAddComment}
                disabled={!newComment.trim()}
                className="px-4 py-2 bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-all self-end"
              >
                Add
              </button>
            </div>
          </div>

          {/* History timeline */}
          {issue.history && issue.history.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-surface-400 uppercase tracking-wider mb-3">
                History ({issue.history.length})
              </h3>
              <div className="space-y-2">
                {issue.history.map((entry, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-surface-400 mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium dark:text-surface-300">
                        {entry.user.display_name}
                      </span>{" "}
                      <span className="text-surface-400">
                        {entry.action === "created" && "created this issue"}
                        {entry.action === "status_changed" && (
                          <>changed status from <span className="font-medium text-surface-500 dark:text-surface-300">{entry.from}</span> to <span className="font-medium text-surface-500 dark:text-surface-300">{entry.to}</span></>
                        )}
                        {entry.action === "comment_added" && "added a comment"}
                        {entry.action === "attachment_added" && (
                          <>attached <span className="font-medium text-surface-500 dark:text-surface-300">{entry.to}</span></>
                        )}
                        {entry.action === "attachment_removed" && (
                          <>removed attachment <span className="font-medium text-surface-500 dark:text-surface-300">{entry.from}</span></>
                        )}
                      </span>
                    </div>
                    <span className="text-surface-400 shrink-0">
                      {formatDate(entry.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Danger zone */}
          <div className="pt-4 border-t border-surface-200 dark:border-surface-800">
            {showDeleteConfirm ? (
              <div className="flex items-center gap-3 p-3 bg-red-500/10 rounded-lg">
                <p className="text-sm text-red-500 flex-1">Are you sure? This cannot be undone.</p>
                <button onClick={() => setShowDeleteConfirm(false)} className="text-sm text-surface-400 hover:text-surface-600">Cancel</button>
                <button onClick={handleDelete} className="text-sm bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700">Delete</button>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="text-sm text-red-500 hover:text-red-400 font-medium"
              >
                Delete Issue
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Image Lightbox */}
      {lightboxAttachment && lightboxUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-backdrop-in"
          onClick={() => { setLightboxAttachment(null); setLightboxUrl(null); }}
        >
          <div className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            {/* Close button */}
            <button
              onClick={() => { setLightboxAttachment(null); setLightboxUrl(null); }}
              className="absolute -top-10 right-0 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={lightboxUrl}
              alt={lightboxAttachment.filename}
              className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain"
            />
            <div className="mt-3 flex items-center gap-3">
              <p className="text-sm text-white/80">{lightboxAttachment.filename}</p>
              <span className="text-xs text-white/50">{formatFileSize(lightboxAttachment.size_bytes)}</span>
              <button
                onClick={() => handleOpenAttachment(lightboxAttachment.id)}
                className="text-xs text-accent-400 hover:text-accent-300 font-medium"
              >
                Open in System App
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Section({ title, editing, children }: { title: string; editing: boolean; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div>
      <button
        onClick={() => !editing && setCollapsed(!collapsed)}
        className="flex items-center gap-1 text-sm font-semibold text-surface-400 uppercase tracking-wider mb-2"
      >
        {!editing && (
          <svg className={`w-3 h-3 transition-transform ${collapsed ? "" : "rotate-90"}`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" />
          </svg>
        )}
        {title}
      </button>
      {!collapsed && children}
    </div>
  );
}
