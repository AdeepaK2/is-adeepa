"use client";

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { VisualId } from "@/types/study";

/**
 * Visuals are code-split: a study page only downloads the three.js scenes it
 * actually renders, and none of them run during server rendering.
 */
const VolumeGrid = dynamic(
  () => import("./volume-grid").then((m) => m.VolumeGrid),
  { ssr: false, loading: () => <VisualSkeleton /> },
);

const TwoStreamFlow = dynamic(
  () => import("./two-stream-flow").then((m) => m.TwoStreamFlow),
  { ssr: false, loading: () => <VisualSkeleton /> },
);

const SequenceTimeline = dynamic(
  () => import("./sequence-timeline").then((m) => m.SequenceTimeline),
  { ssr: false, loading: () => <VisualSkeleton /> },
);

const ResnetStack = dynamic(
  () => import("./resnet-stack").then((m) => m.ResnetStack),
  { ssr: false, loading: () => <VisualSkeleton /> },
);

/**
 * Visuals are addressed by id and configured with a free-form options bag, so
 * the registry has to erase their individual prop types. Each visual validates
 * its own options through its exported props interface.
 */
export type VisualComponent = ComponentType<Record<string, unknown>>;

/**
 * Registered visuals, keyed by the `kind` used in a study module's concept.
 *
 * Partial by design -- ids declared in `VisualId` but not yet built fall back to
 * a placeholder, so a module can be written before its visual exists.
 */
export const visualRegistry: Partial<Record<VisualId, VisualComponent>> = {
  "volume-grid": VolumeGrid as VisualComponent,
  "two-stream-flow": TwoStreamFlow as VisualComponent,
  "sequence-timeline": SequenceTimeline as VisualComponent,
  "resnet-stack": ResnetStack as VisualComponent,
};

export function VisualSkeleton() {
  return (
    <div className="bg-panel/60 grid h-full w-full place-items-center">
      <span className="eyebrow animate-pulse">loading visual</span>
    </div>
  );
}

export function MissingVisual({ kind }: { kind: string }) {
  return (
    <div className="bg-panel/60 grid h-full w-full place-items-center px-6 text-center">
      <div>
        <p className="eyebrow">visual not built yet</p>
        <p className="text-ink-faint mt-2 font-mono text-xs">{kind}</p>
      </div>
    </div>
  );
}
