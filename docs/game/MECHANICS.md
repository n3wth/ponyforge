# Dress to Match — Mechanics

Moment-to-moment design for the v1 minigame. Pure, no power-ups.

## Loop

1. Round begins. Target outfit appears in the top-right corner card.
2. 30-second timer starts. Thin oxblood progress bar drains across the top edge.
3. Player picks a horse from the paddock, applies hats from the tray, then submits.
4. Match → score float, celebration, fresh round (target rerolls, timer resets, difficulty bumps).
5. Miss → shake, heart -1, hat stack on that horse clears. Same round continues.
6. Run ends when hearts reach 0. Final score posts.

The session is a continuous run of rounds. The player carries 3 hearts across the whole run; rounds get harder, but hearts only refresh on a new run.

## Target outfit card

- Fixed top-right, 96px tall, oxblood border, flat fill.
- Shows a silhouetted horse with the exact hat stack required (1–4 hats depending on round).
- Includes round number and the count of hats required (e.g. "Round 4 — 3 hats").
- Order matters from round 5 onward. Before that, only the set matters.
- The card never animates except a subtle 1px border pulse at T-5s.

## Picking a horse

The existing radial-ring-on-tap picker stays as-is. In PLAY mode:

- Tap any horse → radial ring opens around it. This horse becomes the **active horse**.
- The active horse is highlighted with a 2px oxblood outline. All other horses dim to 60% opacity.
- Tapping a different horse swaps the active horse. The previous horse's stack is preserved (you can come back to it), but only ONE horse is the **target horse** at submit.
- The target horse is whichever horse is active at the moment of submission. This is shown unambiguously by the highlight.

Rationale: we keep the existing UI primitive (radial ring), we add a single piece of state (active horse), and the player's mental model is "the highlighted horse is the one being judged."

## Applying hats

The existing hat-stacking system stays. In PLAY mode:

- Hats are dragged from the tray onto the active horse.
- Stack appears on the horse's head, top-down in the order applied.
- Tap a hat already on the horse to remove it (returns to tray, no penalty).
- Hats on non-active horses are visible but do not count and cannot be removed during play. They reset between rounds.
- Max 4 hats per horse. Tray exposes 6–8 hat options, drawn from the 12-hat pool, always including the correct ones plus distractors.

**Anti-frustration rule:** Only the final stack on the active horse at the moment of submission is judged. Mistakes cost nothing as long as you fix them before submitting. Encourages experimentation.

## Submission

**Decision: explicit submit button. Not auto-detect.**

