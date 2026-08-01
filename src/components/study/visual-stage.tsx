"use client";

import { MissingVisual, visualRegistry } from "@/components/visuals/registry";
import type { Visual } from "@/types/study";

/**
 * Renders whichever visual a concept declares, framed consistently. Concepts
 * without a visual fall through to `null` so the note stands on its own.
 */
export function VisualStage({ visual }: { visual?: Visual }) {
  if (!visual) return null;

  const Component = visualRegistry[visual.kind];

  return (
    <figure className="border-line bg-void overflow-hidden rounded-[var(--radius-card)] border">
      <div className="h-[46vh] min-h-80 w-full">
        {Component ? (
          <Component {...(visual.options ?? {})} />
        ) : (
          <MissingVisual kind={visual.kind} />
        )}
      </div>
      {visual.caption && (
        <figcaption className="border-line/70 text-ink-faint border-t px-4 py-2.5 text-xs">
          {visual.caption}
        </figcaption>
      )}
    </figure>
  );
}
