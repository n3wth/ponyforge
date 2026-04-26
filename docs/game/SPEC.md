# DRESS TO MATCH — Game Spec

Canonical source of truth for the ponyforge.com mini-game. Other agents (engine, UI, audio, persistence) implement against this document. No new content: only the existing 6 horses and 12 hats may be used.

## 1. Premise

Six horses live on a meadow. The player has been dressing them in hats already (sandbox / CHILL mode). The game layer ("PLAY mode") drops a target outfit card into a corner: a horse name plus the exact hat set it wants. Player has 30 seconds to make that horse wear exactly that set. Match → score, next round, harder. Miss → lose a heart. 3 hearts. No win state — only a high score.

## 2. Modes

The site has two modes, never both at once.

### CHILL (default)
- Page loads in CHILL.
- Everything in the current site behaves as it does today: tap-to-summon hat ring, drag-to-position, breath, gaze, click counters, time-of-day shading, `G` procession, mute toggle.
- A small `play` stamp sits in the bottom-right HUD slot. Pressing `Space` or clicking the stamp enters PLAY.

### PLAY
- A target card appears top-right. A heart row appears top-left. A timer ring wraps the target card.
- Frozen during a round: `G` procession, click counters increment, time-of-day visual cycling, idle wander.
- Still live: drag, hat ring summon, breath, gaze toward pointer, juice physics, mute toggle.
- `Esc` exits PLAY at any time, returning to CHILL. Exiting mid-round forfeits the round but does not cost a heart and does not record a score (the run simply ends).
- Game-over screen also returns to CHILL on dismiss.

## 3. Goal & Win Condition

There is no win. The player chases a high score. Every successful match increases score and starts a harder round. Three failures end the run.

Tracked per run: `score`, `combo`, `round`.
Tracked across runs (localStorage `pf:game`): `highScore`, `totalRuns`, `longestCombo`.

## 4. Round Structure

Each round is a single deterministic loop:

1. **Generate target.** Pick horse(s) and a hat set per the difficulty rules (§7). Display target card: e.g. `Vesper · 👑 + 💋 + 🕶️`. Hats in the card are sorted in the display order defined in §6 — but order is cosmetic only.
2. **Reset state.** Clear all hats from all horses. (Hats clear with the existing dismount animation. This is the one moment we touch the sandbox.)
3. **Start timer.** 30.0 seconds, ticking down to 0.0 at 60fps. Timer ring depletes counterclockwise from full.
4. **Player dresses.** Player summons hats and stacks them on horses normally.
5. **Match check.** Runs continuously (see §5). The first instant the board state equals the target, the round is won. No explicit submit needed in v1.
6. **Resolution.**
   - Match → score awarded (§8), `combo += 1`, brief celebration (0.8s — horse breath spike, hat sparkle pulse, score number flies up), then round `n+1` begins.
   - Timer hits 0 with no match → lose a heart, `combo = 0`, brief miss feedback (heart shatters, board dims 200ms), then a new round at the *same* difficulty tier begins.
   - Hearts at 0 → game over (§9).

Rounds are back-to-back with a 600ms intermission for animation.

## 5. Match Validation

A round has a target `T = { horseId → Set<hatId> }`.

The board state `B = { horseId → Set<hatId> }` is computed from current stacks. Stack *order* is ignored. Stack *position* on the horse is ignored. Only set membership matters.

Match condition (exact, no partial credit):

```
match(B, T) ⇔
  for every horse h in T: B[h] === T[h]   (set equality)
  for every horse h NOT in T: B[h] is empty
```

That second clause is critical: putting hats on a horse the target didn't ask for breaks the match. The player must keep non-target horses naked.

The check runs on every hat add / hat remove / drop event (cheap — at most 6 horses × 3 hats). On match, the engine fires `pf:game:match`.

### Submit gesture

