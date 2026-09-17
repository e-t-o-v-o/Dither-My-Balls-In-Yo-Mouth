// @vitest-environment node
import { createCanvas, ImageData, loadImage } from "@napi-rs/canvas";
import { FrameRenderer, SVGContext } from "./renderer";
import { looks, spatialArtEffects, defaults, sanitizeConfig, isArtisticLook } from "./model";
import { configAtTime, availableMotionControls } from "./motion";
import { effectScale } from "./effect-scale";
import { ContourPlate } from "./contour-plate";
import { contourPaths } from "./graphics";
import { SpatialRenderer } from "./spatial-art";

beforeAll(() => {
  global.document = { createElement: () => createCanvas(1, 1) };
  global.ImageData = ImageData;
});
const bytes = c => c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
const equal = (a, b) => Buffer.from(a).equals(Buffer.from(b));
function source(alpha = 1, portrait = false) {
  const c = createCanvas(portrait ? 240 : 400, portrait ? 400 : 240), ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, c.width, c.height);
  g.addColorStop(0, "#142443"); g.addColorStop(.5, "#c45c31"); g.addColorStop(1, "#faf3ca");
  ctx.globalAlpha = alpha; ctx.fillStyle = g; ctx.fillRect(0, 0, c.width, c.height);
  ctx.clearRect(0, 0, c.width / 5, c.height);
  ctx.fillStyle = "#182937"; ctx.beginPath(); ctx.arc(c.width * .6, c.height * .45, c.width * .13, 0, Math.PI * 2); ctx.fill();
  return c;
}
// Keep coverage for retired effects so saved projects still render correctly.
const compatibilityLooks = [
  { name: "Coral syntax", note: "Harmonic field / vermilion & lilac membranes",
    config: { ...defaults, effect: "harmonics", cellSize: 60, fgColor: "#ef4b2c", accentColor: "#aba5e2", bgColor: "#f3eddb", harmonicWarp: .85, harmonicAccent: .7, harmonicWeight: 1.05 } },
  { name: "Plasma garden", note: "Harmonic field / luminous organic channels",
    config: { ...defaults, effect: "harmonics", cellSize: 44, fgColor: "#d2f586", accentColor: "#349b95", bgColor: "#152934", harmonicWarp: 1, harmonicAccent: .85, harmonicWeight: 1.1, artSeed: 41 } },
  { name: "Resonant silk", note: "Harmonic field / intersecting violet lattices",
    config: { ...defaults, effect: "harmonics", cellSize: 56, fgColor: "#5041aa", accentColor: "#ed9c7f", bgColor: "#f5e3d1", harmonicStructure: "lattice", harmonicWarp: .55, harmonicAccent: .75 } },
];
const newLooks = [...looks.filter(look => spatialArtEffects.includes(look.config.effect)), ...compatibilityLooks];
const families = spatialArtEffects.map(effect => newLooks.find(look => look.config.effect === effect));
test.each(newLooks)("$name keeps SVG geometry and raster output aligned", async ({ config }) => {
  const input = source(), out = createCanvas(400, 240), vector = new SVGContext(400, 240);
  const c = { ...config, transparent: true };
  new FrameRenderer().render(input, out, c, 400, 240);
  new FrameRenderer().render(input, createCanvas(400, 240), c, 400, 240, vector);
  const xml = vector.serialize();
  expect(xml).not.toMatch(/NaN|Infinity|<image/);
  expect(xml).toContain("<mask");
  const decoded = createCanvas(400, 240);
  decoded.getContext("2d").drawImage(await loadImage(Buffer.from(xml)), 0, 0);
  const a = bytes(out), b = bytes(decoded); let error = 0;
  for (let i = 0; i < a.length; i += 4) {
    for (let k = 0; k < 3; k++) error += Math.abs(a[i + k] * a[i + 3] / 255 - b[i + k] * b[i + 3] / 255);
    error += Math.abs(a[i + 3] - b[i + 3]);
  }
  expect(error / a.length).toBeLessThan(7);
});

