import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Emit a plain static site into `out/`.
   *
   * Every route here already prerenders -- the home page and 404 are static,
   * and `/papers/[slug]` is SSG through `generateStaticParams` -- so there is no
   * server-side work left to host. Exporting means any static host serves it
   * without a Next.js adapter, which is what Netlify needs.
   *
   * This forecloses server features: route handlers, middleware, server
   * actions, ISR, `cookies()`/`headers()`, and `next/image` optimisation. If one
   * of those is ever needed, drop this line and deploy through a runtime that
   * supports Next.js instead.
   */
  output: "export",

  /**
   * Export each route as `<route>/index.html` rather than `<route>.html`.
   *
   * The export also writes RSC payloads to `papers/<slug>/__next.*.txt`, so the
   * deploy manifest contains entries under `papers/<slug>/` either way. Without
   * this, `papers/<slug>` is both a directory prefix and a sibling `.html` file,
   * and which one a host resolves for the clean URL is left to that host. With
   * it, the directory has a real index and there is nothing to resolve.
   */
  trailingSlash: true,
};

export default nextConfig;
