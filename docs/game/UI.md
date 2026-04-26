# Dress-to-Match HUD Layout

In-game heads-up display spec for ponyforge.com. Preserves the existing
paper-and-ink aesthetic. No new colors. Two modes: `play` and `chill`. All
HUD chrome animates out in chill mode.

## Tokens (already in styles.css)

```
--paper:       #f3efe6
--paper-2:     #ebe5d6   /* slightly darker paper for chips */
--ink:         #14130f
--ink-soft:    rgba(20,19,15,0.62)
--ink-faint:   rgba(20,19,15,0.18)
--oxblood:     #8a2a1e
--font-display:'Fraunces', serif
--font-mono:   'JetBrains Mono', ui-monospace, monospace
```

No shadows. No gradients. Hairline 1px borders only, color `--ink-faint`.

## Stage

```
.game-stage              full viewport, position: relative
  .paddock              the playfield (drop zones, horse art) — z:0
  .hud                  HUD layer, position:absolute inset:0, pointer-events:none — z:10
  .hud > *              individual islands re-enable pointer-events:auto
  .game-over            full-bleed overlay — z:20, hidden by default
```

The `.hud` layer is a single absolutely-positioned container so chrome can
be hidden via one class toggle: `.hud[data-mode="chill"]`.

## Layout map

```
+-------------------------------------------------------------+
| .hud-timer (full-width 2px bar, top:0)                      |
+-------------------------------------------------------------+
|                                                             |
| .hud-score              .hud-target            .hud-hearts  |
|  top-left                top-center             top-right   |
|                                                             |
|                                                             |
|                          PADDOCK                            |
|                                                             |
|                                                             |
|                                            .hud-mode        |
|                                            bottom-right     |
+-------------------------------------------------------------+
```

Padding from edges: `clamp(16px, 2.4vw, 28px)`.
Top row sits at `top: clamp(20px, 3vw, 36px)` to clear the timer bar.

## 1. Timer — `.hud-timer`

Thin draining bar across the very top of the stage. Not the ring variant
(simpler, reads cleaner on paper).

```html
<div class="hud-timer" role="timer" aria-label="round time remaining">
  <div class="hud-timer__fill" style="--t:1"></div>
</div>
```

```
.hud-timer        position:absolute; top:0; left:0; right:0; height:2px;
                  background: var(--ink-faint);
.hud-timer__fill  height:100%; background: var(--oxblood);
                  transform-origin: left center;
                  transform: scaleX(var(--t));     /* 1 → 0 over 30s */
                  transition: transform 100ms linear;
.hud-timer.is-critical .hud-timer__fill
                  animation: hud-blink 0.5s steps(2,end) infinite;
```

Behavior: `--t` is updated every animation frame from `timeLeft/30`. Last
5 seconds add `.is-critical` to blink the fill (50% opacity flicker).
Reduce-motion: blink replaced by steady fill at 70% opacity.

## 2. Target card — `.hud-target`

Top-center. Shows target horse name, required hat chips, round plate.

```html
<section class="hud-target" aria-label="target outfit">
  <span class="hud-target__plate font-mono">round 07</span>
  <h2 class="hud-target__name">Biscuit</h2>
  <ul class="hud-target__chips">
    <li class="chip"><span class="chip__emoji">🎩</span><span class="chip__label">topper</span></li>
    <li class="chip"><span class="chip__emoji">🌼</span><span class="chip__label">daisy</span></li>
  </ul>
</section>
```

```
.hud-target          position:absolute; top: var(--hud-pad); left:50%;
                     transform: translateX(-50%);
                     min-width: 240px; max-width: 360px;
                     padding: 12px 16px 14px;
                     background: var(--paper);
                     border: 1px solid var(--ink-faint);
                     border-radius: 2px;
                     text-align: center;
.hud-target__plate   font: 11px/1 var(--font-mono);
                     letter-spacing: 0.12em;
                     color: var(--ink-soft);
                     text-transform: lowercase;
.hud-target__name    font: 600 22px/1.1 var(--font-display);
                     color: var(--ink); margin: 6px 0 10px;
.hud-target__chips   display:flex; gap:8px; justify-content:center; flex-wrap:wrap;
.chip                display:inline-flex; align-items:center; gap:6px;
                     padding: 4px 9px;
                     background: var(--paper-2);
                     border: 1px solid var(--ink-faint);
                     border-radius: 999px;
.chip__emoji         font-size: 14px; line-height: 1;
.chip__label         font: 11px/1 var(--font-mono);
                     color: var(--ink); text-transform: lowercase;
```

When a chip's hat is correctly equipped, add `.chip.is-met`: oxblood
border, ink label. No fill change.

