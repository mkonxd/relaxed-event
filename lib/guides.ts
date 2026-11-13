/**
 * The one guide this site serves. The blob at `guideUrl` is encrypted for
 * `sourceTag`; the browser decrypts it and re-encrypts for the visitor's tag.
 */
import { BASE_PATH } from "@/lib/base-path";

export const FOREVER_GUIDE = {
  id: "forever",
  title: "WoW Forever Leveling Guide",
  expansion: "WoW Forever",
  levels: "1-60",
  guideUrl: `${BASE_PATH}/forever_Player_1234.txt`,
  sourceTag: "Player#1234",
} as const;
