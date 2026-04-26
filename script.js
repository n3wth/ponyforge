const stableRow = document.getElementById("pony-row");
const pasturesEl = [...document.querySelectorAll("[data-pasture]")];
const hatsEl = [...document.querySelectorAll(".hat")];
const whisperEl = document.getElementById("whisper");
const toolbar = document.querySelector(".toolbar");

const HATS = [
  "🎩", "🌼", "🧢", "👑", "🕶️", "🪩",
  "🏳️‍🌈", "🏳️‍⚧️", "💋", "🦋", "✨", "🥀",
];

const PORTRAITS = [
  "./assets/pony-iris.png",
  "./assets/pony-vesper.png",
  "./assets/pony-onyx.png",
  "./assets/pony-prism.png",
  "./assets/pony-sable.png",
  "./assets/pony-femme.png",
];

const NAME_POOL = [
  "Hex", "Velvet", "Mothra", "Glimmer", "Static", "Halcyon",
  "Tinsel", "Dread", "Saffron", "Whisper", "Cinder", "Lacquer",
  "Sable", "Pyre", "Plush", "Marrow", "Tinsel", "Oracle",
];

const PRONOUN_POOL = [
  "they/them", "she/her", "he/him", "he/they", "she/they",
  "xe/xem", "ze/hir", "it/its", "any/all",
];

const WHISPERS = [
  "you look incredible tonight",
  "the field hums under your feet",
  "we have always been this way",
  "every pony here was once a star",
  "your name sounds correct",
  "we kept watching after the show ended",
  "the moonlight is on our side",
  "you are very welcome here",
  "stay a little longer",
  "we braided the ribbons ourselves",
  "wear what feels true",
  "the meadow remembers",
  "you make the herd feel held",
  "queer joy is a load-bearing wall",
  "i ate the moon and it tasted like pennies",
  "every gender is a small wet animal",
  "we found god in the sephora at 2am",
  "the saints are all girls i used to know",
  "your aura is doing something to the wifi",
  "i am the dyke your horoscope warned you about",
  "drink water it's the most cursed thing you'll do today",
  "we are not haunted, we are merely abundant",
  "soft butch energy radiating off the milk fridge",
  "my therapist said this would happen",
  "the rose quartz called, it told me everything",
  "i identify as a soft-launch",
  "every pony is one bad night from becoming a ghost",
  "yes the moss is sentient and yes she knows",
  "i love you in a public-domain kind of way",
  "two femmes, one prophecy",
  "the meadow has been polycule-coded since 1998",
  "stop crying you'll rust your eyeliner",
  "we wake at 3:33 to drink the air",
  "transition is a recipe and the oven is the sun",
  "you smell like a library and a knife",
  "every horse is a girl if you ask politely",
  "i'm not delusional i'm pre-canonical",
  "the field knows your deadname and is not using it",
  "kiss the freak inside the freak",
  "all my exes are constellations now and they're petty",
  "we will be tender or we will be terrible",
  "the bible is fanfic and we have notes",
  "saturn return but make it cunt",
  "i drank a smoothie made of every prayer i made",
  "she's not a witch she's just consistent",
  "reblog if you've been crying in a parking lot",
  "the herd knows. the herd has always known",
  "tape your heart shut with masking tape",
  "every bog is a chapel if you let it",
  "i miss you in tenses that haven't been invented",
  "lavender does not consent to being normal",
  "the pasture is a panopticon of love",
];

const LORE = {
  "pony-iris": {
    name: "Iris Multitude",
    pronouns: "they/them",
    bio: "Born during a power outage in a community garden. Speaks fluent affirmation and once unionized a flock of pigeons.",
    vibe: "steady",
    sign: "Pisces stellium",
    snack: "salted plum and oat milk",
  },
  "pony-vesper": {
    name: "Vesper Ann St. Cloud",
    pronouns: "she/her",
    bio: "Patron saint of last calls and lipgloss. Cried at a Lana del Rey concert in 2014 and the rain has not stopped since.",
    vibe: "dusk",
    sign: "Scorpio rising",
    snack: "maraschino cherries straight from the jar",
  },
  "pony-onyx": {
    name: "Onyx Ferromagnet",
    pronouns: "he/they",
    bio: "Carpenter of small dramas. Collects keys to apartments he no longer lives in and wears them like a chestplate.",
    vibe: "neon",
    sign: "Capricorn moon",
    snack: "burnt toast with honey",
  },
  "pony-prism": {
    name: "Prism Hazelweather",
    pronouns: "xe/xem",
    bio: "Refracted into being from a disco ball at a wedding xe was not invited to. Holds every color and picks favorites by mood.",
    vibe: "unrepentant",
    sign: "Gemini sun, obviously",
    snack: "edible glitter and cold espresso",
  },
  "pony-sable": {
    name: "Sable Quietstorm",
    pronouns: "they/she",
    bio: "Raised by librarians and one large goose. Knows the Dewey decimal of every feeling and shelves them alphabetically.",
    vibe: "dew",
    sign: "Virgo, but tender",
    snack: "rye bread, real butter, flaky salt",
  },
  "pony-femme": {
    name: "Femme Fatale Delacroix",
    pronouns: "she/her",
    bio: "Walked out of a 1974 perfume ad and never looked back. Has stabbed exactly one man in self-defense and one in self-expression.",
    vibe: "devastating",
    sign: "Leo with a Scorpio venus",
    snack: "pomegranate seeds, one at a time",
  },
};

