/**
 * Deterministic pseudo-random source (mulberry32).
 *
 * The 3D scenes scatter points at build/mount time. Using `Math.random` there
 * would be an impure render, and would also make the same scene look different
 * on every mount -- a seeded generator avoids both.
 */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
