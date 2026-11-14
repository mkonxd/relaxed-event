"use client";

import { useEffect, useState } from "react";
import { UPDATED_AT, UPDATED_SHA, formatAgo, formatFull } from "@/lib/build-info";

/**
 * "Updated 3 hours ago", measured against the visitor's clock.
 *
 * Deliberately empty in the static HTML: the stamp is a *relative* string, so
 * it has to be computed in the browser. Rendering it on the server would bake
 * "just now" into the export at build time, and hydrating with a different
 * string (build machine vs. visitor clock) would mismatch. The `title` carries
 * the exact commit date and hash for anyone who wants the real timestamp.
 */
export function LastUpdated({ className = "" }: { className?: string }) {
  const [ago, setAgo] = useState<string | null>(null);

  useEffect(() => {
    // Local copy: TS won't narrow a module-level binding inside this closure.
    const iso = UPDATED_AT;
    if (!iso) return;

    const tick = () => setAgo(formatAgo(iso));
    tick();

    // A tab left open all day keeps rolling by itself.
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  if (!UPDATED_AT || ago === null) return null;

  const tooltip =
    `Guide content last changed ${formatFull(UPDATED_AT)}` +
    (UPDATED_SHA ? ` (commit ${UPDATED_SHA})` : "");

  return (
    <p
      className={`text-[11px] text-muted-foreground/60 ${className}`}
      title={tooltip}
    >
      Updated <span className="text-gold">{ago}</span>
    </p>
  );
}
