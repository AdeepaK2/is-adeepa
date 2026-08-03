"use client";

import { useMemo, useState } from "react";
import type { ArchitectureFamily, Paper } from "@/types/paper";
import { cn } from "@/lib/utils";
import { PaperCard } from "./paper-card";

type SortKey = "list" | "newest" | "oldest" | "title";

interface PaperLibraryProps {
  papers: Paper[];
  families: ArchitectureFamily[];
  datasets: string[];
}

export function PaperLibrary({ papers, families, datasets }: PaperLibraryProps) {
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState<ArchitectureFamily | null>(null);
  const [dataset, setDataset] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("list");

  // Only show family chips that survive the other active filters.
  const availableFamilies = useMemo(() => {
    const pool = dataset
      ? papers.filter((p) => p.datasets.includes(dataset))
      : papers;
    const present = new Set(pool.map((p) => p.architecture));
    return families.filter((f) => present.has(f));
  }, [papers, families, dataset]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const matched = papers.filter((paper) => {
      if (family && paper.architecture !== family) return false;
      if (dataset && !paper.datasets.includes(dataset)) return false;
      if (!needle) return true;
      return [
        paper.title,
        paper.shortTitle,
        paper.summary,
        paper.venue,
        ...paper.authors,
        ...paper.tags,
        ...paper.datasets,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });

    // "list" keeps the source order of the data file, which is the reading list.
    if (sort === "list") return matched;

    return matched.sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "oldest") return a.year - b.year;
      return b.year - a.year;
    });
  }, [papers, query, family, dataset, sort]);

  const filtersActive = Boolean(query || family || dataset);

  return (
    <section id="library" className="mx-auto max-w-7xl scroll-mt-20 px-6 py-20">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">The library</p>
          <h2 className="text-ink mt-2 text-2xl font-semibold tracking-tight">
            All papers
          </h2>
        </div>
        <p className="text-ink-faint font-mono text-xs">
          {visible.length} of {papers.length} shown
        </p>
      </header>

      <div className="mt-8 flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={query} onChange={setQuery} />
          <SortSelect value={sort} onChange={setSort} />
          {filtersActive && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setFamily(null);
                setDataset(null);
              }}
              className="text-ink-faint hover:text-ink font-mono text-xs underline underline-offset-4 transition-colors"
            >
              reset
            </button>
          )}
        </div>

        <FilterRow label="Approach">
          <Chip active={!family} onClick={() => setFamily(null)}>
            All
          </Chip>
          {availableFamilies.map((f) => (
            <Chip
              key={f}
              active={family === f}
              onClick={() => setFamily(family === f ? null : f)}
            >
              {f}
            </Chip>
          ))}
        </FilterRow>

        <FilterRow label="Dataset">
          <Chip active={!dataset} onClick={() => setDataset(null)}>
            All
          </Chip>
          {datasets.map((d) => (
            <Chip
              key={d}
              active={dataset === d}
              onClick={() => {
                setDataset(dataset === d ? null : d);
                setFamily(null);
              }}
            >
              {d}
            </Chip>
          ))}
        </FilterRow>
      </div>

      {visible.length > 0 ? (
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((paper) => (
            <PaperCard key={paper.slug} paper={paper} />
          ))}
        </div>
      ) : (
        <p className="border-line text-ink-faint mt-10 rounded-[var(--radius-card)] border border-dashed p-12 text-center text-sm">
          No papers match those filters.
        </p>
      )}
    </section>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="eyebrow w-16 shrink-0">{label}</span>
      {children}
    </div>
  );
}

function Chip({
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
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-signal/60 bg-signal/10 text-signal"
          : "border-line text-ink-muted hover:border-line-strong hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function SearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative flex-1 sm:max-w-xs">
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className="text-ink-faint pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
      >
        <circle
          cx="7"
          cy="7"
          r="4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M10.5 10.5 L14 14"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search titles, authors, methods…"
        aria-label="Search papers"
        className="border-line bg-panel text-ink placeholder:text-ink-faint focus:border-signal/60 w-full rounded-lg border py-2 pr-3 pl-9 text-sm transition-colors outline-none"
      />
    </div>
  );
}

function SortSelect({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (value: SortKey) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as SortKey)}
      aria-label="Sort papers"
      className="border-line bg-panel text-ink-muted focus:border-signal/60 rounded-lg border px-3 py-2 text-sm transition-colors outline-none"
    >
      <option value="list">Reading list order</option>
      <option value="newest">Newest first</option>
      <option value="oldest">Oldest first</option>
      <option value="title">A–Z</option>
    </select>
  );
}
