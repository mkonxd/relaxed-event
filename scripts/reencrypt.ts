/**
 * Re-encrypt an RXPGuides export for a different BattleTag.
 *
 *   npx tsx scripts/reencrypt.ts <input> <sourceTag> <targetTag> [output]
 *   npx tsx scripts/reencrypt.ts --verify <input> <tag>
 *
 *
 * The payload blob is copied byte-for-byte, so the output is exactly what
 * the addon itself would have written for the target tag.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, join, basename } from "path";
import {
  adler32,
  decryptGuideBytes,
  encryptBytesForBattletag,
  countGuides,
} from "../lib/rxp-crypto";

const BATTLETAG_RE = /^.+#\d+$/;
const [, , a1, a2, a3, a4] = process.argv;

if (!a1 || a1 === "-h" || a1 === "--help") {
  console.log(
    "usage: npx tsx scripts/reencrypt.ts <input> <sourceTag> <targetTag> [output]\n" +
      "       npx tsx scripts/reencrypt.ts --verify <input> <tag>",
  );
  process.exit(1);
}

const verify = a1 === "--verify";
const input = resolve(verify ? a2 : a1);
const sourceTag = verify ? a3 : a2;
const targetTag = verify ? undefined : a3;
const output = verify ? undefined : a4;

if (!existsSync(input)) {
  console.error(`No such file: ${input}`);
  process.exit(1);
}
if (!BATTLETAG_RE.test(sourceTag)) {
  console.error(`Bad source BattleTag "${sourceTag}". Expected Name#12345`);
  process.exit(1);
}

const raw = readFileSync(input, "utf-8").trim();

let src;
try {
  src = decryptGuideBytes(raw, sourceTag);
} catch (e) {
  console.error(
    `Could not decrypt as "${sourceTag}": ${e instanceof Error ? e.message : e}`,
  );
  console.error(`(Wrong BattleTag? Tag derivation is case-insensitive but exact.)`);
  process.exit(1);
}

console.log(`input          ${input}`);
console.log(`source tag     ${sourceTag}`);
console.log(`version        ${src.version}`);
console.log(`guides         ${src.headerCount || countGuides(src.data)}`);
console.log(`payload bytes  ${src.data.length}`);
console.log(
  `checksum       header ${src.headerChecksum} / computed ${adler32(src.data)} ` +
    `-> ${src.checksumValid ? "VALID" : "MISMATCH"}`,
);

if (!src.checksumValid) {
  console.error(
    "\nHeader checksum does not match the decrypted payload.\n" +
      "The tag is probably wrong (a wrong key yields garbage that decompresses " +
      "by luck), or the file is truncated.",
  );
  process.exit(1);
}

if (verify || !targetTag) {
  console.log("\n--verify: OK, file decrypts cleanly and its checksum is valid.");
  process.exit(0);
}

if (!BATTLETAG_RE.test(targetTag)) {
  console.error(`Bad target BattleTag "${targetTag}". Expected Name#12345`);
  process.exit(1);
}

const out = encryptBytesForBattletag(src.data, targetTag, src.version);

// Self-check: decrypt what we just wrote and require byte equality.
const round = decryptGuideBytes(out, targetTag);
const identical =
  round.data.length === src.data.length &&
  round.data.every((v, i) => v === src.data[i]);
if (!identical || !round.checksumValid) {
  console.error("Self-check failed — refusing to write output.");
  process.exit(1);
}

const base = basename(input).replace(/\.txt$/, "");
const outPath =
  output ??
  join(
    resolve(input, ".."),
    `${base}_${targetTag.replace(/#/g, "_").toLowerCase()}.txt`,
  );

writeFileSync(outPath, out, "utf-8");
console.log(`\ntarget tag     ${targetTag}`);
console.log(`header         ${out.slice(0, out.indexOf(":"))}`);
console.log(`self-check     round-trip byte-identical + checksum valid`);
console.log(`written        ${outPath}`);
