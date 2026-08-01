"use client";

import { useState } from "react";
import type { Paper } from "@/types/paper";

/**
 * Reads the PDF straight from /public via the browser's built-in viewer. No
 * PDF.js dependency -- the papers are static assets and the native viewer
 * already handles search, zoom and printing.
 */
export function PdfPanel({ paper, page }: { paper: Paper; page?: number }) {
  const [loaded, setLoaded] = useState(false);
  const src = page ? `${paper.pdf}#page=${page}` : paper.pdf;

  return (
    <div className="border-line bg-panel relative overflow-hidden rounded-[var(--radius-card)] border">
      <div className="border-line/70 flex items-center gap-3 border-b px-4 py-2.5">
        <span className="eyebrow">source pdf</span>
        <span className="text-ink-faint font-mono text-[11px]">
          {paper.pageCount} pages
        </span>
        <a
          href={paper.pdf}
          target="_blank"
          rel="noreferrer"
          className="text-ink-muted hover:text-signal ml-auto font-mono text-[11px] transition-colors"
        >
          open in new tab ↗
        </a>
      </div>

      {!loaded && (
        <div className="text-ink-faint absolute inset-x-0 top-12 grid h-96 place-items-center">
          <span className="eyebrow animate-pulse">loading pdf</span>
        </div>
      )}

      <iframe
        src={src}
        title={`${paper.title} (PDF)`}
        onLoad={() => setLoaded(true)}
        className="h-[78vh] w-full bg-white"
      />
    </div>
  );
}
