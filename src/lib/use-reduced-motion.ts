"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Tracks `prefers-reduced-motion`.
 *
 * `globals.css` already neutralises CSS animations, but the 3D scenes animate
 * inside `useFrame`, which stylesheets cannot reach. Visuals read this and hold
 * a static pose instead -- their controls stay fully usable, so the reduced
 * motion path still teaches the same thing.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