Auto-submit on first matching frame. There is no submit button in v1. Rationale: stacking is already a deliberate gesture, the existing 3-hats-per-horse cap prevents accidental overstuffing, and an auto-resolve keeps the loop tight. If playtesting shows players "scrubbing" through valid intermediate states, v1.1 adds a 250ms debounce: state must hold the match for 250ms before resolving.

## 6. Content (locked)

Horses (`horseId`):
`iris`, `vesper`, `onyx`, `prism`, `sable`, `femme`

Hats (`hatId` = the emoji itself, in canonical display order):

```
🎩  🌼  🧢  👑  🕶️  🪩  🏳️‍🌈  🏳️‍⚧️  💋  🦋  ✨  🥀
```

Display rule: when rendering a hat set in a target card, sort by this canonical order and join with ` + `. Example: target `{👑, 🕶️, 💋}` on Vesper renders as `Vesper · 👑 + 🕶️ + 💋`.

## 7. Difficulty Escalation

Difficulty is a function of `round` (1-indexed). A "tier" determines target shape; within a tier the target is randomized.

| Round  | Horses in target | Hats per horse | Notes                                      |
|--------|------------------|----------------|--------------------------------------------|
| 1–5    | 1                | 1              | Onboarding. Any horse, any hat.            |
| 6–10   | 1                | 2              | Stack of two on one horse.                 |
| 11–15  | 1                | 3              | Max stack on one horse.                    |
| 16–20  | 2                | 1 each         | Two horses, one hat each. Others empty.    |
| 21–25  | 2                | 2 each         |                                            |
| 26–30  | 3                | mixed (1–2)    | Engine picks distribution.                 |
| 31+    | 3                | mixed (1–3)    | Plateau. Stays here forever.               |

Random rules:
- No hat may appear twice in the same target overall (a hat is a unique outfit piece across the round; the game does not require duplicates because there are not duplicate hats in inventory anyway — the existing summon ring gives one of each).
- The target horse(s) are chosen uniformly at random from the 6.
- The hats per horse are chosen uniformly at random from the 12 (without replacement across the whole target).
- Seed: `Math.random()` is fine. No determinism needed in v1.

Timer stays at 30s across all tiers in v1. Difficulty comes from target complexity, not time pressure. (v1.1 may scale timer down: 30s → 25s → 22s → 20s.)

## 8. Scoring

```
roundScore = base + timeBonus
base       = 100 × hatsInTarget          // total hats across all target horses
timeBonus  = floor(50 × secondsRemaining) // decays linearly with the timer
roundScore = roundScore × comboMultiplier
```

Combo multiplier:

| Consecutive matches | Multiplier |
|---------------------|------------|
| 1                   | 1.0×       |
| 2                   | 1.25×      |
| 3                   | 1.5×       |
| 4                   | 1.75×      |
| 5+                  | 2.0× (cap) |

Combo resets to 0 on any miss (timer expiry). It does not reset on Esc-to-CHILL because that's not a miss — it ends the run.

Score is displayed as an integer. Round it with `Math.floor` after multiplier.

## 9. Lives & Game Over

- Run starts with `hearts = 3`.
- Heart lost on timer expiry. (No "wrong submit" path in v1 since submission is implicit.)
- Heart lost on Esc-during-round in CHILL exit? **No.** Esc cleanly ends the run with no score recorded — a free quit.
- At `hearts === 0`: game over.

### Game over screen
Centered card, flat, no shadows:

```
run over

score          1,240
round reached  9
longest combo  4

high score     2,180   (or "new high score!" if beaten)

[ play again ]   [ done ]
```

- `play again` resets and starts round 1.
- `done` returns to CHILL.
- `Space` activates `play again`. `Esc` activates `done`.
- High score, total runs, longest combo are written to localStorage at this moment — never mid-run.

## 10. Persistence

Key: `pf:game`
Value: JSON

```json
{
  "v": 1,
  "highScore": 0,
  "totalRuns": 0,
  "longestCombo": 0
}
```

