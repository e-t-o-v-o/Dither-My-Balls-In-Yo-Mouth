import { charPalettes, paletteSets, asciiVariants, fonts } from "../constants";
export { asciiVariants, fonts };
export const palettes = {
  Paper: ["#101215", "#f1f2e9"],
  Phosphor: ["#071912", "#315c36", "#8ca942", "#dbf69b"],
  Amber: ["#181108", "#744c1b", "#cd933e", "#ffe0a0"],
  Electric: ["#11101a", "#523cff", "#eaa3ff", "#f6f1ff"],
  "Signal pop": [
    "#152939",
    "#155fd5",
    "#f34980",
    "#fe893b",
    "#d8e940",
    "#fff4d5",
  ],
  "Cobalt vermilion": ["#103eac", "#60b5de", "#f44913", "#f7f6ed"],
  "Acid ink": ["#20251b", "#5f704a", "#a4b76e", "#f4ff64"],
  ...charPalettes,
  ...paletteSets,
};
export const effects = [
  [
    "beads",
    "Contour beads",
    "11",
    "Evenly spaced beads trace continuous tonal contours.",
  ],
  [
    "mosaic",
    "Dot mosaic",
    "12",
    "Staggered color dots with open space between cells.",
  ],
  [
    "symbols",
    "Symbol field",
    "13",
    "Geometric marks build tone with stable, selective accents.",
  ],
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
  shapeColor: "source",
  accentColor: "#ff6a00",
  accentAmount: 0.2,
  mosaicLayout: "staggered",
  symbolSet: "mixed",
  contourSource: "luminance",
  beadSpacing: 1.1,
  beadSize: 0.8,
  beadRing: 0.22,
  contourFill: false,
  fillColor: "#f7f6ed",
  maskMode: "none",
  maskLow: 80,
  maskHigh: 255,
  maskColor: "#ffffff",
  maskTolerance: 0.22,
  maskSoftness: 0.05,
  maskInvert: false,
  maskBackdrop: false,
  underlayMode: "source",
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
  accentAmount: [0, 1],
  beadSpacing: [0.65, 2.5],
  beadSize: [0.25, 1.5],
  beadRing: [0, 0.6],
  maskLow: [0, 255],
  maskHigh: [0, 255],
  maskTolerance: [0.01, 1],
  maskSoftness: [0, 0.3],
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
  if (c.effect === "beads") c.cellSize = Math.max(6, c.cellSize);
  if (!methods.some(([id]) => id === c.method)) c.method = defaults.method;
  if (!Object.hasOwn(palettes, c.palette)) c.palette = defaults.palette;
  for (const k of [
    "fgColor",
    "bgColor",
    "accentColor",
    "fillColor",
    "maskColor",
  ])
    if (!/^#[\da-f]{6}$/i.test(c[k])) c[k] = defaults[k];
  if (!["palette", "source", "foreground", "contrast"].includes(c.textColor))
    c.textColor = "palette";
  if (!["none", "number", "character", "binary", "luma"].includes(c.overlay))
    c.overlay = "none";
  c.char = Array.from(c.char || "×")[0];
  c.characters = c.characters || defaults.characters;
  c.font = c.font.replace(/[^\w\s-]/g, "") || "monospace";
  for (const [key, values] of Object.entries({
    shapeColor: ["source", "palette", "ink"],
    mosaicLayout: ["staggered", "square"],
    symbolSet: ["mixed", "orbital", "directional"],
    contourSource: ["luminance", "alpha"],
    maskMode: ["none", "luminance", "color"],
    underlayMode: ["source", "palette"],
  }))
    if (!values.includes(c[key])) c[key] = defaults[key];
  if (c.maskLow > c.maskHigh) [c.maskLow, c.maskHigh] = [c.maskHigh, c.maskLow];
  return c;
}
export function usesPalette(c) {
  return (
    ["dither", "dither-ascii", "palette"].includes(c.effect) ||
    (c.effect === "ascii" &&
      (c.textColor === "palette" ||
        (c.underlay && c.underlayMode === "palette"))) ||
    (["mosaic", "symbols"].includes(c.effect) && c.shapeColor === "palette")
  );
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
    name: "Cobalt beads",
    note: "Contours / ceramic blue",
    config: {
      ...defaults,
      effect: "beads",
      cellSize: 20,
      threshold: 118,
      fgColor: "#103eac",
      bgColor: "#f44913",
      accentColor: "#60b5de",
      beadSize: 1.1,
      beadSpacing: 1.2,
      contourFill: true,
    },
  },
  {
    name: "Acid dots",
    note: "Color dots / bright ground",
    config: {
      ...defaults,
      effect: "mosaic",
      cellSize: 22,
      bgColor: "#f4ff64",
      dotScale: 0.92,
      maskMode: "luminance",
      maskLow: 0,
      maskHigh: 205,
      maskSoftness: 0.03,
    },
  },
  {
    name: "Wayfinding",
    note: "Symbols / selective orange",
    config: {
      ...defaults,
      effect: "symbols",
      cellSize: 24,
      shapeColor: "ink",
      fgColor: "#20211f",
      bgColor: "#eeeee9",
      accentColor: "#ff6900",
      accentAmount: 0.18,
    },
  },
  {
    name: "Letterpress",
    note: "Flat color / contrasting type",
    config: {
      ...defaults,
      effect: "ascii",
      cellSize: 18,
      palette: "Signal pop",
      underlay: true,
      underlayMode: "palette",
      textColor: "contrast",
      characters: " .LITXVWMA",
      fontScale: 0.85,
      bgColor: "#fff4d5",
    },
  },
  {
    name: "Mint cutout",
    note: "Tonal mask / original photo",
    config: {
      ...defaults,
      effect: "two-tone",
      threshold: 0,
      fgColor: "#c0ffa3",
      bgColor: "#c0ffa3",
      cellSize: 4,
      maskMode: "luminance",
      maskLow: 135,
      maskHigh: 255,
      maskSoftness: 0.03,
      maskBackdrop: true,
    },
  },
  {
    name: "Orbital",
    note: "Rings / electric palette",
    config: {
      ...defaults,
      effect: "symbols",
      symbolSet: "orbital",
      shapeColor: "palette",
      palette: "Electric",
      cellSize: 24,
      bgColor: "#090911",
    },
  },
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
