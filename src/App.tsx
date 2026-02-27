import { useEffect } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useAppStore } from "./lib/store";
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
