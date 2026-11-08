import { describe, expect, it } from "vitest";
import { analyseProgression, analyseChord, type ChordAnalysis } from "../analysis";
import { analyseFull, deviceTags } from "../harmony";
import { parseProgression, transposeProgression } from "../progression";
import { parseKey, transposeKey, keyShortName } from "../key";
import { parseChord } from "../chord";
import { mod12 } from "../pitch";
import { LABELLED_PROGRESSIONS } from "../corpus";
import { ADVANCED_PROGRESSIONS } from "../advancedCorpus";
import { evaluateAdvanced } from "../evaluation";

const an = (s: string, k: string) => analyseProgression(parseProgression(s).items, parseKey(k)!);
const at = (s: string, k: string, i: number): ChordAnalysis => an(s, k)[i];
const full = (s: string, k: string) => analyseFull(parseProgression(s).items, parseKey(k)!);
const FUNCTIONS = ["T", "PD", "D", "PASS"];

describe("v2 function system: never unknown", () => {
  it("every chord in both labelled sets has T / PD / D / PASS, a device, a reason and an explanation", () => {
    for (const p of [...LABELLED_PROGRESSIONS, ...ADVANCED_PROGRESSIONS]) {
      for (const a of an(p.chords, p.key)) {
        expect(FUNCTIONS, `${p.id} ${a.roman}`).toContain(a.function);
        expect(a.device.length, p.id).toBeGreaterThan(0);
        expect(a.reason.length, p.id).toBeGreaterThan(0);
        expect(a.explanation.length, p.id).toBeGreaterThan(0);
      }
    }
  });

  it("unexplained chords infer their function from the root degree and say so", () => {
    const a = at("C F#m B7 Em", "C", 1);
    expect(a.inferred).toBe(true);
    expect(a.device).toBe("inferred");
    expect(a.chip).toBe("inferred");
    expect(a.function).toBe("PD");
    // Root-degree table: iii → T, bII → PD (no device), V → D.
    expect(analyseChord(parseChord("Ebm"), parseKey("C")!).function).toBe("T");
  });

  it("explanations for non-diatonic chords are one or two sentences", () => {
    for (const p of ADVANCED_PROGRESSIONS) {
      for (const a of an(p.chords, p.key)) {
        if (a.category === "diatonic" && !a.tags.includes("altered-dominant")) continue;
        const sentences = a.explanation.split(/(?<=[.!?])\s+(?=[A-Z])/).filter(Boolean);
        expect(sentences.length, `${p.id} ${a.roman}: ${a.explanation}`).toBeGreaterThanOrEqual(1);
        expect(sentences.length, `${p.id} ${a.roman}: ${a.explanation}`).toBeLessThanOrEqual(2);
      }
    }
  });
});

