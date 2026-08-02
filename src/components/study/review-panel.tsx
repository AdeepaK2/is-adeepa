"use client";

import { useState } from "react";
import type {
  ClaimStatus,
  DatasetRole,
  ReviewProfile,
} from "@/types/study";
import { cn } from "@/lib/utils";

type Axis = "architecture" | "attention" | "efficiency" | "evaluation";

const AXES: { id: Axis; label: string; hint: string }[] = [
  { id: "architecture", label: "Architecture", hint: "How motion is encoded" },
  { id: "attention", label: "Attention", hint: "What is weighted, and where" },
  { id: "efficiency", label: "Efficiency", hint: "Cost, speed, deployability" },
  { id: "evaluation", label: "Datasets & metrics", hint: "What the numbers mean" },
];

/**
 * One paper's extraction along the review's four axes.
 *
 * Every field is shown even when the paper does not report it, because a blank
 * is a result: the point of reading eighteen papers this way is to see which
 * questions the field consistently leaves unanswered. Nothing here is inferred
 * -- `not reported` means the paper is silent, not that it was hard to find.
 */
export function ReviewPanel({
  review,
  accent,
}: {
  review: ReviewProfile;
  accent: string;
}) {
  const [axis, setAxis] = useState<Axis>("architecture");

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
      <nav aria-label="Review axes" className="lg:sticky lg:top-20 lg:self-start">
        <p className="eyebrow mb-3">Review axes</p>
        <ol className="space-y-1">
          {AXES.map((item, index) => {
            const isActive = item.id === axis;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setAxis(item.id)}
                  aria-current={isActive ? "step" : undefined}
                  className={cn(
                    "flex w-full items-baseline gap-3 rounded-lg px-3 py-2 text-left transition-colors",
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
                  <span className="leading-snug">
                    <span className="block text-sm">{item.label}</span>
                    <span className="text-ink-faint block text-xs">{item.hint}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="min-w-0">
        {axis === "architecture" && (
          <Architecture data={review.architecture} accent={accent} />
        )}
        {axis === "attention" && <Attention data={review.attention} accent={accent} />}
        {axis === "efficiency" && (
          <Efficiency data={review.efficiency} accent={accent} />
        )}
        {axis === "evaluation" && (
          <Evaluation data={review.evaluation} accent={accent} />
        )}
      </div>
    </div>
  );
}

function Architecture({
  data,
  accent,
}: {
  data: ReviewProfile["architecture"];
  accent: string;
}) {
  return (
    <section className="space-y-6">
      <Field label="Family" value={data.family} accent={accent} mono />
      <Field label="Backbone" value={data.backbone} />
      <Field label="Supervision" value={data.supervision} />
      <Field label="How motion is encoded" value={data.motionEncoding} />
      <ListField label="Inputs" items={data.inputs} accent={accent} />
      <Field label="Fusion" value={data.fusion} />
      <Notes items={data.notes} accent={accent} />
    </section>
  );
}

function Attention({
  data,
  accent,
}: {
  data: ReviewProfile["attention"];
  accent: string;
}) {
  return (
    <section className="space-y-6">
      <div>
        <p className="eyebrow mb-2">Attention used</p>
        <Chip
          label={data.used ? "yes" : "none"}
          tone={data.used ? "signal" : "faint"}
          accent={accent}
        />
      </div>

      <div>
        <p className="eyebrow mb-2">Kinds</p>
        <div className="flex flex-wrap gap-1.5">
          {data.kinds.map((kind) => (
            <Chip key={kind} label={kind} tone="neutral" accent={accent} />
          ))}
        </div>
      </div>

      {data.mechanisms && data.mechanisms.length > 0 && (
        <div className="space-y-3">
          <p className="eyebrow">Mechanisms</p>
          {data.mechanisms.map((mechanism) => (
            <div
              key={mechanism.name}
              className="border-line bg-panel rounded-[var(--radius-card)] border p-4"
            >
              <p className="text-ink font-mono text-sm">{mechanism.name}</p>
              <dl className="mt-2 space-y-1.5">
                <InlinePair label="Placement" value={mechanism.placement} />
                <InlinePair label="Reported effect" value={mechanism.reportedEffect} />
              </dl>
            </div>
          ))}
        </div>
      )}

      <Notes items={data.notes} accent={accent} />
    </section>
  );
}

function Efficiency({
  data,
  accent,
}: {
  data: ReviewProfile["efficiency"];
  accent: string;
}) {
  return (
    <section className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Parameters" value={data.parameters} accent={accent} />
        <Metric label="FLOPs" value={data.flops} accent={accent} />
        <Metric label="Model size" value={data.modelSize} accent={accent} />
        <Metric label="Throughput" value={data.throughput} accent={accent} />
      </div>

      <Field label="Hardware" value={data.hardware} />

      <Claim label="Real-time operation" claim={data.realTime} />
      <Claim label="Edge deployment" claim={data.edgeDeployment} />

      <Notes items={data.notes} accent={accent} />
    </section>
  );
}

function Evaluation({
  data,
  accent,
}: {
  data: ReviewProfile["evaluation"];
  accent: string;
}) {
  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <p className="eyebrow">Datasets</p>
        {data.datasets.map((dataset) => (
          <div
            key={dataset.name}
            className="border-line bg-panel rounded-[var(--radius-card)] border p-4"
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-ink text-sm font-semibold">{dataset.name}</span>
              <RoleChip role={dataset.role} accent={accent} />
            </div>
            {dataset.note && (
              <p className="text-ink-muted mt-2 text-sm leading-relaxed">
                {dataset.note}
              </p>
            )}
          </div>
        ))}
      </div>

      <Field label="Split and protocol" value={data.split} />

      <div>
        <p className="eyebrow mb-2">Metrics reported</p>
        <div className="flex flex-wrap gap-1.5">
          {data.metrics.map((metric) => (
            <Chip key={metric} label={metric} tone="neutral" accent={accent} />
          ))}
        </div>
      </div>

      <Notes items={data.protocolNotes} accent={accent} label="What limits the numbers" />
    </section>
  );
}

/* -- shared pieces ------------------------------------------------------- */

function Field({
  label,
  value,
  accent,
  mono,
}: {
  label: string;
  value?: string;
  accent?: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="eyebrow mb-1.5">{label}</p>
      {value ? (
        <p
          className={cn(
            "max-w-2xl leading-relaxed",
            mono ? "font-mono text-sm" : "text-ink-muted",
          )}
          style={mono && accent ? { color: accent } : undefined}
        >
          {value}
        </p>
      ) : (
        <NotReported />
      )}
    </div>
  );
}

function ListField({
  label,
  items,
  accent,
}: {
  label: string;
  items: string[];
  accent: string;
}) {
  return (
    <div>
      <p className="eyebrow mb-1.5">{label}</p>
      <ul className="max-w-2xl space-y-1.5">
        {items.map((item) => (
          <li key={item} className="text-ink-muted flex gap-3 text-sm leading-relaxed">
            <span
              aria-hidden
              className="mt-2 size-1.5 shrink-0 rounded-full"
              style={{ background: accent }}
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value?: string;
  accent: string;
}) {
  return (
    <div className="border-line bg-panel rounded-[var(--radius-card)] border px-4 py-3">
      <p className="eyebrow">{label}</p>
      {value ? (
        <p className="mt-1 font-mono text-lg tabular-nums" style={{ color: accent }}>
          {value}
        </p>
      ) : (
        <p className="text-ink-faint mt-1 font-mono text-xs">not reported</p>
      )}
    </div>
  );
}

const CLAIM_COPY: Record<ClaimStatus, { label: string; tone: Tone }> = {
  "not-addressed": { label: "not addressed", tone: "faint" },
  "claimed-without-evidence": { label: "claimed, no evidence", tone: "alert" },
  "measured-and-supported": { label: "measured, supported", tone: "signal" },
  "measured-and-refuted": { label: "measured, contradicted", tone: "alert" },
};

function Claim({
  label,
  claim,
}: {
  label: string;
  claim: { status: ClaimStatus; note: string };
}) {
  const copy = CLAIM_COPY[claim.status];
  return (
    <div className="border-line bg-panel rounded-[var(--radius-card)] border p-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="eyebrow">{label}</p>
        <Chip label={copy.label} tone={copy.tone} />
      </div>
      <p className="text-ink-muted mt-2 max-w-2xl text-sm leading-relaxed">
        {claim.note}
      </p>
    </div>
  );
}

const ROLE_COPY: Record<DatasetRole, { label: string; tone: Tone }> = {
  evaluation: { label: "results reported", tone: "signal" },
  "pre-training": { label: "pre-training only", tone: "neutral" },
  "mentioned-only": { label: "named, never run", tone: "alert" },
};

function RoleChip({ role, accent }: { role: DatasetRole; accent: string }) {
  const copy = ROLE_COPY[role];
  return <Chip label={copy.label} tone={copy.tone} accent={accent} />;
}

type Tone = "signal" | "alert" | "neutral" | "faint";

function Chip({
  label,
  tone,
  accent,
}: {
  label: string;
  tone: Tone;
  accent?: string;
}) {
  return (
    <span
      className={cn(
        "rounded border px-1.5 py-0.5 font-mono text-[10px] whitespace-nowrap",
        tone === "signal" && "border-signal/40 text-signal",
        tone === "alert" && "border-alert/40 text-alert",
        tone === "faint" && "border-line text-ink-faint",
        tone === "neutral" && "border-line text-ink-muted",
      )}
      style={
        tone === "neutral" && accent
          ? { borderColor: `color-mix(in oklab, ${accent} 35%, transparent)` }
          : undefined
      }
    >
      {label}
    </span>
  );
}

function Notes({
  items,
  accent,
  label = "Notes",
}: {
  items?: string[];
  accent: string;
  label?: string;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="eyebrow mb-2">{label}</p>
      <ul className="border-line bg-panel/60 max-w-2xl space-y-2 rounded-[var(--radius-card)] border p-5">
        {items.map((item, i) => (
          <li key={i} className="text-ink-muted flex gap-3 text-sm leading-relaxed">
            <span
              aria-hidden
              className="mt-2 size-1.5 shrink-0 rounded-full"
              style={{ background: accent }}
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function InlinePair({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap gap-x-2 text-sm">
      <dt className="text-ink-faint shrink-0 font-mono text-[11px]">{label}</dt>
      <dd className="text-ink-muted min-w-0 flex-1 leading-relaxed">{value}</dd>
    </div>
  );
}

function NotReported() {
  return <p className="text-ink-faint font-mono text-xs">not reported in the paper</p>;
}
