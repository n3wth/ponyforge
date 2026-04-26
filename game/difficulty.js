// PonyForge — difficulty module
// Round timing + scoring multiplier + final score formula.
//
// Surfaces window.PFG.difficulty with:
//   getTimerSeconds(round, opts={ scaling:false })
//   getDifficultyMultiplier(round)
//   getScoreFor(round, secondsRemaining, comboMult)
//
// Score formula choice: we use SPEC.md §8 — `(100*hats + 50*secondsLeft) * comboMult`
// (NOT MECHANICS' `100*round + 25*secondsLeft`, NOT SCORING.md's variant which
// also folds in a difficultyMultiplier). SPEC is the named source of truth in
// section 1 of that doc, and the caller already passes comboMult. Difficulty
// mult is exposed separately via getDifficultyMultiplier so other modules can
// layer it if they choose.
//
// Hats-in-target is derived from `round` per SPEC §7 tier table, since this
// module's signature does not take hats directly.

;(function () {
  'use strict'

  // SPEC §7 tier table -> total hats in target by round.
  function hatsInTarget(round) {
    const r = Math.max(1, round | 0)
    if (r <= 5) return 1               // 1 horse x 1 hat
    if (r <= 10) return 2              // 1 horse x 2 hats
    if (r <= 15) return 3              // 1 horse x 3 hats
    if (r <= 20) return 2              // 2 horses x 1 hat
    if (r <= 25) return 4              // 2 horses x 2 hats
    if (r <= 30) return 5              // 3 horses, mixed 1-2 -> avg ~5
    return 6                           // 31+: 3 horses, mixed 1-3 -> ~6
  }

  // Per SPEC v1: flat 30s. v1.1 opt-in: max(25, 30 - floor((round-1)/5)).
  function getTimerSeconds(round, opts) {
    const r = Math.max(1, round | 0)
    const scaling = !!(opts && opts.scaling)
    if (!scaling) return 30
    return Math.max(25, 30 - Math.floor((r - 1) / 5))
  }

  // Per SCORING.md tiers (the user-supplied tier breakdown):
  // 1x (r1-3), 1.2x (r4-6), 1.5x (r7-9), 2x (r10+).
  function getDifficultyMultiplier(round) {
    const r = Math.max(1, round | 0)
    if (r >= 10) return 2
    if (r >= 7) return 1.5
    if (r >= 4) return 1.2
    return 1
  }

  // SPEC §8 formula. Combo multiplier provided by caller.
  // roundScore = (100*hats + floor(50*secondsRemaining)) * comboMult
  // Floor after multiply per SPEC ("Math.floor after multiplier").
  function getScoreFor(round, secondsRemaining, comboMult) {
    const hats = hatsInTarget(round)
    const secs = Math.max(0, +secondsRemaining || 0)
    const cm = +comboMult > 0 ? +comboMult : 1
    const base = 100 * hats
    const timeBonus = Math.floor(50 * secs)
    return Math.floor((base + timeBonus) * cm)
  }

  const api = {
    getTimerSeconds: getTimerSeconds,
    getDifficultyMultiplier: getDifficultyMultiplier,
    getScoreFor: getScoreFor,
    // exposed for tests / other modules
    _hatsInTarget: hatsInTarget,
  }

  if (typeof window !== 'undefined') {
    window.PFG = window.PFG || {}
    window.PFG.difficulty = api
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api
  }
})()
