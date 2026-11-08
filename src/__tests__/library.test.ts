import { describe, expect, it } from "vitest";
import { LIBRARY, DROPPED_EXAMPLES, TRIMMED_EXAMPLES, exampleCounts } from "../library";
import { parseProgression } from "../progression";
import { parseKey } from "../key";
import { analyseFull, deviceTags } from "../harmony";

describe("named progression library", () => {
  it("has unique ids, featured entries and the required fields", () => {
    expect(new Set(LIBRARY.map((e) => e.id)).size).toBe(LIBRARY.length);
    expect(LIBRARY.filter((e) => e.featured).length).toBe(8);
    for (const e of LIBRARY) {
      expect(e.name.length, e.id).toBeGreaterThan(0);
      expect(e.why.length, e.id).toBeGreaterThan(20);
      expect(e.numerals.length, e.id).toBeGreaterThan(0);
      expect(parseKey(e.key), e.id).not.toBeNull();
      expect(e.examples.length > 0 || !!e.context, `${e.id} needs examples or context`).toBe(true);
    }
  });

  it.each(LIBRARY.map((e) => [e.id, e]))("%s parses and its analysis contains the expected devices", (_, e) => {
    const parsed = parseProgression(e.chords);
    expect(parsed.errors).toEqual([]);
    const tags = deviceTags(analyseFull(parsed.items, parseKey(e.key)!));
    for (const d of e.expectedDevices) expect([...tags], `${e.id} missing ${d}`).toContain(d);
  });

  it("no chord in any library entry has an empty or unknown function", () => {
    for (const e of LIBRARY) {
      const a = analyseFull(parseProgression(e.chords).items, parseKey(e.key)!);
      for (const c of a.chords) {
        expect(["T", "PD", "D", "PASS"], `${e.id} ${c.roman}`).toContain(c.function);
        expect(c.explanation.length).toBeGreaterThan(0);
      }
    }
  });

  it("every kept song example has at least one http(s) source and only title + artist text", () => {
    for (const e of LIBRARY) {
      for (const ex of e.examples) {
        expect(ex.sources.length, `${e.id}: ${ex.title}`).toBeGreaterThan(0);
        for (const u of ex.sources) expect(u, `${e.id}: ${ex.title}`).toMatch(/^https?:\/\/\S+$/);
        expect(ex.title.length).toBeLessThan(80);
        expect(ex.artist.length).toBeGreaterThan(0);
      }
    }
  });

  it("shows at most two well-known songs per progression", () => {
    for (const e of LIBRARY) expect(e.examples.length, e.id).toBeLessThanOrEqual(2);
  });

  it("dropped and trimmed examples are not shown; counts add up", () => {
    const shown = new Set(LIBRARY.flatMap((e) => e.examples.map((x) => e.id + "/" + x.title)));
    for (const d of DROPPED_EXAMPLES) expect(shown.has(d.entry + "/" + d.title)).toBe(false);
    for (const t of TRIMMED_EXAMPLES) {
      expect(shown.has(t.entry + "/" + t.title)).toBe(false);
      expect(LIBRARY.some((e) => e.id === t.entry), t.entry).toBe(true);
    }
    const c = exampleCounts();
    console.log(`[library] ${LIBRARY.length} entries; song examples verified ${c.verified} (shown ${c.shown}, trimmed ${c.trimmed}), dropped ${c.dropped} (of ${c.seeds} seeds)`);
    expect(c.shown + c.trimmed + c.dropped).toBe(c.seeds);
  });
});
