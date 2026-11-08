import { describe, expect, it } from "vitest";
import { en } from "../i18n/en";
import { ko } from "../i18n/ko";
import { fmt, type Msg } from "../i18n";
import { LIBRARY_KO } from "../i18n/library.ko";
import { LIBRARY } from "../library";
import { RULE_NAMES, reharmonise, presetTarget } from "../reharm";
import { analyseFull } from "../harmony";
import { parseProgression } from "../progression";
import { parseKey } from "../key";
import { tensionCurve } from "../tension";
import { LABELLED_PROGRESSIONS } from "../corpus";
import { ADVANCED_PROGRESSIONS } from "../advancedCorpus";

const placeholders = (s: string) => [...new Set([...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();
const ALL = [...LABELLED_PROGRESSIONS, ...ADVANCED_PROGRESSIONS, ...LIBRARY].map((p) => ({ chords: p.chords, key: p.key }));

/** Every message produced for a progression: chord texts, spans, cadences. */
function messagesOf(chords: string, key: string): (Msg | string)[] {
  const a = analyseFull(parseProgression(chords).items, parseKey(key)!);
  return [
    ...a.chords.flatMap((c) => [c.texts.deviceName, c.texts.chip, c.texts.reason, c.texts.explanation, ...c.texts.alternatives]),
    ...a.spans.flatMap((s) => [s.labelMsg, s.explanationMsg]),
    ...a.cadences.map((c) => c.descriptionMsg),
  ];
}

describe("dictionary parity", () => {
  it("en and ko have exactly the same keys", () => {
    expect(Object.keys(ko).sort()).toEqual(Object.keys(en).sort());
  });

  it("every key uses the same placeholders in both languages, and ko is never empty unless en is", () => {
    for (const k of Object.keys(en) as (keyof typeof en)[]) {
      expect(placeholders(ko[k]), k).toEqual(placeholders(en[k]));
      if (en[k] !== "") expect(ko[k].length, k).toBeGreaterThan(0);
    }
  });

  it("every library entry has a Korean name, alternative names, explanation and (if any) context", () => {
    for (const e of LIBRARY) {
      const k = LIBRARY_KO[e.id];
      expect(k, e.id).toBeDefined();
      expect(k.name.length).toBeGreaterThan(0);
      expect(k.why.length).toBeGreaterThan(0);
      expect(k.aka.length, e.id).toBe(e.aka.length);
      expect(!!k.context, e.id).toBe(!!e.context);
    }
    expect(Object.keys(LIBRARY_KO).sort()).toEqual(LIBRARY.map((e) => e.id).sort());
  });

  it("the engine's English rule names come from the dictionary", () => {
    for (const [id, name] of Object.entries(RULE_NAMES)) expect(en[`rule.${id}` as keyof typeof en]).toBe(name);
  });
});

describe("rendering", () => {
  it("every engine message renders fully in both languages (no unfilled placeholders)", () => {
    let count = 0;
    for (const p of ALL) {
      for (const msg of messagesOf(p.chords, p.key)) {
        for (const lang of ["en", "ko"] as const) {
          const s = fmt(lang, msg);
          expect(s, JSON.stringify(msg)).not.toMatch(/\{\w+\}/);
          count++;
        }
      }
    }
    expect(count).toBeGreaterThan(1000);
  });

  it("the English strings the engine returns equal fmt('en') of its messages", () => {
    for (const p of ALL) {
      const a = analyseFull(parseProgression(p.chords).items, parseKey(p.key)!);
      for (const c of a.chords) {
        expect(c.explanation).toBe(fmt("en", c.texts.explanation));
        expect(c.deviceName).toBe(fmt("en", c.texts.deviceName));
        expect(c.reason).toBe(fmt("en", c.texts.reason));
      }
    }
  });

  it("reharmoniser change texts render in Korean", () => {
    const items = parseProgression("C Am Dm G C").items;
    const key = parseKey("C")!;
    const curve = tensionCurve(items, key).map((p) => p.total);
    const r = reharmonise({ items, key, target: presetTarget(curve, "arch"), locked: [true, false, false, false, true], advancedRules: true });
    expect(r.suggestions.length).toBeGreaterThan(0);
    for (const s of r.suggestions) for (const c of s.changes) {
      expect(fmt("en", c.textMsg)).toBe(c.text);
      const k = fmt("ko", c.textMsg);
      expect(k).toMatch(/번째 코드/);
      expect(k).not.toMatch(/\{\w+\}/);
    }
  });
});

describe("toggling language never changes the analysis", () => {
  it("analysis is computed once and rendering it in either language leaves it unchanged", () => {
    for (const p of ALL) {
      const a = analyseFull(parseProgression(p.chords).items, parseKey(p.key)!);
      const before = JSON.stringify(a);
      for (const lang of ["ko", "en", "ko"] as const) {
        for (const c of a.chords) [c.texts.deviceName, c.texts.chip, c.texts.reason, c.texts.explanation, ...c.texts.alternatives].forEach((x) => fmt(lang, x));
      }
      expect(JSON.stringify(a)).toBe(before);
      // A second analysis (as after a re-render) is identical.
      expect(JSON.stringify(analyseFull(parseProgression(p.chords).items, parseKey(p.key)!))).toBe(before);
    }
  });

  it("Korean function letters map 1:1 to the underlying functions (T/PD/D/PASS ↔ T/SD/D/P)", () => {
    const fns = ["T", "PD", "D", "PASS"] as const;
    const enL = fns.map((f) => en[`fnLetter.${f}`]);
    const koL = fns.map((f) => ko[`fnLetter.${f}`]);
    expect(enL).toEqual(["T", "PD", "D", "PASS"]);
    expect(koL).toEqual(["T", "SD", "D", "P"]);
    expect(new Set(koL).size).toBe(4);
    expect(fns.map((f) => ko[`fnLegend.${f}`])).toEqual(["토닉", "서브도미넌트", "도미넌트", "경과·장식"]);
  });
});