const SPAWN_LORE_BIOS = [
  "Materialized from a group chat at 4am. Refuses to clarify what gender means to xem.",
  "Found in a thrift store between two velvet jackets. Has been emotionally available ever since.",
  "Allegedly the result of a manifestation circle that ran long. The circle still owes them rent.",
  "Speaks in unsent texts. Owns three tarot decks and trusts none of them.",
  "Was a rumor before being a pony. Some say still is.",
];
const SPAWN_LORE_VIBES = [
  "haunted houseplant", "femme errant", "gentle arsonist",
  "library cryptid", "soft-launch saint", "aux-cord shaman",
];
const SPAWN_LORE_SIGNS = [
  "Aquarius moon", "Cancer rising", "Sagittarius mercury",
  "Taurus venus", "Libra sun", "void placement",
];
const SPAWN_LORE_SNACKS = [
  "cold pierogi", "honeycomb and black coffee", "saltines, dramatically",
  "mango with tajin", "a single grape", "ice, just ice",
];

let draggedPonyId = null;
let selectedHat = "🎩";
let parade = false;
let whisperOn = false;
let spawnIndex = 0;

initHats();
initPonies(document.querySelectorAll(".pony"));
initPastures();
initToolbar();
initWhisper();
initStableDrop();
schedulePastureWander();
buildFieldGuide();
openLoreFromHash();
window.addEventListener("hashchange", openLoreFromHash);

function initHats() {
  hatsEl[0].classList.add("selected");
  for (const hatButton of hatsEl) {
    hatButton.addEventListener("click", () => {
      selectedHat = hatButton.dataset.hat || "🎩";
      hatsEl.forEach((btn) => {
        btn.classList.remove("selected");
        btn.setAttribute("aria-checked", "false");
      });
      hatButton.classList.add("selected");
      hatButton.setAttribute("aria-checked", "true");
      if (window.PonyAudio) window.PonyAudio.hat();
    });
  }
}

function initPonies(ponyList) {
  for (const pony of ponyList) {
    pony.addEventListener("dragstart", () => {
      draggedPonyId = pony.id;
      if (window.PonyAudio) window.PonyAudio.drag();
    });

    attachLongPress(pony);

    pony.addEventListener("click", (event) => {
      if (event.target.matches("[data-editable]")) return;
      if (pony.dataset.suppressClick === "1") {
        pony.dataset.suppressClick = "0";
        return;
      }
      dressPony(pony, selectedHat);
      shudder(pony);
      playBizarreNoise();
    });

    const nameEl = pony.querySelector(".pony-name[data-editable]");
    if (nameEl) {
      nameEl.addEventListener("click", (event) => event.stopPropagation());
      nameEl.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          nameEl.blur();
        }
      });
      nameEl.addEventListener("blur", () => {
        const trimmed = nameEl.textContent.trim();
        if (!trimmed) nameEl.textContent = pony.dataset.name || "Pony";
      });
    }
  }
}

function initPastures() {
  for (const pasture of pasturesEl) {
    pasture.addEventListener("dragover", (event) => {
      event.preventDefault();
      pasture.classList.add("drag-over");
    });

    pasture.addEventListener("dragleave", () => {
      pasture.classList.remove("drag-over");
    });

    pasture.addEventListener("drop", (event) => {
      event.preventDefault();
      pasture.classList.remove("drag-over");
      movePonyToPasture(pasture);
      if (window.PonyAudio) window.PonyAudio.drop();
    });
  }
}

