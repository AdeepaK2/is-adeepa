import Link from "next/link";
import { papers } from "@/data/papers";
import { HeroVisual } from "./hero-visual";

export function Hero() {
  const years = papers.map((p) => p.year);
  const span = `${Math.min(...years)}–${Math.max(...years)}`;

  return (
    <section className="border-line/70 relative overflow-hidden border-b">
      <div className="bg-grid absolute inset-0 opacity-[0.35]" />
      <HeroVisual />
      {/* Fade the visual out behind the text so the copy stays legible. */}
      <div className="from-base via-base/85 absolute inset-0 bg-gradient-to-r to-transparent" />
      <div className="from-base absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t to-transparent" />

      <div className="relative mx-auto max-w-7xl px-6 py-24 sm:py-32">
        <div className="max-w-2xl">
          <p className="eyebrow">Visual research library</p>
          <h1 className="text-ink mt-4 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Learn violence detection research by{" "}
            <span className="text-signal">seeing</span> how it works.
          </h1>
          <p className="text-ink-muted mt-5 text-lg leading-relaxed text-pretty">
            {papers.length} papers on detecting violent activity in video,
            published {span}. Pick one, read a short note on each key idea, and
            watch the architecture explained as an interactive 3D model rather
            than a static figure.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="#library"
              className="bg-signal text-void hover:bg-signal-dim rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors"
            >
              Browse the library
            </Link>
            <Link
              href="#families"
              className="border-line-strong text-ink-muted hover:text-ink hover:border-ink-faint rounded-lg border px-5 py-2.5 text-sm font-medium transition-colors"
            >
              See approaches
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
