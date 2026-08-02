"use client";

import { cn } from "@/lib/utils";

/**
 * Control primitives shared by the interactive visuals.
 *
 * The house pattern elsewhere is to keep sub-components local to their one
 * consumer, but four visuals need the same chip row, frame-window slider and
 * accuracy readout, so they live together here instead.
 *
 * The readout deliberately has a "not measured" state. These visuals report the
 * accuracies a paper actually published, and a control that moves freely will
 * land on configurations nobody ran -- saying so is the whole point, because an
 * invented number would teach something false.
 */

/** Bar beneath a scene's canvas. Visuals lay themselves out as canvas + this. */
export function ControlRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-line/70 bg-panel/60 flex flex-wrap items-end gap-x-6 gap-y-3 border-t px-4 py-3">
      {children}
    </div>
  );
}

export function ControlGroup({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="eyebrow mb-1.5">{label}</p>
      {children}
    </div>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Shown as a tooltip -- useful for spelling out an abbreviated chip. */
  title?: string;
}

export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  accent,
}: {
  label: string;
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  accent: string;
}) {
  return (
    <ControlGroup label={label}>
      <div role="group" aria-label={label} className="flex flex-wrap gap-1">
        {options.map((option) => {
          const isActive = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              title={option.title}
              aria-pressed={isActive}
              onClick={() => onChange(option.value)}
              className={cn(
                "rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors",
                isActive
                  ? "text-void"
                  : "bg-raised text-ink-muted hover:text-ink",
              )}
              style={isActive ? { background: accent } : undefined}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </ControlGroup>
  );
}

/** A measured window of frames, e.g. the `49-149` row of a results table. */
export interface RangePreset {
  start: number;
  end: number;
}

/**
 * Start/end sliders over a clip's frame axis.
 *
 * Two labelled inputs rather than one overlaid dual-thumb track: it stays
 * keyboard operable and needs no custom pointer handling. Values snap to nearby
 * preset boundaries so the configurations a paper actually measured are easy to
 * land on, while still allowing the gaps between them.
 */
export function RangeWindow({
  label,
  total,
  start,
  end,
  onChange,
  presets = [],
  snapTolerance = 5,
  accent,
}: {
  label: string;
  total: number;
  start: number;
  end: number;
  onChange: (range: RangePreset) => void;
  presets?: RangePreset[];
  snapTolerance?: number;
  accent: string;
}) {
  const boundaries = Array.from(
    new Set(presets.flatMap((preset) => [preset.start, preset.end])),
  );

  const snap = (value: number) => {
    let best = value;
    let bestDistance = snapTolerance;
    for (const boundary of boundaries) {
      const distance = Math.abs(boundary - value);
      if (distance <= bestDistance) {
        best = boundary;
        bestDistance = distance;
      }
    }
    return best;
  };

  // At least one frame of window, so the readout always describes a real clip.
  const setStart = (value: number) => {
    const next = snap(value);
    onChange({ start: Math.min(next, end - 1), end });
  };
  const setEnd = (value: number) => {
    const next = snap(value);
    onChange({ start, end: Math.max(next, start + 1) });
  };

  return (
    <ControlGroup label={label} className="w-full max-w-72 sm:w-64">
      <div className="flex items-center gap-2">
        <input
          type="range"
          aria-label={`${label} start frame`}
          min={0}
          max={total}
          value={start}
          onChange={(event) => setStart(Number(event.target.value))}
          className="min-w-0 flex-1 accent-[var(--range-accent)]"
          style={{ "--range-accent": accent } as React.CSSProperties}
        />
        <span className="text-ink-faint w-16 shrink-0 text-right font-mono text-[11px]">
          {start}&ndash;{end}
        </span>
      </div>
      <input
        type="range"
        aria-label={`${label} end frame`}
        min={0}
        max={total}
        value={end}
        onChange={(event) => setEnd(Number(event.target.value))}
        className="mt-1 w-full accent-[var(--range-accent)]"
        style={{ "--range-accent": accent } as React.CSSProperties}
      />
    </ControlGroup>
  );
}

/**
 * The number a control is there to move.
 *
 * `value` of `undefined` renders the "not measured" state rather than a blank
 * or a guess -- see the note at the top of this file.
 */
export function Readout({
  label,
  value,
  unit = "%",
  delta,
  deltaLabel,
  accent,
  unmeasuredNote = "not measured in the paper",
}: {
  label: string;
  value?: number;
  unit?: string;
  delta?: number;
  deltaLabel?: string;
  accent: string;
  unmeasuredNote?: string;
}) {
  return (
    <ControlGroup label={label} className="ml-auto text-right">
      {value === undefined ? (
        <p className="text-ink-faint font-mono text-xs">{unmeasuredNote}</p>
      ) : (
        <p className="flex items-baseline justify-end gap-2">
          <span
            className="font-mono text-xl tabular-nums"
            style={{ color: accent }}
          >
            {value}
            <span className="text-sm">{unit}</span>
          </span>
          {delta !== undefined && delta !== 0 && (
            <span
              className={cn(
                "font-mono text-[11px] tabular-nums",
                delta > 0 ? "text-signal" : "text-alert",
              )}
            >
              {delta > 0 ? "+" : ""}
              {Number(delta.toFixed(2))}
              {deltaLabel && <span className="text-ink-faint"> {deltaLabel}</span>}
            </span>
          )}
        </p>
      )}
    </ControlGroup>
  );
}

/** Shown in place of a scene when WebGL is unavailable. */
export function WebGLFallback() {
  return (
    <div className="text-ink-faint grid h-full w-full place-items-center px-6 text-center text-xs">
      This visual needs WebGL, which isn&apos;t available in your browser.
    </div>
  );
}