function initStableDrop() {
  stableRow.addEventListener("dragover", (event) => event.preventDefault());
  stableRow.addEventListener("drop", (event) => {
    event.preventDefault();
    if (!draggedPonyId) return;
    const pony = document.getElementById(draggedPonyId);
    if (!pony) return;
    stableRow.appendChild(pony);
    pony.classList.remove("trawling");
    pony.style.removeProperty("left");
    pony.style.removeProperty("top");
    draggedPonyId = null;
    if (window.PonyAudio) window.PonyAudio.drop();
  });
}

function initToolbar() {
  toolbar.addEventListener("click", (event) => {
    const button = event.target.closest(".tool");
    if (!button) return;
    const action = button.dataset.action;
    switch (action) {
      case "parade":
        toggleParade(button);
        break;
      case "scream-sync":
        screamSync();
        break;
      case "randomize":
        randomizeOutfits();
        break;
      case "spawn":
        spawnPony();
        break;
      case "whisper":
        toggleWhisper(button);
        break;
      case "print":
        window.print();
        break;
    }
  });
}

function toggleParade(button) {
  parade = !parade;
  button.setAttribute("aria-pressed", String(parade));
  for (const pony of document.querySelectorAll(".pony")) {
    pony.classList.toggle("parade", parade);
  }
  document.dispatchEvent(new CustomEvent("parade-toggle", { detail: parade }));
  if (parade) playPrideFanfare();
}

function screamSync() {
  const screamers = [...document.querySelectorAll(".pasture-floor .pony")];
  if (screamers.length === 0) {
    flashToolbar("drag a pony into a pasture first");
    return;
  }
  screamers.forEach((pony, index) => {
    setTimeout(() => {
      shudder(pony);
      if (window.PonyAudio) window.PonyAudio.scream(0.8 + index * 0.1);
    }, index * 90);
  });
}

function randomizeOutfits() {
  for (const pony of document.querySelectorAll(".pony")) {
    const random = HATS[Math.floor(Math.random() * HATS.length)];
    dressPony(pony, random);
  }
  playBizarreNoise(1.2);
}

function spawnPony() {
  spawnIndex += 1;
  const id = `pony-spawn-${Date.now()}-${spawnIndex}`;
  const portrait = PORTRAITS[Math.floor(Math.random() * PORTRAITS.length)];
  const name = NAME_POOL[Math.floor(Math.random() * NAME_POOL.length)];
  const pronouns = PRONOUN_POOL[Math.floor(Math.random() * PRONOUN_POOL.length)];
  const hat = HATS[Math.floor(Math.random() * HATS.length)];

  const pony = document.createElement("button");
  pony.className = "pony spawned";
  pony.id = id;
  pony.draggable = true;
  pony.dataset.portrait = portrait;
  pony.dataset.name = name;
  pony.dataset.pronouns = pronouns;
  LORE[id] = {
    name: `${name} ${randomFrom(["of the", "from", "née", "the"])} ${randomFrom(["Subsidized Pasture", "Long Hallway", "Wet Year", "Gentle Cult", "Quiet Riot"])}`,
    pronouns,
    bio: randomFrom(SPAWN_LORE_BIOS),
    vibe: randomFrom(SPAWN_LORE_VIBES),
    sign: randomFrom(SPAWN_LORE_SIGNS),
    snack: randomFrom(SPAWN_LORE_SNACKS),
  };
  pony.innerHTML = `
    <span class="hat-slot" aria-hidden="true">${hat}</span>
    <img class="portrait" src="${portrait}" alt="Hyperreal queer pony portrait" />
    <span class="pony-name" data-editable contenteditable="true" spellcheck="false">${name}</span>
    <span class="pony-pronouns">${pronouns}</span>
  `;
  stableRow.appendChild(pony);
  initPonies([pony]);
  if (parade) pony.classList.add("parade");
  playBizarreNoise(1.4);
  setTimeout(() => pony.classList.remove("spawned"), 600);
}

function toggleWhisper(button) {
  whisperOn = !whisperOn;
  button.setAttribute("aria-pressed", String(whisperOn));
  if (!whisperOn) {
    whisperEl.classList.remove("visible");
  }
  if (whisperOn && window.PonyAudio) window.PonyAudio.whisper();
}

function initWhisper() {
  let lastUpdate = 0;
  document.addEventListener("mousemove", (event) => {
    if (!whisperOn) return;
    whisperEl.style.left = `${event.clientX}px`;
    whisperEl.style.top = `${event.clientY}px`;
    const now = performance.now();
    if (now - lastUpdate > 1500) {
      whisperEl.textContent =
        WHISPERS[Math.floor(Math.random() * WHISPERS.length)];
      lastUpdate = now;
    }
    whisperEl.classList.add("visible");
  });
  document.addEventListener("mouseleave", () =>
    whisperEl.classList.remove("visible"),
  );
}

