/**
 * Architecture families used to group the library. Keep this list closed so the
 * home page filters and the per-paper visual modules stay in sync.
 */
export type ArchitectureFamily =
  | "3D CNN"
  | "Two-Stream"
  | "2D CNN + Attention"
  | "CNN-LSTM"
  | "Vision Transformer"
  | "Spiking Neural Network"
  | "Unsupervised / Generative"
  | "Edge / Lightweight";

/** Whether an interactive study module has been authored for a paper yet. */
export type StudyStatus = "ready" | "planned";

export interface Paper {
  /** URL segment, also the PDF basename in /public/papers. */
  slug: string;
  title: string;
  /** Compact label for cards, breadcrumbs and nav. */
  shortTitle: string;
  authors: string[];
  venue: string;
  year: number;
  doi?: string;
  pageCount: number;
  /** Public path to the PDF. */
  pdf: string;
  /** One or two sentences, plain language. */
  summary: string;
  architecture: ArchitectureFamily;
  datasets: string[];
  tags: string[];
  /** Base hue (0-360) driving the card gradient and the 3D scene accent. */
  hue: number;
  status: StudyStatus;
}
