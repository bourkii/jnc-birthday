const params = new URLSearchParams(window.location.search);
const greetingElement = document.getElementById("greeting");
const countdownElement = document.getElementById("countdown");
const dateStatusElement = document.getElementById("date-status");
const dayElement = document.getElementById("days");
const hourElement = document.getElementById("hours");
const minuteElement = document.getElementById("minutes");
const secondElement = document.getElementById("seconds");

const nameValue = params.get("name");
const birthdateValue = params.get("birthdate");
const themeValue = (params.get("theme") || "midnight").trim().toLowerCase();

const themeMap = {
  midnight: {
    "bg-deep": "#0d0a0d",
    "bg-rose": "#1e1418",
    "bg-warm": "#2f1d1f",
    "panel": "rgba(26, 18, 20, 0.72)",
    "panel-border": "rgba(214, 183, 122, 0.4)",
    "gold": "#d6b77a",
    "gold-soft": "#f1e1b5",
    "rose": "#c98e8d",
    "ivory": "#f2ead9",
    "muted": "rgba(242, 234, 217, 0.76)",
    "shadow": "rgba(0, 0, 0, 0.32)",
    "success": "#d7c28b",
  },
  rose: {
    "bg-deep": "#160d10",
    "bg-rose": "#2b161a",
    "bg-warm": "#4e2f31",
    "panel": "rgba(32, 17, 21, 0.78)",
    "panel-border": "rgba(228, 170, 177, 0.45)",
    "gold": "#d99ea6",
    "gold-soft": "#f5dfe2",
    "rose": "#e9b0ba",
    "ivory": "#fff6f9",
    "muted": "rgba(255, 246, 249, 0.76)",
    "shadow": "rgba(50, 20, 28, 0.32)",
    "success": "#f1c7cf",
  },
  champagne: {
    "bg-deep": "#12110d",
    "bg-rose": "#1e1a17",
    "bg-warm": "#342c24",
    "panel": "rgba(30, 24, 20, 0.74)",
    "panel-border": "rgba(214, 183, 122, 0.46)",
    "gold": "#d7b87e",
    "gold-soft": "#f3e4ba",
    "rose": "#d8af90",
    "ivory": "#f8f3eb",
    "muted": "rgba(248, 243, 235, 0.75)",
    "shadow": "rgba(0, 0, 0, 0.28)",
    "success": "#dfc98c",
  },
  forest: {
    "bg-deep": "#0a120d",
    "bg-rose": "#132018",
    "bg-warm": "#1d2d24",
    "panel": "rgba(14, 22, 18, 0.76)",
    "panel-border": "rgba(160, 200, 170, 0.4)",
    "gold": "#c6d3b2",
    "gold-soft": "#ebf1d4",
    "rose": "#a9c3a1",
    "ivory": "#edf4ec",
    "muted": "rgba(237, 244, 236, 0.76)",
    "shadow": "rgba(0, 0, 0, 0.26)",
    "success": "#b9d4a6",
  },
};

function sanitizeName(rawName) {
  if (!rawName) {
    return "You";
  }

  const trimmed = rawName.trim();
  return trimmed || "You";
}

function setGreeting() {
  const displayName = sanitizeName(nameValue);
  greetingElement.textContent = `Dear ${displayName} ❤️`;
}

function applyTheme(themeName) {
  const safeThemeName = themeName in themeMap ? themeName : "midnight";
  const selectedTheme = themeMap[safeThemeName];
  const root = document.documentElement;

  Object.entries(selectedTheme).forEach(([key, value]) => {
    root.style.setProperty(`--${key}`, value);
  });

  document.body.dataset.theme = safeThemeName;
}

function setStatus(message) {
  if (!message) {
    dateStatusElement.textContent = "";
    return;
  }

  dateStatusElement.textContent = message;
}

function normalizeDateInput(rawValue) {
  if (!rawValue) {
    return "";
  }

  let normalized = rawValue.trim();

  if (/\d{2}:\d{2}(?::\d{2})?\s\d{2}:?\d{2}$/.test(normalized)) {
    normalized = normalized.replace(/\s+(?=\d{2}:?\d{2}$)/, "+");
  }

  return normalized;
}

function parseBirthdate(rawValue) {
  if (!rawValue || !rawValue.trim()) {
    return null;
  }

  const normalizedValue = normalizeDateInput(rawValue);
  const parsedDate = new Date(normalizedValue);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate;
}

function formatCountdownValues(milliseconds) {
  const totalMilliseconds = Math.max(0, milliseconds);
  const totalDays = Math.floor(totalMilliseconds / 86400000);
  const remainingAfterDays = totalMilliseconds % 86400000;
  const hours = Math.floor(remainingAfterDays / 3600000);
  const remainingAfterHours = remainingAfterDays % 3600000;
  const minutes = Math.floor(remainingAfterHours / 60000);
  const remainingAfterMinutes = remainingAfterHours % 60000;
  const seconds = Math.floor(remainingAfterMinutes / 1000);

  return {
    days: totalDays,
    hours,
    minutes,
    seconds,
  };
}

function updateCountdown() {
  const birthdate = parseBirthdate(birthdateValue);

  if (!birthdate) {
    countdownElement.setAttribute("aria-hidden", "true");

    if (!birthdateValue || !birthdateValue.trim()) {
      setStatus("A birthdate is needed to calculate the countdown ❤️");
    } else {
      setStatus("Something went wrong with the date ❤️");
    }

    return;
  }

  const now = Date.now();
  const elapsed = now - birthdate.getTime();

  if (elapsed < 0) {
    countdownElement.setAttribute("aria-hidden", "true");
    setStatus("This date is in the future, so the countdown will start when it arrives ❤️");
    return;
  }

  countdownElement.removeAttribute("aria-hidden");
  setStatus("");

  const values = formatCountdownValues(elapsed);
  dayElement.textContent = String(values.days);
  hourElement.textContent = String(values.hours).padStart(2, "0");
  minuteElement.textContent = String(values.minutes).padStart(2, "0");
  secondElement.textContent = String(values.seconds).padStart(2, "0");
}

function spawnConfetti() {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) {
    return;
  }

  const confettiLayer = document.createElement("div");
  confettiLayer.className = "confetti-layer";
  document.body.appendChild(confettiLayer);

  const colors = ["#d6b77a", "#c98e8d", "#f1e1b5", "#8f7a72", "#d6a9a8", "#e8d7a9"];

  for (let index = 0; index < 30; index += 1) {
    const piece = document.createElement("span");
    const size = 8 + Math.random() * 14;
    const drift = (Math.random() * 180 - 90).toFixed(2);
    const duration = (3.4 + Math.random() * 2.7).toFixed(2);
    const color = colors[Math.floor(Math.random() * colors.length)];

    piece.className = "confetti-piece";
    piece.style.setProperty("--size", `${size}px`);
    piece.style.setProperty("--drift", `${drift}px`);
    piece.style.setProperty("--duration", `${duration}s`);
    piece.style.setProperty("--piece-color", color);
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;

    confettiLayer.appendChild(piece);

    window.setTimeout(() => {
      piece.remove();
    }, 5200);
  }

  window.setTimeout(() => {
    confettiLayer.remove();
  }, 5400);
}

applyTheme(themeValue);
setGreeting();
updateCountdown();
window.setInterval(updateCountdown, 1000);
window.setTimeout(spawnConfetti, 200);
