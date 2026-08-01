# IS-Support-Adeepa

A visual study environment for research on **violence detection in video**.

Twelve papers live in this repo. The home page is the library: browse, filter and
search them. Open one and you get its overview plus the full PDF — and, as
modules get authored, an interactive walkthrough that explains each key idea
with a short note next to a 3D visual instead of a static figure.

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build; prerenders every paper page
npm run lint
```

## What exists today

- **Home page** — hero, searchable/filterable library of all 12 papers, and an
  "approaches" section grouping them by how they model time.
- **Paper pages** — one per paper, statically prerendered, with the source PDF
  embedded and an overview built from the paper's own metadata.
- **Visual infrastructure** — a shared three.js canvas, a WebGL error boundary,
  and one reusable visual (`volume-grid`).

Every paper is currently marked `status: "planned"`, meaning its interactive
walkthrough has not been written yet. Those are added one paper at a time.

## Structure

```
public/papers/          the 12 PDFs, named by slug
src/
  app/
    page.tsx            home page
    papers/[slug]/      the study view for one paper
  components/
    home/               hero, library grid, filters, family map
    study/              study shell, concept rail, PDF panel, visual stage
    visuals/            three.js scenes + the visual registry
    layout/             header, footer
  data/
    papers.ts           the paper catalog (metadata for all 12)
    modules/            per-paper study content, registered in index.ts
  types/                Paper and StudyModule models
  lib/                  small helpers
```

## Adding a paper's study module

Content is data, not code — the study page renders whatever a module declares,
so no page work is needed.

1. Create `src/data/modules/<slug>.ts` exporting a `StudyModule`: a `premise`,
   optional headline `results`, and a list of `concepts`. Each concept carries a
   title, a short note, optional takeaways, and optionally a `visual`.
2. Register it in `src/data/modules/index.ts`.
3. Flip that paper's `status` to `"ready"` in `src/data/papers.ts`.

A concept's `visual` names a `kind` from the registry in
`src/components/visuals/registry.tsx`. Ids that aren't built yet render a clear
placeholder, so notes can be written before their visuals exist.

## Adding a new visual

1. Build the scene in `src/components/visuals/`, mounting it through
   `SceneCanvas` so renderer settings and the WebGL fallback are shared.
2. Export its props interface — that's what validates a concept's `options`.
3. Add the id to `VisualId` in `src/types/study.ts` and register the component
   in `registry.tsx` (it's loaded with `dynamic(..., { ssr: false })`, so scenes
   are code-split and never run on the server).

## Notes

- Scenes use a seeded PRNG (`src/lib/random.ts`) rather than `Math.random`, so
  renders are pure and reproducible.
- PDFs are served straight from `public/` and displayed in the browser's native
  viewer — no PDF.js dependency.
- The PDFs remain the property of their respective authors and publishers.

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 ·
three.js via @react-three/fiber
