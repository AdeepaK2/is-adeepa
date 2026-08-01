"use client";

import dynamic from "next/dynamic";

/**
 * Client boundary for the hero scene. Kept separate so the page itself stays a
 * Server Component while the WebGL bundle loads only in the browser.
 */
const HeroField = dynamic(
  () => import("@/components/visuals/hero-field").then((m) => m.HeroField),
  { ssr: false },
);

export function HeroVisual() {
  return (
    <div aria-hidden className="absolute inset-0">
      <HeroField />
    </div>
  );
}
