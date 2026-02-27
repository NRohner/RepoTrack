import { create } from "zustand";
import type { Issue, RepoTrackFile } from "./types";

interface AppStore {
  theme: "light" | "dark" | "system";
  resolvedTheme: "light" | "dark";
  setTheme: (theme: "light" | "dark" | "system") => void;
  setResolvedTheme: (theme: "light" | "dark") => void;

  activeProject: RepoTrackFile | null;
  activeProjectPath: string | null;
  setActiveProject: (project: RepoTrackFile | null, path: string | null) => void;

  issues: Issue[];
  setIssues: (issues: Issue[]) => void;
  updateIssueInStore: (issue: Issue) => void;
  removeIssueFromStore: (id: string) => void;
  addIssueToStore: (issue: Issue) => void;

  selectedIssueId: string | null;
  setSelectedIssueId: (id: string | null) => void;

  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

export interface Toast {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

let toastCounter = 0;

export const useAppStore = create<AppStore>((set) => ({
  theme: "system",
  resolvedTheme: "dark",
  setTheme: (theme) => set({ theme }),
  setResolvedTheme: (resolvedTheme) => set({ resolvedTheme }),

  activeProject: null,
  activeProjectPath: null,
  setActiveProject: (project, path) =>
    set({
      activeProject: project,
      activeProjectPath: path,
      issues: project?.issues ?? [],
    }),

  issues: [],
  setIssues: (issues) => set({ issues }),
  updateIssueInStore: (issue) =>
    set((state) => ({
      issues: state.issues.map((i) => (i.id === issue.id ? issue : i)),
    })),
  removeIssueFromStore: (id) =>
    set((state) => ({
      issues: state.issues.filter((i) => i.id !== id),
    })),
  addIssueToStore: (issue) =>
    set((state) => ({
      issues: [...state.issues, issue],
    })),

  selectedIssueId: null,
  setSelectedIssueId: (id) => set({ selectedIssueId: id }),

  toasts: [],
  addToast: (toast) =>
    set((state) => {
      const id = `toast-${++toastCounter}`;
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, 4000);
      return { toasts: [...state.toasts, { ...toast, id }] };
    }),
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
