// Ponyforge — interaction script.
// Direction: studbook & millinery. Tactile, weighted, considered.
// Notes: no idle animation; all motion is reactive.

(() => {
  const hats     = document.querySelectorAll('.hat')
  const ponies   = document.querySelectorAll('.pony')
  const entries  = document.querySelectorAll('.entry')
  const paddock  = document.getElementById('paddock')
  const stable   = document.getElementById('stable')
  const recall   = document.getElementById('recall')
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  let currentHat = '🎩'

  // ---------------------------------------------------------- HAT PALETTE

  const setHat = (btn) => {
    hats.forEach(h => h.setAttribute('aria-checked', h === btn ? 'true' : 'false'))
    currentHat = btn.dataset.hat
  }

  hats.forEach(h => {
    h.addEventListener('click', () => setHat(h))
    h.addEventListener('keydown', (e) => {
      // arrow-key navigation across the palette
      const idx = [...hats].indexOf(h)
      let next = -1
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % hats.length
      if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   next = (idx - 1 + hats.length) % hats.length
      if (next >= 0) {
        e.preventDefault()
        setHat(hats[next])
        hats[next].focus()
      }
    })
  })

  // ---------------------------------------------------------- HAT FITTING

  // Choreography: the previous hat falls (drop + tilt + fade);
  // a beat later the new hat lands from above.
  const fitHat = (pony, newHat) => {
    const slot = pony.querySelector('.hat-slot')
    if (!slot) return
    const prev = slot.textContent

    if (reduceMotion || prev === newHat) {
      slot.textContent = newHat
      return
    }

    // 1. animate previous hat falling out
    slot.classList.remove('is-landing')
    slot.classList.add('is-falling')

    slot.addEventListener('animationend', function onFall() {
      slot.removeEventListener('animationend', onFall)
      slot.classList.remove('is-falling')
      // 2. swap glyph, then animate landing
      slot.textContent = newHat
      // force reflow so the next animation re-fires
      void slot.offsetWidth
      slot.classList.add('is-landing')
      slot.addEventListener('animationend', () => slot.classList.remove('is-landing'), { once: true })
    }, { once: true })
  }

  // ---------------------------------------------------------- ENTRY METADATA

  // The unexpected detail: when a horse is first interacted with,
  // we stamp a coordinate alongside its plate number — a paddock
  // location, drawn from the horse's name. Subtle, persistent.
  const stampCoord = (entry, x, y) => {
    if (!entry) return
    const w = paddock.clientWidth || 1
    const h = paddock.clientHeight || 1
    const col = String.fromCharCode(65 + Math.min(7, Math.floor((x / w) * 8)))  // A–H
    const row = Math.min(5, Math.floor((y / h) * 5)) + 1                         // 1–5
    const plate = entry.querySelector('.pony__plate')
    if (plate) {
      entry.dataset.touched = 'true'
      plate.setAttribute('data-coord', `${col}·${row}`)
    }
  }

  // ---------------------------------------------------------- DRAG (HTML5)

  let dragged = null
  let dragOffset = [0, 0]
  let ghost = null
  let originEntry = null   // remember home so we can return on cancel

  const makeGhost = (pony) => {
    const img = pony.querySelector('img')
    const g = document.createElement('div')
    g.className = 'drag-ghost'
    g.innerHTML = `<img src="${img.src}" alt="" />`
    document.body.appendChild(g)
    return g
  }

  const moveGhost = (x, y) => {
    if (!ghost) return
    ghost.style.left = `${x}px`
    ghost.style.top  = `${y}px`
  }

  const removeGhost = () => {
    if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost)
    ghost = null
  }

  // Re-sort paddock children so y-position determines z-index:
  // a horse further down the canvas overlaps one further up.
  const sortPaddockZ = () => {
    const inPaddock = [...paddock.querySelectorAll('.pony')]
    inPaddock.forEach(p => {
      const top = parseFloat(p.style.top) || 0
      // z = top, with a small base. Closer to bottom = higher z.
      p.style.setProperty('--z', String(Math.round(top + 100)))
      // depth = 0 (front) at bottom, 1 (back) at top of paddock
      const h = paddock.clientHeight || 1
      const depth = Math.max(0, Math.min(0.85, 1 - (top / h) - 0.1))
      p.style.setProperty('--depth', depth.toFixed(3))
    })
  }

  ponies.forEach(p => {
    // CLICK = fit hat (with the choreography)
    p.addEventListener('click', () => {
      if (p._wasDragged) { p._wasDragged = false; return }
      fitHat(p, currentHat)
    })

    // KEYBOARD: Enter / Space fits hat (button default already does)
    // No extra binding needed — buttons already trigger click on Enter/Space.

    p.addEventListener('dragstart', (e) => {
      dragged = p
      originEntry = p.closest('.entry')   // null if already in paddock
      const r = p.getBoundingClientRect()
      dragOffset = [e.clientX - r.left, e.clientY - r.top]
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', 'pony')

      // Hide the default browser drag image and use our own ghost.
      const blank = document.createElement('canvas')
      blank.width = blank.height = 1
      e.dataTransfer.setDragImage(blank, 0, 0)
      ghost = makeGhost(p)
      moveGhost(e.clientX, e.clientY)

      // Visual hint — origin fades a touch while dragging.
      p.style.opacity = '0.35'
    })

    p.addEventListener('drag', (e) => {
      if (e.clientX === 0 && e.clientY === 0) return  // ignore drag-end ghost frame
      moveGhost(e.clientX, e.clientY)
    })

    p.addEventListener('dragend', () => {
      if (dragged === p) p._wasDragged = true
      p.style.opacity = ''
      removeGhost()
      dragged = null
      originEntry = null
    })
  })

  // ---------------------------------------------------------- PADDOCK DROP

  paddock.addEventListener('dragover', (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    paddock.classList.add('over')
  })
  paddock.addEventListener('dragleave', (e) => {
    if (e.target === paddock) paddock.classList.remove('over')
  })

  paddock.addEventListener('drop', (e) => {
    e.preventDefault()
    paddock.classList.remove('over')
    if (!dragged) return

    const r = paddock.getBoundingClientRect()
    const x = e.clientX - r.left - dragOffset[0]
    const y = e.clientY - r.top  - dragOffset[1]

    // If horse is coming from the stable, move it to the paddock.
    if (dragged.parentElement !== paddock) {
      paddock.appendChild(dragged)
    }

    const wide = dragged.offsetWidth  || 130
    const tall = dragged.offsetHeight || 80
    const cx = Math.max(0, Math.min(r.width  - wide, x))
    const cy = Math.max(0, Math.min(r.height - tall, y))
    dragged.style.left = `${cx}px`
    dragged.style.top  = `${cy}px`

    sortPaddockZ()

    // weighted-landing animation
    if (!reduceMotion) {
      dragged.classList.remove('is-landing')
      void dragged.offsetWidth
      dragged.classList.add('is-landing')
    }

    // stamp coordinate onto the corresponding studbook entry
    const name = dragged.dataset.name
    const homeEntry = [...entries].find(e => e.querySelector('.pony')?.dataset.name === name)
                     || [...entries].find(e => e.contains(dragged))
    stampCoord(homeEntry, cx + wide / 2, cy + tall / 2)
  })

  // ---------------------------------------------------------- DROP-BACK-TO-STABLE (undo)

  // Dragging a horse back over the studbook returns it home.
  stable.addEventListener('dragover', (e) => {
    if (!dragged) return
    if (dragged.parentElement === paddock) e.preventDefault()
  })
  stable.addEventListener('drop', (e) => {
    if (!dragged) return
    if (dragged.parentElement !== paddock) return
    e.preventDefault()
    returnToStable(dragged)
  })

  const returnToStable = (pony) => {
    const name = pony.dataset.name
    const home = [...entries].find(en => en.querySelector('.pony')?.dataset.name === name)
                 || [...entries].find(en => {
                   const img = en.querySelector('img')
                   return img && pony.querySelector('img')?.src === img.src
                 })
    pony.style.left = ''
    pony.style.top = ''
    pony.style.removeProperty('--z')
    pony.style.removeProperty('--depth')
    if (home) {
      // place pony as the first child of the entry (before the dl)
      home.insertBefore(pony, home.firstChild)
    }
  }

  // ---------------------------------------------------------- RECALL

  recall.addEventListener('click', () => {
    const inPaddock = [...paddock.querySelectorAll('.pony')]
    inPaddock.forEach(p => returnToStable(p))
  })

  // ---------------------------------------------------------- KEYBOARD: place via Shift+Enter

  // For keyboard users: focus a horse, press 'P' to drop it in the
  // paddock at a stable default position; press 'S' to send back.
  document.addEventListener('keydown', (e) => {
    const focused = document.activeElement
    if (!focused || !focused.classList.contains('pony')) return
    if (e.key === 'p' || e.key === 'P') {
      e.preventDefault()
      const idx = [...ponies].indexOf(focused)
      if (focused.parentElement !== paddock) paddock.appendChild(focused)
      const r = paddock.getBoundingClientRect()
      const cols = 3
      const col = idx % cols
      const row = Math.floor(idx / cols)
      const w = focused.offsetWidth  || 130
      const h = focused.offsetHeight || 80
      const cx = 40 + col * ((r.width - 80) / cols)
      const cy = 40 + row * ((r.height - 80) / 2)
      focused.style.left = `${Math.max(0, Math.min(r.width - w, cx))}px`
      focused.style.top  = `${Math.max(0, Math.min(r.height - h, cy))}px`
      sortPaddockZ()
      if (!reduceMotion) {
        focused.classList.remove('is-landing')
        void focused.offsetWidth
        focused.classList.add('is-landing')
      }
      const home = focused.closest('.entry')
                 || [...entries].find(en => en.querySelector('.pony')?.dataset.name === focused.dataset.name)
      stampCoord(home, cx + w / 2, cy + h / 2)
    }
    if (e.key === 's' || e.key === 'S') {
      if (focused.parentElement === paddock) {
        e.preventDefault()
        returnToStable(focused)
      }
    }
  })

})()
