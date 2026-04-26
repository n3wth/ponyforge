# PonyForge Scoring

Spec for round scoring, persistence, and on-screen feedback.

## Core formula

```
roundScore = (BASE + timeBonus) * comboMultiplier * difficultyMultiplier
```

- `BASE = 100` per successful match.
- `timeBonus = floor(secondsRemaining * 10)` at the moment of the hit.
- `comboMultiplier` derived from current combo count (see table).
- `difficultyMultiplier` derived from round number (see table).

All math runs client-side. Round to integer with `Math.round` after the
final multiply, then add to `runScore`.

## Combo multiplier

Combo counts consecutive successful matches. A loss (timeout or wrong
selection) and a skip both reset combo to 1.

| combo (n) | multiplier |
|-----------|------------|
| 1 - 2     | 1.0x       |
| 3 - 5     | 1.5x       |
| 6 - 9     | 2.0x       |
| 10+       | 3.0x (cap) |

Pseudocode:

```js
function comboMult(n) {
  if (n >= 10) return 3
  if (n >= 6)  return 2
  if (n >= 3)  return 1.5
  return 1
}
```

## Difficulty multiplier

Rounds get harder; payout scales with them.

| round       | multiplier |
|-------------|------------|
| 1 - 3       | 1.0x       |
| 4 - 6       | 1.2x       |
| 7 - 9       | 1.5x       |
| 10+         | 2.0x       |

```js
function difficultyMult(r) {
  if (r >= 10) return 2
  if (r >= 7)  return 1.5
  if (r >= 4)  return 1.2
  return 1
}
```

## Loss

Round loss = timer hits 0 or player picks the wrong horse.

- `combo` resets to 1.
- No score awarded.
- `hearts -= 1`. Game ends at 0 hearts.

## Skip

Skips bail out of a hard round without scoring.

- `hearts -= 1` (skip is a heart-cost action).
- No score awarded.
- `combo` resets to 1.
- Round counter advances (skip still consumes a round).

If `hearts === 0`, skip is disabled.

## Persistence

Stored in `localStorage`. Read once on boot, write on run end.

| key                  | type     | description                                  |
|----------------------|----------|----------------------------------------------|
| `pf:game.highScore`  | integer  | best `runScore` across all runs              |
| `pf:game.longestCombo` | integer | best combo count reached in any run          |
| `pf:game.runs`       | integer  | total number of completed runs               |

Update rules at end-of-run:

```js
const prev = {
  highScore:    +(localStorage.getItem('pf:game.highScore')    || 0),
  longestCombo: +(localStorage.getItem('pf:game.longestCombo') || 0),
  runs:         +(localStorage.getItem('pf:game.runs')         || 0),
}
localStorage.setItem('pf:game.highScore',    Math.max(prev.highScore,    runScore))
localStorage.setItem('pf:game.longestCombo', Math.max(prev.longestCombo, longestCombo))
localStorage.setItem('pf:game.runs',         prev.runs + 1)
```

Wrap in try/catch; private-mode browsers throw on `setItem`. Fall back
to in-memory only.

## Display

Three feedback surfaces. All driven by the same scoring event.

### 1. Rolling score counter

The HUD score is a tween, not a snap. On hit:

- Animate `displayedScore` toward `runScore` over 400ms with ease-out.
- Use `requestAnimationFrame`; render integer only.
- If a second hit lands mid-tween, retarget without resetting elapsed
  time so the counter keeps climbing smoothly.

### 2. Score-pop float

A `+1234` chip bursts up from the matching horse card.

- Spawn at the card's center (use `getBoundingClientRect`).
- Translate `-64px` on Y over 700ms with ease-out, fade to 0 in last
  200ms.
- Color tracks combo tier:
  - 1.0x neutral foreground
  - 1.5x accent
  - 2.0x accent strong
  - 3.0x accent peak
- Show multiplier suffix when combo >= 3, e.g. `+1234 x1.5`.
- Pointer-events: none. Removed after animation.

### 3. Combo flash

Short HUD flourish on every successful match.

- Combo number scales from 1.0 to 1.15 and back over 180ms.
- On tier change (1 -> 1.5, 1.5 -> 2, 2 -> 3), add a single-frame
  full-bleed flash overlay at 8% opacity using the tier color, 220ms
  fade-out.
- Tier-up also pulses the combo label (e.g. "x2"). No persistent glow.

## Worked example

Round 5, 7.4s remaining, combo currently 6 going to 7.

- timeBonus = floor(7.4 * 10) = 74
- comboMult(7) = 2.0
- difficultyMult(5) = 1.2
- raw = (100 + 74) * 2.0 * 1.2 = 417.6
- award = round(417.6) = 418

Display: `+418 x2.0` floats up from the matched horse, HUD counter
tweens from previous total to previous + 418.

## Open questions

- Should combo persist across rounds within a run? Yes.
- Should combo persist across runs? No.
- Should `pf:game.runs` increment on early quit? Only if at least one
  round was completed.
