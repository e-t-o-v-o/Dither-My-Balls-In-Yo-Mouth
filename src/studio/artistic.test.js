// @vitest-environment node
import { createCanvas, ImageData, loadImage } from "@napi-rs/canvas";
import { FrameRenderer, SVGContext } from "./renderer";
import { defaults, looks, proceduralArtEffects, materialArtEffects, sanitizeConfig } from "./model";

beforeAll(() => {
  global.document = { createElement: () => createCanvas(1, 1) };
  global.ImageData = ImageData;
});
const pixels = canvas => canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
function source(alpha = 1) {
  const input = createCanvas(480, 270), ctx = input.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 480, 270);
  gradient.addColorStop(0, "#12251f"); gradient.addColorStop(0.5, "#c16743"); gradient.addColorStop(1, "#faf2d1");
  ctx.globalAlpha = alpha;
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 480, 270);
  return input;
}
const artLooks = looks.filter(look => proceduralArtEffects.includes(look.config.effect));

test.each(artLooks)("$name preserves its composition as editable SVG", async ({ config }) => {
  const input = source(), output = createCanvas(480, 270), vector = new SVGContext(480, 270);
  new FrameRenderer().render(input, output, config, 480, 270);
  new FrameRenderer().render(input, createCanvas(480, 270), config, 480, 270, vector);
  const xml = vector.serialize();
  expect(xml).not.toContain("<image");
  expect(xml).not.toMatch(/NaN|Infinity/);
  const decoded = createCanvas(480, 270);
  decoded.getContext("2d").drawImage(await loadImage(Buffer.from(xml)), 0, 0);
  const a = pixels(output), b = pixels(decoded);
  expect(a.reduce((sum, value, i) => sum + Math.abs(value - b[i]), 0) / a.length).toBeLessThan(6);
});

test.each(proceduralArtEffects)("%s has repeatable frame order, live source response, and stable palette caches", effect => {
  const c = { ...looks.find(look => look.config.effect === effect).config, artColorMode: "source" };
  const output = createCanvas(480, 270), renderer = new FrameRenderer(), input = source();
  renderer.render(input, output, c, 480, 270, null, 12);
  const expected = pixels(output).slice();
  renderer.render(input, output, { ...c, artSeed: 82, topoLevels: 4 }, 480, 270, null, 30);
  expect(pixels(output)).not.toEqual(expected);
  const different = createCanvas(480, 270);
  different.getContext("2d").fillStyle = "#ff0d30";
  different.getContext("2d").fillRect(0, 0, 480, 270);
  renderer.render(different, output, c, 480, 270, null, 3);
  expect(pixels(output)).not.toEqual(expected);
  renderer.render(input, output, c, 480, 270, null, 0);
  expect(pixels(output)).toEqual(expected);
  const cold = createCanvas(480, 270);
  new FrameRenderer().render(input, cold, c, 480, 270);
  expect(pixels(output)).toEqual(pixels(cold));
});

test.each(proceduralArtEffects)("%s preserves empty areas and does not compound a soft selection", effect => {
  const input = source(0.5), ctx = input.getContext("2d");
  ctx.clearRect(0, 0, 200, 270);
  const c = { ...looks.find(look => look.config.effect === effect).config, transparent: true, engraveWeight: 1, paperFill: 1, glassGap: 0, glassScatter: 1, arcWeight: 1, arcBands: 4 };
  const output = createCanvas(480, 270), renderer = new FrameRenderer();
  renderer.render(input, output, c, 480, 270);
  expect(output.getContext("2d").getImageData(30, 135, 1, 1).data[3]).toBe(0);
  const a = pixels(output);
  let max = 0;
  for (let i = 3; i < a.length; i += 4) max = Math.max(max, a[i]);
  expect(max).toBeGreaterThan(110);
  const sampled = pixels(renderer.sample);
  let sampledMax = 0;
  for (let i = 3; i < sampled.length; i += 4) sampledMax = Math.max(sampledMax, sampled[i]);
  // High-quality source resampling can ring slightly at a hard alpha edge.
  // Compare to that actual input, plus three levels for native path rounding.
  // Compounding half-opacity marks would reach 192 and must still fail.
  expect(max).toBeLessThanOrEqual(sampledMax + 3);
});

test("single-ink glass retains tonal information instead of producing a solid mesh", () => {
  const input = source(), output = createCanvas(480, 270);
  new FrameRenderer().render(input, output, { ...defaults, effect: "glass", cellSize: 48, artColorMode: "ink", transparent: true }, 480, 270);
  const a = pixels(output), left = [], right = [];
  for (let y = 0; y < 270; y++) for (let x = 0; x < 480; x++) {
    if (x < 160) left.push(a[(y * 480 + x) * 4 + 3]);
    if (x > 320) right.push(a[(y * 480 + x) * 4 + 3]);
  }
  const average = a => a.reduce((s, v) => s + v, 0) / a.length;
  expect(average(right)).toBeGreaterThan(average(left) * 2);
});

