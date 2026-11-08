/**
 * Multi-chord devices shown as spans: pedal points, line clichés, descending bass lines (lament),
 * Mixolydian I–bVII–IV and Dorian i–IV vamps, and Coltrane (major-third) cycles.
 * All detection is relative (pitch-class differences), so it is transposition-invariant.
 */
import type { Chord } from "./chord";
import { spellInKey, type Key } from "./key";
import { mod12 } from "./pitch";
import type { ProgressionItem } from "./progression";
import { fmtEn, m, type Msg } from "./i18n";

export type SpanType = "pedal" | "line-cliche" | "lament" | "mixolydian-vamp" | "dorian-vamp" | "coltrane-cycle";

export interface Span {
  type: SpanType;
  start: number; // first chord index
  end: number; // last chord index (inclusive)
  label: string;
  explanation: string;
  labelMsg: Msg;
  explanationMsg: Msg;
}

function mk(type: SpanType, start: number, end: number, labelMsg: Msg, explanationMsg: Msg): Span {
  return { type, start, end, label: fmtEn(labelMsg), explanation: fmtEn(explanationMsg), labelMsg, explanationMsg };
}

const isMajorish = (c: Chord) => c.triad === "major" || c.triad === "sus4" || c.triad === "sus2";
const isDominant7 = (c: Chord) => (c.triad === "major" || c.triad === "augmented") && c.seventh === "minor7";

function pedals(items: ProgressionItem[], key: Key): Span[] {
  const out: Span[] = [];
  let i = 0;
  while (i < items.length) {
    let j = i;
    while (j + 1 < items.length && items[j + 1].chord.bass === items[i].chord.bass) j++;
    const run = items.slice(i, j + 1);
    const bass = items[i].chord.bass;
    if (run.length >= 3 && run.some((it) => it.chord.root !== bass)) {
      const off = mod12(bass - key.tonic);
      const n = spellInKey(bass, key);
      const label = off === 0 ? m("span.pedal.tonic") : off === 7 ? m("span.pedal.dominant") : m("span.pedal.other", { n });
      out.push(mk("pedal", i, j, label, m("span.pedal.expl", { label, n })));
    }
    i = j + 1;
  }
  return out;
}

/** Pitch classes available in a chord for a moving inner line (chord tones plus bass). */
function voicePcs(c: Chord): number[] {
  return [...new Set([...c.pcs, c.bass])];
}

function lineCliches(items: ProgressionItem[], key: Key): Span[] {
  const out: Span[] = [];
  let i = 0;
  while (i < items.length) {
    let j = i;
    while (j + 1 < items.length && items[j + 1].chord.root === items[i].chord.root) j++;
    if (j - i + 1 >= 3) {
      // Search for a voice moving by semitone in one direction through every chord of the run.
      const run = items.slice(i, j + 1).map((it) => it.chord);
      let found: { dir: number; start: number } | null = null;
      for (const dir of [-1, 1]) {
        for (const p0 of voicePcs(run[0])) {
          let ok = true;
          let p = p0;
          for (let k = 1; k < run.length; k++) {
            const q = mod12(p + dir);
            if (!voicePcs(run[k]).includes(q) || voicePcs(run[k - 1]).includes(q)) { ok = false; break; }
            p = q;
          }
          if (ok) { found = { dir, start: p0 }; break; }
        }
        if (found) break;
      }
      if (found) {
        const line = run.map((_, k) => spellInKey(mod12(found!.start + found!.dir * k), key)).join("–");
        out.push(mk("line-cliche", i, j,
          m("span.cliche.label", { dir: m(found.dir < 0 ? "span.dir.descending" : "span.dir.ascending") }),
          m("span.cliche.expl", { root: run[0].rootName, line })));
      }
    }
    i = Math.max(j + 1, i + 1);
  }
  return out;
}

function descendingBass(items: ProgressionItem[], key: Key, minorKey: boolean): Span[] {
  const out: Span[] = [];
  let i = 0;
  while (i < items.length - 1) {
    let j = i;
    while (j + 1 < items.length) {
      const step = mod12(items[j].chord.bass - items[j + 1].chord.bass);
      if (step === 1 || step === 2) j++;
      else break;
    }
    if (j - i + 1 >= 4) {
      const basses = items.slice(i, j + 1).map((it) => it.chord.bass);
      const steps = basses.slice(1).map((b, k) => mod12(basses[k] - b));
      const chromatic = steps.every((s) => s === 1);
      // Descending tetrachord: from the tonic down to the dominant (a perfect fourth) inside the run.
      const startOff = mod12(basses[0] - key.tonic);
      let fell = 0, tetrachord = false;
      for (const s of steps) { fell += s; if (startOff === 0 && fell === 5) tetrachord = true; }
      const names = basses.map((b) => spellInKey(b, key)).join("–");
      const lament = tetrachord && minorKey;
      out.push(mk("lament", i, j,
        m(lament ? (chromatic ? "span.lament.chromatic" : "span.lament.tetrachord") : chromatic ? "span.desc.chromatic" : "span.desc.plain"),
        m(lament ? "span.lament.expl" : "span.desc.expl", { names })));
      i = j;
    } else {
      i++;
    }
  }
  return out;
}

