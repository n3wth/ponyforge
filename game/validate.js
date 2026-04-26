// game/validate.js
// VALIDATE module for ponyforge "Dress to Match".
// Pure functions, no DOM. Exposes window.PFG.validate.match(target, currentState).
//
// target: either a single { horseId, hats:[...], orderMatters? }
//         or an array of such objects (one per target horse).
// currentState: { horseId: [hatGlyphsInStackOrder] } for ALL 6 horses.
//   Non-target horses MUST be empty (per SPEC.md §5 — prevents cheese).
//
// Returns: {
//   matched: boolean,
//   perHorse: { horseId: { matched, missing[], extra[] } }
// }
;(function () {
  'use strict'

  var ALL_HORSES = ['iris', 'vesper', 'onyx', 'prism', 'sable', 'femme']

  function normalizeTarget(target) {
    if (target == null) return []
    var arr = Array.isArray(target) ? target : [target]
    var out = []
    for (var i = 0; i < arr.length; i++) {
      var t = arr[i]
      if (!t || typeof t.horseId !== 'string') continue
      out.push({
        horseId: t.horseId,
        hats: Array.isArray(t.hats) ? t.hats.slice() : [],
        orderMatters: !!t.orderMatters,
      })
    }
    return out
  }

  // Compute set difference: items in `a` not in `b` (multiset-aware).
  function diff(a, b) {
    var bCounts = {}
    for (var i = 0; i < b.length; i++) bCounts[b[i]] = (bCounts[b[i]] || 0) + 1
    var out = []
    for (var j = 0; j < a.length; j++) {
      var k = a[j]
      if (bCounts[k]) bCounts[k]--
      else out.push(k)
    }
    return out
  }

  function arraysEqualOrdered(a, b) {
    if (a.length !== b.length) return false
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
    return true
  }

  function setsEqual(a, b) {
    if (a.length !== b.length) return false
    return diff(a, b).length === 0 && diff(b, a).length === 0
  }

  function match(target, currentState) {
    var targets = normalizeTarget(target)
    var state = currentState || {}
    var perHorse = {}
    var allMatched = true

    var targetIds = {}
    for (var i = 0; i < targets.length; i++) {
      var t = targets[i]
      targetIds[t.horseId] = true
      var stack = Array.isArray(state[t.horseId]) ? state[t.horseId] : []
      var ok
      if (t.orderMatters) {
        ok = arraysEqualOrdered(stack, t.hats)
      } else {
        ok = setsEqual(stack, t.hats)
      }
      perHorse[t.horseId] = {
        matched: ok,
        missing: diff(t.hats, stack), // wanted but not present
        extra: diff(stack, t.hats),   // present but not wanted
      }
      if (!ok) allMatched = false
    }

    // Non-target horses must be empty.
    for (var h = 0; h < ALL_HORSES.length; h++) {
      var id = ALL_HORSES[h]
      if (targetIds[id]) continue
      var s = Array.isArray(state[id]) ? state[id] : []
      var clean = s.length === 0
      perHorse[id] = {
        matched: clean,
        missing: [],
        extra: s.slice(),
      }
      if (!clean) allMatched = false
    }

    return { matched: allMatched, perHorse: perHorse }
  }

  var api = { match: match }

  if (typeof window !== 'undefined') {
    window.PFG = window.PFG || {}
    window.PFG.validate = api
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api
  }

  // ---- Tests (manual: PFG.validate._test() in console) ----
  function _test() {
    var pass = 0, fail = 0
    function check(label, cond) {
      if (cond) { pass++; console.log('  ok  ' + label) }
      else { fail++; console.error('  FAIL ' + label) }
      console.assert(cond, label)
    }

    var empty = { iris: [], vesper: [], onyx: [], prism: [], sable: [], femme: [] }

    // 1. single horse, single hat, exact match
    var r1 = match(
      { horseId: 'vesper', hats: ['👑'] },
      Object.assign({}, empty, { vesper: ['👑'] })
    )
    check('1: single hat match', r1.matched && r1.perHorse.vesper.matched)

    // 2. missing required hat
    var r2 = match(
      { horseId: 'vesper', hats: ['👑', '🕶️'] },
      Object.assign({}, empty, { vesper: ['👑'] })
    )
    check('2: missing hat fails', !r2.matched && r2.perHorse.vesper.missing.length === 1 && r2.perHorse.vesper.missing[0] === '🕶️')

    // 3. extra hat on target horse
    var r3 = match(
      { horseId: 'vesper', hats: ['👑'] },
      Object.assign({}, empty, { vesper: ['👑', '💋'] })
    )
    check('3: extra hat fails', !r3.matched && r3.perHorse.vesper.extra.length === 1)

    // 4. cheese: hat on non-target horse
    var r4 = match(
      { horseId: 'vesper', hats: ['👑'] },
      Object.assign({}, empty, { vesper: ['👑'], iris: ['🌼'] })
    )
    check('4: non-target horse with hat fails', !r4.matched && !r4.perHorse.iris.matched && r4.perHorse.iris.extra[0] === '🌼')

    // 5. order ignored when orderMatters=false (default)
    var r5 = match(
      { horseId: 'onyx', hats: ['👑', '🕶️', '💋'] },
      Object.assign({}, empty, { onyx: ['💋', '👑', '🕶️'] })
    )
    check('5: set equality ignores order', r5.matched)

    // 6. orderMatters=true rejects different order
    var r6 = match(
      { horseId: 'onyx', hats: ['👑', '🕶️', '💋'], orderMatters: true },
      Object.assign({}, empty, { onyx: ['💋', '👑', '🕶️'] })
    )
    check('6: ordered match rejects wrong order', !r6.matched)

    // 7. multi-horse target, both correct
    var r7 = match(
      [
        { horseId: 'iris', hats: ['🌼'] },
        { horseId: 'sable', hats: ['🪩', '🏳️‍🌈'] },
      ],
      Object.assign({}, empty, { iris: ['🌼'], sable: ['🏳️‍🌈', '🪩'] })
    )
    check('7: multi-horse match', r7.matched)

    // 8. multi-horse with cheese on third horse
    var r8 = match(
      [
        { horseId: 'iris', hats: ['🌼'] },
        { horseId: 'sable', hats: ['🪩'] },
      ],
      Object.assign({}, empty, { iris: ['🌼'], sable: ['🪩'], femme: ['✨'] })
    )
    check('8: multi-horse cheese fails', !r8.matched && r8.perHorse.femme.extra[0] === '✨')

    console.log('validate._test: ' + pass + ' passed, ' + fail + ' failed')
    return { pass: pass, fail: fail }
  }
  api._test = _test
})()