describe("v2 devices", () => {
  it("symmetric chords: augmented triads are re-rooted by their resolution, with alternatives", () => {
    const a = at("C Dm7 Eb+ C", "C", 2);
    expect(a.roman).toBe("V+");
    expect(a.device).toBe("aug-dominant");
    expect(a.alternatives[0]).toMatch(/Same notes as/);
    expect(at("C C+ C6 C7 F", "C", 1).device).toBe("passing-aug");
    expect(at("C C+ F", "C", 1).function).toBe("PASS");
    expect(at("G G+ C", "C", 1).device).toBe("aug-dominant"); // V–V+–I stays dominant
    expect(at("Am C+ Dm E7 Am", "Am", 1).roman).toBe("III+");
  });

  it("symmetric chords: diminished sevenths resolving up a half step are vii°7 of the target", () => {
    const a = at("C Bbdim7 Dm", "C", 1); // Bb°7 has the notes of C#°7 → D
    expect(a.roman).toBe("vii°7/ii");
    expect(a.device).toBe("leading-tone-dim7");
    expect(at("C F#dim7 G", "C", 1).roman).toBe("vii°7/V");
    expect(at("C C#dim7 Dm7", "C", 1).tags).toContain("passing-dim");
  });

  it("augmented sixths from pitch content and resolution, including pop spellings", () => {
    expect(at("C Ab7 G7 C", "C", 1).device).toBe("aug6-ger");
    expect(at("C Ab7 C/G G7", "C", 1).device).toBe("aug6-ger");
    expect(at("C D7b5/Ab G C", "C", 1).device).toBe("aug6-fr");
    expect(at("C Ab7b5 G C", "C", 1).device).toBe("aug6-fr");
    expect(at("Cm Ab7(no5) G Cm", "Cm", 1).device).toBe("aug6-it");
    const g = at("C Ab7 G7 C", "C", 1);
    expect(g.function).toBe("PD");
    expect(g.alternatives.join(" ")).toMatch(/tritone substitute of V\/V/);
    expect(g.explanation).toMatch(/expands outward/);
    // Same notes, but resolving to the tonic: not an augmented sixth.
    expect(at("C Ab7 C", "C", 1).device).not.toMatch(/^aug6/);
  });

  it("Neapolitan bII and N6; Phrygian bII when it falls straight back to the tonic", () => {
    expect(at("Am Bb/D E7 Am", "Am", 1).roman).toBe("N6");
    expect(at("Cm Db G7 Cm", "Cm", 1).device).toBe("neapolitan");
    expect(at("Em F Em", "Em", 1).tags).toContain("mixture:phrygian");
  });

  it("diminished: common-tone and descending passing chords are PASS", () => {
    expect(at("C Cdim7 C", "C", 1).device).toBe("ct-dim7");
    expect(at("C D#dim7 C", "C", 1).function).toBe("PASS");
    expect(at("Dm7 Dbdim7 C", "C", 1).device).toBe("passing-dim");
    expect(at("Dm7 Dbdim7 C", "C", 1).function).toBe("PASS");
  });

  it("chromatic mediants vs mixture vs applied dominants", () => {
    expect(at("C E F", "C", 1).device).toBe("chromatic-mediant");
    expect(at("C E Am", "C", 1).device).toBe("secondary-dominant"); // E → Am is V/vi
    expect(at("C Ab C", "C", 1).tags).toContain("mixture:aeolian");
    expect(at("C Abm C", "C", 1).device).toBe("chromatic-mediant");
    expect(at("C Abm C", "C", 1).function).toBe("T");
  });

  it("modal interchange names its source mode", () => {
    expect(at("C Fm C", "C", 1).mode).toBe("aeolian");
    expect(at("D C G D", "D", 1).mode).toBe("mixolydian");
    expect(at("C Ab Bb C", "C", 2).mode).toBe("aeolian"); // with minor colour, bVII comes from Aeolian
    expect(at("C D C", "C", 1).mode).toBe("lydian");
    expect(at("Am D Am", "Am", 1).mode).toBe("dorian");
    expect(at("Cm Dm7 G7 Cm", "Cm", 1).mode).toBe("dorian");
    expect(at("Dm A7 D", "Dm", 2).device).toBe("picardy");
    expect(at("C Bdim7 C", "C", 1).mode).toBe("harmonic-minor");
  });

  it("extensions and alterations never change the function", () => {
    const plain = an("C A7 Dm7 G7 C", "C").map((a) => a.function);
    const rich = an("C A13 Dm9 G7b9 C", "C").map((a) => a.function);
    expect(rich).toEqual(plain);
    for (const s of ["G7b9", "G7#9", "G7#11", "G7b13", "G7alt", "G13", "G9", "G11"]) {
      const a = at(`Dm7 ${s} C`, "C", 1);
      expect(a.function, s).toBe("D");
    }
    expect(at("Dm7 G7alt C", "C", 1).tags).toContain("altered-dominant");
    expect(at("Dm7 G7#11 C", "C", 1).tags).toContain("altered-dominant");
    expect(at("C G7sus4 C", "C", 1).tags).toContain("suspended-dominant");
  });

  it("backdoor dominant", () => {
    const a = at("C Fm7 Bb7 C", "C", 2);
    expect(a.device).toBe("backdoor-dominant");
    expect(a.function).toBe("D");
  });
});

describe("v2 spans", () => {
  const spans = (s: string, k: string) => full(s, k).spans.map((x) => `${x.type}:${x.start}-${x.end}`);
  it("pedal points", () => {
    expect(spans("C F/C G/C C", "C")).toContain("pedal:0-3");
    expect(full("C F/C G/C C", "C").spans[0].label).toBe("Tonic pedal");
    expect(spans("C G Dm/G C/G G7 C", "C")).toContain("pedal:1-4");
  });
  it("line clichés, ascending and descending", () => {
    expect(spans("Cm CmMaj7 Cm7 Cm6 Fm", "Cm")).toContain("line-cliche:0-3");
    expect(spans("C C+ C6 C7 F", "C")).toContain("line-cliche:0-3");
    expect(spans("Am Am/G# Am/G Am/F# F E7", "Am")).toContain("line-cliche:0-3");
    expect(spans("C C C C", "C").some((s) => s.startsWith("line-cliche"))).toBe(false);
  });
  it("descending bass lines and lament", () => {
    const f = full("Am Am/G# C/G D/F# Fmaj7 E", "Am");
    const l = f.spans.find((s) => s.type === "lament")!;
    expect(l.label).toMatch(/lament/i);
    expect(spans("Dm C Bb A7", "Dm")).toContain("lament:0-3");
  });
  it("modal vamps need the key's tonic as their I / i", () => {
    expect(spans("D C G D", "D")).toContain("mixolydian-vamp:0-3");
    expect(spans("C F G C", "C").some((s) => s.startsWith("mixolydian"))).toBe(false); // I–IV–V is not a vamp
    expect(spans("Am D Am D", "Am")).toContain("dorian-vamp:0-3");
    expect(spans("Em A Em A", "D").some((s) => s.startsWith("dorian"))).toBe(false); // ii–V vamp in D
  });
});

