#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const configPath = path.join(root, "data", "memory-items.json");
const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

function isInsideRoot(filePath) {
  const relative = path.relative(root, filePath);
  return relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}

function hasSupportedImageSignature(filePath) {
  const bytes = fs.readFileSync(filePath);
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return true;
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true;
  if (bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6))) return true;
  return bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
}

function findImageFiles(directory, topLevelOnly = false) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isFile() && imageExtensions.has(path.extname(entry.name).toLowerCase())) return [fullPath];
    if (!topLevelOnly && entry.isDirectory()) return findImageFiles(fullPath);
    return [];
  });
}

const errors = [];
const warnings = [];
if (!fs.existsSync(configPath)) {
  console.error("Memory asset validation failed: data/memory-items.json was not found.");
  process.exit(1);
}

let config;
try {
  config = JSON.parse(fs.readFileSync(configPath, "utf8"));
} catch (error) {
  console.error(`Memory asset validation failed: ${error.message}`);
  process.exit(1);
}

if (!config || !Array.isArray(config.pairs)) {
  console.error("Memory asset validation failed: configuration must contain a pairs array.");
  process.exit(1);
}

const minimumPairs = Number.isInteger(config.minimumPairs) && config.minimumPairs > 0
  ? config.minimumPairs
  : 2;
const ids = new Set();
const validPairs = [];
const referencedImages = new Set();

config.pairs.forEach((pair, index) => {
  const entry = `pair ${index + 1}`;
  if (!pair || typeof pair.id !== "string" || !pair.id.trim()) {
    errors.push(`${entry}: missing or invalid id.`);
    return;
  }
  const id = pair.id.trim();
  if (ids.has(id)) {
    errors.push(`${entry} (${id}): duplicate pair id.`);
    return;
  }
  ids.add(id);

  if (typeof pair.text !== "string" || !pair.text.trim()) {
    errors.push(`${entry} (${id}): missing text to match with the image.`);
  }
  if (typeof pair.image !== "string" || !pair.image.trim()) {
    errors.push(`${entry} (${id}): missing image path.`);
    return;
  }

  const imagePath = path.resolve(root, pair.image);
  if (!isInsideRoot(imagePath)) {
    errors.push(`${entry} (${id}): image path must resolve inside the project.`);
    return;
  }
  referencedImages.add(imagePath);
  if (!fs.existsSync(imagePath) || !fs.statSync(imagePath).isFile()) {
    errors.push(`${entry} (${id}): image not found: ${pair.image}`);
    return;
  }
  if (!hasSupportedImageSignature(imagePath)) {
    errors.push(`${entry} (${id}): file is not a readable PNG, JPEG, GIF, or WebP image: ${pair.image}`);
    return;
  }
  if (typeof pair.text === "string" && pair.text.trim()) validPairs.push(pair);
});

if (validPairs.length < minimumPairs) {
  errors.push(`Only ${validPairs.length} valid pair(s); at least ${minimumPairs} required to start the game.`);
}

const imageFiles = [
  ...findImageFiles(root, true),
  ...findImageFiles(path.join(root, "assets", "images")),
  ...findImageFiles(path.join(root, "data")),
];
const unreferenced = imageFiles.filter((filePath) => !referencedImages.has(path.resolve(filePath)));

console.log("Memory asset validation");
console.log(`Configured pairs: ${config.pairs.length}`);
console.log(`Valid playable pairs: ${validPairs.length}`);
console.log(`Minimum required: ${minimumPairs}`);
if (errors.length) {
  console.error("\nIssues:");
  errors.forEach((error) => console.error(`  - ${error}`));
}
if (unreferenced.length) {
  warnings.push(`Unreferenced image files: ${unreferenced.map((filePath) => path.relative(root, filePath)).join(", ")}`);
}
if (warnings.length) {
  console.warn("\nWarnings:");
  warnings.forEach((warning) => console.warn(`  - ${warning}`));
}
if (!errors.length) {
  console.log("All configured image assets are present and valid.");
}

process.exitCode = errors.length ? 1 : 0;
