import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import * as api from "@/lib/api";
import type { UserPreferences } from "@/lib/types";
import { Modal } from "@/shared/components/Modal";

export function Settings() {
  const { theme, setTheme, activeProject, activeProjectPath, addToast } = useAppStore();
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [projectName, setProjectName] = useState(activeProject?.project_name || "");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    api.getPreferences().then(setPrefs).catch(console.error);
  }, []);

  const handleThemeChange = async (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    if (prefs) {
      const updated = { ...prefs, theme: newTheme };
      setPrefs(updated);
      await api.updatePreferences(updated);
    }
  };

  const handlePrefsChange = async (key: keyof UserPreferences, value: string) => {
    if (!prefs) return;
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    try {
      await api.updatePreferences(updated);
      addToast({ type: "success", message: "Preferences saved" });
    } catch (e: any) {
      addToast({ type: "error", message: e.toString() });
    }
  };

  const handleRenameProject = async () => {
    if (!projectName.trim()) return;
    try {
      await api.updateProjectName(projectName.trim());
      addToast({ type: "success", message: "Project renamed" });
    } catch (e: any) {
      addToast({ type: "error", message: e.toString() });
    }
  };

  const handleExportCsv = async () => {
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const path = await save({
        title: "Export CSV",
        filters: [{ name: "CSV", extensions: ["csv"] }],
        defaultPath: "issues.csv",
      });
      if (path) {
        await api.exportCsv(path);
        addToast({ type: "success", message: "Exported to CSV" });
      }
    } catch (e: any) {
      addToast({ type: "error", message: e.toString() });
    }
  };

  const handleExportMarkdown = async () => {
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const path = await save({
        title: "Export Markdown",
        filters: [{ name: "Markdown", extensions: ["md"] }],
        defaultPath: "issues.md",
      });
      if (path) {
        await api.exportMarkdown(path);
        addToast({ type: "success", message: "Exported to Markdown" });
      }
    } catch (e: any) {
      addToast({ type: "error", message: e.toString() });
    }
  };

  const handleDeleteAll = async (type?: string) => {
    try {
      await api.deleteAllIssues(type);
      addToast({ type: "success", message: "Issues deleted" });
      setShowDeleteConfirm(null);
      // Reload issues
      const data = await api.reloadProject();
      useAppStore.getState().setActiveProject(data, activeProjectPath);
    } catch (e: any) {
      addToast({ type: "error", message: e.toString() });
    }
  };

  const copyPath = () => {
    if (activeProjectPath) {
      navigator.clipboard.writeText(activeProjectPath);
      addToast({ type: "info", message: "Path copied to clipboard" });
    }
  };

  return (
    <div className="h-full overflow-auto">
      <div className="px-6 py-4 border-b border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900">
        <h1 className="text-xl font-bold dark:text-white">Settings</h1>
      </div>

      <div className="p-6 max-w-3xl space-y-8">
        {/* Theme */}
        <SettingsSection title="Appearance" description="Customize the look and feel">
          <div className="flex gap-3">
            {(["light", "dark", "system"] as const).map((t) => (
              <button
                key={t}
                onClick={() => handleThemeChange(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${
                  theme === t
                    ? "bg-accent-600 text-white shadow-md"
                    : "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </SettingsSection>

        {/* Default View */}
        <SettingsSection title="Default View" description="Set the default tab and layout when opening a project">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium dark:text-surface-300 mb-1">Default Tab</label>
              <select
                value={prefs?.default_view || "all"}
                onChange={(e) => handlePrefsChange("default_view", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 dark:text-white text-sm"
              >
                <option value="all">All</option>
                <option value="bug">Bugs</option>
                <option value="feature">Features</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium dark:text-surface-300 mb-1">Default Layout</label>
              <select
                value={prefs?.default_layout || "table"}
                onChange={(e) => handlePrefsChange("default_layout", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 dark:text-white text-sm"
              >
                <option value="table">Table</option>
                <option value="kanban">Kanban</option>
              </select>
            </div>
          </div>
        </SettingsSection>

        {/* Project Settings */}
        <SettingsSection title="Project" description="Manage the current project">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium dark:text-surface-300 mb-1">Project Name</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 dark:text-white text-sm"
                />
                <button
                  onClick={handleRenameProject}
                  className="px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium dark:text-surface-300 mb-1">Project Path</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-surface-100 dark:bg-surface-800 rounded-lg text-sm text-surface-500 dark:text-surface-400 font-mono truncate">
                  {activeProjectPath}
                </code>
                <button
                  onClick={copyPath}
                  className="px-3 py-2 bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 rounded-lg text-sm transition-colors dark:text-white"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </SettingsSection>

        {/* Export */}
        <SettingsSection title="Export" description="Export your issues to other formats">
          <div className="flex gap-3">
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-2 px-4 py-2 bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 rounded-lg text-sm font-medium transition-colors dark:text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
            <button
              onClick={handleExportMarkdown}
              className="flex items-center gap-2 px-4 py-2 bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 rounded-lg text-sm font-medium transition-colors dark:text-white"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export Markdown
            </button>
          </div>
        </SettingsSection>

        {/* Danger Zone */}
        <SettingsSection title="Danger Zone" description="Destructive actions that cannot be undone" danger>
          <div className="space-y-3">
            <button
              onClick={() => setShowDeleteConfirm("all")}
              className="px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg text-sm font-medium transition-colors"
            >
              Delete All Issues
            </button>
            <button
              onClick={() => setShowDeleteConfirm("bug")}
              className="px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg text-sm font-medium transition-colors ml-3"
            >
              Delete All Bugs
            </button>
            <button
              onClick={() => setShowDeleteConfirm("feature")}
              className="px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg text-sm font-medium transition-colors ml-3"
            >
              Delete All Features
            </button>
          </div>
        </SettingsSection>
      </div>

      {/* Delete confirmation modal */}
      <Modal
        open={showDeleteConfirm !== null}
        onClose={() => setShowDeleteConfirm(null)}
        title="Confirm Deletion"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm dark:text-surface-300">
            Are you sure you want to delete{" "}
            {showDeleteConfirm === "all"
              ? "all issues"
              : showDeleteConfirm === "bug"
              ? "all bugs"
              : "all feature requests"}
            ? This action cannot be undone (but git history will preserve them).
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowDeleteConfirm(null)}
              className="px-4 py-2 text-sm font-medium text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => handleDeleteAll(showDeleteConfirm === "all" ? undefined : showDeleteConfirm || undefined)}
              className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function SettingsSection({
  title,
  description,
  children,
  danger,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div className={`p-6 rounded-xl border ${
      danger
        ? "border-red-500/20 bg-red-500/5"
        : "border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900"
    }`}>
      <h2 className={`text-lg font-semibold mb-1 ${danger ? "text-red-500" : "dark:text-white"}`}>{title}</h2>
      <p className="text-sm text-surface-400 mb-4">{description}</p>
      {children}
    </div>
  );
}