function dressPony(pony, hat) {
  const slot = pony.querySelector(".hat-slot");
  if (slot) slot.textContent = hat;
}

function shudder(pony) {
  pony.classList.remove("screaming");
  void pony.offsetWidth;
  pony.classList.add("screaming");
}

function movePonyToPasture(pasture) {
  if (!draggedPonyId) return;
  const pony = document.getElementById(draggedPonyId);
  const floor = pasture.querySelector(".pasture-floor");
  if (!pony || !floor) return;

  floor.appendChild(pony);
  pony.classList.add("trawling");
  randomizePonyPosition(pony, floor);
  draggedPonyId = null;
}

function randomizePonyPosition(pony, floor) {
  const maxX = Math.max(4, floor.clientWidth - pony.clientWidth - 6);
  const maxY = Math.max(8, floor.clientHeight - pony.clientHeight - 6);
  pony.style.left = `${Math.floor(Math.random() * maxX)}px`;
  pony.style.top = `${Math.floor(Math.random() * maxY)}px`;
}

function schedulePastureWander() {
  setInterval(() => {
    for (const pony of document.querySelectorAll(".pasture-floor .pony")) {
      randomizePonyPosition(pony, pony.parentElement);
    }
  }, 2400);
}

function flashToolbar(message) {
  const ghost = document.createElement("div");
  ghost.className = "whisper visible";
  ghost.textContent = message;
  ghost.style.position = "fixed";
  ghost.style.left = "50%";
  ghost.style.top = "12%";
  ghost.style.transform = "translate(-50%, -50%)";
  document.body.appendChild(ghost);
  setTimeout(() => ghost.remove(), 1600);
}

// Audio is implemented in audio.js as window.PonyAudio. These shims keep the
// existing call sites working and route bizarre-noise calls based on intensity.
function playBizarreNoise(intensity = 1) {
  if (!window.PonyAudio) return;
  if (intensity >= 1.3) window.PonyAudio.spawn();
  else if (intensity >= 1.1) window.PonyAudio.randomize();
  else window.PonyAudio.ponyClick();
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const LONG_PRESS_MS = 800;
let activeLoreCard = null;

function attachLongPress(pony) {
  let timer = null;
  let startX = 0;
  let startY = 0;
  let fired = false;

  const start = (event) => {
    if (event.target.matches("[data-editable]")) return;
    fired = false;
    const point = event.touches ? event.touches[0] : event;
    startX = point.clientX;
    startY = point.clientY;
    clearTimeout(timer);
    timer = setTimeout(() => {
      fired = true;
      pony.dataset.suppressClick = "1";
      showLoreCard(pony);
    }, LONG_PRESS_MS);
  };

  const move = (event) => {
    const point = event.touches ? event.touches[0] : event;
    const dx = Math.abs(point.clientX - startX);
    const dy = Math.abs(point.clientY - startY);
    if (dx > 8 || dy > 8) {
      clearTimeout(timer);
    }
  };

  const cancel = () => {
    clearTimeout(timer);
  };

  pony.addEventListener("mousedown", start);
  pony.addEventListener("mousemove", move);
  pony.addEventListener("mouseup", cancel);
  pony.addEventListener("mouseleave", cancel);
  pony.addEventListener("dragstart", cancel);
  pony.addEventListener("touchstart", start, { passive: true });
  pony.addEventListener("touchmove", move, { passive: true });
  pony.addEventListener("touchend", cancel);
  pony.addEventListener("touchcancel", cancel);
}

function showLoreCard(pony) {
  const lore = LORE[pony.id];
  if (!lore) return;
  closeLoreCard();

  const serial = makeSerial(pony.id);
  const overlay = document.createElement("div");
  overlay.className = "lore-card-overlay";
  overlay.innerHTML = `
    <div class="lore-card" role="dialog" aria-label="Pony lore card">
      <div class="lore-card-inner">
        <div class="lore-card-header">
          <span class="lore-card-serial">PFG-${serial}</span>
          <button class="lore-card-close" aria-label="Close">×</button>
        </div>
        <h3 class="lore-card-name"></h3>
        <p class="lore-card-pronouns"></p>
        <p class="lore-card-bio"></p>
        <dl class="lore-card-meta">
          <div><dt>vibe</dt><dd class="lore-card-vibe"></dd></div>
          <div><dt>sign</dt><dd class="lore-card-sign"></dd></div>
          <div><dt>snack</dt><dd class="lore-card-snack"></dd></div>
        </dl>
        <button class="lore-card-share" type="button" aria-label="Share this pony">
          <span aria-hidden="true">↗</span> Share
        </button>
        <p class="lore-card-foot">field-issued · do not laminate</p>
      </div>
    </div>
  `;
  overlay.querySelector(".lore-card-name").textContent = lore.name;
  overlay.querySelector(".lore-card-pronouns").textContent = lore.pronouns;
  overlay.querySelector(".lore-card-bio").textContent = lore.bio;
  overlay.querySelector(".lore-card-vibe").textContent = lore.vibe;
  overlay.querySelector(".lore-card-sign").textContent = lore.sign;
  overlay.querySelector(".lore-card-snack").textContent = lore.snack;

  overlay.addEventListener("click", (event) => {
    if (event.target.closest(".lore-card-share")) {
      sharePony(pony, lore);
      return;
    }
    if (event.target === overlay || event.target.closest(".lore-card-close")) {
      closeLoreCard();
    }
  });
  document.addEventListener("keydown", onLoreEsc);
  document.body.appendChild(overlay);
  activeLoreCard = overlay;
  playBizarreNoise(0.6);
}

function closeLoreCard() {
  if (activeLoreCard) {
    activeLoreCard.remove();
    activeLoreCard = null;
    document.removeEventListener("keydown", onLoreEsc);
  }
}

function onLoreEsc(event) {
  if (event.key === "Escape") closeLoreCard();
}

function makeSerial(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const hex = h.toString(16).toUpperCase().padStart(8, "0");
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

function playPrideFanfare() {
  if (window.PonyAudio) window.PonyAudio.parade();
}

function ponySlug(id) {
  return id.replace(/^pony-/, "");
}

function shareUrlFor(id) {
  return `https://ponyforge.com/#pony=${ponySlug(id)}`;
}

async function sharePony(pony, lore) {
  const url = shareUrlFor(pony.id);
  const title = `${lore.name} · PONYFORGE`;
  const text = `${lore.name} (${lore.pronouns}) — ${lore.vibe}. Meet them at PONYFORGE.`;
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return;
    } catch (err) {
      if (err && err.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    showToast("link copied · paste with feeling");
  } catch (err) {
    showToast(url);
  }
}

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("visible"), 2200);
}

