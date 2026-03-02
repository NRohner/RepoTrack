import { useEffect } from "react";
import { useAppStore } from "./store";
import * as api from "./api";

const POLL_INTERVAL = 30_000;

export function useGitStatusPolling() {
  const activeProject = useAppStore((s) => s.activeProject);
  const setGitHasChanges = useAppStore((s) => s.setGitHasChanges);

  useEffect(() => {
    if (!activeProject) {
      setGitHasChanges(false);
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const s = await api.gitGetStatus();
        if (!cancelled) {
          setGitHasChanges(
            s.is_git_repo &&
              (s.repotrack_has_changes || s.unpushed_hashes.length > 0)
          );
        }
      } catch {
        // Silently ignore polling errors
      }
    };

    poll();
    const id = setInterval(poll, POLL_INTERVAL);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [activeProject, setGitHasChanges]);
}
