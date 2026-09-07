// @vitest-environment node
import { contourPaths, spacedPoints } from "./graphics";
import { applyMask } from "./masks";
import { defaults, sanitizeConfig, looks, usesPalette } from "./model";
test("contours close around a silhouette and retain interior holes", () => {
  const data = new Uint8ClampedArray(7 * 7 * 4);
  for (let y = 1; y < 6; y++)
    for (let x = 1; x < 6; x++) {
      if (x >= 2 && x <= 4 && y >= 2 && y <= 4) continue;
      data.set([255, 255, 255, 255], (y * 7 + x) * 4);
    }
  const paths = contourPaths(data, 7, 7, 128, true);
  expect(paths).toHaveLength(2);
  for (const path of paths) expect(path[0]).toEqual(path.at(-1));
  expect(
    contourPaths(new Uint8ClampedArray(4 * 4 * 4), 4, 4, 128, true),
  ).toEqual([]);
});
test("bead spacing carries continuously across short contour segments", () => {
  const points = spacedPoints(
    [
      [0, 0],
      [0.3, 0],
      [0.7, 0],
      [1.2, 0],
      [3, 0],
    ],
    1,
  );
  expect(points).toEqual([
    [0.5, 0],
    [1.5, 0],
    [2.5, 0],
  ]);
});
test("color masks invert selection while preserving source transparency", () => {
  const data = new Uint8ClampedArray([
    255, 0, 0, 128, 0, 255, 0, 255, 255, 0, 0, 0,
  ]);
  const c = {
    ...defaults,
    maskMode: "color",
    maskColor: "#ff0000",
    maskTolerance: 0.1,
    maskSoftness: 0,
  };
  expect(Array.from(applyMask(data, c)).filter((_, i) => i % 4 === 3)).toEqual([
    128, 0, 0,
  ]);
  expect(
    Array.from(applyMask(data, { ...c, maskInvert: true })).filter(
      (_, i) => i % 4 === 3,
    ),
  ).toEqual([0, 255, 0]);
  expect(data[3]).toBe(128);
});
test("brightness masks preserve endpoints and feather the selection", () => {
  const data = new Uint8ClampedArray([
    0, 0, 0, 255, 110, 110, 110, 255, 180, 180, 180, 255, 255, 255, 255, 255,
  ]);
  const out = applyMask(data, {
    ...defaults,
    maskMode: "luminance",
    maskLow: 128,
    maskHigh: 255,
    maskSoftness: 0.15,
  });
  expect(out[3]).toBe(0);
  expect(out[7]).toBeGreaterThan(0);
  expect(out[7]).toBeLessThan(255);
  expect(out[11]).toBe(255);
  expect(out[15]).toBe(255);
  expect(applyMask(data, defaults)).toBe(data);
});
test("graphic settings and bundled styles remain valid", () => {
  const c = sanitizeConfig({
    effect: "beads",
    cellSize: 2,
    beadSpacing: -1,
    maskLow: 230,
    maskHigh: 10,
    maskColor: "bad",
    symbolSet: "bad",
  });
  expect(c.cellSize).toBe(6);
  expect(c.beadSpacing).toBe(0.65);
  expect(c.maskLow).toBe(10);
  expect(c.maskHigh).toBe(230);
  expect(c.maskColor).toBe(defaults.maskColor);
  expect(c.symbolSet).toBe("mixed");
  for (const look of looks)
    expect(sanitizeConfig(look.config)).toEqual(look.config);
  expect(usesPalette(looks.find((l) => l.name === "Letterpress").config)).toBe(
    true,
  );
});
