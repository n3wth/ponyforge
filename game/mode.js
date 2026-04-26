// game/mode.js
// Owns the play/chill mode toggle and global keyboard shortcuts.
// No game logic lives here — all state changes flow through caller-supplied
// callbacks (see SPEC §2, §11). The module also remembers the last focused
// element when entering play and restores it on returning to chill.

(function () {
  const PFG = (window.PFG = window.PFG || {})

  let state = 'chill'
  let onEnterPlay = null
  let onEnterChill = null
  let lastFocused = null
  let initialized = false

  function isTypingTarget(el) {
    if (!el) return false
    const tag = el.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
    if (el.isContentEditable) return true
    return false
  }

  function isHorseFocused(el) {
    if (!el || el === document.body) return false
    // A horse element is expected to expose a data-horse-id attribute or
    // a .horse class. Either signals the user is keyboard-targeting a horse.
    if (el.closest && el.closest('[data-horse-id], .horse')) return true
    return false
  }

  function emit(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail }))
    } catch (_) {
      // older browsers — ignore
    }
  }

  function rememberFocus() {
    const el = document.activeElement
    if (el && el !== document.body) lastFocused = el
    else lastFocused = null
  }

  function restoreFocus() {
    if (lastFocused && document.contains(lastFocused)) {
      try {
        lastFocused.focus({ preventScroll: true })
      } catch (_) {
        // best-effort
      }
    }
    lastFocused = null
  }

  function enterPlay() {
    if (state === 'play') return
    rememberFocus()
    state = 'play'
    if (typeof onEnterPlay === 'function') {
      try { onEnterPlay() } catch (e) { console.error('[mode] onEnterPlay', e) }
    }
    emit('pf:game:enter')
  }

  function enterChill() {
    if (state === 'chill') return
    state = 'chill'
    if (typeof onEnterChill === 'function') {
      try { onEnterChill() } catch (e) { console.error('[mode] onEnterChill', e) }
    }
    emit('pf:game:exit')
    // restore focus after the callback so any HUD teardown can complete first
    restoreFocus()
  }

  function toggle() {
    if (state === 'play') enterChill()
    else enterPlay()
  }

  function current() {
    return state
  }

  function onKeyDown(e) {
    // Don't intercept when the user is typing somewhere
    if (isTypingTarget(e.target)) return
    // Ignore when modifier keys are held — those belong to the browser
    if (e.metaKey || e.ctrlKey || e.altKey) return

    const key = e.key

    if (key === 'Escape') {
      if (state === 'play') {
        // If a transient overlay already consumed Esc (e.g. the hat ring or
        // an in-progress procession), let it close first instead of quitting
        // the run. script.js calls preventDefault() when it handles Esc.
        if (e.defaultPrevented) return
        e.preventDefault()
        // SPEC §9: Esc-during-round is a free quit, no heart cost.
        enterChill()
      }
      return
    }

    if (key === 'p' || key === 'P') {
      e.preventDefault()
      toggle()
      return
    }

    if (key === ' ' || key === 'Spacebar') {
      // Space enters play from chill, but only when the user isn't focused
      // on an interactive horse (where Space is the summon action).
      if (state === 'chill' && !isHorseFocused(e.target)) {
        e.preventDefault()
        enterPlay()
      }
    }
  }

  function init(opts) {
    opts = opts || {}
    onEnterPlay = opts.onEnterPlay || null
    onEnterChill = opts.onEnterChill || null
    if (initialized) return
    initialized = true
    window.addEventListener('keydown', onKeyDown, { capture: false })
  }

  PFG.mode = {
    init,
    enterPlay,
    enterChill,
    current,
  }
})()