## 3. Score — `.hud-score`

Top-left. Mono. Rolling counter with subtle slide animation.

```html
<div class="hud-score" aria-live="polite">
  <div class="hud-score__num font-mono">01,240</div>
  <div class="hud-score__meta font-mono">
    <span class="hud-score__round">round 12</span>
    <span class="hud-score__sep">·</span>
    <span class="hud-score__best">best 47</span>
  </div>
  <div class="hud-combo font-mono" data-active="false">×2</div>
</div>
```

```
.hud-score           position:absolute; top: var(--hud-pad); left: var(--hud-pad);
.hud-score__num      font: 500 28px/1 var(--font-mono);
                     color: var(--ink);
                     font-variant-numeric: tabular-nums;
.hud-score__meta     margin-top: 6px;
                     font: 11px/1 var(--font-mono);
                     color: var(--ink-soft);
                     letter-spacing: 0.08em;
.hud-score__sep      margin: 0 6px;
.hud-combo           margin-top: 8px;
                     font: 600 14px/1 var(--font-mono);
                     color: var(--oxblood);
                     opacity: 0; transform: translateY(-2px);
                     transition: opacity 160ms, transform 160ms;
.hud-combo[data-active="true"]  opacity: 1; transform: translateY(0);
```

Increment animation: when score changes, briefly add `.is-tick` to
`.hud-score__num`, which translates the digit container `-2px` then back
over 180ms. Tabular-nums prevents reflow.

Combo: shows `×2`, `×3`, etc. when consecutive correct dresses occur.
Hidden when multiplier is 1.

## 4. Hearts — `.hud-hearts`

Top-right. Three small SVG horseshoes. Inline SVG, no emoji.

```html
<ul class="hud-hearts" aria-label="lives remaining">
  <li class="shoe is-on"><svg class="shoe__svg" viewBox="0 0 20 20" aria-hidden="true">
    <path d="M5 3 C5 9 5 13 7 16 L13 16 C15 13 15 9 15 3 L13 3 L13 12 C13 13 12 14 11 14 L9 14 C8 14 7 13 7 12 L7 3 Z"
          fill="none" stroke="currentColor" stroke-width="1.4"/>
    <circle cx="6.4" cy="4.5" r="0.7" fill="currentColor"/>
    <circle cx="13.6" cy="4.5" r="0.7" fill="currentColor"/>
  </svg></li>
  <li class="shoe is-on">…</li>
  <li class="shoe is-off">…</li>
</ul>
```

```
.hud-hearts          position:absolute; top: var(--hud-pad); right: var(--hud-pad);
                     display:flex; gap:8px; list-style:none; padding:0; margin:0;
.shoe                width: 22px; height: 22px;
                     color: var(--ink);
                     transition: color 240ms, opacity 240ms;
.shoe.is-off         color: var(--ink-faint); opacity: 0.55;
.shoe.is-losing      animation: hud-shoe-drop 360ms ease-out forwards;
@keyframes hud-shoe-drop {
  0%   { transform: translateY(0)    rotate(0);     color: var(--oxblood); }
  60%  { transform: translateY(2px)  rotate(-8deg); color: var(--oxblood); }
  100% { transform: translateY(0)    rotate(0);     color: var(--ink-faint); }
}
```

When a life is lost, add `.is-losing` for one cycle, then settle to
`.is-off`.

## 5. Mode toggle — `.hud-mode`

