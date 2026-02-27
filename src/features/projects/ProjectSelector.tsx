import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "@/lib/store";
import * as api from "@/lib/api";
import type { ProjectInfo } from "@/lib/types";
import { Modal } from "@/shared/components/Modal";

export function ProjectSelector() {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [selectedPath, setSelectedPath] = useState("");
  const setActiveProject = useAppStore((s) => s.setActiveProject);
  const addToast = useAppStore((s) => s.addToast);
  const navigate = useNavigate();

  const loadProjects = async () => {
    try {
      const list = await api.listRecentProjects();
      setProjects(list);
    } catch {
      // No projects yet
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleOpenProject = async (path: string) => {
    try {
      const data = await api.openProject(path);
      setActiveProject(data, path);
      navigate("/issues");
    } catch (e: any) {
      addToast({ type: "error", message: `Failed to open project: ${e}` });
    }
  };

  const handleBrowse = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Project Directory",
      });
      if (selected && typeof selected === "string") {
        // Check if repotrack.json exists
        try {
          const data = await api.openProject(selected);
          setActiveProject(data, selected);
          navigate("/issues");
        } catch {
          // No repotrack.json, prompt to create
          setSelectedPath(selected);
          const dirName = selected.split("/").pop() || selected.split("\\").pop() || "My Project";
          setNewProjectName(dirName);
          setShowNewProject(true);
        }
      }
    } catch (e: any) {
      addToast({ type: "error", message: `Failed to browse: ${e}` });
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim() || !selectedPath) return;
    try {
      const data = await api.createProject(selectedPath, newProjectName.trim());
      setActiveProject(data, selectedPath);
      setShowNewProject(false);
      navigate("/issues");
      addToast({ type: "success", message: "Project created successfully" });
    } catch (e: any) {
      addToast({ type: "error", message: `Failed to create project: ${e}` });
    }
  };

  const handleRemoveProject = async (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.removeProject(path);
      setProjects((prev) => prev.filter((p) => p.path !== path));
      addToast({ type: "info", message: "Project removed" });
    } catch (err: any) {
      addToast({ type: "error", message: `Failed to remove: ${err}` });
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="max-w-3xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-accent-600 rounded-2xl mb-6 shadow-lg shadow-accent-600/25">
            <svg className="w-9 h-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold dark:text-white mb-3">RepoTrack</h1>
          <p className="text-surface-500 dark:text-surface-400 text-lg">
            File-backed issue &amp; feature tracking that lives in your repo
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex justify-center gap-4 mb-10">
          <button
            onClick={handleBrowse}
            className="flex items-center gap-2 px-6 py-3 bg-accent-600 hover:bg-accent-700 text-white rounded-xl font-medium shadow-lg shadow-accent-600/25 transition-all active:scale-[0.98]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            Open Project
          </button>
        </div>

        {/* Recent Projects */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl animate-shimmer bg-surface-200 dark:bg-surface-800" />
            ))}
          </div>
        ) : projects.length > 0 ? (
          <div>
            <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wider mb-4">
              Recent Projects
            </h2>
            <div className="space-y-2">
              {projects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => project.exists && handleOpenProject(project.path)}
                  className={`group flex items-center justify-between p-4 rounded-xl border transition-all ${
                    project.exists
                      ? "border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 hover:border-accent-500/50 hover:shadow-lg hover:shadow-accent-600/5 cursor-pointer"
                      : "border-red-500/20 bg-red-500/5 opacity-60"
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-accent-600/10 dark:bg-accent-600/20 flex items-center justify-center shrink-0">
                      <svg className="w-5 h-5 text-accent-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold dark:text-white truncate">{project.name}</p>
                        {!project.exists && (
                          <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">Missing</span>
                        )}
                      </div>
                      <p className="text-sm text-surface-400 truncate">{project.path}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {project.exists && project.open_issues > 0 && (
                      <span className="text-xs font-medium bg-accent-600/10 text-accent-500 px-2.5 py-1 rounded-full">
                        {project.open_issues} open
                      </span>
                    )}
                    <button
                      onClick={(e) => handleRemoveProject(project.path, e)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-surface-400 hover:text-red-500 transition-all"
                      title="Remove project"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center text-surface-400 py-12">
            <p className="text-lg mb-2">No projects yet</p>
            <p className="text-sm">Click "Open Project" to get started</p>
          </div>
        )}
      </div>

      {/* New Project Modal */}
      <Modal
        open={showNewProject}
        onClose={() => setShowNewProject(false)}
        title="Initialize New Project"
      >
        <div className="space-y-4">
          <p className="text-sm text-surface-500 dark:text-surface-400">
            No <code className="bg-surface-100 dark:bg-surface-800 px-1.5 py-0.5 rounded text-xs">repotrack.json</code> found.
            Create one to start tracking issues.
          </p>
          <div>
            <label className="block text-sm font-medium dark:text-surface-300 mb-1">
              Project Name
            </label>
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
              className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-accent-500"
              autoFocus
            />
          </div>
          <p className="text-xs text-surface-400">
            Path: {selectedPath}
          </p>
          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={() => setShowNewProject(false)}
              className="px-4 py-2 text-sm font-medium text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateProject}
              className="px-4 py-2 text-sm font-medium bg-accent-600 hover:bg-accent-700 text-white rounded-lg transition-colors"
            >
              Create Project
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
