import type { NextConfig } from "next";
import { execFileSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * GitHub Pages project sites are served from /<repo>/, so the export has to be
 * built with a matching basePath + assetPrefix. Set NEXT_PUBLIC_BASE_PATH in the
 * deploy workflow; leave it unset for `npm run dev` / `npm start`.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Tree whose contents define "the guide changed" — the encrypted blobs the
 * visitor downloads. Site-only tweaks (copy, styling) deliberately don't move
 * the stamp. See lib/build-info.ts.
 */
const CONTENT_PATH = "public";

/** Empty string on any failure (no git binary, no .git, path matched nothing). */
function git(...args: string[]): string {
  try {
    return execFileSync("git", args, {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

/**
 * ISO (UTC) timestamp of the last commit to touch the guide content, so the UI
 * can show "updated x hours ago". Falls back to HEAD's date, then to the newest
 * mtime under `public/` (a `git archive` / zip download has no history), then
 * to build time — every push rebuilds, so that is still ~the push time.
 */
function contentUpdatedAt(): string {
  const committed =
    git("log", "-1", "--format=%cI", "--", CONTENT_PATH) || git("log", "-1", "--format=%cI");
  if (committed) return new Date(committed).toISOString();

  try {
    const dir = join(process.cwd(), CONTENT_PATH);
    const newest = readdirSync(dir).reduce(
      (max, entry) => Math.max(max, statSync(join(dir, entry)).mtimeMs),
      0,
    );
    if (newest) return new Date(newest).toISOString();
  } catch {
    // Fall through to build time.
  }

  return new Date().toISOString();
}

/** Short hash of the commit the timestamp came from, for the tooltip. */
function contentSha(): string {
  return (
    git("log", "-1", "--format=%h", "--", CONTENT_PATH) || git("rev-parse", "--short", "HEAD")
  );
}

const nextConfig: NextConfig = {
  output: "export",
  distDir: "out",
  basePath,
  assetPrefix: basePath,
  // Static export has no next/image optimizer server.
  images: { unoptimized: true },
  // Inlined into the client bundle at build time; NEXT_PUBLIC_ is what makes
  // them visible to the browser. Set NEXT_PUBLIC_UPDATED_AT / _SHA in CI to
  // skip the git probing entirely (e.g. once the repo grows past a shallow
  // checkout being enough).
  env: {
    NEXT_PUBLIC_UPDATED_AT: process.env.NEXT_PUBLIC_UPDATED_AT || contentUpdatedAt(),
    NEXT_PUBLIC_UPDATED_SHA: process.env.NEXT_PUBLIC_UPDATED_SHA || contentSha(),
  },
};

export default nextConfig;
