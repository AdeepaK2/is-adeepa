"use client";

import { useState } from "react";
import type { Paper } from "@/types/paper";
import type { StudyModule } from "@/types/study";
import { cn, hueColor } from "@/lib/utils";
import { PdfPanel } from "./pdf-panel";
import { VisualStage } from "./visual-stage";

type Tab = "study" | "pdf";

/**
 * The per-paper study view. Concept content is data, not code -- see
 * `src/data/modules/`. Papers without a module yet still get the overview and
 * the PDF reader.
 */
export function StudyShell({
  paper,
  studyModule,
}: {
  paper: Paper;
  studyModule?: StudyModule;
}) {
  const [tab, setTab] = useState<Tab>("study");
  const [activeId, setActiveId] = useState(studyModule?.concepts[0]?.id ?? "");

  const active =
    studyModule?.concepts.find((c) => c.id === activeId) ?? studyModule?.concepts[0];
  const accent = hueColor(paper.hue);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="border-line/70 mb-8 flex gap-1 border-b">
        <TabButton active={tab === "study"} onClick={() => setTab("study")}>
          Study
        </TabButton>
        <TabButton active={tab === "pdf"} onClick={() => setTab("pdf")}>
          Read the paper
        </TabButton>
      </div>

      {tab === "pdf" ? (
        <PdfPanel paper={paper} page={active?.pdfPage} />
      ) : studyModule && active ? (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
          <ConceptRail
            studyModule={studyModule}
            activeId={active.id}
            onSelect={setActiveId}
            accent={accent}
          />

          <article className="min-w-0">
            <VisualStage visual={active.visual} />

            <header className="mt-8">
              <p className="eyebrow">{active.tagline}</p>
              <h2 className="text-ink mt-2 text-2xl font-semibold tracking-tight text-balance">
                {active.title}
              </h2>
            </header>

            <div className="mt-5 max-w-2xl space-y-4">
              {active.note.map((paragraph, i) => (
                <p key={i} className="text-ink-muted leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>

            {active.takeaways && active.takeaways.length > 0 && (
              <ul className="border-line bg-panel/60 mt-6 max-w-2xl space-y-2 rounded-[var(--radius-card)] border p-5">
                {active.takeaways.map((takeaway, i) => (
                  <li key={i} className="text-ink-muted flex gap-3 text-sm leading-relaxed">
                    <span
                      aria-hidden
                      className="mt-2 size-1.5 shrink-0 rounded-full"
                      style={{ background: accent }}
                    />
                    {takeaway}
                  </li>
                ))}
              </ul>
            )}

            {active.pdfPage && (
              <button
                type="button"
                onClick={() => setTab("pdf")}
                className="text-ink-faint hover:text-signal mt-6 font-mono text-xs underline underline-offset-4 transition-colors"
              >
                open page {active.pdfPage} in the paper →
              </button>
            )}
          </article>
        </div>
      ) : (
        <PendingModule paper={paper} />
      )}
    </div>
  );
}

function ConceptRail({
  studyModule,
  activeId,
  onSelect,
  accent,
}: {
  studyModule: StudyModule;
  activeId: string;
  onSelect: (id: string) => void;
  accent: string;
}) {
  return (
    <nav aria-label="Concepts" className="lg:sticky lg:top-20 lg:self-start">
      <p className="eyebrow mb-3">Key concepts</p>
      <ol className="space-y-1">
        {studyModule.concepts.map((concept, index) => {
          const isActive = concept.id === activeId;
          return (
            <li key={concept.id}>
              <button
                type="button"
                onClick={() => onSelect(concept.id)}
                aria-current={isActive ? "step" : undefined}
                className={cn(
                  "flex w-full items-baseline gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  isActive
                    ? "bg-raised text-ink"
                    : "text-ink-muted hover:bg-panel hover:text-ink",
                )}
              >
                <span
                  className="font-mono text-[11px]"
                  style={{ color: isActive ? accent : undefined }}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="leading-snug">{concept.title}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Shown until a study module is authored for this paper. */
function PendingModule({ paper }: { paper: Paper }) {
  return (
    <div className="border-line rounded-[var(--radius-card)] border border-dashed p-12 text-center">
      <p className="eyebrow">Visual walkthrough in progress</p>
      <h2 className="text-ink mx-auto mt-3 max-w-md text-lg font-semibold text-balance">
        The interactive breakdown for this paper hasn&apos;t been written yet.
      </h2>
      <p className="text-ink-muted mx-auto mt-3 max-w-md text-sm leading-relaxed">
        The full text is available now — open the{" "}
        <span className="text-ink">Read the paper</span> tab. Concepts, short
        notes and 3D explanations get added per paper in{" "}
        <code className="text-ink-faint font-mono text-xs">
          src/data/modules/{paper.slug}.ts
        </code>
        .
      </p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
        active
          ? "border-signal text-ink"
          : "text-ink-muted hover:text-ink border-transparent",
      )}
    >
      {children}
    </button>
  );
}
