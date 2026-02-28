import { useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { listen } from "@tauri-apps/api/event";
import { useAppStore } from "./lib/store";
import * as api from "./lib/api";
import { Sidebar } from "./shared/components/Sidebar";
import { ToastContainer } from "./shared/components/Toast";
import { ProjectSelector } from "./features/projects/ProjectSelector";
import { IssueBoard } from "./features/issues/IssueBoard";
import { Dashboard } from "./features/dashboard/Dashboard";
import { Roadmap } from "./features/roadmap/Roadmap";
import { Settings } from "./features/settings/Settings";

export default function App() {
  const theme = useAppStore((s) => s.theme);
  const resolvedTheme = useAppStore((s) => s.resolvedTheme);
  const setResolvedTheme = useAppStore((s) => s.setResolvedTheme);
  const activeProject = useAppStore((s) => s.activeProject);
  const navigate = useNavigate();

  useEffect(() => {
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      setResolvedTheme(mq.matches ? "dark" : "light");
      const handler = (e: MediaQueryListEvent) =>
        setResolvedTheme(e.matches ? "dark" : "light");
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    } else {
      setResolvedTheme(theme);
    }
  }, [theme, setResolvedTheme]);

  useEffect(() => {
    document.documentElement.classList.toggle(
      "dark",
      resolvedTheme === "dark"
    );
  }, [resolvedTheme]);

  useEffect(() => {
    const unlistenPromise = listen<string>("menu-event", async (event) => {
      const payload = event.payload;
      const { setActiveProject, addToast } = useAppStore.getState();

      if (payload === "open-project") {
        try {
          const { open } = await import("@tauri-apps/plugin-dialog");
          const selected = await open({
            directory: true,
            multiple: false,
            title: "Select Project Directory",
          });
          if (selected && typeof selected === "string") {
            try {
              const data = await api.openProject(selected);
              setActiveProject(data, selected);
              navigate("/issues");
              await api.updateRecentMenu();
            } catch {
              addToast({
                type: "error",
                message:
                  "No repotrack.json found in the selected directory",
              });
            }
          }
        } catch (e) {
          addToast({
            type: "error",
            message: `Failed to open directory picker: ${e}`,
          });
        }
      } else if (payload.startsWith("open-recent:")) {
        const path = payload.slice("open-recent:".length);
        try {
          const data = await api.openProject(path);
          setActiveProject(data, path);
          navigate("/issues");
          await api.updateRecentMenu();
        } catch (e) {
          addToast({
            type: "error",
            message: `Failed to open project: ${e}`,
          });
        }
      } else if (payload === "export-csv") {
        const state = useAppStore.getState();
        if (!state.activeProject) {
          addToast({
            type: "info",
            message: "Open a project first to export",
          });
          return;
        }
        try {
          const { save } = await import("@tauri-apps/plugin-dialog");
          const savePath = await save({
            title: "Export as CSV",
            filters: [{ name: "CSV", extensions: ["csv"] }],
            defaultPath: `${state.activeProject.project_name}.csv`,
          });
          if (savePath) {
            await api.exportCsv(savePath);
            addToast({ type: "success", message: "Exported as CSV" });
          }
        } catch (e) {
          addToast({
            type: "error",
            message: `Export failed: ${e}`,
          });
        }
      } else if (payload === "export-markdown") {
        const state = useAppStore.getState();
        if (!state.activeProject) {
          addToast({
            type: "info",
            message: "Open a project first to export",
          });
          return;
        }
        try {
          const { save } = await import("@tauri-apps/plugin-dialog");
          const savePath = await save({
            title: "Export as Markdown",
            filters: [{ name: "Markdown", extensions: ["md"] }],
            defaultPath: `${state.activeProject.project_name}.md`,
          });
          if (savePath) {
            await api.exportMarkdown(savePath);
            addToast({
              type: "success",
              message: "Exported as Markdown",
            });
          }
        } catch (e) {
          addToast({
            type: "error",
            message: `Export failed: ${e}`,
          });
        }
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [navigate]);

  if (!activeProject) {
    return (
      <div className="min-h-screen bg-surface-50 dark:bg-surface-950">
        <ProjectSelector />
        <ToastContainer />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-surface-50 dark:bg-surface-950 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/issues" element={<IssueBoard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/roadmap" element={<Roadmap />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/issues" replace />} />
        </Routes>
      </main>
      <ToastContainer />
    </div>
  );
}
