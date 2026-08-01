import Link from "next/link";
import type { Paper } from "@/types/paper";
import { formatAuthors, hueColor } from "@/lib/utils";

export function PaperCard({ paper }: { paper: Paper }) {
  const accent = hueColor(paper.hue);

  return (
    <Link
      href={`/papers/${paper.slug}`}
      style={{ "--accent": accent } as React.CSSProperties}
      className="group border-line bg-panel hover:border-line-strong relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border p-5 transition-colors"
    >
      {/* Accent wash, revealed on hover. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 h-40 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-25"
        style={{ background: `radial-gradient(50% 100% at 50% 100%, ${accent}, transparent)` }}
      />
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 h-px opacity-40 transition-opacity group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
      />

      <div className="relative flex items-center gap-2">
        <span
          className="rounded-full px-2 py-0.5 font-mono text-[10px] tracking-wide"
          style={{
            color: accent,
            background: `color-mix(in oklab, ${accent} 14%, transparent)`,
          }}
        >
          {paper.architecture}
        </span>
        <span className="text-ink-faint ml-auto font-mono text-[11px]">
          {paper.year}
        </span>
      </div>

      <h3 className="text-ink group-hover:text-signal mt-3 text-base leading-snug font-semibold text-balance transition-colors">
        {paper.shortTitle}
      </h3>

      <p className="text-ink-muted mt-2 line-clamp-3 text-sm leading-relaxed">
        {paper.summary}
      </p>

      <div className="text-ink-faint mt-4 flex items-center gap-1.5 font-mono text-[11px]">
        <span>{formatAuthors(paper.authors)}</span>
        <span aria-hidden>·</span>
        <span className="truncate">{paper.venue}</span>
      </div>

      <div className="border-line/70 relative mt-4 flex flex-wrap items-center gap-1.5 border-t pt-4">
        {paper.datasets.slice(0, 3).map((dataset) => (
          <span
            key={dataset}
            className="border-line text-ink-faint rounded border px-1.5 py-0.5 font-mono text-[10px]"
          >
            {dataset}
          </span>
        ))}
        {paper.datasets.length > 3 && (
          <span className="text-ink-faint font-mono text-[10px]">
            +{paper.datasets.length - 3}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1.5">
          <StatusDot status={paper.status} />
          <span className="text-ink-faint font-mono text-[10px]">
            {paper.status === "ready" ? "study ready" : "PDF only"}
          </span>
        </span>
      </div>
    </Link>
  );
}

function StatusDot({ status }: { status: Paper["status"] }) {
  return (
    <span
      aria-hidden
      className={
        status === "ready"
          ? "bg-signal size-1.5 rounded-full"
          : "bg-ink-faint/50 size-1.5 rounded-full"
      }
    />
  );
}
