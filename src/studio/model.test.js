import {
  sanitizeConfig,
  migrateConfig,
  defaults,
  dimensions,
  parsePresets,
  readStorage,
  timeLabel,
  filename,
} from "./model";
test("corrupt and hostile settings recover safely", () => {
  localStorage.setItem("bad", "{broken");
  expect(readStorage("bad", null)).toBeNull();
  const c = sanitizeConfig({
    effect: "missing",
    cellSize: -20,
    brightness: Infinity,
    palette: "missing",
    fgColor: "red",
    font: '<bad>";{}',
    characters: "",
    transparent: "true",
    unknown: 1,
  });
  expect(c.effect).toBe("dither");
  expect(c.cellSize).toBe(2);
  expect(c.brightness).toBe(0);
  expect(c.palette).toBe("Paper");
  expect(c.fgColor).toBe(defaults.fgColor);
  expect(c.font).toBe("bad");
  expect(c.characters.length).toBeGreaterThan(0);
  expect(c.transparent).toBe(false);
  expect(c.unknown).toBeUndefined();
});
test("migrates original saved controls", () => {
  expect(
    migrateConfig({
      effect: "dither",
      ditherMethod: "atkinson",
      ditherPalette: "Pure BW",
      pixelSize: 12,
      transparentBg: true,
      smoothFactor: "0.5",
    }),
  ).toMatchObject({
    method: "atkinson",
    palette: "Pure BW",
    cellSize: 12,
    transparent: true,
    smooth: 0.5,
  });
});
test.each([
  [1920, 1080, "3840", 3840, 2160],
  [1080, 1920, "1920", 1080, 1920],
  [1000, 1000, "1280", 1280, 1280],
  [8000, 4000, "native", 4096, 2048],
])("output preserves aspect ratio %s × %s", (w, h, r, ow, oh) =>
  expect(dimensions(w, h, r)).toEqual({ width: ow, height: oh }),
);
test("video dimensions are positive and even", () => {
  const d = dimensions(853, 479, "1280", true);
  expect(d.width % 2).toBe(0);
  expect(d.height % 2).toBe(0);
  expect(() => dimensions(0, 0)).toThrow();
});
test("preset import validates and supports versioned backups", () => {
  expect(() => parsePresets([])).toThrow();
  expect(() => parsePresets({ garbage: 42 })).toThrow();
  expect(
    parsePresets({
      version: 2,
      presets: { test: { effect: "ascii", pixelSize: 10 } },
    }).test,
  ).toMatchObject({ effect: "ascii", cellSize: 10 });
});
test("filenames and timeline labels are deterministic", () => {
  expect(filename("test.mov", "webm")).toBe("test-dither.webm");
  expect(timeLabel(61.5)).toBe("01:01.5");
  expect(timeLabel(NaN)).toBe("00:00.0");
});

test("inherited object keys cannot be selected as palettes", () => {
  expect(sanitizeConfig({ palette: "toString" }).palette).toBe("Paper");
  expect(sanitizeConfig({ palette: "constructor" }).palette).toBe("Paper");
});
test("consolidated effects preserve legacy presets and overlays", () => {
  expect(sanitizeConfig({ effect: "decade" })).toMatchObject({
    effect: "palette",
    overlay: "number",
  });
  expect(sanitizeConfig({ effect: "binary" })).toMatchObject({
    effect: "two-tone",
    overlay: "binary",
  });
  expect(sanitizeConfig({ effect: "binary-char" })).toMatchObject({
    effect: "two-tone",
    overlay: "luma",
  });
  expect(sanitizeConfig({ effect: "letter-char", char: "Z" })).toMatchObject({
    effect: "two-tone",
    overlay: "character",
    char: "Z",
  });
  expect(
    sanitizeConfig({ effect: "letters-palette", letterCount: 3 }),
  ).toMatchObject({ effect: "ascii", characters: "ABC" });
  expect(sanitizeConfig({ effect: "green-screen" })).toMatchObject({
    effect: "pixel",
    removeGreen: true,
  });
});