test.each(newLooks)("$name is source responsive and deterministic after seeking, edits, and resize", ({ config }) => {
  const r = new FrameRenderer(), out = createCanvas(400, 240), input = source();
  r.render(input, out, config, 400, 240, null, 5);
  const expected = bytes(out).slice(), other = createCanvas(400, 240);
  other.getContext("2d").fillStyle = "#f7f7dd"; other.getContext("2d").fillRect(0, 0, 400, 240);
  r.render(other, out, config, 400, 240, null, 6);
  expect(equal(expected, bytes(out))).toBe(false);
  r.render(source(1, true), out, { ...config, artSeed: 99, harmonicPhase: .6, harmonicWarp: 0 }, 240, 400, null, 30);
  r.render(input, out, config, 400, 240, null, 0);
  expect(equal(expected, bytes(out))).toBe(true);
  const cold = createCanvas(400, 240); new FrameRenderer().render(input, cold, config, 400, 240);
  expect(equal(expected, bytes(cold))).toBe(true);
});

test.each(families.flatMap(look => [false, true].map(portrait => ({ ...look, portrait }))))(
  "$name preserves soft alpha at maximum detail, portrait=$portrait", ({ config, portrait }) => {
    const input = source(.5, portrait), { width, height } = input, out = createCanvas(width, height), r = new FrameRenderer();
    const c = sanitizeConfig({ ...config, transparent: true, cellSize: 1, reliefDepth: 4, reliefSlant: -1, harmonicAccent: 1, tileDetail: 1 });
    r.render(input, out, c, width, height);
    expect(out.getContext("2d").getImageData(4, height / 2, 1, 1).data[3]).toBe(0);
    const a = bytes(out), sampled = bytes(r.sample); let max = 0, sampledMax = 0;
    for (let i = 3; i < a.length; i += 4) max = Math.max(max, a[i]);
    for (let i = 3; i < sampled.length; i += 4) sampledMax = Math.max(sampledMax, sampled[i]);
    expect(max).toBeGreaterThan(25); expect(max).toBeLessThanOrEqual(sampledMax + 2);
    r.render(createCanvas(width, height), out, c, width, height);
    expect(bytes(out).some(v => v !== 0)).toBe(false);
    r.render(input, out, c, width, height, null, 0, true);
    const flat = bytes(out);
    for (let i = 3; i < flat.length; i += 4) if (flat[i] !== 255) throw new Error("Video frame was not flattened");
  });

test.each([
  ["Porcelain ridges", { reliefDepth: [0, 4], reliefSlant: [-1, 1] }],
  ["Coral syntax", { harmonicPhase: [0, 1], harmonicWarp: [0, 1] }],
  ["Resonant silk", { harmonicPhase: [0, 1] }],
  ["City inlay", { tileDetail: [0, 1], tileGap: [0, .3] }],
])("%s animates continuous controls on a fixed-size frame", (name, tracks) => {
  const c = { ...newLooks.find(l => l.name === name).config, motion: { enabled: true, easing: "linear", playback: "once", tracks } };
  const r = new FrameRenderer(), out = createCanvas(400, 240), input = source();
  r.render(input, out, configAtTime(c, 0, [0, 2]), 400, 240); const start = bytes(out).slice();
  r.render(input, out, configAtTime(c, 1, [0, 2]), 400, 240);
  expect(equal(start, bytes(out))).toBe(false);
  expect([out.width, out.height]).toEqual([400, 240]);
});

