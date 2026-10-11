let locations = {};
const mapLongitudeOffset = 14;
const mapViewBoxHeight = 1537.631;
const mapNorthEdge = 61.99;
const mapGeographicHeight = 1395.57;
const params = new URLSearchParams(window.location.search);
const places = params.get("places");
const mapFrame = document.getElementById("map-frame");
const mapArt = document.getElementById("map-art");
const pinsElement = document.getElementById("pins");
const emptyState = document.getElementById("empty-state");
const eventCard = document.getElementById("event-card");
const cityElement = document.getElementById("event-city");
const dateElement = document.getElementById("event-date");
const placeCount = document.getElementById("place-count");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function parsePlaces(value) {
  if (!value) return [];

  return value.split(";").flatMap((part) => {
    const separator = part.lastIndexOf("|");
    if (separator < 1) return [];

    const city = part.slice(0, separator).trim();
    const date = part.slice(separator + 1).trim();
    if (!city || !/^\d{4}-(0[1-9]|1[0-2])$/.test(date)) return [];
    if (!Object.hasOwn(locations, city)) {
      console.warn(`Unknown location: ${city}`);
      return [];
    }

    return [{ city, date }];
  });
}

function formatMonth(date) {
  const monthDate = new Date(`${date}-01T12:00:00Z`);
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(monthDate);
}

let events = [];
const pinButtons = [];

function projectLongitude(longitude, width) {
  return ((longitude + 180 - mapLongitudeOffset) / 360) * width;
}

function projectLatitude(latitude, height) {
  const y = mapNorthEdge + ((90 - latitude) / 180) * mapGeographicHeight;
  return (y / mapViewBoxHeight) * height;
}

function renderPins() {
  events.forEach((event, index) => {
    const { lat, lng } = locations[event.city];
    const pin = document.createElement("button");
    pin.type = "button";
    pin.className = "map-pin";
    pin.style.left = `${projectLongitude(lng, 100)}%`;
    pin.style.top = `${(projectLatitude(lat, 100) / 100) * 100}%`;
    pin.setAttribute("aria-label", `${event.city}, ${formatMonth(event.date)}`);
    pin.setAttribute("aria-pressed", "false");
    pinsElement.appendChild(pin);
    pinButtons.push(pin);
  });
}

mapFrame.addEventListener("click", (event) => {
  if (suppressNextPinClick) {
    suppressNextPinClick = false;
    return;
  }

  const clickedPin = event.target.closest(".map-pin");
  let selectedIndex = clickedPin ? pinButtons.indexOf(clickedPin) : -1;

  if (selectedIndex < 0) {
    let nearestDistance = 24 ** 2;
    pinButtons.forEach((pin, index) => {
      const bounds = pin.getBoundingClientRect();
      const distance = (bounds.x + bounds.width / 2 - event.clientX) ** 2
        + (bounds.y + bounds.height / 2 - event.clientY) ** 2;
      if (distance <= nearestDistance) {
        nearestDistance = distance;
        selectedIndex = index;
      }
    });
  }

  if (selectedIndex < 0) return;
  cancelAnimation();
  showEvent(selectedIndex, false);
});

let activeController;
let activeIndex = -1;
let scale = 1;
let translateX = 0;
let translateY = 0;
let dragStart = null;
let pinchStart = null;
const activePointers = new Map();
let dragged = false;
let suppressNextPinClick = false;

function setMapTransform(duration = 650) {
  mapArt.style.transitionDuration = `${duration}ms`;
  mapArt.style.transform = `translate(calc(-50% + ${translateX}px), calc(-50% + ${translateY}px)) scale(${scale})`;
}

function focusEvent(index, duration = 2600) {
  const { lat, lng } = locations[events[index].city];
  const width = mapArt.offsetWidth;
  const height = mapArt.offsetHeight;
  const pointX = projectLongitude(lng, width);
  const pointY = projectLatitude(lat, height);
  scale = 2;
  translateX = (width / 2 - pointX) * scale;
  translateY = (height / 2 - pointY) * scale;
  setMapTransform(duration);
}

function resetMap(duration = 1000) {
  scale = 1;
  translateX = 0;
  translateY = 0;
  setMapTransform(duration);
}

function showEvent(index, pulse) {
  activeIndex = index;
  const event = events[index];
  pinButtons.forEach((pin, pinIndex) => {
    const active = pinIndex === index;
    pin.classList.toggle("is-active", active);
    pin.classList.toggle("is-pulsing", active && pulse);
    pin.setAttribute("aria-pressed", String(active));
  });
  cityElement.textContent = event.city;
  dateElement.textContent = formatMonth(event.date);
  eventCard.hidden = false;
}

function hideEvent() {
  eventCard.hidden = true;
  activeIndex = -1;
  pinButtons.forEach((pin) => {
    pin.classList.remove("is-active", "is-pulsing");
    pin.setAttribute("aria-pressed", "false");
  });
}

function cancelAnimation() {
  if (!activeController) return;
  activeController.abort();
  activeController = undefined;
  mapArt.style.transitionDuration = "0ms";
}

