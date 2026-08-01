import Link from "next/link";
import { papers } from "@/data/papers";

export function SiteHeader() {
  return (
    <header className="border-line/70 bg-base/80 sticky top-0 z-50 border-b backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <Mark />
          <span className="text-ink text-sm font-semibold tracking-tight">
            IS-Support-Adeepa
          </span>
        </Link>

        <nav className="ml-auto flex items-center gap-1 text-sm">
          <NavLink href="/#library">Library</NavLink>
          <NavLink href="/#families">Families</NavLink>
        </nav>

        <span className="border-line text-ink-faint hidden rounded-full border px-2.5 py-1 font-mono text-[11px] sm:inline">
          {papers.length} papers
        </span>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-ink-muted hover:text-ink hover:bg-raised/60 rounded-md px-3 py-1.5 transition-colors"
    >
      {children}
    </Link>
  );
}

/** Three stacked bars — frames of a clip, the recurring motif of the app. */
function Mark() {
  return (
    <span
      aria-hidden
      className="border-line-strong bg-panel grid size-7 place-items-center rounded-md border"
    >
      <svg viewBox="0 0 16 16" className="size-4">
        <rect x="1.5" y="2" width="13" height="3" rx="1" className="fill-signal" />
        <rect
          x="1.5"
          y="6.5"
          width="13"
          height="3"
          rx="1"
          className="fill-signal opacity-60"
        />
        <rect
          x="1.5"
          y="11"
          width="13"
          height="3"
          rx="1"
          className="fill-signal opacity-30"
        />
      </svg>
    </span>
  );
}
