import Link from "next/link";
import { architectureFamilies, papers } from "@/data/papers";
import { hueColor } from "@/lib/utils";

/** One-line orientation for each family, so the grouping teaches something. */
const familyBlurbs: Record<string, string> = {
  "3D CNN": "Convolve over space and time at once — accurate, but heavy.",
  "Two-Stream": "Split appearance and motion into parallel networks, then fuse.",
  "2D CNN + Attention":
    "Keep the cheap 2D backbone; let attention supply the missing time axis.",
  "CNN-LSTM": "Encode each frame, then read the sequence with a recurrent net.",
  "Vision Transformer": "Treat patches as tokens and let self-attention relate them.",
  "Spiking Neural Network":
    "Neurons fire in discrete spikes, so timing is built into the network.",
  "Unsupervised / Generative":
    "Learn normal motion without labels; flag what the model cannot reproduce.",
  "Edge / Lightweight": "Small enough to run on the camera instead of the server.",
};

export function FamilyMap() {
  const groups = architectureFamilies
    .map((family) => ({
      family,
      items: papers.filter((paper) => paper.architecture === family),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <section
      id="families"
      className="border-line/70 scroll-mt-20 border-t bg-[#070912]"
    >
      <div className="mx-auto max-w-7xl px-6 py-20">
        <header className="max-w-2xl">
          <p className="eyebrow">Approaches</p>
          <h2 className="text-ink mt-2 text-2xl font-semibold tracking-tight">
            How these papers attack the problem
          </h2>
          <p className="text-ink-muted mt-3 leading-relaxed">
            Every paper here answers the same question — is this clip violent? —
            and they differ mainly in how they get time into the model. That
            choice is the spine of the library.
          </p>
        </header>

        <div className="mt-10 grid gap-3 md:grid-cols-2">
          {groups.map(({ family, items }) => {
            const accent = hueColor(items[0].hue);
            return (
              <div
                key={family}
                className="border-line bg-panel/60 rounded-[var(--radius-card)] border p-5"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="size-2 rounded-full"
                    style={{ background: accent }}
                  />
                  <h3 className="text-ink text-sm font-semibold">{family}</h3>
                  <span className="text-ink-faint ml-auto font-mono text-[11px]">
                    {items.length}
                  </span>
                </div>

                <p className="text-ink-muted mt-2 text-sm leading-relaxed">
                  {familyBlurbs[family]}
                </p>

                <ul className="mt-4 space-y-1.5">
                  {items.map((paper) => (
                    <li key={paper.slug}>
                      <Link
                        href={`/papers/${paper.slug}`}
                        className="text-ink-muted hover:text-signal flex items-baseline gap-2 text-sm transition-colors"
                      >
                        <span className="truncate">{paper.shortTitle}</span>
                        <span className="text-ink-faint ml-auto shrink-0 font-mono text-[11px]">
                          {paper.year}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
