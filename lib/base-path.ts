/**
 * Path prefix used when the static export is served from a GitHub Pages
 * *project* site (https://<user>.github.io/<repo>/). Set by the deploy
 * workflow via `NEXT_PUBLIC_BASE_PATH`; empty in local dev and when the site
 * is served from a domain root.
 *
 * Next.js rewrites `<Link>`, `next/image` and script/asset URLs with the
 * configured `basePath`, but NOT hand-written strings in `fetch()` calls or
 * inline `style={{ backgroundImage: "url(...)" }}`. Prefix those with this.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
