/** Full v2 analysis bundle used by the UI, the library tests and the advanced evaluation. */
import { analyseProgression, detectCadences, type Cadence, type ChordAnalysis } from "./analysis";
import { keyShortName } from "./key";
import { analyseRegions, type RegionResult } from "./regions";
import { detectSpans, type Span } from "./structure";
import type { Key } from "./key";
import type { ProgressionItem } from "./progression";

export interface LocalReading {
  keyName: string;
  roman: string;
  function: ChordAnalysis["function"];
}

export interface FullAnalysis {
  chords: ChordAnalysis[];
  /** For chords inside a modulation or tonicised region: the reading in that region's key. */
  local: (LocalReading | null)[];
  cadences: Cadence[];
  spans: Span[];
  regions: RegionResult;
}

export function analyseFull(items: ProgressionItem[], key: Key): FullAnalysis {
  const chords = analyseProgression(items, key);
  const regions = analyseRegions(items, key);
  const local: (LocalReading | null)[] = items.map(() => null);
  // With more than one region, every chord gets its reading in its own region's key (home included).
  for (const r of regions.regions) {
    if (regions.regions.length <= 1) break;
    const slice = items.slice(r.start, r.end + 1);
    analyseProgression(slice, r.key).forEach((a, k) => {
      local[r.start + k] = { keyName: keyShortName(r.key), roman: a.roman, function: a.function };
    });
  }
  return {
    chords,
    local,
    cadences: detectCadences(items, chords),
    spans: detectSpans(items, key),
    regions,
  };
}

/** Every device tag found anywhere: chord tags, span types, "cadence:<type>", "modulation", "pivot", "tonicisation". */
export function deviceTags(a: FullAnalysis): Set<string> {
  const s = new Set<string>();
  for (const c of a.chords) for (const t of c.tags) s.add(t);
  for (const sp of a.spans) s.add(sp.type);
  for (const c of a.cadences) s.add("cadence:" + c.type);
  for (const r of a.regions.regions) if (r.kind !== "home") s.add(r.kind);
  if (a.regions.pivots.length) s.add("pivot");
  return s;
}
