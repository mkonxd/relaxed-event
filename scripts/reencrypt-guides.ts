/**
 * Batch re-encrypt every forever guide shipped in public/ for one target BattleTag.
 *
 *   TARGET_TAG="Me#12345" npx tsx scripts/reencrypt-guides.ts
 *
 * Superseded by scripts/reencrypt.ts for one-off files, but kept so the
 * whole catalogue can be re-forged in one go. Output goes to public/out/.
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, basename } from "path";
import { decryptGuideBytes, encryptBytesForBattletag } from "../lib/rxp-crypto";

const SOURCE_TAG = "Player#1234";
const TARGET_TAG = process.env.TARGET_TAG ?? "";

if (!/^.+#\d+$/.test(TARGET_TAG)) {
  console.error('Set TARGET_TAG, e.g. TARGET_TAG="Me#12345" npx tsx scripts/reencrypt-guides.ts');
  process.exit(1);
}

const publicDir = join(__dirname, "..", "public");
const outDir = join(publicDir, "out");
mkdirSync(outDir, { recursive: true });

const files = [
  "forever_Player_1234.txt",
];

for (const file of files) {
  const raw = readFileSync(join(publicDir, file), "utf-8").trim();
  console.log(`${file}:`);

  const p = decryptGuideBytes(raw, SOURCE_TAG);
  if (!p.checksumValid)
    throw new Error(`  checksum mismatch for "${SOURCE_TAG}" — wrong tag or corrupt file.`);
  console.log(`  ${p.headerCount} guides, version ${p.version}, payload ${p.data.length} bytes`);

  const encrypted = encryptBytesForBattletag(p.data, TARGET_TAG, p.version);

  // Self-check: the output must decrypt back to identical bytes.
  const back = decryptGuideBytes(encrypted, TARGET_TAG);
  const ok =
    back.checksumValid &&
    back.data.length === p.data.length &&
    back.data.every((v, i) => v === p.data[i]);
  if (!ok) throw new Error(`  self-check failed for ${TARGET_TAG}`);

  const outPath = join(outDir, `${basename(file, ".txt")}_${TARGET_TAG.replace(/#/g, "_")}.txt`);
  writeFileSync(outPath, encrypted, "utf-8");
  console.log(`  -> ${outPath}`);
}

console.log("Done!");
