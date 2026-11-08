# Progression library — example verification log (2026-11-08)

Policy: a song example is kept only if a web source states that the song uses the progression in at least one section (possibly transposed or varied). The source URL is stored with the example in `src/library.ts` (`examples[].sources`). Examples from memory without a source are never kept.

Method:
1. Downloaded the raw wikitext of the Wikipedia articles on the progressions/devices and the songs (`action=raw`), searched each for the song title or progression terms, and read the surrounding passage.
2. For songs those pages did not confirm, ran a web search and kept the example only if a result explicitly gave the progression (chord names or numerals) for the song.

Result: **55 of 56 seed examples verified, 1 dropped.**

| Dropped | Reason |
|---|---|
| Chim Chim Cher-ee (minor line cliché) | Sources describe only "chromatic downward movement in the harmony"; none shows a line cliché over a held chord. |

Notes on verified examples whose sources disagree in detail (kept, noted in the entry):
- *Walk, Don't Run*: the Andalusian cadence article notes the first chord is major.
- *Lady Madonna*: bVI–bVII–I at 0:06 (intro) per the cited Beatles analysis; one tab site gives the intro without the bVII.
- *White Rabbit*: sources call it F# Phrygian (F#–G at the centre), and one blog disputes the Phrygian reading; the progression i–bII (F#–G) is present either way.
- *I Will Survive*, *Autumn Leaves*: minor-key versions of the circle of fifths.
- *Sympathy for the Devil*: E–D–A (I–bVII–IV) per the cited lesson; one source notes the song does not use the vamp throughout.

Sources: see `examples[].sources` in `src/library.ts`.

## Trimmed after verification (owner's request: 1–2 best-known songs per progression)

These 17 examples were verified but are not shown. They are listed in `TRIMMED_EXAMPLES` in `library.ts`.

| Progression | Song | Source |
|---|---|---|
| I–V–vi–IV | No Woman, No Cry — Bob Marley and the Wailers | https://en.wikipedia.org/wiki/I%E2%80%93V%E2%80%93vi%E2%80%93IV_progression |
| I–V–vi–IV | Someone Like You — Adele | https://en.wikipedia.org/wiki/I%E2%80%93V%E2%80%93vi%E2%80%93IV_progression |
| I–vi–IV–V | Heart and Soul — Hoagy Carmichael | https://en.wikipedia.org/wiki/%2750s_progression |
| Canon | Basket Case — Green Day | https://en.wikipedia.org/wiki/Basket_Case_(song) |
| Canon | Graduation (Friends Forever) — Vitamin C | https://en.wikipedia.org/wiki/Graduation_(Friends_Forever) |
| ii–V–I | Satin Doll — Duke Ellington | https://en.wikipedia.org/wiki/Satin_Doll |
| Circle of fifths | Autumn Leaves | https://en.wikipedia.org/wiki/Autumn_Leaves_(1945_song) |
| 12-bar blues | Pride and Joy — Stevie Ray Vaughan | https://en.wikipedia.org/wiki/Pride_and_Joy_(Stevie_Ray_Vaughan_song) |
| Rhythm changes | Oleo — Sonny Rollins | https://en.wikipedia.org/wiki/Oleo_(composition) |
| Rhythm changes | Anthropology — Charlie Parker & Dizzy Gillespie | https://en.wikipedia.org/wiki/Rhythm_changes |
| Andalusian cadence | Walk, Don't Run — The Ventures | https://en.wikipedia.org/wiki/Andalusian_cadence |
| Andalusian cadence | Stray Cat Strut — Stray Cats | https://en.wikipedia.org/wiki/Andalusian_cadence |
| Mixolydian | Sympathy for the Devil — The Rolling Stones | https://www.jonmaclennan.com/blog/sympathy-for-the-devil-chords |
| I–IV–V | Wild Thing — The Troggs | https://www.hooktheory.com/theorytab/view/the-troggs/wild-thing |
| Dorian vamp | Evil Ways — Santana | https://www.guitarworld.com/lessons/101-amazing-licks-lick-6 |
| Ragtime | Alice's Restaurant — Arlo Guthrie | https://en.wikipedia.org/wiki/Ragtime_progression |
| Coltrane changes | Countdown — John Coltrane | https://en.wikipedia.org/wiki/Coltrane_changes |

Final library: 38 examples shown + 17 trimmed = 55 verified; 1 dropped; 56 seeds.
