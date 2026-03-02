import { useState, useEffect, useCallback } from "react";
import * as api from "@/lib/api";
import { useAppStore } from "@/lib/store";
import type { GitStatus, GitBranch, GitCommitInfo } from "@/lib/types";
import { GitGraph } from "./GitGraph";

export function GitTab() {
  const addToast = useAppStore((s) => s.addToast);

  const [status, setStatus] = useState<GitStatus | null>(null);
  const [branches, setBranches] = useState<GitBranch[]>([]);
  const [commits, setCommits] = useState<GitCommitInfo[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<GitCommitInfo | null>(null);
  const [commitMessage, setCommitMessage] = useState("");
  const [committing, setCommitting] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [s, b, c] = await Promise.all([
        api.gitGetStatus(),
        api.gitGetStatus().then((st) =>
          st.is_git_repo ? api.gitGetBranches() : []
        ),
        api.gitGetStatus().then((st) =>
          st.is_git_repo ? api.gitGetLog(200) : []
        ),
      ]);
      setStatus(s);
      setBranches(b);
      setCommits(c);
    } catch (e: any) {
      addToast({ type: "error", message: `Git error: ${e}` });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  // Better refresh that doesn't duplicate status calls
  const loadData = useCallback(async () => {
    try {
      const s = await api.gitGetStatus();
      setStatus(s);
      if (s.is_git_repo) {
        const [b, c] = await Promise.all([
          api.gitGetBranches(),
          api.gitGetLog(200),
        ]);
        setBranches(b);
        setCommits(c);
      }
    } catch (e: any) {
      addToast({ type: "error", message: `Git error: ${e}` });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCheckout = async (branchName: string) => {
    try {
      await api.gitCheckoutBranch(branchName);
      setShowBranchDropdown(false);
      addToast({ type: "success", message: `Switched to ${branchName}` });
      await loadData();
    } catch (e: any) {
      addToast({ type: "error", message: e.toString() });
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) return;
    setCommitting(true);
    try {
      await api.gitCommitRepotrack(commitMessage.trim());
      setCommitMessage("");
      addToast({ type: "success", message: "Changes committed" });
      await loadData();
    } catch (e: any) {
      addToast({ type: "error", message: e.toString() });
    } finally {
      setCommitting(false);
    }
  };

  const handleCommitAndPush = async () => {
    if (!commitMessage.trim()) return;
    setCommitting(true);
    try {
      await api.gitCommitRepotrack(commitMessage.trim());
      setCommitMessage("");
      addToast({ type: "success", message: "Changes committed" });
      setPushing(true);
      await api.gitPush();
      addToast({ type: "success", message: "Pushed to remote" });
      await loadData();
    } catch (e: any) {
      addToast({ type: "error", message: e.toString() });
    } finally {
      setCommitting(false);
      setPushing(false);
    }
  };

  const handlePush = async () => {
    setPushing(true);
    try {
      await api.gitPush();
      addToast({ type: "success", message: "Pushed to remote" });
    } catch (e: any) {
      addToast({ type: "error", message: e.toString() });
    } finally {
      setPushing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-6 h-6 border-2 border-accent-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Not a git repo
  if (!status?.is_git_repo) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <svg className="w-16 h-16 text-surface-300 dark:text-surface-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="18" cy="18" r="3" strokeWidth={1.5} />
          <circle cx="6" cy="6" r="3" strokeWidth={1.5} />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 9v3a3 3 0 003 3h6" />
        </svg>
        <h2 className="text-xl font-bold dark:text-white">Not a Git Repository</h2>
        <p className="text-surface-400 text-sm text-center max-w-md">
          This project directory is not inside a git repository. Initialize one to track changes to your .repotrack files.
        </p>
      </div>
    );
  }

  const localBranches = branches.filter((b) => !b.is_remote);
  const remoteBranches = branches.filter((b) => b.is_remote);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-surface-200 dark:border-surface-800 flex items-center justify-between shrink-0">
        <h1 className="text-lg font-bold dark:text-white">Git</h1>
        <div className="flex items-center gap-3">
          {/* Branch selector */}
          <div className="relative">
            <button
              onClick={() => setShowBranchDropdown(!showBranchDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-sm dark:text-white hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors"
            >
              <svg className="w-4 h-4 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="18" cy="18" r="3" strokeWidth={1.5} />
                <circle cx="6" cy="6" r="3" strokeWidth={1.5} />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 9v3a3 3 0 003 3h6" />
              </svg>
              {status.current_branch}
              <svg className="w-3 h-3 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showBranchDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowBranchDropdown(false)} />
                <div className="absolute right-0 mt-1 w-72 bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg shadow-xl z-20 max-h-80 overflow-y-auto">
                  {localBranches.length > 0 && (
                    <div>
                      <p className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-surface-400">Local</p>
                      {localBranches.map((b) => (
                        <button
                          key={b.name}
                          onClick={() => handleCheckout(b.name)}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors flex items-center gap-2 ${
                            b.is_current ? "text-accent-500 font-medium" : "dark:text-white"
                          }`}
                        >
                          {b.is_current && (
                            <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                            </svg>
                          )}
                          <span className="truncate">{b.name}</span>
                          <span className="text-xs text-surface-400 truncate ml-auto shrink-0 max-w-[140px]">
                            {b.last_commit_summary}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {remoteBranches.length > 0 && (
                    <div className="border-t border-surface-200 dark:border-surface-700">
                      <p className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-surface-400">Remote</p>
                      {remoteBranches.map((b) => (
                        <button
                          key={b.name}
                          onClick={() => handleCheckout(b.name)}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors dark:text-white flex items-center gap-2"
                        >
                          <span className="truncate">{b.name}</span>
                          <span className="text-xs text-surface-400 truncate ml-auto shrink-0 max-w-[140px]">
                            {b.last_commit_summary}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Refresh button */}
          <button
            onClick={loadData}
            className="p-2 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-400 transition-colors"
            title="Refresh"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>

          {/* Push button */}
          <button
            onClick={handlePush}
            disabled={pushing}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 dark:text-white transition-colors disabled:opacity-50"
          >
            {pushing ? "Pushing..." : "Push"}
          </button>
        </div>
      </div>

      {/* Main content: Graph + Detail */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 flex min-h-0">
          {/* Commit graph */}
          <div className="flex-1 overflow-auto border-r border-surface-200 dark:border-surface-800">
            {commits.length > 0 ? (
              <GitGraph
                commits={commits}
                selectedHash={selectedCommit?.hash ?? null}
                onSelectCommit={setSelectedCommit}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-surface-400 text-sm">
                No commits yet
              </div>
            )}
          </div>

          {/* Commit detail sidebar */}
          {selectedCommit && (
            <div className="w-80 shrink-0 overflow-y-auto p-4 space-y-4 bg-surface-50 dark:bg-surface-900">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">Commit Detail</h3>
                <button
                  onClick={() => setSelectedCommit(null)}
                  className="p-1 rounded hover:bg-surface-200 dark:hover:bg-surface-700 text-surface-400"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div>
                <p className="text-sm font-medium dark:text-white mb-1">{selectedCommit.message}</p>
                <div className="space-y-2 text-xs text-surface-400">
                  <div className="flex justify-between">
                    <span>Hash</span>
                    <span className="font-mono text-accent-500">{selectedCommit.short_hash}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Author</span>
                    <span className="dark:text-surface-300">{selectedCommit.author}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Date</span>
                    <span className="dark:text-surface-300">
                      {new Date(selectedCommit.timestamp * 1000).toLocaleString()}
                    </span>
                  </div>
                  {selectedCommit.is_merge && (
                    <div className="flex justify-between">
                      <span>Type</span>
                      <span className="text-amber-500 font-medium">Merge commit</span>
                    </div>
                  )}
                  {selectedCommit.parent_hashes.length > 0 && (
                    <div>
                      <span className="block mb-1">Parents</span>
                      {selectedCommit.parent_hashes.map((ph) => (
                        <span key={ph} className="block font-mono text-accent-500">{ph.slice(0, 7)}</span>
                      ))}
                    </div>
                  )}
                  {selectedCommit.refs.length > 0 && (
                    <div>
                      <span className="block mb-1">Refs</span>
                      <div className="flex flex-wrap gap-1">
                        {selectedCommit.refs.map((r) => (
                          <span key={r} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent-600/15 text-accent-500">
                            {r}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bottom panel: .repotrack changes + commit form */}
        <div className="shrink-0 border-t border-surface-200 dark:border-surface-800 p-4 space-y-3 bg-white dark:bg-surface-950">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">
              .repotrack Changes
            </h3>
            {status.repotrack_has_changes && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 font-medium">
                {status.changed_files.length} file{status.changed_files.length !== 1 ? "s" : ""} changed
              </span>
            )}
          </div>

          {status.changed_files.length > 0 ? (
            <>
              <div className="max-h-28 overflow-y-auto space-y-1">
                {status.changed_files.map((f) => (
                  <div key={f} className="flex items-center gap-2 text-xs">
                    <span className="px-1 py-0.5 rounded font-mono text-[10px] font-bold bg-amber-500/15 text-amber-500">M</span>
                    <span className="font-mono dark:text-surface-300 truncate">{f}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Commit message..."
                  className="flex-1 px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleCommitAndPush();
                    else if (e.key === "Enter") handleCommit();
                  }}
                />
                <button
                  onClick={handleCommit}
                  disabled={committing || !commitMessage.trim()}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 dark:text-white transition-colors disabled:opacity-50"
                >
                  {committing ? "..." : "Commit"}
                </button>
                <button
                  onClick={handleCommitAndPush}
                  disabled={committing || pushing || !commitMessage.trim()}
                  className="px-4 py-2 bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-all"
                >
                  {committing || pushing ? "..." : "Commit & Push"}
                </button>
              </div>
            </>
          ) : (
            <p className="text-xs text-surface-400">No .repotrack changes to commit</p>
          )}
        </div>
      </div>
    </div>
  );
}