describe("v2 key regions", () => {
  it("Coltrane cycle: B D7 G Bb7 Eb F#7 B → regions B, G, Eb (and back to B)", () => {
    const f = full("B D7 G Bb7 Eb F#7 B", "B");
    expect(f.regions.regions.map((r) => r.name)).toEqual(["B", "G", "Eb", "B"]);
    expect(f.spans.some((s) => s.type === "coltrane-cycle")).toBe(true);
    // Chords in the G region are read in G.
    expect(f.local[1]).toMatchObject({ keyName: "G", roman: "V7" });
  });

  it("a clear C → G modulation with a pivot chord", () => {
    const items = parseProgression("C F G7 C Am D7 G Em Am D7 G").items;
    const f = analyseFull(items, parseKey("C")!);
    const names = f.regions.regions.map((r) => `${r.name}:${r.kind}`);
    expect(names).toEqual(["C:home", "G:modulation"]);
    const pivot = f.regions.pivots[0];
    expect(pivot).toBeDefined();
    expect(items[pivot.index].chord.symbol).toBe("Am");
    expect(pivot.fromRoman).toBe("vi");
    expect(pivot.toRoman).toBe("ii");
  });

  it("an applied chord alone is a tonicisation at most, never a modulation", () => {
    for (const s of ["C A7 Dm7 G7 C", "C E7 Am F G C", "C D7 G7 C", "F C/E Dm Bb C7 F"]) {
      expect(deviceTags(full(s, s.startsWith("F") ? "F" : "C")).has("modulation"), s).toBe(false);
    }
  });

  it("regions are transposition-invariant", () => {
    for (const s of ["B D7 G Bb7 Eb F#7 B", "C F G7 C Am D7 G Em Am D7 G"]) {
      const items = parseProgression(s).items;
      const k0 = parseKey(s.startsWith("B") ? "B" : "C")!;
      const base = analyseFull(items, k0).regions.regions.map((r) => [mod12(r.key.tonic - k0.tonic), r.key.mode, r.start, r.end, r.kind]);
      for (let t = 1; t < 12; t++) {
        const k = transposeKey(k0, t);
        const moved = analyseFull(transposeProgression(items, t, k), k).regions.regions.map((r) => [mod12(r.key.tonic - k.tonic), r.key.mode, r.start, r.end, r.kind]);
        expect(moved, `${s} +${t}`).toEqual(base);
      }
    }
  });
});

describe("v2 transposition invariance (advanced set, all 12 keys)", () => {
  it("functions, devices and span types are unchanged", () => {
    for (const p of ADVANCED_PROGRESSIONS) {
      const items = parseProgression(p.chords).items;
      const key = parseKey(p.key)!;
      const sig = (f: ReturnType<typeof analyseFull>) => [
        f.chords.map((c) => [c.roman, c.function, c.device, c.tags.join(",")]),
        f.spans.map((s) => [s.type, s.start, s.end]),
      ];
      const base = sig(analyseFull(items, key));
      for (let t = 1; t < 12; t++) {
        const k = transposeKey(key, t);
        expect(sig(analyseFull(transposeProgression(items, t, k), k)), `${p.id} +${t} (${keyShortName(k)})`).toEqual(base);
      }
    }
  });
});

describe("advanced labelled set", () => {
  it("has at least 30 entries with expectations", () => {
    expect(ADVANCED_PROGRESSIONS.length).toBeGreaterThanOrEqual(30);
    for (const p of ADVANCED_PROGRESSIONS) expect(p.chordsExpect.length + (p.spans?.length ?? 0) + (p.regions ? 1 : 0), p.id).toBeGreaterThan(0);
  });

  it("reports the exact-match count (printed; floor is a regression guard)", () => {
    const s = evaluateAdvanced();
    console.log(`[advanced] exact match ${s.matched}/${s.n}; checks ${s.checksPassed}/${s.checks}`);
    for (const r of s.rows) if (!r.match) console.log(`[advanced] miss ${r.id}: ${r.failures.join("; ")}`);
    expect(s.matched).toBeGreaterThanOrEqual(Math.ceil(s.n * 0.8));
  });
});
