const elements = {
  intro: document.querySelector("#intro"),
  game: document.querySelector("#game"),
  celebration: document.querySelector("#celebration"),
  setupMessage: document.querySelector("#setup-message"),
  missingAssets: document.querySelector("#missing-assets"),
  startButton: document.querySelector("#start-button"),
  playAgainButton: document.querySelector("#play-again-button"),
  board: document.querySelector("#board"),
  progress: document.querySelector("#progress"),
  moves: document.querySelector("#moves"),
  announcement: document.querySelector("#game-announcement"),
  confetti: document.querySelector("#confetti"),
};

const state = {
  availablePairs: [],
  pairs: [],
  cards: [],
  selected: [],
  matchedPairs: 0,
  moves: 0,
  minimumPairs: 2,
  isChecking: false,
  gameStarted: false,
  gameCompleted: false,
  mismatchTimer: null,
  completionTimer: null,
};

const MAX_PAIRS_PER_GAME = 6;

function setSetupMessage(message) {
  elements.setupMessage.textContent = message;
}

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function isValidPair(pair) {
  return pair
    && typeof pair.id === "string"
    && pair.id.trim() !== ""
    && typeof pair.text === "string"
    && pair.text.trim() !== ""
    && typeof pair.image === "string"
    && pair.image.trim() !== "";
}

async function imageCanLoad(imagePath) {
  const image = new Image();
  image.src = new URL(imagePath, document.baseURI).href;
  try {
    if (typeof image.decode === "function") {
      await image.decode();
    } else {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
      });
    }
    return image.naturalWidth > 0 && image.naturalHeight > 0;
  } catch {
    return false;
  }
}

async function loadGameData() {
  try {
    const response = await fetch("./data/memory-items.json");
    if (!response.ok) {
      throw new Error(`Could not load the image configuration (HTTP ${response.status}).`);
    }
    const config = await response.json();
    if (!Array.isArray(config.pairs)) {
      throw new Error("The image configuration must include a pairs array.");
    }
    state.minimumPairs = Number.isInteger(config.minimumPairs) && config.minimumPairs > 0
      ? config.minimumPairs
      : 2;

    const seenIds = new Set();
    const invalidEntries = [];
    const candidates = [];
    for (const [index, pair] of config.pairs.entries()) {
      if (!isValidPair(pair) || seenIds.has(pair.id.trim())) {
        invalidEntries.push(`entry ${index + 1}`);
        continue;
      }
      seenIds.add(pair.id.trim());
      candidates.push({
        ...pair,
        id: pair.id.trim(),
        text: pair.text.trim(),
        image: pair.image.trim(),
      });
    }

    const results = await Promise.all(candidates.map(async (pair) => ({
      pair,
      available: await imageCanLoad(pair.image),
    })));
    state.availablePairs = results.filter((result) => result.available).map((result) => result.pair);

    const missingImages = results.filter((result) => !result.available).map((result) => result.pair.image);
    elements.missingAssets.replaceChildren();
    elements.missingAssets.hidden = missingImages.length === 0;
    for (const result of results.filter((item) => !item.available)) {
      const placeholder = document.createElement("div");
      placeholder.className = "missing-asset";
      placeholder.setAttribute("role", "img");
      placeholder.setAttribute("aria-label", `Unavailable image for ${result.pair.text}`);
      const tile = document.createElement("span");
      tile.className = "missing-asset-placeholder";
      tile.setAttribute("aria-hidden", "true");
      tile.textContent = "M";
      const label = document.createElement("span");
      label.className = "missing-asset-name";
      label.textContent = result.pair.text;
      placeholder.append(tile, label);
      elements.missingAssets.append(placeholder);
    }
    const issues = [];
    if (missingImages.length) {
      issues.push(`Missing or unreadable image${missingImages.length === 1 ? "" : "s"}: ${missingImages.join(", ")}.`);
    }
    if (invalidEntries.length) {
      issues.push(`Invalid or duplicate configuration at ${invalidEntries.join(", ")}.`);
    }
    if (state.minimumPairs > MAX_PAIRS_PER_GAME) {
      issues.push(`The board supports at most ${MAX_PAIRS_PER_GAME} pairs; set minimumPairs to ${MAX_PAIRS_PER_GAME} or fewer.`);
    } else if (state.availablePairs.length < state.minimumPairs) {
      issues.push(`Add at least ${state.minimumPairs} valid image pairs to begin (${state.availablePairs.length} currently available).`);
    }
    setSetupMessage(issues.join(" "));
    elements.startButton.disabled = state.minimumPairs > MAX_PAIRS_PER_GAME
      || state.availablePairs.length < state.minimumPairs;
  } catch (error) {
    setSetupMessage(`${error.message} Check data/memory-items.json and reload the page.`);
    elements.startButton.disabled = true;
  }
}

