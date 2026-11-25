import type { Tone } from "../../lib/format";

/** Colour appears only in data: green for gains, red for losses. */
export function toneClass(tone: Tone): string {
  if (tone === "gain") return "text-gain";
  if (tone === "loss") return "text-loss";
  return "";
}
