// @vitest-environment node
import { createCanvas, ImageData, loadImage } from "@napi-rs/canvas";
import { FrameRenderer, SVGContext } from "./renderer";
import { looks, editorialArtEffects, defaults, sanitizeConfig, isArtisticLook } from "./model";
import { configAtTime } from "./motion";

beforeAll(() => {
  global.document = { createElement: () => createCanvas(1, 1) };
  global.ImageData = ImageData;
});
const bytes = canvas => canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
const equal = (a, b) => Buffer.from(a).equals(Buffer.from(b));
function source(alpha = 1, portrait = false) {
  const canvas = createCanvas(portrait ? 240 : 400, portrait ? 400 : 240), ctx = canvas.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  g.addColorStop(0, "#142443"); g.addColorStop(.5, "#c45c31"); g.addColorStop(1, "#faf3ca");
  ctx.globalAlpha = alpha; ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.clearRect(0, 0, canvas.width / 5, canvas.height);
  ctx.fillStyle = `rgba(30,30,50,${alpha})`; ctx.beginPath(); ctx.arc(canvas.width * .6, canvas.height * .45, canvas.width * .13, 0, Math.PI * 2); ctx.fill();
  return canvas;
}
const newLooks = looks.filter(look => editorialArtEffects.includes(look.config.effect) || look.config.mosaicLayout === "targets");
const families = ["Cobalt code", "Field notes", "Archive collage", "Opal interference", "Chromatic orbits"].map(name => looks.find(look => look.name === name));

test.each(newLooks)("$name exports editable SVG matching its raster composition", async ({ config }) => {
  const input = source(), out = createCanvas(400, 240), vector = new SVGContext(400, 240);
  const c = { ...config, transparent: true };
  new FrameRenderer().render(input, out, c, 400, 240);
  new FrameRenderer().render(input, createCanvas(400, 240), c, 400, 240, vector);
  const xml = vector.serialize();
  expect(xml).not.toMatch(/NaN|Infinity|<image/);
  expect(xml).toContain("<mask");
  const decoded = createCanvas(400, 240);
  decoded.getContext("2d").drawImage(await loadImage(Buffer.from(xml)), 0, 0);
  const a = bytes(out), b = bytes(decoded);
  // Transparent antialiased edges can differ in unassociated RGB; compare
  // premultiplied colors as well as alpha, which is what compositing displays.
  let error = 0;
  for (let i = 0; i < a.length; i += 4) {
    for (let k = 0; k < 3; k++) error += Math.abs(a[i + k] * a[i + 3] / 255 - b[i + k] * b[i + 3] / 255);
    error += Math.abs(a[i + 3] - b[i + 3]);
  }
  expect(error / a.length).toBeLessThan(7);
});

test.each(families)("$name responds to the source and remains identical after seeking and cache changes", ({ config }) => {
  const r = new FrameRenderer(), out = createCanvas(400, 240), input = source();
  r.render(input, out, config, 400, 240, null, 5);
  const expected = bytes(out).slice();
  const different = createCanvas(400, 240); different.getContext("2d").fillStyle = "#f7f7dd"; different.getContext("2d").fillRect(0, 0, 400, 240);
  r.render(different, out, config, 400, 240, null, 6);
  expect(equal(expected, bytes(out))).toBe(false);
  r.render(input, out, { ...config, palette: "Paper", fgColor: "#00ff00", artSeed: 99, artColorMode: "ink" }, 400, 240, null, 30);
  r.render(input, out, config, 400, 240, null, 0);
  expect(equal(expected, bytes(out))).toBe(true);
  const cold = createCanvas(400, 240); new FrameRenderer().render(input, cold, config, 400, 240);
  expect(equal(expected, bytes(cold))).toBe(true);
  expect(r.editorial.plate.masks.size).toBeLessThanOrEqual(512);
  expect(r.editorial.colors.size).toBeLessThanOrEqual(32768);
});

