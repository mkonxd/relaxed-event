"use client";

import { useState } from "react";
import {
  decryptGuideBytes,
  encryptBytesForBattletag,
} from "@/lib/rxp-crypto";
import { UPDATED_AT, formatAgo } from "@/lib/build-info";
import { FOREVER_GUIDE } from "@/lib/guides";

const BATTLETAG_RE = /^.+#\d{2,}$/;

type Status =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "done"; guides: number }
  | { kind: "error"; message: string };

export function KeyForm() {
  const [tag, setTag] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const trimmed = tag.trim();
  const valid = BATTLETAG_RE.test(trimmed);
  const busy = status.kind === "working";

  const download = async () => {
    if (!valid) {
      setStatus({ kind: "error", message: "Enter your BattleTag, e.g. Name#12345" });
      return;
    }

    setStatus({ kind: "working" });
    try {
      const res = await fetch(FOREVER_GUIDE.guideUrl);
      if (!res.ok) throw new Error(`Could not load the guide (${res.status}).`);

      const p = decryptGuideBytes(await res.text(), FOREVER_GUIDE.sourceTag);
      if (!p.checksumValid)
        throw new Error("Source file is corrupt or was encrypted for a different tag.");

      const output = encryptBytesForBattletag(p.data, trimmed, p.version);

      const url = URL.createObjectURL(new Blob([output], { type: "text/plain" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${FOREVER_GUIDE.id}_${trimmed.replace(/#/g, "_")}.txt`;
      a.click();
      URL.revokeObjectURL(url);

      setStatus({ kind: "done", guides: p.headerCount });
    } catch (e) {
      setStatus({
        kind: "error",
        message: e instanceof Error ? e.message : "Something went wrong.",
      });
    }
  };

  return (
    <div className="w-full max-w-md space-y-3">
      <div className="flex gap-2">
        <input
          value={tag}
          onChange={(e) => {
            setTag(e.target.value);
            setStatus({ kind: "idle" });
          }}
          onKeyDown={(e) => e.key === "Enter" && !busy && download()}
          placeholder="Your BattleTag — Name#12345"
          spellCheck={false}
          autoComplete="off"
          autoFocus
          className="wow-input h-11 flex-1"
        />
        <button
          onClick={download}
          disabled={busy || !valid}
          className="wow-btn-gold h-11 shrink-0 rounded-md px-5 text-sm cursor-pointer"
        >
          {busy ? "Generating…" : "Download key"}
        </button>
      </div>

      <p className="min-h-4 text-center text-xs">
        {status.kind === "done" && (
          <span className="text-green-400">
            {status.guides} guides bound to {trimmed}. Import ingame via addon.
            {/*
              Only ever rendered after a click, so this is never in the
              prerendered HTML — a relative string here is hydration-safe.
              It is the moment a visitor cares whether what they just grabbed
              is current.
            */}
            {UPDATED_AT && (
              <span className="text-muted-foreground/60">
                {" "}
                Guide updated {formatAgo(UPDATED_AT)}.
              </span>
            )}
          </span>
        )}
        {status.kind === "error" && (
          <span className="text-destructive">{status.message}</span>
        )}
        {!busy && status.kind !== "done" && status.kind !== "error" && (
          <span className="text-muted-foreground/50">
            {FOREVER_GUIDE.expansion} · Levels {FOREVER_GUIDE.levels} · runs in
            your browser, your tag is never uploaded.
          </span>
        )}
      </p>
    </div>
  );
}