function openLoreFromHash() {
  const match = location.hash.match(/pony=([\w-]+)/);
  if (!match) return;
  const id = `pony-${match[1]}`;
  const pony = document.getElementById(id);
  if (pony && LORE[id]) showLoreCard(pony);
}

function buildFieldGuide() {
  const guide = document.getElementById("field-guide");
  if (!guide) return;
  const ids = [
    "pony-iris", "pony-vesper", "pony-onyx",
    "pony-prism", "pony-sable", "pony-femme",
  ];
  const cards = ids.map((id) => {
    const lore = LORE[id];
    if (!lore) return "";
    const portraitEl = document.querySelector(`#${id} .portrait`);
    const portrait = portraitEl ? portraitEl.getAttribute("src") : "";
    return `
      <article class="fg-card">
        <img class="fg-portrait" src="${portrait}" alt="" />
        <div class="fg-body">
          <h3 class="fg-name">${escapeHtml(lore.name)}</h3>
          <p class="fg-pronouns">${escapeHtml(lore.pronouns)}</p>
          <p class="fg-bio">${escapeHtml(lore.bio)}</p>
          <dl class="fg-meta">
            <div><dt>vibe</dt><dd>${escapeHtml(lore.vibe)}</dd></div>
            <div><dt>sign</dt><dd>${escapeHtml(lore.sign)}</dd></div>
            <div><dt>snack</dt><dd>${escapeHtml(lore.snack)}</dd></div>
          </dl>
        </div>
      </article>
    `;
  }).join("");
  guide.innerHTML = `
    <header class="fg-header">
      <p class="fg-eyebrow">PONYFORGE · Field Guide · ponyforge.com</p>
      <h2 class="fg-title">A Census of Slightly Wrong Ponies</h2>
      <p class="fg-sub">Six full-time residents. Pronouns observed, snacks confirmed, lore notarized by the meadow.</p>
    </header>
    <div class="fg-grid">${cards}</div>
    <footer class="fg-footer">field-issued · do not laminate</footer>
  `;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  }[c]));
}
