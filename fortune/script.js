document.addEventListener("DOMContentLoaded", async () => {
  const STORAGE_KEY = "luxury-fortune-history-v2";
  const cookieButton = document.getElementById("fortuneCookie");
  const cookiePanel = document.getElementById("cookiePanel");
  const fortuneCard = document.getElementById("fortuneCard");
  const fortuneText = document.getElementById("fortuneText");
  const anotherFortuneButton = document.getElementById("anotherFortune");
  const confettiLayer = document.getElementById("confettiLayer");

  if (!cookieButton || !cookiePanel || !fortuneCard || !fortuneText || !anotherFortuneButton || !confettiLayer) {
    console.error("Required fortune-cookie elements are missing.");
    return;
  }

  cookieButton.disabled = true;
  let fortunes;
  try {
    const response = await fetch("fortunes.json");
    if (!response.ok) {
      throw new Error(`Unable to load fortunes: ${response.status} ${response.statusText}`);
    }

    fortunes = await response.json();
    if (
      !Array.isArray(fortunes) ||
      fortunes.length === 0 ||
      fortunes.some((fortune) => typeof fortune !== "string" || !fortune.trim())
    ) {
      throw new Error("Fortunes must be a non-empty array of non-empty strings.");
    }
  } catch (error) {
    console.error("Unable to initialize fortune messages.", error);
    return;
  }

  let usedFortuneIds = loadUsedFortunes();
  let isOpening = false;

  function loadUsedFortunes() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed)
        ? parsed.filter((index) => Number.isInteger(index) && index >= 0 && index < fortunes.length)
        : [];
    } catch (error) {
      console.warn("Unable to read saved fortunes.", error);
      return [];
    }
  }

  function saveUsedFortunes() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(usedFortuneIds));
    } catch (error) {
      console.warn("Unable to save fortunes.", error);
    }
  }

  function getNextFortune() {
    let available = fortunes
      .map((_, index) => index)
      .filter((index) => !usedFortuneIds.includes(index));

    if (available.length === 0) {
      usedFortuneIds = [];
      saveUsedFortunes();
      available = fortunes.map((_, index) => index);
    }

    const chosenIndex = available[Math.floor(Math.random() * available.length)];
    usedFortuneIds.push(chosenIndex);
    saveUsedFortunes();
    return fortunes[chosenIndex];
  }

  function createConfetti() {
    confettiLayer.innerHTML = "";

    const colors = ["#a82424", "#c83227", "#c99b32", "#e3c875", "#fff0cf"];
    const cookieBounds = cookieButton.getBoundingClientRect();
    const originX = cookieBounds.left + cookieBounds.width / 2;
    const originY = cookieBounds.top + cookieBounds.height * 0.48;
    const totalPieces = 46;

    for (let index = 0; index < totalPieces; index += 1) {
      const piece = document.createElement("span");
      piece.className = "confetti-piece";

      const angle = (Math.PI * 2 * index) / totalPieces;
      const radius = 55 + Math.random() * 130;
      const x = Math.cos(angle) * radius + (Math.random() * 50 - 25);
      const y = Math.sin(angle) * radius * 0.45 + 105 + Math.random() * 60;
      const spin = (Math.random() * 900 - 450).toFixed(0);
      const duration = (1.25 + Math.random() * 1.2).toFixed(2);

      piece.style.setProperty("--origin-x", `${originX}px`);
      piece.style.setProperty("--origin-y", `${originY}px`);
      piece.style.setProperty("--x", `${x}px`);
      piece.style.setProperty("--y", `${y}px`);
      piece.style.setProperty("--spin", `${spin}deg`);
      piece.style.setProperty("--duration", `${duration}s`);
      piece.style.setProperty("--size", `${4 + Math.random() * 5}px`);
      piece.style.background = colors[index % colors.length];

      confettiLayer.appendChild(piece);
    }
  }

  function showCookie() {
    cookiePanel.classList.remove("is-hidden");
    cookieButton.classList.remove("hidden");
    cookieButton.disabled = false;
  }

  function hideCookie() {
    cookiePanel.classList.add("is-hidden");
    cookieButton.classList.add("hidden");
    cookieButton.disabled = true;
  }

  function showFortune(message) {
    fortuneText.textContent = message;
    fortuneCard.classList.remove("hidden");
    fortuneCard.classList.add("is-visible");
  }

  function hideFortune() {
    fortuneCard.classList.remove("is-visible");
    fortuneCard.classList.add("hidden");
  }

  function openFortuneCookie() {
    if (isOpening) return;
    isOpening = true;

    // Remove and re-add class to restart animation
    cookieButton.classList.remove("is-opening");
    // Force browser reflow to trigger animation restart
    void cookieButton.offsetWidth;
    cookieButton.classList.add("is-opening");

    createConfetti();
    const fortuneMessage = getNextFortune();

    setTimeout(() => {
      hideCookie();
      showFortune(fortuneMessage);
      anotherFortuneButton.classList.remove("hidden");
      anotherFortuneButton.disabled = false;
    }, 1300);

    setTimeout(() => {
      cookieButton.classList.remove("is-opening");
      isOpening = false;
    }, 1500);
  }

  function resetForNewCycle() {
    anotherFortuneButton.classList.add("hidden");
    anotherFortuneButton.disabled = true;
    hideFortune();
    showCookie();
    isOpening = false;
    cookieButton.classList.remove("is-opening");
  }

  // Main click handler for cookie
  cookieButton.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openFortuneCookie();
  });

  // Click handler for another fortune button
  anotherFortuneButton.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    resetForNewCycle();
  });

  // Initialize on page load
  function initialize() {
    hideFortune();
    anotherFortuneButton.classList.add("hidden");
    anotherFortuneButton.disabled = true;
    showCookie();
    isOpening = false;
    cookieButton.classList.remove("is-opening");

    if (usedFortuneIds.length >= fortunes.length) {
      usedFortuneIds = [];
      saveUsedFortunes();
    }
  }

  initialize();
});
