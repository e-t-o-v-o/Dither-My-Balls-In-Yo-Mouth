import { charPalettes, paletteSets, asciiVariants, fonts } from "../constants";
export { asciiVariants, fonts };
export const palettes = {
  Paper: ["#101215", "#f1f2e9"],
  Phosphor: ["#071912", "#315c36", "#8ca942", "#dbf69b"],
  Amber: ["#181108", "#744c1b", "#cd933e", "#ffe0a0"],
  Electric: ["#11101a", "#523cff", "#eaa3ff", "#f6f1ff"],
  ...charPalettes,
  ...paletteSets,
};
export const effects = [
  ["dither", "Dither", "01", "Six ordered and error-diffusion patterns."],
  ["ascii", "ASCII", "02", "Brightness mapped to a custom character ramp."],
  [
    "dither-ascii",
    "Dither + ASCII",
    "03",
    "Quantized brightness with typographic texture.",
  ],
  [
    "palette",
    "Palette",
    "04",
    "Nearest-color reduction with optional cell labels.",
  ],
  [
    "two-tone",
    "Threshold",
    "05",
    "A clean two-color cutoff with optional glyphs.",
  ],
  [
    "halftone",
    "Halftone",
    "06",
    "Area-correct dots that reproduce the source tone.",
  ],
  [
    "crosshatch",
    "Crosshatch",
    "07",
    "Layered ink strokes for light, midtone, and shadow.",
  ],
  ["edge", "Edges", "08", "Sobel contours with adjustable sensitivity."],
  [
    "channel",
    "Channel study",
    "09",
    "Red, green, and blue as three grayscale panels.",
  ],
  [
    "pixel",
    "Pixelate",
    "10",
    "Source-color mosaic, also useful for chroma keying.",
  ],
];
export const methods = [
  ["ordered", "Bayer ordered"],
  ["floyd", "Floyd–Steinberg"],
  ["atkinson", "Atkinson"],
  ["jarvis", "Jarvis–Judice–Ninke"],
  ["burkes", "Burkes"],
  ["sierra", "Sierra"],
];
export const defaults = {
  effect: "dither",
  method: "ordered",
  palette: "Paper",
  cellSize: 8,
  threshold: 128,
  brightness: 0,
  contrast: 1,
  saturation: 1,
  invert: false,
  amount: 1,
  fgColor: "#f1f2e9",
  bgColor: "#101215",
  transparent: false,
  removeGreen: false,
  greenTolerance: 1.25,
  font: "monospace",
  fontScale: 1,
  characters: " .:-=+*#%@",
  dynamic: false,
  textColor: "palette",
  underlay: false,
  overlay: "none",
  char: "×",
  letterCount: 10,
  smooth: 1,
  dotScale: 1,
  lineWidth: 0.12,
};
const numeric = {
  cellSize: [2, 80],
  threshold: [0, 255],
  brightness: [-100, 100],
  contrast: [0.2, 3],
  saturation: [0, 2],
  amount: [0, 2],
  greenTolerance: [1.05, 2],
  fontScale: [0.4, 2],
  letterCount: [2, 26],
  smooth: [0.05, 1],
  dotScale: [0.25, 1],
  lineWidth: [0.04, 0.3],
};
export function sanitizeConfig(input = {}) {
  const c = { ...defaults };
  if (!input || typeof input !== "object" || Array.isArray(input)) return c;
  for (const [k, v] of Object.entries(input)) {
    if (!(k in c)) continue;
    if (numeric[k]) {
      const n = Number(v);
      if (Number.isFinite(n))
        c[k] = Math.min(numeric[k][1], Math.max(numeric[k][0], n));
    } else if (typeof c[k] === "boolean" && typeof v === "boolean") c[k] = v;
    else if (typeof c[k] === "string" && typeof v === "string")
      c[k] = v.slice(0, 128);
  }
  // Consolidate old effect IDs without losing saved looks.
  const legacy = {
    decade: { effect: "palette", overlay: "number" },
    binary: { effect: "two-tone", overlay: "binary" },
    "binary-char": { effect: "two-tone", overlay: "luma" },
    "letter-char": { effect: "two-tone", overlay: "character" },
    "letters-palette": {
      effect: "ascii",
      characters: "ABCDEFGHIJKLMNOPQRSTUVWXYZ".slice(
        0,
        Math.round(c.letterCount),
      ),
    },
    "green-screen": { effect: "pixel", removeGreen: true },
  };
  if (Object.hasOwn(legacy, c.effect)) Object.assign(c, legacy[c.effect]);
  if (!effects.some(([id]) => id === c.effect)) c.effect = defaults.effect;
  if (!methods.some(([id]) => id === c.method)) c.method = defaults.method;
  if (!Object.hasOwn(palettes, c.palette)) c.palette = defaults.palette;
  for (const k of ["fgColor", "bgColor"])
    if (!/^#[\da-f]{6}$/i.test(c[k])) c[k] = defaults[k];
  if (!["palette", "source", "foreground"].includes(c.textColor))
    c.textColor = "palette";
  if (!["none", "number", "character", "binary", "luma"].includes(c.overlay))
    c.overlay = "none";
  c.char = Array.from(c.char || "×")[0];
  c.characters = c.characters || defaults.characters;
  c.font = c.font.replace(/[^\w\s-]/g, "") || "monospace";
  return c;
}
export function migrateConfig(c) {
  if (!c || typeof c !== "object") return sanitizeConfig();
  return sanitizeConfig({
    ...c,
    method: c.method || c.ditherMethod,
    palette: c.palette || c.ditherPalette || c.paletteName,
    cellSize: c.cellSize || c.pixelSize,
    transparent: c.transparent ?? c.transparentBg,
    smooth: c.smooth ?? c.smoothFactor,
    dynamic: c.dynamic ?? c.asciiMapping === "dynamic",
    underlay: c.underlay ?? c.asciiUnderlay,
    characters:
      c.characters ||
      asciiVariants[c.asciiVariant]?.join("") ||
      defaults.characters,
  });
}
export function readStorage(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
}
export function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export function parsePresets(value) {
  if (value?.version === 2) value = value.presets;
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Choose a presets JSON file exported from Dither.");
  const result = Object.create(null);
  Object.entries(value)
    .slice(0, 50)
    .forEach(([name, c]) => {
      if (
        c &&
        typeof c === "object" &&
        !Array.isArray(c) &&
        typeof c.effect === "string"
      )
        result[name.slice(0, 60)] = migrateConfig(c);
    });
  if (!Object.keys(result).length)
    throw new Error("No valid effect presets were found in that file.");
  return result;
}
export const looks = [
  {
    name: "Printed matter",
    note: "Bayer / monochrome",
    config: { ...defaults },
  },
  {
    name: "Phosphor",
    note: "Atkinson / four colors",
    config: {
      ...defaults,
      method: "atkinson",
      palette: "Phosphor",
      cellSize: 6,
    },
  },
  {
    name: "After hours",
    note: "Diffusion / electric",
    config: { ...defaults, method: "floyd", palette: "Electric", cellSize: 7 },
  },
  {
    name: "Terminal",
    note: "ASCII / amber",
    config: { ...defaults, effect: "ascii", palette: "Amber", cellSize: 14 },
  },
  {
    name: "Index study",
    note: "Palette / numbered",
    config: {
      ...defaults,
      effect: "palette",
      palette: "Graphic Ticket Neon",
      cellSize: 32,
      overlay: "number",
      fontScale: 0.7,
    },
  },
  {
    name: "Outline",
    note: "Edges / paper",
    config: { ...defaults, effect: "edge", threshold: 35, cellSize: 5 },
  },
];
export function dimensions(sw, sh, resolution = "1080", even = false) {
  if (!(sw > 0 && sh > 0))
    throw new Error("This media has no readable dimensions.");
  const long =
    resolution === "native"
      ? Math.min(Math.max(sw, sh), 4096)
      : Number(resolution);
  const scale = long / Math.max(sw, sh);
  const round = (n) =>
    even ? Math.max(2, Math.round(n / 2) * 2) : Math.max(1, Math.round(n));
  return { width: round(sw * scale), height: round(sh * scale) };
}
export function timeLabel(t) {
  if (!Number.isFinite(t)) return "00:00.0";
  const s = Math.max(0, t);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${(s % 60).toFixed(1).padStart(4, "0")}`;
}
export function filename(name, ext) {
  return `${(name || "test-signal")
    .replace(/\.[^.]+$/, "")
    .replace(/[^\w\s.-]/g, "_")
    .slice(0, 80)}-dither.${ext}`;
}
