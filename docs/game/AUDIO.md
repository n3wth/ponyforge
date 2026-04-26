# Game Audio Cue Spec

All cues are synthesized via Web Audio API. No samples. Reuses the existing
`AudioContext`, master `GainNode`, and mute toggle already wired for the pickup
tick, drop thud, wall, pair-collision, and hat-land arpeggio cues.

## Shared infrastructure

Reuse, do not duplicate:

- `ctx: AudioContext` — single shared instance, lazy-initialized on first user
  gesture.
- `masterGain: GainNode` — connected to `ctx.destination`, default `0.6`.
- `muted: boolean` — short-circuits all cue functions when true.
- `ensureCtxResumed()` — calls `ctx.resume()` if `ctx.state === 'suspended'`.

### Output limiter (NEW)

Insert a `DynamicsCompressorNode` between `masterGain` and `ctx.destination`
to prevent stacking/clipping when cues fire in quick succession:

```
threshold: -12 dB
knee:       6 dB
ratio:      4
attack:     0.003 s
release:    0.15 s
```

### Envelope helper

Every cue uses an ADSR-ish envelope on a per-cue `GainNode` that starts at 0,
ramps to peak, then exponentially decays. Always:

1. `g.gain.setValueAtTime(0, t0)`
2. `g.gain.linearRampToValueAtTime(peak, t0 + attack)`
3. `g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)`
4. `osc.stop(t0 + duration + 0.02)`
5. `osc.onended = () => { osc.disconnect(); g.disconnect() }` — node cleanup
   prevents leaks across many rapid cues.

Frequencies below assume root = C5 (523.25 Hz) unless noted. Cues are key-
agnostic; pick a single root constant in code so cues stay harmonically
consistent.

---

## ROUND_START

Rising 3-note major arpeggio. Confident, brief.

- Notes: C5 523.25 Hz, G5 783.99 Hz, C6 1046.50 Hz
- Stagger: each note offset by +66 ms (3 × 66 ≈ 200 ms total)
- Per-note duration: 120 ms
- Oscillator: `triangle`
- Peak gain: 0.08
- Envelope: attack 8 ms, decay to 0.0001 over remaining 112 ms
- Routing: osc → gain → masterGain

## TICK_5S

Subtle metronome on the final 5 seconds. Fires once per second when
`secondsRemaining <= 5 && secondsRemaining > 0`.

- Frequency: 1200 Hz
- Oscillator: `square`, fed through a `BiquadFilterNode` (lowpass, cutoff
  2000 Hz, Q 0.7) to soften edges
- Duration: 30 ms
- Peak gain: 0.03
- Envelope: attack 2 ms, decay to 0.0001 over 28 ms
- Last tick (1s remaining): pitch up to 1600 Hz, same gain — telegraphs final beat

## MATCH_CORRECT

Bright bell triad, all three notes struck simultaneously.

- Notes (parallel): C5 523.25 Hz, E5 659.25 Hz, G5 783.99 Hz
- Oscillator: `sine` for each (clean bell)
- Duration: 250 ms total
- Peak gain: 0.10 distributed (0.04 + 0.035 + 0.035 across the three voices to
  keep summed peak ≤ 0.10)
- Envelope: attack 4 ms, exponential decay to 0.0001 over 246 ms
- Optional sparkle: add a 4th voice at C7 (2093 Hz), `sine`, gain 0.015,
  duration 120 ms — only if combo ≥ 2

## MATCH_WRONG

Short detuned descending pair. Reads as "nope" without being harsh.

- Note 1: 320 Hz, 90 ms
- Note 2: 240 Hz, 90 ms (starts at +90 ms)
- Detune: each oscillator runs as two voices, one at 0 cents, one at -18 cents,
  summed — gives the wobbly "wrong" texture
- Oscillator: `sawtooth`, lowpass filter cutoff 1400 Hz Q 0.5
- Total duration: 180 ms
- Peak gain: 0.06 (summed across both voices of each note)
- Envelope: attack 4 ms, decay to 0.0001 over each 90 ms slice

## HEART_LOST

Low filtered noise burst. Felt more than heard.

- Source: `AudioBufferSourceNode` with 0.3 s of white noise generated at
  `ctx.sampleRate` (Math.random() * 2 - 1, single channel)