test("source-color glass preserves eight-bit color values", () => {
  const input = createCanvas(480, 270), output = createCanvas(480, 270);
  input.getContext("2d").fillStyle = "#fa071d";
  input.getContext("2d").fillRect(0, 0, 480, 270);
  new FrameRenderer().render(input, output, { ...defaults, effect: "glass", cellSize: 48, artColorMode: "source", transparent: true }, 480, 270);
  const a = pixels(output);
  let solid = 0;
  for (let i = 0; i < a.length; i += 4) if (a[i + 3] === 255) {
    expect(Array.from(a.slice(i, i + 3))).toEqual([250, 7, 29]);
    solid++;
    if (solid === 50) break;
  }
  expect(solid).toBe(50);
});

test("artistic imports reject invalid structures and bound expensive detail settings", () => {
  expect(sanitizeConfig({ effect: "arc-tiles", cellSize: 0, artSeed: 12.8, arcBands: 999, arcWeight: -4, artColorMode: "bogus", paperShape: "bogus", glassGap: 9 }))
    .toMatchObject({ effect: "arc-tiles", cellSize: 16, artSeed: 13, arcBands: 4, arcWeight: 0.1, artColorMode: "palette", paperShape: "leaves", glassGap: 0.2 });
});

test.each(materialArtEffects)("%s bounds opacity at maximum detail, with repeatable landscape and portrait compositions", effect => {
  for (const [width, height] of [[360, 240], [240, 360]]) for (const artSeed of [0, 43, 99]) {
    const input = createCanvas(width, height), output = createCanvas(width, height), ctx = input.getContext("2d");
    ctx.fillStyle = "rgba(185,130,60,0.5)"; ctx.fillRect(0, 0, width, height);
    const c = sanitizeConfig({ ...defaults, effect, transparent: true, cellSize: 12, artColorMode: "source", artSeed,
      marbleSwirl: 1, marbleWeight: 1, topoLevels: 16, topoContour: 0.04, stitchLength: 1, stitchWidth: 1, stitchStrands: 3 });
    new FrameRenderer().render(input, output, c, width, height);
    const a = pixels(output);
    let max = 0;
    for (let i = 3; i < a.length; i += 4) max = Math.max(max, a[i]);
    expect(max).toBeGreaterThan(32); // Fine filaments can be narrower than a pixel.
    expect(max).toBeLessThanOrEqual(130);
  }
});

test("contour terraces preserve white plateaus at the top of the tone range", () => {
  const input = createCanvas(320, 240), output = createCanvas(320, 240);
  input.getContext("2d").fillStyle = "#fff";
  input.getContext("2d").fillRect(0, 0, 320, 240);
  for (const artColorMode of ["source", "tone", "ink"]) {
    new FrameRenderer().render(input, output, { ...defaults, effect: "topography", cellSize: 16, artColorMode, transparent: true }, 320, 240);
    const center = output.getContext("2d").getImageData(150, 110, 1, 1).data;
    expect(center[3]).toBe(255);
    expect(center[0]).toBeGreaterThan(230);
  }
});

test("threadwork retains full eight-bit source colors", () => {
  const input = createCanvas(480, 320), output = createCanvas(480, 320);
  input.getContext("2d").fillStyle = "#fa071d";
  input.getContext("2d").fillRect(0, 0, 480, 320);
  new FrameRenderer().render(input, output, { ...defaults, effect: "threadwork", cellSize: 40, artColorMode: "source", transparent: true, stitchWidth: 1 }, 480, 320);
  const a = pixels(output);
  let solid = 0;
  for (let i = 0; i < a.length; i += 4) if (a[i + 3] === 255) {
    expect(Array.from(a.slice(i, i + 3))).toEqual([250, 7, 29]);
    if (++solid === 20) break;
  }
  expect(solid).toBe(20);
});

test("material imports bound geometry cost and sanitize each control", () => {
  expect(sanitizeConfig({ effect: "threadwork", cellSize: 2, stitchStrands: 99, stitchFollow: -1, stitchLength: 8,
    topoLevels: 99, topoSoftness: 2.8, topoStyle: "bogus", marbleSwirl: 9 }))
    .toMatchObject({ cellSize: 12, stitchStrands: 3, stitchFollow: 0, stitchLength: 1, topoLevels: 16, topoSoftness: 3, topoStyle: "terraces", marbleSwirl: 1 });
});
