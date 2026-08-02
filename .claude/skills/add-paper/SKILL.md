---
name: add-paper
description: Extract a paper from the IN3901 reading list into this app - the four-axis review extraction (architecture, attention, computational efficiency, datasets and metrics) and optionally an interactive study module. Use when asked to add, extract, review, or "do" a paper; to fill in a paper's review tab; or to turn a PDF in public/papers/ into a module under src/data/modules/.
---

# Adding a paper

This repo backs an independent study: *Deep Learning-Based Spatiotemporal Violence
Detection in Surveillance Videos — A Comparative Review of Architectures, Attention
Mechanisms, and Computational Efficiency*. Roughly 18 peer-reviewed papers (2021–2026)
get read the same way, so the extraction has to be **comparable across papers**, not
just correct for one.

Two artifacts come out of a paper. They are independent — do either alone.

| Artifact | Where | Why |
| --- | --- | --- |
| **Review extraction** (`review`) | `src/data/modules/<slug>.ts` | The actual deliverable. Structured fields, comparable across all 18 papers. |
| **Study module** (`concepts`) | same file | Optional teaching layer: notes plus 3D visuals. Nice, not required. |

`src/data/modules/3d-cnn.ts` is the worked reference. Read it before starting.

---

## 1. Get the text out of the PDF

There is **no poppler, pdftotext, mutool or qpdf** on this machine, and the `Read`
tool cannot render these PDFs. Use pypdf in a scratch venv:

```bash
python3 -m venv "$SCRATCH/v" && "$SCRATCH/v/bin/pip" -q install pypdf
"$SCRATCH/v/bin/python3" -c "
from pypdf import PdfReader
r = PdfReader('public/papers/<slug>.pdf')
for i in range(len(r.pages)):
    print('='*20, 'PDF PAGE', i+1); print(r.pages[i].extract_text())
"
```

Then grep the joined text for the terms that decide the extraction. Always run these,
because absence is a finding:

```
FLOPs  GFLOPs  params  parameters  FPS  inference  latency  runtime
real-time  edge  embedded  Jetson  Raspberry  mobile  GPU  CPU
attention  CBAM  squeeze  self-attention  transformer
precision  recall  F1  AUC  EER  confusion  cross-dataset
```

**Extraction quirks.** Ligatures drop (`ﬁ`, `ﬂ`), so grep for `identi` not `identified`.
Table cells run together with stray footnote digits — `100 86 1 100 87` is
`86` and `87` with a marker between. Verify any table number that looks odd against a
neighbouring row.

## 2. Map tables to pages first

Before writing anything, build the table → PDF page map and put it in the file header
comment, as `3d-cnn.ts` does. Everything downstream cites it, and it is what makes the
numbers checkable later by someone holding the PDF.

Use **physical PDF pages, 1-based** — not the journal's printed page numbers. `pdfPage`
on a concept feeds `#page=N` in the iframe, so it must be the physical page.

## 3. Fill the review extraction

Types are in `src/types/study.ts`. Fill **every** field. If the paper is silent, leave it
`undefined` — the UI renders "not reported in the paper", and that blank is a result: the
review's whole point is showing which questions the field consistently leaves unanswered.

**Never infer, never interpolate, never round in the paper's favour.** If a number is not
in the paper, it does not go in the extraction.

### architecture

- `motionEncoding` is the important one — how motion enters the representation at all.
  Be specific about the mechanism (3D kernels spanning N frames / recurrent state /
  frame differencing / pre-computed optical flow / spike timing), not the family name.
- `family` should match a value in `architectureFamilies` in `src/data/papers.ts` where
  one fits.
- Separate the *named contribution* from the *architecture*. Papers often sell a data or
  training trick as if it were a design. Say so in `notes`.

### attention

- `used: false` with `kinds: ["none"]` is a **finding, not a gap**. Papers with no
  attention are the baselines the attention papers get measured against — record them
  deliberately and say so in `notes`.
- Only count attention **in the proposed model**. Mentions in Related Works describing
  other people's models do not count. This is the single easiest mistake to make: grep
  hits for "attention" are usually all in Related Works.
- A fixed, hand-set prior (a crop, a fixed frame window) is **not** attention. Note the
  distinction rather than filing it under attention.

### efficiency

`ClaimStatus` is doing analytical work here — pick it deliberately:

| Status | Use when |
| --- | --- |
| `not-addressed` | The paper never raises it. No numbers, no claim. |
| `claimed-without-evidence` | It says "real-time" or "lightweight" and reports nothing to support it. |
| `measured-and-supported` | It claims it *and* the reported numbers back it. |
| `measured-and-refuted` | It claims it and its **own** numbers contradict it. |

`measured-and-refuted` is for a paper contradicting itself, not for disagreeing with a
paper. Quote the contradicting number in the `note`.

