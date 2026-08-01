import Link from "next/link";
import type { Paper } from "@/types/paper";
import type { StudyModule } from "@/types/study";
import { hueColor } from "@/lib/utils";

export function PaperHeader({
  paper,
  studyModule,
}: {
  paper: Paper;
  studyModule?: StudyModule;
}) {
  const accent = hueColor(paper.hue);

  return (
    <section className="border-line/70 relative overflow-hidden border-b">
      <div className="bg-grid absolute inset-0 opacity-25" />
      <span
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/4 h-80 w-[36rem] opacity-20 blur-[100px]"
        style={{ background: accent }}
      />

      <div className="relative mx-auto max-w-7xl px-6 pt-8 pb-12">
        <Link
          href="/#library"
          className="text-ink-faint hover:text-ink font-mono text-xs transition-colors"
        >
          ← library
        </Link>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span
            className="rounded-full px-2.5 py-0.5 font-mono text-[11px]"
            style={{
              color: accent,
              background: `color-mix(in oklab, ${accent} 14%, transparent)`,
            }}
          >
            {paper.architecture}
          </span>
          <span className="text-ink-faint font-mono text-[11px]">
            {paper.venue} · {paper.year}
          </span>
        </div>

        <h1 className="text-ink mt-4 max-w-4xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {paper.title}
        </h1>

        <p className="text-ink-muted mt-4 max-w-3xl leading-relaxed text-pretty">
          {studyModule?.premise ?? paper.summary}
        </p>

        <dl className="border-line/70 mt-8 grid gap-6 border-t pt-6 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Authors">{paper.authors.join(", ")}</Field>
          <Field label="Datasets">{paper.datasets.join(", ")}</Field>
          <Field label="Topics">{paper.tags.join(", ")}</Field>
          <Field label="DOI">
            {paper.doi ? (
              <a
                href={`https://doi.org/${paper.doi}`}
                target="_blank"
                rel="noreferrer"
                className="hover:text-signal font-mono transition-colors"
              >
                {paper.doi}
              </a>
            ) : (
              "—"
            )}
          </Field>
        </dl>

        {studyModule?.results && studyModule.results.length > 0 && (
          <div className="mt-8 flex flex-wrap gap-3">
            {studyModule.results.map((result) => (
              <div
                key={result.label}
                className="border-line bg-panel rounded-lg border px-4 py-3"
              >
                <p className="eyebrow">{result.label}</p>
                <p className="text-ink mt-1 font-mono text-xl">{result.value}</p>
                {result.note && (
                  <p className="text-ink-faint mt-0.5 text-xs">{result.note}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="text-ink-muted mt-1.5 text-sm leading-relaxed">{children}</dd>
    </div>
  );
}