test("pattern settings import safely and irrelevant relief shading does not animate wire", () => {
  for (const look of newLooks) {
    expect(sanitizeConfig(look.config)).toEqual(look.config);
    expect(isArtisticLook(look)).toBe(true);
  }
  expect(sanitizeConfig({ effect: "harmonics", cellSize: 0, harmonicStructure: "bad", harmonicWeight: 99, harmonicWarp: Infinity }))
    .toMatchObject({ cellSize: 32, harmonicStructure: "flow", harmonicWeight: 1.5, harmonicWarp: defaults.harmonicWarp });
  expect(availableMotionControls("relief", { reliefStyle: "wire" }).map(([key]) => key)).not.toContain("reliefShade");
  expect(availableMotionControls("relief", { reliefStyle: "ridges" }).map(([key]) => key)).toContain("reliefShade");
  expect(effectScale({ ...defaults, effect: "print-collage", cellSize: 48, collageDetail: 12 })).toMatchObject({ min: 24, sampleSize: 12 });
});

test("integer contour tracing retains saddle decisions, holes, and closed edge contours", () => {
  const w = 21, h = 17, data = new Uint8ClampedArray(w * h * 4), field = new Float32Array((w + 2) * (h + 2));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const value = (x * 73 + y * 47 + x * y * 11) % 256, i = (y * w + x) * 4;
    data[i] = data[i + 1] = data[i + 2] = value; data[i + 3] = 255;
    field[(y + 1) * (w + 2) + x + 1] = value;
  }
  const fast = createCanvas(420, 340), reference = createCanvas(420, 340), tracer = new ContourPlate();
  for (const level of [75, 128, 210, 75]) {
    const a = fast.getContext("2d"), b = reference.getContext("2d");
    a.clearRect(0, 0, 420, 340); b.clearRect(0, 0, 420, 340);
    tracer.draw(a, field, w, h, level, 420, 340);
    b.beginPath();
    for (const points of contourPaths(data, w, h, level)) {
      points.forEach(([x, y], i) => i ? b.lineTo(x * 20, y * 20) : b.moveTo(x * 20, y * 20));
      b.closePath();
    }
    b.fill("evenodd");
    let error = 0; const aa = bytes(fast), bb = bytes(reference);
    for (let i = 3; i < aa.length; i += 4) error += Math.abs(aa[i] - bb[i]);
    expect(error / (w * h * 400)).toBeLessThan(.05);
  }
});

test.each([.52, .58, .64])("adaptive subdivision at detail %s uses solid, nonoverlapping leaf tiles", detail => {
  // Alternating midtones put several subdivision levels inside the old
  // crossfade band. Every printed shape must still use full ink opacity.
  const w = 32, h = 32, size = 256, data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const value = (i + Math.floor(i / w)) % 2 ? 150 : 104;
    data.set([value, value, value, 255], i * 4);
  }
  const c = { ...defaults, effect: "adaptive-tiles", cellSize: 64, tileGap: 0, tileDetail: detail, tileMotif: "chambers", fgColor: "#ff0000", bgColor: "#ffffff" };
  const out = new SVGContext(size, size), r = new SpatialRenderer();
  r.tiles(out, () => [127, 127, 127, 255], () => c.fgColor, () => .5, c, size, size, 1, w, h, data);
  const xml = out.serialize();
  expect([...xml.matchAll(/opacity="([^"]+)"/g)].every(([, opacity]) => Number(opacity) === 1)).toBe(true);
  // Each chamber has one full ink rectangle with a single notched cutout.
  // Inspect those rectangles to ensure a parent never overlaps its children.
  const inks = [...xml.matchAll(/<rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)" fill="#ff0000"/g)];
  const leaves = inks.map(m => m.slice(1).map(Number));
  expect(leaves.reduce((area, [, , width, height]) => area + width * height, 0)).toBe(size * size);
  for (let i = 0; i < leaves.length; i++) for (let j = i + 1; j < leaves.length; j++) {
    const [x, y, width, height] = leaves[i], [xx, yy, ww, hh] = leaves[j];
    expect(x + width <= xx || xx + ww <= x || y + height <= yy || yy + hh <= y).toBe(true);
  }
});