Also:
- Record `hardware` exactly, including whether it is CPU or GPU. A throughput figure
  without hardware is close to meaningless for comparison — say so in `notes`.
- Watch for **uncosted pre-processing**. Optical flow, pose extraction and frame
  differencing are often excluded from the reported speed. Flag it.
- Check units on the tables themselves. One paper heads a column `Params (MB)` while its
  text says millions. Record what it *means* and flag the mislabel.

### evaluation

- `DatasetRole` matters more than it looks. `evaluation` = a result is reported on it.
  `pre-training` = weights only. `mentioned-only` = named in the intro or related work
  and **never run**.
- **Then check `src/data/papers.ts`.** Its `datasets` field drives the library filter and
  has been wrong before — the 3D CNN paper listed Crowd Violence and UCF-Crime, neither
  of which it runs. `datasets` there should list only `evaluation` datasets. Fix it and
  say so in the report.
- List `metrics` exactly as reported. Accuracy-only is common and is worth calling out in
  `protocolNotes`, because it says nothing about false positives — the thing that decides
  whether an alarm is usable.
- In `protocolNotes`, look hard for these, since they usually go unstated:
  - Is the "validation" set also the test set, and was it used to pick hyperparameters?
    Then the headline is a selected-best number, not a clean held-out one.
  - Training accuracy pinned at 100% — overfitting the authors may or may not admit.
  - Any cross-dataset test at all.
  - How close the data is to operational CCTV: staged, film, broadcast sport, or scraped
    surveillance footage.

## 4. Optional: concepts and visuals

Only if the paper earns a teaching layer. Follow `3d-cnn.ts` for voice: short paragraphs,
plain language, the number that matters in `highlight`, `takeaways` for the things worth
carrying away.

**The trap:** `visualRegistry` types visuals as `ComponentType<Record<string, unknown>>`,
so **`visual.options` is not typechecked**. A typo'd or wrong-typed option fails silently
at runtime. Open the visual's exported props interface and check every key by hand.

Built visuals: `volume-grid`, `two-stream-flow`, `sequence-timeline`, `resnet-stack`.
`attention-map` is declared in `VisualId` but not built — a module can reference it and
will render `MissingVisual` until someone builds it.

Prefer configuring an existing visual over writing one. If you must write one:

- Mount through `SceneCanvas`; pass `orbit` (and `autoRotate` for ambient scenes).
- Take a `SceneHover` prop and label every meaningful mesh — see `hover.tsx`.
- **The app is light-themed.** Inactive/off/frozen states must be *pale* (`hsl(h, 20%, 84%)`)
  and active states *dark and saturated* (`hsl(h, 85%, 42%)`). This is the inverse of the
  usual dark-scene instinct. Never use `AdditiveBlending` — it brightens toward white and
  erases itself on a light page.
- Get the accent from `hueColor(hue)`, never a hardcoded `hsl()` literal.
- Do not rotate the scene's own group per frame — it fights the orbit camera.

## 5. Register it

```ts
// src/data/modules/index.ts
export const studyModules: Record<string, StudyModule> = {
  "3d-cnn": module3dCnn,
  "<slug>": module<Slug>,
};
```

Set `status: "ready"` in `src/data/papers.ts` **only if** the paper has `concepts`. The
Study tab renders concepts; the Review tab appears on its own whenever `review` is present.

**Known constraint:** `concepts` is currently required on `StudyModule`. A review-only
paper therefore needs at least one concept. If you are adding several review-only papers,
make `concepts` optional in `src/types/study.ts` and guard the Study tab in
`study-shell.tsx` — that is the right fix, do not pad the file with a filler concept.

## 6. Verify

```bash
npx tsc --noEmit && npm run lint && npm run build
```

`tsc` will not catch bad `visual.options` (see above) or any wrong number. For anything
rendering client-side, check the dev server log — the visuals are `ssr: false` and never
execute during the build:

```bash
tail -n 200 .next/dev/logs/next-development.log
```

Ignore two known-harmless entries: a `THREE.Clock` deprecation from inside R3F, and a
hydration mismatch caused by a browser extension writing `bis_register` onto `<body>`.
Check timestamps before believing an error — stale mid-edit errors sit in that log.

## Rules that keep the review trustworthy

1. **Numbers come from the paper's tables**, not its abstract or conclusion. Abstracts
   round and cherry-pick.
2. **When a paper contradicts itself, record both and flag it.** Do not silently pick one.
   The 3D CNN paper's Tables 8 and 9 disagree on the same baseline.
3. **Check "previous best" claims against the paper's own comparison table.** That paper
   billed 87.25% as the previous best while its own Table 8 listed a 89.75% baseline —
   turning a +0.75 margin into a claimed +3.25.
4. **Configurations the paper did not run are `undefined`**, and the visuals report them
   as unmeasured. Never interpolate a missing cell.
5. **Report what you changed in `papers.ts`**, and say plainly which claims you verified
   against the PDF and which you did not.