function updateProgress() {
  elements.progress.textContent = `Matched: ${state.matchedPairs} / ${state.pairs.length} pairs`;
  elements.moves.textContent = `Moves: ${state.moves}`;
}

function createCard(pair, copy) {
  return {
    id: `${pair.id}-${copy}`,
    pairId: pair.id,
    image: pair.image,
    text: pair.text,
    type: copy === 0 ? "text" : "image",
    revealed: false,
    matched: false,
  };
}

function renderBoard() {
  elements.board.replaceChildren();
  state.cards.forEach((card, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "memory-card";
    button.dataset.cardId = card.id;
    button.setAttribute("aria-label", `Card ${index + 1}, face down`);

    const inner = document.createElement("span");
    inner.className = "card-inner";
    inner.setAttribute("aria-hidden", "true");

    const back = document.createElement("span");
    back.className = "card-face card-back";
    const emblem = document.createElement("span");
    emblem.className = "card-emblem";
    emblem.textContent = "?";
    back.append(emblem);

    const front = document.createElement("span");
    front.className = "card-face card-front";
    if (card.type === "image") {
      const image = document.createElement("img");
      image.src = card.image;
      image.alt = "";
      image.draggable = false;
      front.append(image);
    } else {
      const text = document.createElement("span");
      text.className = "card-text";
      text.textContent = card.text;
      front.append(text);
    }
    inner.append(back, front);
    button.append(inner);
    button.addEventListener("click", () => selectCard(card.id));
    elements.board.append(button);
  });
  fitCardText();
}

function fitCardText() {
  window.requestAnimationFrame(() => {
    elements.board.querySelectorAll(".card-text").forEach((text) => {
      text.style.fontSize = "";
      let fontSize = Number.parseFloat(window.getComputedStyle(text).fontSize);
      while (text.scrollHeight > text.clientHeight && fontSize > 8) {
        fontSize = Math.max(8, fontSize - 0.5);
        text.style.fontSize = `${fontSize}px`;
      }
    });
  });
}

function updateCardElement(card) {
  const button = elements.board.querySelector(`[data-card-id="${CSS.escape(card.id)}"]`);
  if (!button) return;
  button.classList.toggle("is-revealed", card.revealed);
  button.classList.toggle("is-matched", card.matched);
  const faceUp = card.revealed || card.matched;
  button.setAttribute("aria-label", faceUp
    ? `${card.type === "text" ? "Text" : "Picture"}: ${card.text}${card.matched ? ", matched" : ", revealed"}`
    : "Card, face down");
  button.setAttribute("aria-disabled", card.matched || state.isChecking ? "true" : "false");
}

function setBoardAvailability() {
  state.cards.forEach(updateCardElement);
}

