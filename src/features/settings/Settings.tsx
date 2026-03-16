import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import * as api from "@/lib/api";
import type { UserPreferences, ColorTheme } from "@/lib/types";
import { applyColorTheme, resetColorTheme } from "@/lib/theme";
import { Modal } from "@/shared/components/Modal";
import { SegmentedControl } from "@/shared/components/SegmentedControl";
import { ThemeCard } from "./ThemeCard";
import { ThemeBuilderModal } from "./ThemeBuilderModal";

export function Settings() {
  const { theme, setTheme, activeProject, activeProjectPath, addToast, activeColorTheme, setActiveColorTheme, currentUser, setCurrentUser } = useAppStore();
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [projectName, setProjectName] = useState(activeProject?.project_name || "");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [colorThemes, setColorThemes] = useState<ColorTheme[]>([]);
  const [showBuilderModal, setShowBuilderModal] = useState(false);
  const [signingIn, setSigningIn] = useState<string | null>(null);

  useEffect(() => {
    api.getPreferences().then(setPrefs).catch(console.error);
    api.listColorThemes().then(setColorThemes).catch(console.error);
  }, []);

  const handleSelectColorTheme = async (selected: ColorTheme) => {
    try {
      applyColorTheme(selected);
      setActiveColorTheme(selected);
      if (prefs) {
        const updated = { ...prefs, selected_color_theme: selected.id };
        setPrefs(updated);
        await api.updatePreferences(updated);
      }
    } catch (e: any) {
      addToast({ type: "error", message: e.toString() });
    }
  };

  const handleDeleteColorTheme = async (themeToDelete: ColorTheme) => {
    try {
      await api.deleteColorTheme(themeToDelete.id);
      setColorThemes((prev) => prev.filter((t) => t.id !== themeToDelete.id));
      // If the deleted theme was active, reset to default
      if (activeColorTheme?.id === themeToDelete.id) {
        const defaultTheme = colorThemes.find((t) => t.id === "default-indigo");
        if (defaultTheme) {
          applyColorTheme(defaultTheme);
          setActiveColorTheme(defaultTheme);
          if (prefs) {
            const updated = { ...prefs, selected_color_theme: defaultTheme.id };
            setPrefs(updated);
            await api.updatePreferences(updated);
          }
        } else {
          resetColorTheme();
          setActiveColorTheme(null);
        }
      }
      addToast({ type: "success", message: "Theme deleted" });
    } catch (e: any) {
      addToast({ type: "error", message: e.toString() });
    }
  };

  const handleThemeCreated = (newTheme: ColorTheme) => {
    setColorThemes((prev) => [...prev, newTheme]);
    addToast({ type: "success", message: `Theme "${newTheme.name}" created` });
  };

  const handleSignIn = async (provider: string) => {
    setSigningIn(provider);
    try {
      const user = await api.signIn(provider);
      setCurrentUser(user);
      addToast({ type: "success", message: `Signed in as ${user.display_name}` });
    } catch (e: any) {
      addToast({ type: "error", message: `Sign in failed: ${e}` });
    } finally {
      setSigningIn(null);
    }
  };

  const handleSignOut = async () => {
    if (!currentUser) return;
    try {
      await api.signOut(currentUser.provider);
      setCurrentUser(null);
      addToast({ type: "success", message: "Signed out" });
    } catch (e: any) {
      addToast({ type: "error", message: e.toString() });
    }
  };

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
        {/* Account */}
        <SettingsSection title="Account" description="Sign in to attribute issues and comments to your identity">
          {currentUser ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {currentUser.avatar_url ? (
                  <img src={currentUser.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-accent-600/20 flex items-center justify-center text-accent-500 text-lg font-bold">
                    {currentUser.display_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-medium dark:text-white">{currentUser.display_name}</p>
                  <p className="text-sm text-surface-400">@{currentUser.username} <span className="ml-1 px-1.5 py-0.5 bg-surface-100 dark:bg-surface-800 rounded text-xs capitalize">{currentUser.provider}</span></p>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={() => handleSignIn("github")}
                disabled={signingIn !== null}
                className="flex items-center gap-2 px-4 py-2.5 bg-surface-900 dark:bg-white text-white dark:text-surface-900 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                </svg>
                {signingIn === "github" ? "Signing in..." : "Sign in with GitHub"}
              </button>
              <button
                onClick={() => handleSignIn("google")}
                disabled={signingIn !== null}
                className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-surface-800 border border-surface-300 dark:border-surface-600 text-surface-700 dark:text-white rounded-lg text-sm font-medium hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                {signingIn === "google" ? "Signing in..." : "Sign in with Google"}
              </button>
            </div>
          )}
        </SettingsSection>

        {/* Theme */}
        <SettingsSection title="Appearance" description="Customize the look and feel">
          <SegmentedControl
            options={[
              { key: "light" as const, label: "Light" },
              { key: "dark" as const, label: "Dark" },
              { key: "system" as const, label: "System" },
            ]}
            value={theme}
            onChange={handleThemeChange}
          />
        </SettingsSection>

        {/* Color Theme */}
        <SettingsSection title="Color Theme" description="Choose or import a color theme for accents and surfaces">
          <div className="grid grid-cols-2 gap-3">
            {colorThemes.map((ct) => (
              <ThemeCard
                key={ct.id}
                theme={ct}
                isActive={activeColorTheme?.id === ct.id}
                onSelect={() => handleSelectColorTheme(ct)}
                onDelete={ct.is_builtin ? undefined : () => handleDeleteColorTheme(ct)}
              />
            ))}
          </div>
          <button
            onClick={() => setShowBuilderModal(true)}
            className="mt-4 flex items-center gap-2 px-4 py-2 bg-accent-600 hover:bg-accent-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
            Theme Builder
          </button>
        </SettingsSection>

        {/* Code Editor */}
        <SettingsSection title="Code Editor" description="Choose your default code editor for the 'Open in Editor' action">
          <select
            value={prefs?.default_editor || "vscode"}
            onChange={(e) => handlePrefsChange("default_editor", e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 dark:text-white text-sm"
          >
            <option value="vscode">Visual Studio Code</option>
            <option value="cursor">Cursor</option>
            <option value="zed">Zed</option>
            <option value="sublime">Sublime Text</option>
            <option value="webstorm">WebStorm</option>
            <option value="idea">IntelliJ IDEA</option>
            <option value="atom">Atom</option>
            <option value="neovim">Neovim</option>
          </select>
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
          <div className="mt-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs?.show_resolved_issues === "true"}
                onChange={(e) => handlePrefsChange("show_resolved_issues", e.target.checked ? "true" : "false")}
                className="rounded border-surface-300 dark:border-surface-600 text-accent-600 focus:ring-accent-500"
              />
              <span className="text-sm dark:text-surface-300">Show completed and won't-fix issues by default</span>
            </label>
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

      <ThemeBuilderModal
        open={showBuilderModal}
        onClose={() => setShowBuilderModal(false)}
        onCreated={handleThemeCreated}
      />
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
