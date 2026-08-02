"use client";

import { useCallback, useMemo, useRef, useState } from "react";

/**
 * Naming the thing under the cursor.
 *
 * The scenes are abstract -- a slab, a lit voxel, a sphere where two lanes meet
 * -- and the caption underneath can only describe the whole picture. Pointing at
 * one part and being told what it is closes the gap between the visual and the
 * note beside it.
 *
 * The label is deliberately plain DOM rather than a billboarded 3D label: it
 * stays legible at every camera angle, inherits the page's type, and cannot end
 * up behind the geometry it describes.
 */

/** Passed down into a scene so its meshes can name themselves. */
export interface SceneHover {
  show: (label: string, event: PointerLike) => void;
  hide: () => void;
}

/** The part of a pointer event this needs -- R3F events carry these too. */
interface PointerLike {
  clientX: number;
  clientY: number;
}

interface HoverState {
  label: string;
  x: number;
  y: number;
  /** Place the label to the left of the cursor, near the frame's right edge. */
  flip: boolean;
}

export function useSceneHover() {
  const frame = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState<HoverState | null>(null);

  const show = useCallback((label: string, event: PointerLike) => {
    const box = frame.current?.getBoundingClientRect();
    if (!box) return;
    const x = event.clientX - box.left;
    setHovered({ label, x, y: event.clientY - box.top, flip: x > box.width - 190 });
  }, []);

  const hide = useCallback(() => setHovered(null), []);

  // `show`/`hide` are stable, so the handle is too -- scenes can hold onto it
  // without their handlers being rebuilt on every hover.
  const hover = useMemo<SceneHover>(() => ({ show, hide }), [show, hide]);

  return { frame, hover, hovered };
}

export function HoverTooltip({ state }: { state: HoverState | null }) {
  if (!state) return null;

  return (
    <div
      aria-hidden
      className="border-line bg-panel text-ink-muted pointer-events-none absolute z-10 max-w-52 rounded-md border px-2 py-1 font-mono text-[11px] leading-snug shadow-sm"
      style={{
        left: state.x,
        top: state.y,
        transform: `translate(${state.flip ? "calc(-100% - 14px)" : "14px"}, -50%)`,
      }}
    >
      {state.label}
    </div>
  );
}

/**
 * Wraps a canvas so the label can be positioned against it.
 *
 * `cursor-crosshair` while something is named is the only affordance the scene
 * gets -- it says "this responds" without adding chrome.
 */
export function HoverFrame({
  frame,
  hovered,
  children,
}: {
  frame: React.RefObject<HTMLDivElement | null>;
  hovered: HoverState | null;
  children: React.ReactNode;
}) {
  return (
    <div
      ref={frame}
      className="relative min-h-0 flex-1"
      style={{ cursor: hovered ? "crosshair" : "grab" }}
    >
      {children}
      <HoverTooltip state={hovered} />
    </div>
  );
}
