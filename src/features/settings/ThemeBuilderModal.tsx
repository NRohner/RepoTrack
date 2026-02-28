import { useState, useMemo } from "react";
import { Modal } from "@/shared/components/Modal";
import { SHADES } from "@/lib/theme";
import { generatePalette } from "@/lib/colorUtils";
import * as api from "@/lib/api";
import type { ColorTheme, ColorPalette } from "@/lib/types";

interface ThemeBuilderModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (theme: ColorTheme) => void;
}

function PaletteSection({
  label,
  baseColor,
  onBaseChange,
  palette,
  overrides,
  onOverride,
  onResetOverride,
}: {
  label: string;
  baseColor: string;
  onBaseChange: (hex: string) => void;
  palette: ColorPalette;
  overrides: Partial<ColorPalette>;
  onOverride: (shade: string, hex: string) => void;
  onResetOverride: (shade: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-sm font-medium dark:text-surface-300">{label}</span>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="color"
            value={baseColor}
            onChange={(e) => onBaseChange(e.target.value)}
            className="w-7 h-7 rounded border border-surface-300 dark:border-surface-600 cursor-pointer bg-transparent p-0"
          />
          <span className="text-xs font-mono text-surface-400">{baseColor}</span>
        </label>
      </div>
      <div className="flex gap-0.5">
        {SHADES.map((shade) => {
          const isOverridden = shade in overrides;
          const displayColor = overrides[shade] ?? palette[shade];
          return (
            <label
              key={shade}
              className={`relative group h-10 flex-1 first:rounded-l-lg last:rounded-r-lg cursor-pointer ${
                isOverridden ? "ring-2 ring-accent-500 ring-offset-1 ring-offset-white dark:ring-offset-surface-900" : ""
              }`}
              style={{ backgroundColor: displayColor }}
              title={`${shade}: ${displayColor}`}
            >
              <input
                type="color"
                value={displayColor}
                onChange={(e) => onOverride(shade, e.target.value)}
                className="sr-only"
              />
              <span className="absolute inset-x-0 bottom-0 text-center text-[8px] leading-tight opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 text-white rounded-b-sm">
                {shade}
              </span>
              {isOverridden && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onResetOverride(shade);
                  }}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-surface-700 text-white text-[10px] leading-none flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                  title="Reset to generated value"
                >
                  &times;
                </button>
              )}
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function ThemeBuilderModal({ open, onClose, onCreated }: ThemeBuilderModalProps) {
  const [themeName, setThemeName] = useState("");
  const [accentBase, setAccentBase] = useState("#4f46e5");
  const [surfaceBase, setSurfaceBase] = useState("#64748b");
  const [accentOverrides, setAccentOverrides] = useState<Partial<ColorPalette>>({});
  const [surfaceOverrides, setSurfaceOverrides] = useState<Partial<ColorPalette>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const accentPalette = useMemo(() => generatePalette(accentBase), [accentBase]);
  const surfacePalette = useMemo(() => generatePalette(surfaceBase), [surfaceBase]);

  const reset = () => {
    setThemeName("");
    setAccentBase("#4f46e5");
    setSurfaceBase("#64748b");
    setAccentOverrides({});
    setSurfaceOverrides({});
    setError(null);
    setSaving(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSave = async () => {
    if (!themeName.trim()) {
      setError("Please enter a theme name");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const mergedAccent: ColorPalette = {};
      const mergedSurface: ColorPalette = {};
      for (const shade of SHADES) {
        mergedAccent[shade] = accentOverrides[shade] ?? accentPalette[shade];
        mergedSurface[shade] = surfaceOverrides[shade] ?? surfacePalette[shade];
      }

      const now = new Date().toISOString();
      const theme: ColorTheme = {
        id: crypto.randomUUID(),
        name: themeName.trim(),
        is_builtin: false,
        accent_palette: mergedAccent,
        surface_palette: mergedSurface,
        created_at: now,
        updated_at: now,
      };
      await api.createColorTheme(theme);
      onCreated(theme);
      handleClose();
    } catch (e: any) {
      setError(e.message || "Failed to save theme");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Theme Builder" size="lg">
      <div className="space-y-5">
        {/* Theme name */}
        <div>
          <label className="block text-sm font-medium dark:text-surface-300 mb-1">Theme Name</label>
          <input
            type="text"
            value={themeName}
            onChange={(e) => setThemeName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 dark:text-white text-sm"
            placeholder="My Custom Theme"
          />
        </div>

        {/* Accent palette */}
        <PaletteSection
          label="Accent Palette"
          baseColor={accentBase}
          onBaseChange={setAccentBase}
          palette={accentPalette}
          overrides={accentOverrides}
          onOverride={(shade, hex) =>
            setAccentOverrides((prev) => ({ ...prev, [shade]: hex }))
          }
          onResetOverride={(shade) =>
            setAccentOverrides((prev) => {
              const next = { ...prev };
              delete next[shade];
              return next;
            })
          }
        />

        {/* Surface palette */}
        <PaletteSection
          label="Surface Palette"
          baseColor={surfaceBase}
          onBaseChange={setSurfaceBase}
          palette={surfacePalette}
          overrides={surfaceOverrides}
          onOverride={(shade, hex) =>
            setSurfaceOverrides((prev) => ({ ...prev, [shade]: hex }))
          }
          onResetOverride={(shade) =>
            setSurfaceOverrides((prev) => {
              const next = { ...prev };
              delete next[shade];
              return next;
            })
          }
        />

        {/* Error */}
        {error && (
          <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !themeName.trim()}
            className="px-4 py-2 text-sm font-medium bg-accent-600 hover:bg-accent-700 disabled:opacity-50 text-white rounded-lg transition-colors"
          >
            {saving ? "Saving..." : "Save Theme"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
