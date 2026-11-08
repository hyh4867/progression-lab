/**
 * Plucked-string synthesis (Karplus & Strong 1983) with Jaffe–Smith style fractional-delay tuning, and a
 * small Web Audio strummer. `karplusStrong` is pure and testable; `StrumPlayer` needs a browser.
 */

export function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Deterministic PRNG so the same note always sounds (and tests) the same. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PluckOptions {
  decay?: number; // loop gain per sample pass (0.990–0.999)
  brightness?: number; // 0..1, low-pass amount on the initial noise burst (1 = brightest)
  seed?: number;
}

/**
 * Karplus–Strong: a delay line of length ≈ sampleRate/frequency, filled with noise, fed back through a
 * two-point average. The averaging filter adds half a sample of delay; the remaining fractional delay is
 * supplied by a first-order all-pass so the pitch is in tune.
 */
export function karplusStrong(frequency: number, sampleRate: number, seconds: number, opts: PluckOptions = {}): Float32Array {
  const decay = opts.decay ?? 0.996;
  const brightness = opts.brightness ?? 0.6;
  const rand = mulberry32(opts.seed ?? Math.round(frequency * 1000));
  // Reading buf[idx] and buf[idx+1] makes the loop n − 0.5 samples long; the all-pass adds `frac`.
  // So n + frac = period + 0.5.
  const total = sampleRate / frequency + 0.5;
  let n = Math.floor(total);
  let frac = total - n;
  if (frac < 0.1) { n -= 1; frac += 1; } // keep the all-pass coefficient well-behaved
  const c = (1 - frac) / (1 + frac);
  const buf = new Float32Array(n);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const white = rand() * 2 - 1;
    lp = brightness * white + (1 - brightness) * lp;
    buf[i] = lp;
  }
  // Remove DC from the excitation.
  let mean = 0;
  for (let i = 0; i < n; i++) mean += buf[i];
  mean /= n;
  for (let i = 0; i < n; i++) buf[i] -= mean;

  const len = Math.max(1, Math.floor(seconds * sampleRate));
  const out = new Float32Array(len);
  let idx = 0;
  let apX = 0, apY = 0;
  for (let i = 0; i < len; i++) {
    const cur = buf[idx];
    const nxt = buf[(idx + 1) % n];
    const avg = decay * 0.5 * (cur + nxt);
    const y = c * avg + apX - c * apY; // all-pass for the fractional delay
    apX = avg; apY = y;
    out[i] = cur;
    buf[idx] = y;
    idx = (idx + 1) % n;
  }
  let peak = 0;
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 0) for (let i = 0; i < len; i++) out[i] /= peak;
  return out;
}

export interface StrumEvent {
  notes: number[]; // MIDI notes, low to high
  beats: number;
}

/** Schedules strummed chords on a Web Audio context. Browser only. */
export class StrumPlayer {
  private ctx: AudioContext | null = null;
  private sources: AudioBufferSourceNode[] = [];
  private cache = new Map<number, AudioBuffer>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  private context(): AudioContext {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
    }
    return this.ctx;
  }

  private buffer(midi: number): AudioBuffer {
    const ctx = this.context();
    let b = this.cache.get(midi);
    if (!b) {
      const data = karplusStrong(midiToFrequency(midi), ctx.sampleRate, 2.5, { decay: midi < 50 ? 0.997 : 0.995 });
      b = ctx.createBuffer(1, data.length, ctx.sampleRate);
      b.copyToChannel(data as Float32Array<ArrayBuffer>, 0);
      this.cache.set(midi, b);
    }
    return b;
  }

  /**
   * Play a sequence of chords. `onStep(i)` fires as each chord starts, `onEnd` when the sequence finishes.
   * Returns the total duration in seconds.
   */
  play(events: StrumEvent[], bpm: number, onStep?: (i: number) => void, onEnd?: () => void): number {
    this.stop();
    const ctx = this.context();
    if (ctx.state === "suspended") void ctx.resume();
    const beat = 60 / bpm;
    const master = ctx.createGain();
    master.gain.value = 0.28;
    master.connect(ctx.destination);
    let t = ctx.currentTime + 0.06;
    const start = t;
    const stepTimes: number[] = [];
    for (const ev of events) {
      stepTimes.push(t - start);
      const dur = ev.beats * beat;
      ev.notes.forEach((midi, k) => {
        const src = ctx.createBufferSource();
        src.buffer = this.buffer(midi);
        const g = ctx.createGain();
        const at = t + k * 0.018; // down-strum: low to high, 18 ms apart
        g.gain.setValueAtTime(0.9, at);
        g.gain.setTargetAtTime(0, t + dur - 0.04, 0.03); // damp at the chord change
        src.connect(g).connect(master);
        src.start(at);
        src.stop(t + dur + 0.25);
        this.sources.push(src);
      });
      t += dur;
    }
    const total = t - start;
    if (onStep) stepTimes.forEach((st, i) => setTimeout(() => this.sources.length && onStep(i), st * 1000 + 60));
    this.timer = setTimeout(() => { this.sources = []; onEnd?.(); }, total * 1000 + 120);
    return total;
  }

  stop(): void {
    for (const s of this.sources) {
      try { s.stop(); } catch { /* already stopped */ }
    }
    this.sources = [];
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
}
