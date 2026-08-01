import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto grid max-w-2xl place-items-center px-6 py-32 text-center">
      <p className="eyebrow">404</p>
      <h1 className="text-ink mt-3 text-2xl font-semibold tracking-tight">
        That page isn&apos;t in the library.
      </h1>
      <Link
        href="/"
        className="bg-signal text-void hover:bg-signal-dim mt-6 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors"
      >
        Back to the library
      </Link>
    </div>
  );
}
