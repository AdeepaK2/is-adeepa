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

/** CSS color derived from a paper's base hue, used for cards and 3D accents. */
export function hueColor(hue: number, saturation = 78, lightness = 62): string {
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}
