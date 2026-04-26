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
    vibe: "soft butch oracle",
    sign: "Pisces stellium",
    snack: "salted plum and oat milk",
  },
  "pony-vesper": {
    name: "Vesper Ann St. Cloud",
    pronouns: "she/her",
    bio: "Patron saint of last calls and lipgloss. Cried at a Lana del Rey concert in 2014 and the rain has not stopped since.",
    vibe: "wine-mom mystic",
    sign: "Scorpio rising",
    snack: "maraschino cherries straight from the jar",
  },
  "pony-onyx": {
    name: "Onyx Ferromagnet",
    pronouns: "he/they",
    bio: "Carpenter of small dramas. Collects keys to apartments he no longer lives in and wears them like a chestplate.",
    vibe: "sad boy with a toolbelt",
    sign: "Capricorn moon",
    snack: "burnt toast with honey",
  },
  "pony-prism": {
    name: "Prism Hazelweather",
    pronouns: "xe/xem",
    bio: "Refracted into being from a disco ball at a wedding xe was not invited to. Holds every color and picks favorites by mood.",
    vibe: "iridescent twink prophet",
    sign: "Gemini sun, obviously",
    snack: "edible glitter and cold espresso",
  },
  "pony-sable": {
    name: "Sable Quietstorm",
    pronouns: "they/she",
    bio: "Raised by librarians and one large goose. Knows the Dewey decimal of every feeling and shelves them alphabetically.",
    vibe: "non-binary cottage cleric",
    sign: "Virgo, but tender",
    snack: "rye bread, real butter, flaky salt",
  },
  "pony-femme": {
    name: "Femme Fatale Delacroix",
    pronouns: "she/her",
    bio: "Walked out of a 1974 perfume ad and never looked back. Has stabbed exactly one man in self-defense and one in self-expression.",
    vibe: "trans goddess of soft revenge",
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
    });
  }
}

function initPonies(ponyList) {
  for (const pony of ponyList) {
    pony.addEventListener("dragstart", () => {
      draggedPonyId = pony.id;
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
    }
  });
}

function toggleParade(button) {
  parade = !parade;
  button.setAttribute("aria-pressed", String(parade));
  for (const pony of document.querySelectorAll(".pony")) {
    pony.classList.toggle("parade", parade);
  }
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
      playBizarreNoise(0.7 + index * 0.18);
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

let audioContext;

function getAudioContext() {
  if (!audioContext) audioContext = new AudioContext();
  return audioContext;
}

function playBizarreNoise(intensity = 1) {
  const context = getAudioContext();
  const now = context.currentTime;
  const duration = (0.85 + Math.random() * 0.6) * intensity;

  const base = context.createOscillator();
  base.type = ["square", "sawtooth", "triangle"][Math.floor(Math.random() * 3)];
  base.frequency.setValueAtTime(140 + Math.random() * 220, now);
  base.frequency.exponentialRampToValueAtTime(40 + Math.random() * 80, now + duration);

  const wobble = context.createOscillator();
  wobble.type = "sine";
  wobble.frequency.value = 6 + Math.random() * 13;

  const wobbleGain = context.createGain();
  wobbleGain.gain.value = 40 + Math.random() * 90;
  wobble.connect(wobbleGain);
  wobbleGain.connect(base.frequency);

  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 400 + Math.random() * 1600;
  filter.Q.value = 1 + Math.random() * 7;

  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.5 * intensity, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  base.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);

  base.start(now);
  wobble.start(now);
  base.stop(now + duration);
  wobble.stop(now + duration);

  if (Math.random() > 0.4) {
    const chirp = context.createOscillator();
    const chirpGain = context.createGain();
    chirp.type = "triangle";
    chirp.frequency.setValueAtTime(900 + Math.random() * 700, now + 0.1);
    chirp.frequency.exponentialRampToValueAtTime(120 + Math.random() * 80, now + 0.28);
    chirpGain.gain.setValueAtTime(0.0001, now + 0.08);
    chirpGain.gain.exponentialRampToValueAtTime(0.2, now + 0.12);
    chirpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.31);
    chirp.connect(chirpGain);
    chirpGain.connect(context.destination);
    chirp.start(now + 0.08);
    chirp.stop(now + 0.31);
  }
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
  const context = getAudioContext();
  const now = context.currentTime;
  const notes = [262, 330, 392, 523, 659, 784];
  notes.forEach((freq, i) => {
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const start = now + i * 0.08;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.42);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(start);
    osc.stop(start + 0.45);
  });
}
