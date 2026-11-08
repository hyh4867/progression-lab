/**
 * Text of the key panel as language-neutral messages.
 * - With a manual key, the header is the manual key and the auto-detection statistics are labelled as such;
 *   any relation ("relative key") is stated relative to the auto-detected key, never to the manual one.
 * - When key regions find 3+ distinct key centres (or a Coltrane cycle), the ambiguity note is replaced by
 *   "This progression moves through N key centres: …".
 */
import { m, type Msg } from "./i18n";
import { keyRelation, type KeyResult } from "./keyfinding";
import { keyShortName, tonicName, type Key } from "./key";
import type { Region } from "./regions";
import type { Span } from "./structure";

export const keyMsg = (k: Key): Msg => m(k.mode === "major" ? "key.major" : "key.minor", { t: tonicName(k) });

export interface KeyPanelText {
  header: Msg;
  stats: Msg;
  note: Msg;
  noteKind: "centres" | "ambiguous" | "clear";
}

export function keyCentres(regions: Region[]): string[] {
  const out: string[] = [];
  for (const r of regions) {
    const name = keyShortName(r.key);
    if (!out.includes(name)) out.push(name);
  }
  return out;
}

export function keyPanel(result: KeyResult, manual: Key | null, regions: Region[], spans: Span[]): KeyPanelText {
  const best = result.ranked[0], second = result.ranked[1];
  const header = keyMsg(manual ?? best.key);
  const relTo = m(`ui.key.relOf.${keyRelation(best.key, second.key)}` as Msg["k"]);
  const stats = manual
    ? m("ui.key.autoLine", { name: keyMsg(best.key), r: best.score.toFixed(2), name2: keyMsg(second.key), r2: second.score.toFixed(2), relTo })
    : m("ui.key.confidence", { pct: Math.round(result.confidence * 100), r: best.score.toFixed(2), name: keyMsg(second.key), r2: second.score.toFixed(2) });
  const centres = keyCentres(regions);
  if (centres.length >= 3 || spans.some((s) => s.type === "coltrane-cycle")) {
    return { header, stats, note: m("ui.key.centres", { n: centres.length, list: centres.join(", ") }), noteKind: "centres" };
  }
  if (result.ambiguous && result.alternative) {
    const note = manual
      ? m("ui.key.ambiguousManual", { a: keyMsg(best.key), b: keyMsg(result.alternative.key), relTo, m: keyMsg(manual) })
      : m("ui.key.ambiguous", { name: keyMsg(result.alternative.key), rel: m(`rel.${result.alternative.relation}` as Msg["k"]) });
    return { header, stats, note, noteKind: "ambiguous" };
  }
  return { header, stats, note: m("ui.key.clear"), noteKind: "clear" };
}
