# Progression Lab — tension model

Implementation: `src/tension.ts`. Tests: `src/__tests__/tension.test.ts`.

The model follows the chord-distance rule of Fred Lerdahl's *Tonal Pitch Space* (Oxford University Press, 2001), and is deliberately simplified so that it can run on chord symbols alone, in the browser, in real time.

## What is implemented

### Basic space

For a chord *x* heard in region (key) *R*, the basic space has four levels of pitch classes:

| level | contents |
|-------|----------|
| a — root | the chord root |
| b — fifth | root + the chord's fifth (perfect, diminished or augmented) |
| c — chord | every chord tone |
| d — diatonic | the diatonic collection of *R* ∪ the chord tones |

(Lerdahl's level e, the chromatic level, is the same for every chord and drops out of the distance.)

### Chord distance

δ(x → y) = **i** + **j** + **k**

- **i — region distance.** The number of steps between the key signatures of the two chords' regions on the circle of fifths (0–6). Relative major and minor share a signature, so i = 0 between them.
- **j — chordal distance.** Root steps on the *diatonic* circle of fifths of y's region (F–C–G–D–A–E–B–F, so F–B counts as one step). If either root is outside that collection, the chromatic circle of fifths is used instead (0–6).
- **k — basic-space distance.** The number of pitch classes in y's basic space that are not at the same level of x's basic space, summed over levels a–d.

With these rules the model reproduces Lerdahl's published within-key values: δ(I,V) = δ(I,IV) = 5, δ(I,vi) = δ(I,iii) = 7, δ(I,ii) = 8. Tests check these values, and they check that δ is symmetric for diatonic triads.

### Tension curve

For chord *n* of a progression in key *K*:

    tension(n) = δ(tonic → chord_n)  +  λ · δ(chord_{n-1} → chord_n)  +  surface(chord_n)

with λ = 0.5 and no sequential term for the first chord. The tonic chord is the key's tonic triad.

**Regions.** Applied chords (V/x, V7/x, vii°/x) are placed in the region of their target, a major or minor key according to the target's diatonic quality, which follows Lerdahl's treatment of tonicisation. Every other chord sits in the home region.

**Surface dissonance** is a small heuristic that is *not* Lerdahl's surface-tension rule. It adds 0.5 for each 6th and 9th, 1 for each 7th, 11th, 13th, b5 and #5, 1.5 for each #9, #11 and b13, and 2 for a b9. A sus chord adds 1, and so does a slash/inverted bass.

## Simplifications versus Lerdahl (2001)

1. **No prolongational tree.** Lerdahl's hierarchical tension adds up δ along a prolongational reduction, which requires an analysis of the music's structure. Here, a chord's tension is approximated by attaching it directly to the tonic, δ(tonic → chord), plus a weighted sequential term λ·δ(prev → chord). λ = 0.5 is a design choice and was not fitted to any data.
2. **Sevenths and extensions live at level c.** Lerdahl's level c is the triad. Here, every chord tone is placed at level c, so a seventh adds to k.
3. **Chromatic chords are inflections of the home region.** Lerdahl would assign a chromatic chord to whatever region contains it (a pivot interpretation). Here, borrowed chords, tritone substitutes, the Neapolitan, blues dominants and unclassified chords stay in the home region, and their foreign tones are added to level d. An earlier version moved borrowed chords into the parallel key. That double-counted their foreign tones, once through i (three signature steps) and again through k, and gave a rock I–bVII–IV a bVII more tense than a tritone substitute. It was changed for that reason.
4. **Region distance = key-signature distance.** Lerdahl's regional circle combines the circle of fifths with relative and parallel relations, with specific weights. Here, i counts key-signature steps only (so C → c minor = 3).
5. **Minor-key collection.** A minor region's level d is the natural minor. The harmonic-minor leading tone of V or vii° is a foreign tone at level d, so V in minor scores slightly higher than V in major.
6. **j for chromatic roots.** When a root is outside the region's collection, j falls back to the chromatic circle of fifths.
7. **No melodic (soprano) or non-harmonic-tone terms.** There is no melody input. The surface term above stands in for the dissonance of added tones and inversions, and its weights are heuristic.
8. **No attraction (Lerdahl's tonal-attraction rule).** Voice-leading pull is not modelled inside tension. The reharmoniser scores voice-leading separately (see `docs/progression_lab.md`).

## Sanity properties (tested)

- The tonic triad has tension 0 against itself, and every other chord tested in major and minor scores higher.
- V7 is more tense than V, and V is more tense than I.
- V → I, V7 → I and V7 → i resolutions lower the tension at the final chord.
- A tritone substitute (Db7 in C) is more tense than V7, and bVI is more tense than vi.
- Transposing any of the 52 labelled progressions to all 12 keys leaves every tension value unchanged.

## Units

Values are in TPS units: whole numbers for δ, plus halves from λ and the surface weights. In practice they run from 0 to about 25. The UI plots them on a fixed 0–24 axis, so curves from different progressions can be compared.

## Key regions (added after v2)

When the key-region analysis finds more than one region (`src/regions.ts`), each chord is measured against **its own region's tonic**, and Lerdahl's regional distance is added for the region it sits in:

    tension(n) = δ(I_R → chord_n in R)  +  i(home, R)  +  λ · δ(prev → chord_n)  +  surface(chord_n)

- R is the chord's region; i(home, R) is the key-signature distance used for i elsewhere in this model. For chords in the home region, the formula reduces to the original one, so **single-key progressions give identical values** (tested on every one-region progression of the labelled set).
- **Pivot reinterpretation at region boundaries:** the sequential term is computed with the previous chord re-heard in the new region, because the region shift is already counted once by i(home, R). Computing it in the old region would count the shift twice.
- The reharmoniser receives the same per-slot region keys, so the curve it optimises is the curve the chart shows. Substitute chords inherit their slot's region, which is a simplification: a substitution could in principle change the regions.
- **Honest result for Giant Steps** ("Bmaj7 D7 Gmaj7 Bb7 Ebmaj7 A-7 D7 Gmaj7", home Eb): the region tonics fall sharply, e.g. Bmaj7 12 → 6 and Gmaj7 16 → 8.5, and the Eb chords are unchanged. The ii7 (A-7) of the new G region falls from 22 to 19 but **stays the global maximum**, for two reasons: ii is the diatonic chord farthest from its own tonic (δ(I, ii) = 8, against 6 for V7), and it is entered by a tritone root jump from Ebmaj7. I recorded this result rather than tuning the model to produce a different maximum.
