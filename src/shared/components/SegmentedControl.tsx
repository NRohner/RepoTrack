import { useRef, useLayoutEffect, useState, type ReactNode } from "react";

interface SegmentedControlOption<T extends string> {
  key: T;
  label: string;
  icon?: ReactNode;
  badge?: string | number;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  variant?: "neutral" | "accent";
  size?: "sm" | "md";
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  variant = "neutral",
  size = "sm",
}: SegmentedControlProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef<Map<T, HTMLButtonElement>>(new Map());
  const [pillStyle, setPillStyle] = useState<{ left: number; width: number }>({
    left: 0,
    width: 0,
  });
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const btn = buttonRefs.current.get(value);
    const container = containerRef.current;
    if (btn && container) {
      const containerRect = container.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();
      setPillStyle({
        left: btnRect.left - containerRect.left,
        width: btnRect.width,
      });
      if (!ready) setReady(true);
    }
  }, [value, options.length]);

  const isNeutral = variant === "neutral";
  const pad = size === "sm" ? "px-3 py-1.5" : "px-4 py-2";
  const textSize = size === "sm" ? "text-xs" : "text-sm";

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex w-fit rounded-lg ${
        isNeutral
          ? "bg-surface-100 dark:bg-surface-800 p-0.5"
          : "p-0.5"
      }`}
    >
      {/* Sliding pill */}
      <div
        className={`absolute top-0.5 bottom-0.5 rounded-md ${
          ready ? "transition-all duration-200 ease-out" : ""
        } ${
          isNeutral
            ? "bg-white dark:bg-surface-700 shadow-sm"
            : "bg-accent-600/10 dark:bg-accent-500/15"
        }`}
        style={{
          left: pillStyle.left,
          width: pillStyle.width,
          opacity: ready ? 1 : 0,
        }}
      />

      {options.map((opt) => {
        const isActive = opt.key === value;
        return (
          <button
            key={opt.key}
            ref={(el) => {
              if (el) buttonRefs.current.set(opt.key, el);
              else buttonRefs.current.delete(opt.key);
            }}
            onClick={() => onChange(opt.key)}
            className={`relative z-10 flex items-center justify-center gap-1.5 ${pad} rounded-md ${textSize} font-medium transition-colors ${
              isActive
                ? isNeutral
                  ? "dark:text-white"
                  : "text-accent-600 dark:text-accent-400"
                : "text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
            }`}
          >
            {opt.icon}
            {opt.label}
            {opt.badge != null && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full ${
                  isActive && !isNeutral
                    ? "bg-accent-600/15 text-accent-600 dark:text-accent-400"
                    : "bg-surface-200 dark:bg-surface-700 text-surface-500"
                }`}
              >
                {opt.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