- Filter: `BiquadFilterNode`, lowpass, cutoff sweeps from 600 Hz to 180 Hz
  over the duration via `frequency.exponentialRampToValueAtTime`, Q 1.0
- Duration: 300 ms
- Peak gain: 0.05
- Envelope: attack 12 ms, decay to 0.0001 over 288 ms
- Routing: noise → filter → gain → masterGain

## COMBO_X

Each combo step (×2, ×3, ×4 …) plays a higher ping. Each `×2` step adds a
perfect fifth (×1.5) above the previous combo pitch.

- Base frequency at combo step 1: 880 Hz (A5)
- Step `n` frequency: `880 * Math.pow(1.5, n - 1)`, clamped at 4186 Hz (C8)
  to avoid harsh top end
- Oscillator: `sine` + `triangle` mix (two voices at same freq, sine 0.04,
  triangle 0.01) for a slightly metallic ping
- Duration: 140 ms
- Peak gain: 0.05 summed
- Envelope: attack 3 ms, decay to 0.0001 over 137 ms
- Throttle: ignore additional COMBO_X calls within 60 ms of the previous one
  to prevent stacking when matches resolve in the same frame

## GAME_OVER

Slow descending minor arpeggio over 1.2 s. Definitive, not melodramatic.

- Notes (sequential): A4 440 Hz, F4 349.23 Hz, D4 293.66 Hz, A3 220 Hz
- Per-note onset: 0 ms, 280 ms, 560 ms, 840 ms
- Per-note duration: 360 ms (last note 480 ms, fades through end of cue)
- Oscillator: `triangle` with subtle detune (+/- 4 cents two-voice unison,
  each voice at half gain)
- Total duration: 1200 ms
- Peak gain: 0.07
- Envelope per note: attack 12 ms, decay to 0.0001 across the note's duration
- Suppress all other cues for 1200 ms after firing (set a `suppressUntil`
  timestamp; cue functions early-return while `ctx.currentTime < suppressUntil`,
  except the existing mute-toggle short-circuit which still wins)

## ROUND_SKIP

Reuses existing drop thud, pitched down 3 semitones.

- Pitch ratio: `Math.pow(2, -3 / 12)` ≈ 0.8409
- Implementation: existing `playDropThud()` accepts an optional
  `pitchMultiplier` arg (default 1). For ROUND_SKIP, call with 0.8409.
- Gain: existing thud gain × 0.85 (slightly muted vs normal drop)
- Duration: existing thud duration (no change)

---

## Anti-stacking rules

Applied globally across all cues, new and existing:

1. **Compressor on the master bus** (see Shared infrastructure).
2. **Per-cue throttle**: each cue type stores `lastFiredAt`. If a fire happens
   within `minInterval` of the previous (cue-specific values: TICK_5S 200 ms,
   COMBO_X 60 ms, MATCH_WRONG 80 ms, HEART_LOST 150 ms, others 30 ms), drop
   the new fire silently.
3. **Node cleanup**: every cue calls `osc.disconnect()` and `gain.disconnect()`
   in `onended` to release Web Audio nodes — without this, rapid fires leak.
4. **Resume gate**: every cue entry point starts with
   `if (muted) return; ensureCtxResumed();`.
5. **GAME_OVER suppression window**: see above; gives the closing arpeggio
   clean headroom.

## Implementation order

1. Add compressor to master chain.
2. Add `lastFiredAt` map + per-cue throttles.
3. Implement ROUND_START, MATCH_CORRECT, MATCH_WRONG (most-fired during play).
4. Implement TICK_5S, HEART_LOST, COMBO_X.
5. Implement GAME_OVER + suppression window.
6. Wire ROUND_SKIP into existing drop-thud function via pitch arg.

## Test plan

- Mash 20 MATCH_CORRECT calls in 500 ms — output peaks must stay under 0
  dBFS thanks to compressor + throttle.
- Fire COMBO_X up to step 12 — verify clamp at C8.
- Fire HEART_LOST during MATCH_CORRECT — both audible, no clipping.
- Fire GAME_OVER mid-combo — combo cues suppress, arpeggio plays clean.
- Toggle mute mid-cue — current cues fade naturally via envelope; new fires
  are suppressed.
