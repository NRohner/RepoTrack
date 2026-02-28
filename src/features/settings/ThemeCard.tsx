import type { ColorTheme } from "@/lib/types";

const PREVIEW_SHADES = ["200", "400", "500", "600", "800"];

interface ThemeCardProps {
  theme: ColorTheme;
  isActive: boolean;
  onSelect: () => void;
  onDelete?: () => void;
}

export function ThemeCard({ theme, isActive, onSelect, onDelete }: ThemeCardProps) {
  return (
    <button
      onClick={onSelect}
      className={`relative w-full text-left p-4 rounded-xl border-2 transition-all ${
        isActive
          ? "border-accent-500 ring-2 ring-accent-500/30"
          : "border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600"
      } bg-white dark:bg-surface-900`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium dark:text-white truncate pr-2">
          {theme.name}
        </span>
        <div className="flex items-center gap-2">
          {theme.is_builtin && (
            <span className="text-[10px] uppercase tracking-wider text-surface-400 font-medium">
              Built-in
            </span>
          )}
          {!theme.is_builtin && onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-1 rounded-md text-surface-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
              title="Delete theme"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </button>
          )}
          {isActive && (
            <div className="w-5 h-5 rounded-full bg-accent-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Accent swatches */}
      <div className="flex gap-1 mb-1.5">
        {PREVIEW_SHADES.map((shade) => (
          <div
            key={`accent-${shade}`}
            className="h-5 flex-1 rounded-sm first:rounded-l-md last:rounded-r-md"
            style={{ backgroundColor: theme.accent_palette[shade] }}
          />
        ))}
      </div>

      {/* Surface swatches */}
      <div className="flex gap-1">
        {PREVIEW_SHADES.map((shade) => (
          <div
            key={`surface-${shade}`}
            className="h-5 flex-1 rounded-sm first:rounded-l-md last:rounded-r-md"
            style={{ backgroundColor: theme.surface_palette[shade] }}
          />
        ))}
      </div>

    </button>
  );
}