Bottom-right. Solid oxblood pill. Only HUD element that's always visible
(it's how you exit chill).

```html
<button class="hud-mode" type="button" data-mode="play"
        aria-pressed="true" aria-label="toggle play mode">
  <span class="hud-mode__dot" aria-hidden="true"></span>
  <span class="hud-mode__label">play</span>
</button>
```

```
.hud-mode            position:absolute;
                     bottom: var(--hud-pad); right: var(--hud-pad);
                     display:inline-flex; align-items:center; gap:8px;
                     padding: 8px 14px 8px 12px;
                     background: var(--oxblood); color: var(--paper);
                     border: none; border-radius: 999px;
                     font: 500 12px/1 var(--font-mono);
                     letter-spacing: 0.1em; text-transform: lowercase;
                     cursor: pointer;
.hud-mode[data-mode="chill"]
                     background: transparent; color: var(--ink);
                     border: 1px solid var(--ink-faint);
.hud-mode__dot       width:6px; height:6px; border-radius:50%;
                     background: currentColor;
.hud-mode:focus-visible
                     outline: 2px solid var(--ink); outline-offset: 2px;
```

Label switches between `play` and `chill`. The dot is a simple visual cue,
not animated.

## 6. Chill mode behavior

Toggle adds `data-mode="chill"` to `.hud`. Everything except `.hud-mode`
fades and lifts away.

```
.hud > :not(.hud-mode) {
  transition: opacity 280ms ease, transform 280ms ease;
}
.hud[data-mode="chill"] .hud-timer,
.hud[data-mode="chill"] .hud-score,
.hud[data-mode="chill"] .hud-target,
.hud[data-mode="chill"] .hud-hearts {
  opacity: 0; pointer-events: none;
}
.hud[data-mode="chill"] .hud-timer  { transform: translateY(-4px); }
.hud[data-mode="chill"] .hud-score  { transform: translateY(-6px); }
.hud[data-mode="chill"] .hud-target { transform: translate(-50%, -8px); }
.hud[data-mode="chill"] .hud-hearts { transform: translateY(-6px); }
```

Re-entering play mode reverses cleanly via the same transitions. The timer
itself pauses and resets to full when entering chill.

## 7. Game over overlay — `.game-over`

Full-bleed paper-translucent panel. Big serif headline. Two buttons.

```html
<div class="game-over" role="dialog" aria-modal="true" aria-labelledby="go-title" hidden>
  <div class="game-over__panel">
    <p class="game-over__plate font-mono">round 12 · best 47</p>
    <h1 id="go-title" class="game-over__title">thanks for playing</h1>
    <p class="game-over__score font-mono">final score 01,240</p>
    <div class="game-over__actions">
      <button class="btn btn--primary" type="button" data-action="again">again</button>
      <button class="btn btn--ghost"   type="button" data-action="chill">back to chill</button>
    </div>
  </div>
</div>
```

```
.game-over           position:absolute; inset:0;
                     background: rgba(243,239,230,0.92);    /* paper @ 92% */
                     display:flex; align-items:center; justify-content:center;
                     opacity:0; transition: opacity 320ms ease;
.game-over[data-open="true"]   opacity: 1;
.game-over__panel    text-align:center; padding: 24px 32px; max-width: 520px;
.game-over__plate    font: 11px/1 var(--font-mono);
                     color: var(--ink-soft); letter-spacing: 0.12em;
                     text-transform: lowercase;
.game-over__title    font: 400 56px/1.05 var(--font-display);
                     color: var(--ink); margin: 14px 0 6px;
.game-over__score    font: 500 14px/1 var(--font-mono);
                     color: var(--ink); margin-bottom: 22px;
                     font-variant-numeric: tabular-nums;
.game-over__actions  display:flex; gap:12px; justify-content:center;
.btn                 padding: 10px 18px; border-radius: 2px;
                     font: 500 13px/1 var(--font-mono);
                     letter-spacing: 0.08em; text-transform: lowercase;
                     cursor: pointer;
.btn--primary        background: var(--oxblood); color: var(--paper); border: none;
.btn--ghost          background: transparent; color: var(--ink);
                     border: 1px solid var(--ink-faint);
.btn:focus-visible   outline: 2px solid var(--ink); outline-offset: 2px;
```

Open behavior: set `hidden=false` then on next frame add
`data-open="true"` to fade in. `again` resets state and starts round 1.
`back to chill` flips `.hud` to chill mode and dismisses overlay.

## 8. Animations (consolidated)

```
@keyframes hud-blink     { 0%,100% { opacity:1 } 50% { opacity:.35 } }
@keyframes hud-shoe-drop { /* see hearts */ }
@media (prefers-reduced-motion: reduce) {
  .hud > *, .game-over, .hud-timer__fill, .shoe { transition: none !important; }
  .hud-timer.is-critical .hud-timer__fill { animation: none; opacity: .7; }
}
```

## 9. Responsive

- `>= 720px`: layout as drawn.
- `< 720px`: target card width drops to `min(86vw, 320px)`; score and
  hearts shrink (`28px → 22px` score, `22px → 18px` shoes); mode toggle
  stays bottom-right.
- `< 420px`: target chips wrap to two rows; round plate moves above name
  with 4px gap.

## 10. Accessibility

- Timer has `role="timer"` and `aria-label`. Updates throttled to once
  per second via `aria-valuenow` mirror so screen readers don't spam.
- Score wrapper has `aria-live="polite"`; combo is decorative
  (`aria-hidden="true"` when active).
- Hearts list has `aria-label="lives remaining"`; each `.shoe` is
  `aria-hidden="true"` (the count is announced via the live region on
  loss: "two lives remaining").
- Mode toggle uses `aria-pressed`. Game-over dialog traps focus and
  returns focus to mode toggle on close.
- All interactive elements have visible focus rings (`outline: 2px solid
  var(--ink)`).
