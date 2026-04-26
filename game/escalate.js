// ESCALATE — difficulty curve config for DRESS TO MATCH
// Canonical source: docs/game/SPEC.md §7. Where MECHANICS.md disagrees, SPEC wins.
// SPEC §5: "Stack order is ignored. Only set membership matters." → orderMatters is always false.
// API: window.PFG.escalate.getTier(roundNumber)

(function (global) {
  'use strict'

  // Tier table from SPEC.md §7 (canonical).
  // Each entry: minRound (inclusive). The last matching entry wins.
  // hatsPerHorse is [min, max]; equal values mean a fixed count.
  var TIERS = [
    {
      minRound: 1,
      horsesPerRound: 1,
      hatsPerHorse: [1, 1],
      orderMatters: false,
      label: 'onboarding'
    },
    {
      minRound: 6,
      horsesPerRound: 1,
      hatsPerHorse: [2, 2],
      orderMatters: false,
      label: 'stack of two'
    },
    {
      minRound: 11,
      horsesPerRound: 1,
      hatsPerHorse: [3, 3],
      orderMatters: false,
      label: 'max stack'
    },
    {
      minRound: 16,
      horsesPerRound: 2,
      hatsPerHorse: [1, 1],
      orderMatters: false,
      label: 'two horses, one hat each'
    },
    {
      minRound: 21,
      horsesPerRound: 2,
      hatsPerHorse: [2, 2],
      orderMatters: false,
      label: 'two horses, two hats each'
    },
    {
      minRound: 26,
      horsesPerRound: 3,
      hatsPerHorse: [1, 2],
      orderMatters: false,
      label: 'three horses mixed 1-2'
    },
    {
      minRound: 31,
      horsesPerRound: 3,
      hatsPerHorse: [1, 3],
      orderMatters: false,
      label: 'plateau: three horses mixed 1-3'
    }
  ]

  function getTier(roundNumber) {
    var r = Math.max(1, Math.floor(roundNumber || 1))
    var match = TIERS[0]
    for (var i = 0; i < TIERS.length; i++) {
      if (r >= TIERS[i].minRound) match = TIERS[i]
    }
    return {
      horsesPerRound: match.horsesPerRound,
      hatsPerHorse: [match.hatsPerHorse[0], match.hatsPerHorse[1]],
      orderMatters: match.orderMatters,
      label: match.label
    }
  }

  var PFG = global.PFG || (global.PFG = {})
  PFG.escalate = { getTier: getTier }
})(typeof window !== 'undefined' ? window : globalThis)
