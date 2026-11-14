/**
 * Build-time provenance for the guide, injected by `next.config.ts`.
 *
 * `UPDATED_AT` is the commit date of the last push that touched `public/`, so
 * the stamp only moves when the guide content itself changes — a typo fix in
 * the footer won't claim the guide was refreshed.
 *
 * It is baked into the static export, which is why the *rendering* of
 * "updated 3 hours ago" happens in the browser (see
 * `components/last-updated.tsx`): a relative string computed during
 * `next build` would be frozen at "updated just now" until the next push.
 */

export const UPDATED_AT = process.env.NEXT_PUBLIC_UPDATED_AT || null;

/** Short hash of the commit that last changed the content, when known. */
export const UPDATED_SHA = process.env.NEXT_PUBLIC_UPDATED_SHA || null;

/** "just now" / "4 minutes ago" / "2 hours ago" / "9 days ago" / "on 5 Oct 2026". */
export function formatAgo(iso: string, now: number = Date.now()): string | null {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return null;

  // Clamped: a visitor whose clock is behind us must not get "-3 hours ago".
  const minutes = Math.max(0, Math.floor((now - then) / 60_000));

  if (minutes < 1) return "just now";
  if (minutes < 60) return plural(minutes, "minute") + " ago";

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return plural(hours, "hour") + " ago";

  const days = Math.floor(hours / 24);
  if (days < 30) return plural(days, "day") + " ago";

  // Past a month the count stops being useful; the tooltip already carries the
  // exact timestamp, this is just the readable fallback.
  return "on " + formatShortDate(iso);
}

export function formatShortDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Full local date+time for the `title` tooltip. */
export function formatFull(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}