function startGame() {
  if (state.minimumPairs > MAX_PAIRS_PER_GAME
    || state.availablePairs.length < state.minimumPairs) return;
  window.clearTimeout(state.mismatchTimer);
  window.clearTimeout(state.completionTimer);
  state.pairs = shuffle(state.availablePairs).slice(0, MAX_PAIRS_PER_GAME);
  state.cards = shuffle(state.pairs.flatMap((pair) => [createCard(pair, 0), createCard(pair, 1)]));
  state.selected = [];
  state.matchedPairs = 0;
  state.moves = 0;
  state.isChecking = false;
  state.gameStarted = true;
  state.gameCompleted = false;
  elements.announcement.textContent = "";
  updateProgress();
  renderBoard();
  elements.intro.hidden = true;
  elements.celebration.hidden = true;
  elements.game.hidden = false;
  elements.board.querySelector("button")?.focus();
}

function returnToIntro() {
  window.clearTimeout(state.mismatchTimer);
  window.clearTimeout(state.completionTimer);
  state.cards = [];
  state.selected = [];
  state.matchedPairs = 0;
  state.moves = 0;
  state.isChecking = false;
  state.gameStarted = false;
  state.gameCompleted = false;
  state.pairs = [];
  elements.board.replaceChildren();
  elements.confetti.replaceChildren();
  elements.announcement.textContent = "";
  elements.game.hidden = true;
  elements.celebration.hidden = true;
  elements.intro.hidden = false;
  elements.startButton.focus();
}

function selectCard(cardId) {
  if (!state.gameStarted || state.gameCompleted || state.isChecking) return;
  const card = state.cards.find((item) => item.id === cardId);
  if (!card || card.matched || card.revealed || state.selected.includes(card)) return;

  card.revealed = true;
  state.selected.push(card);
  updateCardElement(card);

  if (state.selected.length < 2) return;
  state.moves += 1;
  updateProgress();
  state.isChecking = true;
  setBoardAvailability();

  const [first, second] = state.selected;
  if (first.pairId === second.pairId) {
    first.matched = true;
    second.matched = true;
    state.matchedPairs += 1;
    state.selected = [];
    state.isChecking = false;
    updateProgress();
    setBoardAvailability();
    elements.announcement.textContent = `Match found. ${state.matchedPairs} of ${state.pairs.length} pairs matched.`;
    if (state.matchedPairs === state.pairs.length && state.gameStarted && !state.gameCompleted) {
      state.gameCompleted = true;
      state.completionTimer = window.setTimeout(showCelebration, 850);
    }
    return;
  }

  elements.announcement.textContent = "Not a match. The cards will turn down shortly.";
  state.mismatchTimer = window.setTimeout(() => {
    first.revealed = false;
    second.revealed = false;
    state.selected = [];
    state.isChecking = false;
    updateCardElement(first);
    updateCardElement(second);
    setBoardAvailability();
  }, 950);
}

function showCelebration() {
  if (!state.gameCompleted || !state.gameStarted || state.matchedPairs !== state.pairs.length) return;
  elements.game.hidden = true;
  elements.celebration.hidden = false;
  elements.playAgainButton.focus();
  elements.announcement.textContent = "Game complete. Happy Birthday!";
  addConfetti();
}

function addConfetti() {
  elements.confetti.replaceChildren();
  const colors = ["#b89b5e", "#d8cebc", "#17352a", "#e4d7b8"];
  for (let index = 0; index < 34; index += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.setProperty("--piece-color", colors[index % colors.length]);
    piece.style.setProperty("--fall-delay", `${Math.random() * 1.4}s`);
    piece.style.setProperty("--fall-duration", `${2.8 + Math.random() * 2}s`);
    piece.style.setProperty("--piece-rotation", `${Math.random() * 180}deg`);
    piece.style.setProperty("--drift", `${Math.random() * 100 - 50}px`);
    elements.confetti.append(piece);
  }
}

elements.startButton.addEventListener("click", startGame);
elements.playAgainButton.addEventListener("click", returnToIntro);
window.addEventListener("resize", fitCardText);
loadGameData();
