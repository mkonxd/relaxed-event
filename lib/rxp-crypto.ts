import pako from "pako";

// --- helpers ---

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// --- core crypto ---

/** Derive 16-byte RC4 key from a BattleTag (uses UTF-8 bytes to match Lua). */
export function deriveKey(battletag: string): Uint8Array {
  const lower = battletag.toLowerCase();
  let bytes = new TextEncoder().encode(lower);

  if (bytes.length > 16) {
    bytes = bytes.slice(bytes.length - 16);
  }

  const k = 16 - bytes.length;
  const buffer = new Uint8Array(16);

  for (let i = 0; i < 16; i++) {
    const j = (i - k) & 0xf;
    if (j < bytes.length) {
      buffer[i] = bytes[j];
    }
  }

  for (let i = 0; i < 16; i++) {
    buffer[(-i) & 0xf] =
      buffer[(15 - i) & 0xf] ^
      buffer[(13 - i) & 0xf] ^
      buffer[(12 - i) & 0xf] ^
      buffer[(10 - i) & 0xf];
  }

  return buffer;
}

/** RC4 Key Scheduling Algorithm. */
export function rc4Ksa(key16: Uint8Array): Uint8Array {
  const S = new Uint8Array(256);
  for (let i = 0; i < 256; i++) S[i] = i;
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + S[i] + key16[i & 0xf]) & 0xff;
    const tmp = S[i];
    S[i] = S[j];
    S[j] = tmp;
  }
  return S;
}

/** RC4 PRGA — symmetric encrypt/decrypt. Copies S-box before use. */
export function rc4Crypt(sBox: Uint8Array, data: Uint8Array): Uint8Array {
  const S = new Uint8Array(sBox);
  let i = 0,
    j = 0;
  const out = new Uint8Array(data.length);
  for (let k = 0; k < data.length; k++) {
    i = (i + 1) & 0xff;
    j = (j + S[i]) & 0xff;
    const tmp = S[i];
    S[i] = S[j];
    S[j] = tmp;
    out[k] = data[k] ^ S[(S[i] + S[j]) & 0xff];
  }
  return out;
}

/** Adler-32 matching the addon's unrolled A32 implementation. */
export function adler32(data: Uint8Array): number {
  let a = 1;
  let b = 0;
  let i = 0;
  const len = data.length;

  while (i <= len - 16) {
    const x0 = data[i],
      x1 = data[i + 1],
      x2 = data[i + 2],
      x3 = data[i + 3];
    const x4 = data[i + 4],
      x5 = data[i + 5],
      x6 = data[i + 6],
      x7 = data[i + 7];
    const x8 = data[i + 8],
      x9 = data[i + 9],
      x10 = data[i + 10],
      x11 = data[i + 11];
    const x12 = data[i + 12],
      x13 = data[i + 13],
      x14 = data[i + 14],
      x15 = data[i + 15];

    b =
      (b +
        16 * a +
        16 * x0 +
        15 * x1 +
        14 * x2 +
        13 * x3 +
        12 * x4 +
        11 * x5 +
        10 * x6 +
        9 * x7 +
        8 * x8 +
        7 * x9 +
        6 * x10 +
        5 * x11 +
        4 * x12 +
        3 * x13 +
        2 * x14 +
        x15) %
      65521;
    a =
      (a +
        x0 +
        x1 +
        x2 +
        x3 +
        x4 +
        x5 +
        x6 +
        x7 +
        x8 +
        x9 +
        x10 +
        x11 +
        x12 +
        x13 +
        x14 +
        x15) %
      65521;
    i += 16;
  }

  while (i < len) {
    a = (a + data[i]) % 65521;
    b = (b + a) % 65521;
    i++;
  }

  return ((b * 65536 + a) >>> 0);
}

// --- high-level API ---

/**
 * On-disk layout of an RXPGuides export:
 *
 *   `<nGuides>|<adler32>:<base64(RC4(deflate(payload)))>%|<version>`
 *
 * `payload` is the raw, uncompressed byte blob. The addon builds it by
 * prefixing every serialized guide with a `\x00` separator, so the blob
 * *starts* with `\x00` and `payload.split("\x00")` therefore yields one
 * extra (empty) leading field. `nGuides` counts the real (non-empty)
 * guides, and `adler32` is taken over the payload bytes exactly as-is.
 *
 * That means any re-write of the payload that normalises away empty
 * fields silently breaks the file: the checksum no longer describes the
 * blob the addon expects, and the guide list is shifted by one field.
 * So everything below round-trips the payload as opaque bytes.
 */

