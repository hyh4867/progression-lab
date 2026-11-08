import { describe, expect, it } from "vitest";
import { reharmonise, presetTarget, RULE_NAMES, ADVANCED_RULES } from "../reharm";
import { tensionCurve } from "../tension";
import { parseProgression } from "../progression";
import { parseKey } from "../key";
import { parseChord } from "../chord";
import { analyseProgression } from "../analysis";
import { LABELLED_PROGRESSIONS } from "../corpus";
import { LIBRARY } from "../library";

/**
 * Target = the slot tension curve of the intended result (`goal`, one "|" group per original slot), so the
 * test checks that the rule is generated, explained and survives the never-worse filter.
 */
function slotCurve(goal: string, key: string): number[] {
  const slots = goal.split("|").map((g) => g.trim().split(/\s+/));
  const flat = parseProgression(slots.map((g) => g.join(" ")).join(" ")).items;
  const t = tensionCurve(flat, parseKey(key)!).map((p) => p.total);
  let k = 0;
  return slots.map((g) => { const v = t.slice(k, k + g.length); k += g.length; return v.reduce((a, b) => a + b, 0) / v.length; });
}

function run(chords: string, key: string, opts: { goal?: string; locked?: boolean[]; advanced?: boolean } = {}) {
  const items = parseProgression(chords).items;
  const k = parseKey(key)!;
  const curve = tensionCurve(items, k).map((p) => p.total);
  const target = opts.goal ? slotCurve(opts.goal, key) : presetTarget(curve, "tenser");
  return { items, k, r: reharmonise({ items, key: k, target, locked: opts.locked, advancedRules: opts.advanced ?? true, maxResults: 50, beamWidth: 64 }) };
}

const symbolsOf = (s: { items: { chord: { symbol: string } }[] }) => s.items.map((i) => i.chord.symbol).join(" ");

describe("advanced reharm rules", () => {
  it("augmented-sixth approach to V, analysed as Ger+6", () => {
    const { r, k } = run("C F G C", "C", { locked: [true, false, true, true], goal: "C | Ab7 | G | C" });
    const s = r.suggestions.find((x) => x.changes.some((c) => c.rules.includes("augmented-sixth")));
    expect(s).toBeDefined();
    expect(symbolsOf(s!)).toBe("C Ab7 G C");
    expect(analyseProgression(s!.items, k)[1].device).toBe("aug6-ger");
  });

  it("Neapolitan approach to V, analysed as N6", () => {
    const { r, k } = run("Am Dm E Am", "Am", { locked: [true, false, true, true], goal: "Am | Bb/D | E | Am" });
    const s = r.suggestions.find((x) => x.changes.some((c) => c.rules.includes("neapolitan-approach")));
    expect(s).toBeDefined();
    expect(s!.items[1].chord.symbol).toBe("Bb/D");
    expect(analyseProgression(s!.items, k)[1].device).toBe("neapolitan");
  });

  it("backdoor ii–V into the tonic, analysed as backdoor dominant", () => {
    const { r, k } = run("C Am F C", "C", { locked: [true, true, false, true], goal: "C | Am | Fm7 Bb7 | C" });
    const s = r.suggestions.find((x) => x.changes.some((c) => c.rules.includes("backdoor-ii-v")));
    expect(s).toBeDefined();
    expect(symbolsOf(s!)).toBe("C Am Fm7 Bb7 C");
    expect(analyseProgression(s!.items, k)[3].device).toBe("backdoor-dominant");
  });

  it("chromatic-mediant substitution, analysed as chromatic mediant", () => {
    const { r, k } = run("C F C G C", "C", { locked: [true, true, false, true, true], goal: "C | F | E | G | C" });
    const s = r.suggestions.find((x) => x.changes.some((c) => c.rules.includes("chromatic-mediant")));
    expect(s).toBeDefined();
    const a = analyseProgression(s!.items, k)[2];
    expect(a.device).toBe("chromatic-mediant");
  });

  it("advanced rules are off by default", () => {
    const { r } = run("C F G C", "C", { locked: [true, false, true, true], advanced: false });
    expect(r.suggestions.some((x) => x.changes.some((c) => c.rules.some((rule) => ADVANCED_RULES.includes(rule))))).toBe(false);
  });

  it("property: with advanced rules on, locks hold, chords parse, explanations name rules, never worse than original", () => {
    let n = 0;
    const sets = [...LABELLED_PROGRESSIONS.map((p) => [p.chords, p.key]), ...LIBRARY.map((e) => [e.chords, e.key])];
    for (const [chords, key] of sets) {
      const items = parseProgression(chords).items;
      const k = parseKey(key)!;
      const curve = tensionCurve(items, k).map((p) => p.total);
      const locked = items.map((_, i) => i === 0 || i === items.length - 1);
      const r = reharmonise({ items, key: k, target: presetTarget(curve, "arch"), locked, advancedRules: true });
      n++;
      for (const s of r.suggestions) {
        expect(s.curveDistance).toBeLessThanOrEqual(r.original.curveDistance + 1e-9);
        for (const c of s.changes) {
          expect(locked[c.slot]).toBe(false);
          for (const rule of c.rules) expect(c.text).toContain(RULE_NAMES[rule]);
        }
        for (const it of s.items) expect(parseChord(it.chord.symbol).pcs).toEqual(it.chord.pcs);
      }
    }
    expect(n).toBe(LABELLED_PROGRESSIONS.length + LIBRARY.length);
  });
});
