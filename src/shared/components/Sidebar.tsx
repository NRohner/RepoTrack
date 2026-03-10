import { useRef, useLayoutEffect, useState, useCallback } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAppStore } from "@/lib/store";
import * as api from "@/lib/api";

const navItems = [
  {
    path: "/issues",
    label: "Issues",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
    ),
  },
  {
    path: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    path: "/roadmap",
    label: "Roadmap",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
      </svg>
    ),
  },
  {
    path: "/git",
    label: "Git",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="18" cy="18" r="3" strokeWidth={1.5} />
        <circle cx="6" cy="6" r="3" strokeWidth={1.5} />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 9v3a3 3 0 003 3h6" />
      </svg>
    ),
  },
  {
    path: "/settings",
    label: "Settings",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

export function Sidebar() {
  const activeProject = useAppStore((s) => s.activeProject);
  const setActiveProject = useAppStore((s) => s.setActiveProject);
  const addToast = useAppStore((s) => s.addToast);
  const currentUser = useAppStore((s) => s.currentUser);
  const location = useLocation();
  const navigate = useNavigate();

  const navRef = useRef<HTMLElement>(null);
  const linkRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const [pillStyle, setPillStyle] = useState<{ top: number; height: number }>({ top: 0, height: 0 });
  const [ready, setReady] = useState(false);
  const gitHasChanges = useAppStore((s) => s.gitHasChanges);

  const handleOpenInEditor = async () => {
    try {
      // Fetch fresh preferences each time so changes in Settings take effect immediately
      const prefs = await api.getPreferences();
      const editor = prefs?.default_editor || "vscode";
      await api.openInEditor(editor);
    } catch (e: any) {
      addToast({ type: "error", message: e.toString() });
    }
  };

  const handleOpenInTerminal = async () => {
    try {
      await api.openInTerminal();
    } catch (e: any) {
      addToast({ type: "error", message: e.toString() });
    }
  };
  const activePath = navItems.find((item) => location.pathname.startsWith(item.path))?.path;

  useLayoutEffect(() => {
    if (!activePath) return;
    const link = linkRefs.current.get(activePath);
    const nav = navRef.current;
    if (link && nav) {
      const navRect = nav.getBoundingClientRect();
      const linkRect = link.getBoundingClientRect();
      setPillStyle({
        top: linkRect.top - navRect.top,
        height: linkRect.height,
      });
      if (!ready) setReady(true);
    }
  }, [activePath]);

  const setLinkRef = useCallback((path: string) => (el: HTMLAnchorElement | null) => {
    if (el) linkRefs.current.set(path, el);
    else linkRefs.current.delete(path);
  }, []);

  return (
    <div className="w-56 h-screen flex flex-col bg-white dark:bg-surface-950 border-r border-surface-200 dark:border-surface-800 shrink-0">
      <div className="p-4 border-b border-surface-200 dark:border-surface-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-accent-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <span className="font-bold text-lg dark:text-white">RepoTrack</span>
        </div>
      </div>

      {activeProject && (
        <div className="px-4 py-3 border-b border-surface-200 dark:border-surface-800">
          <p className="text-xs text-surface-400 uppercase tracking-wider font-medium">Project</p>
          <p className="text-sm font-semibold dark:text-white truncate mt-0.5">
            {activeProject.project_name}
          </p>
          <div className="flex items-center gap-1 mt-1.5">
            <button
              onClick={handleOpenInEditor}
              title="Open in Editor"
              className="p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-400 hover:text-accent-500 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </button>
            <button
              onClick={handleOpenInTerminal}
              title="Open in Terminal"
              className="p-1 rounded hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-400 hover:text-accent-500 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              onClick={() => setActiveProject(null, null)}
              className="text-xs text-accent-500 hover:text-accent-400 transition-colors ml-auto"
            >
              Switch
            </button>
          </div>
        </div>
      )}

      <nav ref={navRef} className="relative flex-1 p-2 space-y-0.5 mt-2">
        {/* Sliding pill */}
        {activePath && (
          <div
            className={`absolute left-2 right-2 rounded-lg bg-accent-600/10 ${
              ready ? "transition-all duration-200 ease-out" : ""
            }`}
            style={{
              top: pillStyle.top,
              height: pillStyle.height,
              opacity: ready ? 1 : 0,
            }}
          />
        )}

        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            ref={setLinkRef(item.path)}
            className={({ isActive }) =>
              `relative z-10 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "text-accent-500"
                  : "text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 hover:text-surface-700 dark:hover:text-surface-200"
              }`
            }
          >
            {item.icon}
            {item.label}
            {item.path === "/git" && gitHasChanges && (
              <span className="w-2 h-2 rounded-full bg-amber-500" />
            )}
          </NavLink>
        ))}
      </nav>

      {/* User indicator */}
      <div className="px-4 py-3 border-t border-surface-200 dark:border-surface-800">
        {currentUser ? (
          <div className="flex items-center gap-2">
            {currentUser.avatar_url ? (
              <img src={currentUser.avatar_url} alt="" className="w-7 h-7 rounded-full shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-accent-600/20 flex items-center justify-center text-accent-500 text-xs font-bold shrink-0">
                {currentUser.display_name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-medium dark:text-white truncate">{currentUser.display_name}</p>
              <p className="text-[10px] text-surface-400 capitalize">{currentUser.provider}</p>
            </div>
          </div>
        ) : (
          <button
            onClick={() => navigate("/settings")}
            className="text-xs text-accent-500 hover:text-accent-400 font-medium transition-colors"
          >
            Sign In
          </button>
        )}
      </div>
    </div>
  );
}
