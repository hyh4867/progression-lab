import { describe, expect, it } from "vitest";
import { reharmonise, presetTarget, voiceLeadingDistance, RULE_NAMES, type TargetPreset } from "../reharm";
import { tensionCurve } from "../tension";
import { parseProgression } from "../progression";
import { parseKey } from "../key";
import { parseChord } from "../chord";
import { LABELLED_PROGRESSIONS } from "../corpus";

/** Small deterministic PRNG (mulberry32) for property tests. */
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PRESETS: TargetPreset[] = ["arch", "tenser", "calmer", "flat"];

function setup(chords: string, key: string) {
  const items = parseProgression(chords).items;
  const k = parseKey(key)!;
  const curve = tensionCurve(items, k).map((p) => p.total);
  return { items, key: k, curve };
}

describe("reharmonisation search", () => {
  it("finds the classic secondary dominant / ii–V moves for I–vi–ii–V–I", () => {
    const { items, key, curve } = setup("C Am Dm G C", "C");
    const r = reharmonise({ items, key, target: presetTarget(curve, "arch"), locked: [true, false, false, false, true] });
    expect(r.suggestions.length).toBeGreaterThan(0);
    expect(r.suggestions.length).toBeLessThanOrEqual(5);
    const all = r.suggestions.flatMap((s) => s.changes.flatMap((c) => c.rules));
    expect(all).toContain("secondary-dominant");
    expect(r.suggestions.some((s) => s.items.map((i) => i.chord.symbol).join(" ") === "C Am D7 G C")).toBe(true);
  });

  it("offers a passing diminished chord between chords a whole step apart", () => {
    const { items, key, curve } = setup("C F G C", "C");
    const r = reharmonise({ items, key, target: presetTarget(curve, "arch"), locked: [true, false, false, true] });
    expect(r.suggestions.some((s) => s.items.some((i) => i.chord.symbol === "F#dim7"))).toBe(true);
  });

  it("can propose a deceptive resolution when the tonic after V is unlocked", () => {
    const { items, key } = setup("C F G C", "C");
    const r = reharmonise({ items, key, target: [0, 8, 10, 10], locked: [true, true, true, false] });
    const dec = r.suggestions.find((s) => s.changes.some((c) => c.rules.includes("deceptive-resolution")));
    expect(dec).toBeDefined();
    expect(["Am", "Ab"]).toContain(dec!.items[3].chord.symbol);
  });

  it("every suggestion explains itself by naming its rule(s)", () => {
    const { items, key, curve } = setup("C G Am F", "C");
    const r = reharmonise({ items, key, target: presetTarget(curve, "arch") });
    for (const s of r.suggestions) {
      expect(s.changes.length).toBeGreaterThan(0);
      for (const c of s.changes) {
        expect(c.rules.length).toBeGreaterThan(0);
        for (const rule of c.rules) expect(c.text).toContain(RULE_NAMES[rule]);
      }
    }
  });

  it("explains when nothing beats the original", () => {
    const { items, key, curve } = setup("C G C", "C");
    const r = reharmonise({ items, key, target: curve, locked: [true, true, true] });
    expect(r.suggestions).toEqual([]);
    expect(r.message).toBeTruthy();
  });
});

describe("reharmonisation properties (all labelled progressions × presets + random targets)", () => {
  const rand = rng(20261108);
  const cases: { id: string; chords: string; key: string; target: (c: number[]) => number[]; locked: (n: number) => boolean[] }[] = [];
  for (const p of LABELLED_PROGRESSIONS) {
    for (const preset of PRESETS) cases.push({ id: `${p.id}/${preset}`, chords: p.chords, key: p.key, target: (c) => presetTarget(c, preset), locked: (n) => Array.from({ length: n }, (_, i) => i === 0 || i === n - 1) });
    const seed = Math.floor(rand() * 1e9);
    cases.push({
      id: `${p.id}/random`, chords: p.chords, key: p.key,
      target: (c) => { const r = rng(seed); return c.map(() => r() * 20); },
      locked: (n) => { const r = rng(seed + 1); return Array.from({ length: n }, () => r() < 0.3); },
    });
  }

  it(`runs ${cases.length} cases: locks hold, chords parse, top result never worse on the target curve`, () => {
    let withSuggestions = 0;
    for (const c of cases) {
      const { items, key, curve } = setup(c.chords, c.key);
      const locked = c.locked(items.length);
      const r = reharmonise({ items, key, target: c.target(curve), locked });
      expect(r.suggestions.length, c.id).toBeLessThanOrEqual(5);
      if (r.suggestions.length) withSuggestions++;
      if (r.suggestions[0]) expect(r.suggestions[0].curveDistance, c.id).toBeLessThanOrEqual(r.original.curveDistance + 1e-9);
      for (const s of r.suggestions) {
        expect(s.curveDistance, c.id).toBeLessThanOrEqual(r.original.curveDistance + 1e-9);
        // Locked slots keep exactly their original chord.
        locked.forEach((isLocked, slot) => {
          if (!isLocked) return;
          expect(s.changes.some((ch) => ch.slot === slot), `${c.id} slot ${slot}`).toBe(false);
        });
        // Rebuild slot contents: the chords in each locked slot equal the original.
        const total = s.items.reduce((acc, it) => acc + it.duration, 0);
        expect(total).toBeCloseTo(items.reduce((acc, it) => acc + it.duration, 0), 9);
        for (const it of s.items) {
          const re = parseChord(it.chord.symbol);
          expect(re.pcs, `${c.id} ${it.chord.symbol}`).toEqual(it.chord.pcs);
        }
      }
    }
    console.log(`[reharm] ${withSuggestions}/${cases.length} cases produced at least one suggestion`);
  });

  it("locked slots are untouched even when every other slot changes", () => {
    const { items, key } = setup("C Am F G C Am Dm G7 C", "C");
    const locked = items.map((_, i) => i % 3 === 0);
    const r = reharmonise({ items, key, target: items.map(() => 15), locked });
    for (const s of r.suggestions) {
      let flat = 0;
      const perSlot: string[][] = items.map(() => []);
      // Re-derive slots from durations (each slot fills its original duration).
      items.forEach((it, slot) => {
        let acc = 0;
        while (acc < it.duration - 1e-9) { perSlot[slot].push(s.items[flat].chord.symbol); acc += s.items[flat].duration; flat++; }
      });
      locked.forEach((l, slot) => { if (l) expect(perSlot[slot]).toEqual([items[slot].chord.symbol]); });
    }
  });
});

describe("voice-leading distance", () => {
  it("is zero for identical chords, symmetric, and small for common-tone moves", () => {
    const C = parseChord("C"), Am = parseChord("Am"), Fs = parseChord("F#");
    expect(voiceLeadingDistance(C, C)).toBe(0);
    expect(voiceLeadingDistance(C, Am)).toBe(voiceLeadingDistance(Am, C));
    expect(voiceLeadingDistance(C, Am)).toBeLessThan(voiceLeadingDistance(C, Fs));
  });
});
