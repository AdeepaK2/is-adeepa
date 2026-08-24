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
  | "sequence-timeline"
  | "resnet-stack"
  | "model-lineup"
  | "reconstruction-gap"
  | "bidirectional-sequence"
  | "throughput-budget"
  | "tcn-receptive-field";

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
  /** The single number worth remembering, shown as a badge above the note. */
  highlight?: { label: string; value: string; note?: string };
  /** The short note -- a few short paragraphs, plain language. */
  note: string[];
  /** Optional bullet takeaways rendered under the note. */
  takeaways?: string[];
  visual?: Visual;
  /** Page in the PDF this concept maps to, for "open source page". */
  pdfPage?: number;
}

/**
 * How a paper's own claim stands up to the evidence it reports.
 *
 * Kept separate from the claim's text because the review's second question is
 * exactly this gap -- whether "real-time" and "lightweight" survive contact with
 * the paper's own numbers. `refuted` is reserved for a claim the paper's own
 * measurements contradict, not one this review disagrees with.
 */
export type ClaimStatus =
  | "not-addressed"
  | "claimed-without-evidence"
  | "measured-and-supported"
  | "measured-and-refuted";

export type AttentionKind = "channel" | "spatial" | "temporal" | "self" | "none";

/** Which of a paper's datasets carry a result, and which are only named. */
export type DatasetRole = "evaluation" | "pre-training" | "mentioned-only";

/**
 * The comparable extraction from one paper, along the review's four axes.
 *
 * Structured rather than prose so the same field can be read across eighteen
 * papers and turned into a comparison table. Anything the paper does not report
 * is left `undefined` and rendered as "not reported" -- never inferred, since a
 * silent gap is itself a finding about how the field reports its work.
 */
export interface ReviewProfile {
  architecture: {
    family: string;
    backbone: string;
    /** How motion enters the representation at all -- the core design question. */
    motionEncoding: string;
    inputs: string[];
    fusion?: string;
    supervision: string;
    notes?: string[];
  };
  attention: {
    /** `false` is a finding, not a gap: the paper deliberately uses none. */
    used: boolean;
    kinds: AttentionKind[];
    mechanisms?: {
      name: string;
      placement: string;
      reportedEffect: string;
    }[];
    notes?: string[];
  };
  efficiency: {
    parameters?: string;
    flops?: string;
    modelSize?: string;
    throughput?: string;
    hardware?: string;
    realTime: { status: ClaimStatus; note: string };
    edgeDeployment: { status: ClaimStatus; note: string };
    notes?: string[];
  };
  evaluation: {
    datasets: { name: string; role: DatasetRole; note?: string }[];
    split: string;
    metrics: string[];
    /** Train/test procedure, and anything that limits what the numbers mean. */
    protocolNotes?: string[];
  };
}

export interface StudyModule {
  slug: string;
  /** The problem the paper sets out to solve, in two or three sentences. */
  premise: string;
  /** Headline numbers, e.g. { label: "RWF-2000", value: "87.3%", note: "accuracy" }. */
  results?: { label: string; value: string; note?: string }[];
  /**
   * The teaching layer. Optional: a paper can carry a review extraction with no
   * study module written for it yet, and the Study tab falls back to the
   * overview while the Review tab renders on its own.
   */
  concepts?: Concept[];
  /** The comparable extraction. Optional so papers can be added one at a time. */
  review?: ReviewProfile;
}