function vamps(items: ProgressionItem[], key: Key): Span[] {
  const out: Span[] = [];
  const n = items.length;
  // Mixolydian I–bVII–IV: three consecutive major chords whose roots are r, r−2, r−7 (any rotation).
  for (let i = 0; i + 2 < n; i++) {
    const cs = [items[i], items[i + 1], items[i + 2]].map((it) => it.chord);
    if (!cs.every(isMajorish)) continue;
    for (const r of cs.map((c) => c.root).filter((r) => r === key.tonic)) {
      const rel = cs.map((c) => mod12(c.root - r)).sort((a, b) => a - b);
      if (rel.join(",") === "0,5,10") {
        if (!out.some((s) => s.type === "mixolydian-vamp" && s.end >= i)) {
          out.push(mk("mixolydian-vamp", i, i + 2, m("span.mixo.label"), m("span.mixo.expl")));
        } else {
          out[out.length - 1].end = i + 2;
        }
        break;
      }
    }
  }
  // Dorian i–IV: alternating minor chord and major chord a fourth above, at least 3 chords.
  let i = 0;
  while (i + 2 < n) {
    const a = items[i].chord, b = items[i + 1].chord;
    if (a.root === key.tonic && a.triad === "minor" && isMajorish(b) && mod12(b.root - a.root) === 5) {
      let j = i + 1;
      while (j + 1 < n) {
        const want = (j + 1 - i) % 2 === 0 ? a.root : b.root;
        if (items[j + 1].chord.root === want) j++;
        else break;
      }
      if (j - i + 1 >= 3) {
        out.push(mk("dorian-vamp", i, j, m("span.dorian.label"), m("span.dorian.expl")));
        i = j + 1;
        continue;
      }
    }
    i++;
  }
  return out;
}

/** Coltrane cycle: three or more V7 → I arrivals whose tonics move by major thirds. */
function coltrane(items: ProgressionItem[], key: Key): Span[] {
  const arrivals: { idx: number; root: number }[] = [];
  for (let i = 1; i < items.length; i++) {
    const p = items[i - 1].chord, c = items[i].chord;
    if (isDominant7(p) && mod12(p.root - c.root) === 7 && (c.triad === "major" || c.triad === "minor")) arrivals.push({ idx: i, root: c.root });
  }
  const out: Span[] = [];
  let k = 0;
  while (k < arrivals.length) {
    let m2 = k;
    while (m2 + 1 < arrivals.length && arrivals[m2 + 1].idx - arrivals[m2].idx <= 3 && [4, 8].includes(mod12(arrivals[m2 + 1].root - arrivals[m2].root))) m2++;
    // Include the chord before the first arrival if it is itself a tonic a major third away.
    if (m2 - k + 1 >= 2) {
      let start = arrivals[k].idx - 1;
      const before = start - 1;
      let count = m2 - k + 1;
      if (before >= 0 && [4, 8].includes(mod12(arrivals[k].root - items[before].chord.root)) && (items[before].chord.triad === "major")) { start = before; count++; }
      if (count >= 3) {
        const tonics = [...(start < arrivals[k].idx - 1 ? [items[start].chord.root] : []), ...arrivals.slice(k, m2 + 1).map((a) => a.root)];
        out.push(mk("coltrane-cycle", start, arrivals[m2].idx, m("span.coltrane.label"),
          m("span.coltrane.expl", { list: tonics.map((r) => spellInKey(r, key)).join(" → ") })));
      }
    }
    k = m2 + 1;
  }
  return out;
}

export function detectSpans(items: ProgressionItem[], key: Key): Span[] {
  return [
    ...pedals(items, key),
    ...lineCliches(items, key),
    ...descendingBass(items, key, key.mode === "minor"),
    ...vamps(items, key),
    ...coltrane(items, key),
  ].sort((a, b) => a.start - b.start || a.end - b.end);
}