Reasoning:
- Auto-detect punishes the player mid-stack: if they happen to pass through the correct stack on the way to a wrong one, they "win" without intent. Bad feel.
- Auto-detect also forces us to lock the stack the instant it matches, which fights the anti-frustration rule (player can't undo a correct stack to try a different horse).
- Explicit submit gives the player a deliberate beat: "I'm done, judge me." That beat is where the dopamine lives.
- Cost: one extra tap per round. Worth it.

**Submit button:**
- Bottom-center, 56px tall, oxblood fill, white label "Submit".
- Disabled (40% opacity, no tap) when no horse is active or active stack is empty.
- Enabled the instant the active horse has at least 1 hat.
- Single tap submits. No confirmation dialog. No double-tap.

## Correct match

Triggered when the active horse's stack equals the target stack (set match rounds 1–4, ordered match rounds 5+).

Sequence, total ~900ms:
1. **0ms:** Submit button collapses. All other horses fade to 30%.
2. **0–200ms:** Active horse does a single bob (translateY -8px → 0, ease-out).
3. **100ms:** Confetti burst of 12 oxblood + cream particles from the horse's head, 600ms lifetime, gravity, no glow.
4. **150ms:** Score float — "+100" text in oxblood, rises 40px and fades over 700ms above the horse. Bonus: "+25" time bonus per second remaining, shown as a smaller secondary float 200ms later.
5. **200ms:** Soft chime sound (single note, 200ms, sine). One sound, no stinger.
6. **400ms:** Target card cross-fades to the next round's target.
7. **600ms:** Hat stacks on all horses clear. Tray reshuffles.
8. **800ms:** Timer bar resets and animates back to full in 100ms.
9. **900ms:** New round live. Player can interact again.

Score formula per correct round: `100 × roundNumber + 25 × secondsRemaining`.

## Wrong match

Triggered when player submits and the active horse's stack does not equal the target.

Sequence, total ~600ms:
1. **0ms:** Active horse shake (translateX ±6px, 4 cycles, 280ms total).
2. **0ms:** Heart in the HUD pops: scales 1.0 → 1.3 → 0, 400ms. Heart count decrements.
3. **50ms:** Short low thud sound (100ms, square wave, 80Hz).
4. **300ms:** Active horse's hat stack clears (hats fly back to the tray over 250ms).
5. **600ms:** Player can interact again.

The round does NOT end on a wrong match. The timer keeps running. The same target stays. The player can try again on the same horse or a different one until they match or the timer runs out.

## Timer

- Thin (3px) oxblood progress bar pinned to the top edge of the play area, full width.
- Drains right-to-left over 30 seconds. Linear. No easing.
- At T-5s the bar starts pulsing: opacity 1.0 → 0.6 at 4Hz. Audible tick (40ms click) on each second from 5 to 1.
- Tick sound only — no music in v1.
- At T-0:
  - If the active horse has hats and they happen to match → counts as correct (free submission).
  - Otherwise → wrong match sequence fires, heart -1, round restarts with a new target. Hat stacks clear.
- The timer cannot be paused. Backgrounding the tab pauses the run (timer freezes; resumes on focus).

## Skip round

Strategic escape hatch. Available at all times during a round.

- "Skip" button bottom-left, smaller than Submit (40px tall, secondary style: cream fill, oxblood text, 1px oxblood border).
- Single tap, no confirmation.
- Cost: -1 heart.
- Effect: target rerolls, timer resets to 30s, all hat stacks clear, round number does NOT advance (the round counter only advances on correct matches).
- Rationale: lets the player bail on an impossible-feeling target (e.g. they don't see the right hat in the tray) without dying to the timer. Same heart cost as failing, but trades 25 wasted seconds for a fresh shot. Skill-positive: experienced players skip earlier when they recognize a bad draw.

If the player has 1 heart left, Skip is disabled (would end the run with no payoff). The button shows a tooltip: "Last heart — finish the round."

## Difficulty curve

| Round | Hats required | Order matters | Tray size | Time |
|-------|---------------|---------------|-----------|------|
| 1     | 1             | no            | 6         | 30s  |
| 2     | 2             | no            | 6         | 30s  |
| 3     | 2             | no            | 7         | 30s  |
| 4     | 3             | no            | 7         | 30s  |
| 5     | 3             | yes           | 8         | 30s  |
| 6     | 3             | yes           | 8         | 28s  |
| 7     | 4             | yes           | 8         | 28s  |
| 8+    | 4             | yes           | 8         | 25s  |

Time floors at 25s. Tray size caps at 8. Hat count caps at 4. Difficulty plateaus at round 8 — the run ends when hearts run out, not when difficulty maxes.

## Hearts (HUD)

- 3 hearts at run start, top-left, oxblood filled.
- Lost hearts become 1px oxblood outlines (not removed — keeps layout stable).
- Last heart pulses at 1Hz to telegraph danger.
- 0 hearts → run-over screen (out of scope for this doc).

## State summary

Per-round mutable state:
- `targetStack`: array of hat IDs, length 1–4
- `orderMatters`: boolean
- `activeHorseId`: which horse is highlighted
- `horseStacks`: map of horseId → array of hat IDs (preserved across active-horse swaps within a round)
- `timeRemaining`: seconds, float
- `trayHats`: array of hat IDs available this round

Per-run mutable state:
- `roundNumber`: int, starts at 1
- `score`: int, starts at 0
- `hearts`: int, starts at 3

## What's NOT in v1

- No power-ups, no combos, no streaks bonus.
- No music, only SFX (chime, thud, tick).
- No multiplayer, no leaderboard hooks beyond final score.
- No daily challenge mode.
- No animated target card.
- No hint system.

Pure: pick horse, stack hats, submit, repeat.