export interface DecryptedPayload {
  /** Exact decompressed payload bytes — never filtered or re-joined. */
  data: Uint8Array;
  /** Lossless UTF-8 decode of `data` (display/inspection only). */
  text: string;
  version: number;
  /** Guide count as declared in the file header. */
  headerCount: number;
  /** Adler-32 as declared in the file header. */
  headerChecksum: number;
  /** Whether the header checksum matches `data`. */
  checksumValid: boolean;
}

export interface DecryptResult {
  plaintext: string;
  version: number;
  guideCount: number;
}

/** Number of real (non-empty) `\x00`-separated guide records in a payload. */
export function countGuides(data: Uint8Array | string): number {
  const text =
    typeof data === "string" ? data : new TextDecoder("utf-8").decode(data);
  let n = 0;
  for (const field of text.split("\x00")) if (field.trim()) n++;
  return n;
}

/**
 * Decrypt an RXPGuides export file, returning the payload byte-for-byte.
 * This is the function to use when re-encrypting.
 */
export function decryptGuideBytes(
  raw: string,
  battletag: string,
): DecryptedPayload {
  const versionMatch = raw.match(/\|(\d+)\s*$/);
  const version = versionMatch ? parseInt(versionMatch[1], 10) : 40000;

  const key16 = deriveKey(battletag);
  const S = rc4Ksa(key16);

  const chunks = [...raw.matchAll(/(-?\d+)(\D)([A-Za-z0-9+/=]+)%/g)];
  if (chunks.length === 0) throw new Error("No encrypted chunks found.");

  const parts: Uint8Array[] = [];
  let headerCount = 0;
  let headerChecksum = 0;

  for (const [, , mode, content] of chunks) {
    if (mode.charCodeAt(0) !== 58) continue; // ':' = deflate + RC4
    const decoded = base64ToUint8(content);
    try {
      parts.push(pako.inflate(rc4Crypt(S, decoded)));
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      throw new Error(
        `Failed to decrypt for "${battletag}" (${detail}). Wrong BattleTag?`,
      );
    }
  }

  if (parts.length === 0) throw new Error("Unsupported chunk mode.");

  // A chunk header actually looks like `<count>|<checksum>:<b64>`, so pull
  // both numbers back out of the raw text rather than the capture group.
  const headerMatch = [...raw.matchAll(/(-?\d+)\|(\d+):/g)];
  for (const [, c, s] of headerMatch) {
    headerCount = parseInt(c, 10);
    headerChecksum = parseInt(s, 10);
  }

  const total = parts.reduce((n, p) => n + p.length, 0);
  const data = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    data.set(p, off);
    off += p.length;
  }

  return {
    data,
    text: new TextDecoder("utf-8", { fatal: false }).decode(data),
    version,
    headerCount,
    headerChecksum,
    checksumValid: adler32(data) === headerChecksum,
  };
}

/**
 * Encrypt a raw payload blob for `newBattletag`.
 * `nGuides` defaults to the number of non-empty guide records, which is
 * what the addon writes.
 */
export function encryptBytesForBattletag(
  data: Uint8Array,
  newBattletag: string,
  version: number,
  nGuides: number = countGuides(data),
): string {
  const checksum = adler32(data);
  const compressed = pako.deflate(data);
  const S = rc4Ksa(deriveKey(newBattletag));
  const encoded = uint8ToBase64(rc4Crypt(S, compressed));
  return `${nGuides}|${checksum}:${encoded}%|${version}`;
}

/**
 * Decrypt an RXPGuides export file (string form).
 * Lossless: `plaintext` keeps every field, including empty ones, so it can
 * be handed straight back to {@link encryptForBattletag}.
 */
export function decryptGuideFile(
  raw: string,
  battletag: string,
): DecryptResult {
  const p = decryptGuideBytes(raw, battletag);
  return {
    plaintext: p.text,
    version: p.version,
    guideCount: p.headerCount || countGuides(p.data),
  };
}

/** Encrypt plaintext guides for a BattleTag. */
export function encryptForBattletag(
  plaintext: string,
  newBattletag: string,
  version: number,
): string {
  return encryptBytesForBattletag(
    new TextEncoder().encode(plaintext),
    newBattletag,
    version,
  );
}
