/** Join conditional class names. Small enough not to warrant a dependency. */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

/** "Pratama et al." / "Vosta & Yow" / "Merit" */
export function formatAuthors(authors: string[]): string {
  const last = (name: string) => name.split(" ").slice(-1)[0];
  if (authors.length === 0) return "";
  if (authors.length === 1) return last(authors[0]);
  if (authors.length === 2) return `${last(authors[0])} & ${last(authors[1])}`;
  return `${last(authors[0])} et al.`;
}

/**
 * CSS color derived from a paper's base hue, used for cards and 3D accents.
 *
 * The default lightness is set for text and thin borders on a white panel, and
 * is deliberately dark: these hues span the full circle, and yellow-greens go
 * illegible several stops before blues do, so the ceiling is set by the worst
 * hue in `papers.ts` rather than the average. It also has to carry `text-void`
 * when used as a button fill.
 */
export function hueColor(hue: number, saturation = 60, lightness = 30): string {
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}
