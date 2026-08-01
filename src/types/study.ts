/**
 * Content model for a paper's study module.
 *
 * A module is authored per paper (one file under `src/data/modules/`) and
 * rendered by the shared study shell, so adding a paper means adding data --
 * not new page code.
 */

/** Identifier of a registered 3D/2D visual. See `src/components/visuals/registry.ts`. */
export type VisualId =
  | "volume-grid"
  | "two-stream-flow"
  | "attention-map"
  | "sequence-timeline";

export interface Visual {
  kind: VisualId;
  /** Free-form props forwarded to the registered visual component. */
  options?: Record<string, unknown>;
  /** Shown under the canvas to explain what is being rendered. */
  caption?: string;
}

/** A single idea from the paper: a short note plus the visual that teaches it. */
export interface Concept {
  id: string;
  title: string;
  /** One line shown in the concept rail. */
  tagline: string;
  /** The short note -- a few short paragraphs, plain language. */
  note: string[];
  /** Optional bullet takeaways rendered under the note. */
  takeaways?: string[];
  visual?: Visual;
  /** Page in the PDF this concept maps to, for "open source page". */
  pdfPage?: number;
}

export interface StudyModule {
  slug: string;
  /** The problem the paper sets out to solve, in two or three sentences. */
  premise: string;
  /** Headline numbers, e.g. { label: "RWF-2000", value: "87.3%", note: "accuracy" }. */
  results?: { label: string; value: string; note?: string }[];
  concepts: Concept[];
}