function wait(milliseconds, signal) {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve(false);
    const timeout = window.setTimeout(() => resolve(true), milliseconds);
    signal.addEventListener("abort", () => {
      window.clearTimeout(timeout);
      resolve(false);
    }, { once: true });
  });
}

async function playIntro() {
  if (events.length === 0 || reducedMotion.matches) return;
  const controller = new AbortController();
  activeController = controller;
  const { signal } = controller;

  if (!await wait(900, signal)) return;
  for (let index = 0; index < events.length; index += 1) {
    if (signal.aborted) return;
    showEvent(index, true);
    focusEvent(index);
    if (!await wait(1850, signal)) return;
    eventCard.hidden = true;
  }
  if (!await wait(350, signal)) return;
  resetMap(2800);
  if (!await wait(2900, signal)) return;
  hideEvent();
  activeController = undefined;
}

function userTakesControl() {
  if (!activeController) return;
  cancelAnimation();
  mapArt.style.transitionDuration = "650ms";
}

function zoomBy(amount) {
  userTakesControl();
  const nextScale = Math.min(4, Math.max(1, scale + amount));
  if (nextScale === scale) return;
  scale = nextScale;
  setMapTransform(450);
}

document.getElementById("zoom-in").addEventListener("click", () => zoomBy(0.25));
document.getElementById("zoom-out").addEventListener("click", () => zoomBy(-0.25));
document.getElementById("reset-map").addEventListener("click", () => {
  userTakesControl();
  hideEvent();
  resetMap();
});
document.getElementById("close-card").addEventListener("click", () => {
  userTakesControl();
  hideEvent();
});

mapFrame.addEventListener("pointerdown", (event) => {
  if (event.target.closest("button")) return;
  userTakesControl();
  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  mapFrame.setPointerCapture(event.pointerId);

  if (activePointers.size === 1) {
    dragStart = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, translateX, translateY };
    dragged = false;
    return;
  }

  if (activePointers.size === 2) {
    const [first, second] = [...activePointers.values()];
    const frameBounds = mapFrame.getBoundingClientRect();
    const midpointX = (first.x + second.x) / 2;
    const midpointY = (first.y + second.y) / 2;
    pinchStart = {
      distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
      scale,
      worldX: (midpointX - frameBounds.left - frameBounds.width / 2 - translateX) / scale,
      worldY: (midpointY - frameBounds.top - frameBounds.height / 2 - translateY) / scale,
    };
    dragStart = null;
    dragged = true;
  }
});

mapFrame.addEventListener("pointermove", (event) => {
  if (!activePointers.has(event.pointerId)) return;
  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

  if (pinchStart && activePointers.size >= 2) {
    const [first, second] = [...activePointers.values()];
    const frameBounds = mapFrame.getBoundingClientRect();
    const midpointX = (first.x + second.x) / 2;
    const midpointY = (first.y + second.y) / 2;
    scale = Math.min(4, Math.max(1, pinchStart.scale * Math.hypot(second.x - first.x, second.y - first.y) / pinchStart.distance));
    translateX = midpointX - frameBounds.left - frameBounds.width / 2 - pinchStart.worldX * scale;
    translateY = midpointY - frameBounds.top - frameBounds.height / 2 - pinchStart.worldY * scale;
    setMapTransform(0);
    return;
  }

  if (!dragStart || event.pointerId !== dragStart.pointerId) return;
  const deltaX = event.clientX - dragStart.x;
  const deltaY = event.clientY - dragStart.y;
  if (Math.abs(deltaX) + Math.abs(deltaY) > 4) dragged = true;
  translateX = dragStart.translateX + deltaX;
  translateY = dragStart.translateY + deltaY;
  mapFrame.classList.toggle("is-dragging", dragged);
  setMapTransform(0);
});

function endPointer(event) {
  activePointers.delete(event.pointerId);

  if (activePointers.size === 1 && pinchStart) {
    const [pointerId, point] = [...activePointers.entries()][0];
    dragStart = { pointerId, x: point.x, y: point.y, translateX, translateY };
    pinchStart = null;
  } else if (activePointers.size === 0) {
    pinchStart = null;
    dragStart = null;
  }

  if (dragged) {
    suppressNextPinClick = true;
    window.setTimeout(() => {
      suppressNextPinClick = false;
    }, 0);
  }
  if (activePointers.size === 0) dragged = false;
  mapFrame.classList.remove("is-dragging");
}

mapFrame.addEventListener("pointerup", endPointer);
mapFrame.addEventListener("pointercancel", endPointer);

reducedMotion.addEventListener?.("change", (event) => {
  if (event.matches) cancelAnimation();
});

async function initializeJourney() {
  const response = await fetch("./locations.json");
  if (!response.ok) throw new Error(`Could not load locations: ${response.status}`);

  locations = await response.json();
  events = parsePlaces(places);
  renderPins();
  emptyState.hidden = events.length > 0;
  placeCount.textContent = `${events.length} ${events.length === 1 ? "place" : "places"}`;
  window.setTimeout(playIntro, 120);
}

initializeJourney().catch((error) => {
  console.error(error);
  emptyState.textContent = "Map data could not be loaded.";
  emptyState.hidden = false;
  placeCount.textContent = "";
});