Read on page load. Write only on game over. If parsing fails or `v` mismatches, reset to defaults silently. Never throw on storage errors (private browsing).

The CHILL HUD shows `high · 2,180` in small type next to the `play` stamp once `highScore > 0`. Hidden otherwise.

## 11. HUD Layout (PLAY)

```
┌────────────────────────────────────────┐
│ ♥ ♥ ♥                  ╭─[target]──╮  │
│                        │ Vesper    │  │
│                        │ 👑+🕶️+💋  │  │
│                        ╰────────────╯  │
│                          ◷ 23.4s       │
│                                        │
│         (meadow / horses)              │
│                                        │
│  score 240        combo ×2  esc=quit   │
└────────────────────────────────────────┘
```

- Top-left: hearts. Filled `♥`, empty `♡`. Lost heart shatters once.
- Top-right: target card with a thin SVG ring around it that depletes as timer drains.
- Bottom-left: score. Bottom-right: combo + esc hint.
- All HUD elements are flat: 1px borders, single fill, no shadows, no gradients, no italics.

## 12. Audio

Use the existing mute toggle. New cues, all short (≤300ms), all respect mute:

- `tick` — final 5 seconds, once per second, soft.
- `match` — chord on success.
- `miss` — descending two-note on heart loss.
- `gameover` — soft sustained tone.
- `combo3+` — additional shimmer layered on `match`.

If audio assets aren't authored yet, ship silent stubs. Do not gate launch on audio.

## 13. Accessibility

- Full keyboard path: `Space` enter PLAY / play again, `Esc` exit, `Tab` cycles horses, `1`–`3` selects a stack slot, `Enter` confirms a hat from the ring (ring also keyboard-navigable with arrow keys).
- Target card and HUD have `aria-live="polite"`. Score updates announce as `score 240, round 4`.
- Hearts have `aria-label="3 lives remaining"` etc.
- Respect `prefers-reduced-motion`: skip celebration scale pulse, keep state changes; timer ring still animates (it's information).
- Color is never the only signal. The timer ring also shows `23.4s` numerically. Hearts are shape + count, not just color.
- Min 44×44 hit targets for HUD buttons.

## 14. Engine Hooks (for the implementing agent)

Events the game module fires/listens for. Names are normative.

Fired by sandbox:
- `pf:hat:add { horseId, hatId }`
- `pf:hat:remove { horseId, hatId }`

Fired by game:
- `pf:game:enter` — entered PLAY
- `pf:game:exit` — returned to CHILL
- `pf:game:round { round, target }`
- `pf:game:match { roundScore, totalScore, combo }`
- `pf:game:miss { hearts }`
- `pf:game:over { score, round, longestCombo, isHighScore }`

State the game owns:
```ts
type GameState = {
  mode: 'chill' | 'play' | 'over'
  round: number
  hearts: 0 | 1 | 2 | 3
  score: number
  combo: number
  target: Record<HorseId, HatId[]>   // present in 'play'
  timerMs: number                     // counts down
}
```

The sandbox owns the meadow state; the game reads it via a `getBoard(): Record<HorseId, Set<HatId>>` accessor and resets it via `clearAllHats()` between rounds.

## 15. Out of Scope (v1)

- No leaderboard, no online sync, no accounts.
- No new horses, no new hats, no new animations beyond reusing existing dismount/spawn.
- No daily challenge / seeded mode.
- No haptics on mobile.
- No tutorial overlay — the target card itself is the tutorial. If `totalRuns === 0`, show a one-line tooltip below the target on round 1: `stack the hats. clock is ticking.` Dismissed on first hat placed.

## 16. Open Questions (defer, do not block v1)

- Does `prefers-reduced-motion` also slow time-pressure cues? Probably no — accessibility shouldn't change difficulty.
- Should the 250ms debounce on auto-submit ship in v1? Decide after one playtest.
- Should Esc during game-over be `done` or `play again`? Currently `done`. Revisit.