test.each(families.flatMap(look => [false, true].map(portrait => ({ ...look, portrait }))))(
  "$name preserves alpha at maximum detail, portrait=$portrait", ({ config, portrait }) => {
    const input = source(.5, portrait), width = input.width, height = input.height, out = createCanvas(width, height);
    const c = sanitizeConfig({ ...config, transparent: true, cellSize: 1, collageDetail: 16, targetRings: 5,
      opticalBend: 1, opticalInterference: 1, opticalCenterX: 0, signalAngle: 60, signalWarp: 1 });
    const renderer = new FrameRenderer(); renderer.render(input, out, c, width, height);
    expect(out.getContext("2d").getImageData(4, height / 2, 1, 1).data[3]).toBe(0);
    const a = bytes(out), sampled = bytes(renderer.sample);
    let max = 0, sampledMax = 0;
    for (let i = 3; i < a.length; i += 4) max = Math.max(max, a[i]);
    for (let i = 3; i < sampled.length; i += 4) sampledMax = Math.max(sampledMax, sampled[i]);
    expect(max).toBeGreaterThan(25);
    expect(max).toBeLessThanOrEqual(sampledMax + 2);
  },
);

test.each(["rings", "rays", "waves"])("optical %s responds to continuous motion without changing output dimensions", opticalPattern => {
  const config = { ...looks.find(look => look.name === "Opal interference").config, opticalPattern,
    motion: { enabled: true, easing: "linear", playback: "once", tracks: { opticalPhase: [0, 1], opticalBend: [0, 1] } } };
  const out = createCanvas(400, 240), r = new FrameRenderer(), input = source();
  r.render(input, out, configAtTime(config, 0, [0, 2]), 400, 240);
  const start = bytes(out).slice();
  r.render(input, out, configAtTime(config, 1, [0, 2]), 400, 240);
  expect(equal(start, bytes(out))).toBe(false);
  expect([out.width, out.height]).toEqual([400, 240]);
});

test("imports bound editorial geometry, retain valid presets, and keep target looks in Artistic", () => {
  for (const look of newLooks) {
    expect(sanitizeConfig(look.config)).toEqual(look.config);
    expect(isArtisticLook(look)).toBe(true);
  }
  expect(isArtisticLook({ config: { ...defaults, effect: "mosaic" } })).toBe(false);
  expect(sanitizeConfig({ effect: "print-collage", cellSize: 0, collageDetail: 999, collageStyle: "bad", opticalPattern: "bad", targetRings: 90, signalAngle: Infinity }))
    .toMatchObject({ cellSize: 24, collageDetail: 16, collageStyle: "patchwork", opticalPattern: "rings", targetRings: 5, signalAngle: 0 });
});

test("an entirely transparent source produces no editorial artwork, including after an opaque frame", () => {
  const r = new FrameRenderer(), input = createCanvas(400, 240), out = createCanvas(400, 240);
  for (const { config } of families) {
    r.render(source(), out, config, 400, 240);
    r.render(input, out, { ...config, transparent: true }, 400, 240);
    expect(bytes(out).some(v => v !== 0)).toBe(false);
  }
});

test("cached print buffers survive an equal-area portrait resize and opaque video flattening", () => {
  const renderer = new FrameRenderer(), config = { ...families[2].config, transparent: true }, out = createCanvas(400, 240);
  renderer.render(source(), out, config, 400, 240);
  const input = source(.5, true), expected = createCanvas(240, 400);
  renderer.render(input, out, config, 240, 400, null, 0, true);
  new FrameRenderer().render(input, expected, config, 240, 400, null, 0, true);
  expect(equal(bytes(out), bytes(expected))).toBe(true);
  const a = bytes(out);
  for (let i = 3; i < a.length; i += 4) if (a[i] !== 255) throw new Error("Flattened frame contains transparency");
});

test("single-ink type still reproduces source tone with a fixed palette", () => {
  const config = { ...defaults, effect: "print-collage", cellSize: 48, artColorMode: "ink", collageStyle: "type", collageCoverage: 1 };
  const a = createCanvas(400, 240), b = createCanvas(400, 240), out = createCanvas(400, 240), renderer = new FrameRenderer();
  a.getContext("2d").fillStyle = "#303030"; a.getContext("2d").fillRect(0, 0, 400, 240);
  b.getContext("2d").fillStyle = "#dadada"; b.getContext("2d").fillRect(0, 0, 400, 240);
  renderer.render(a, out, config, 400, 240); const dark = bytes(out).slice();
  renderer.render(b, out, config, 400, 240);
  expect(equal(dark, bytes(out))).toBe(false);
});
