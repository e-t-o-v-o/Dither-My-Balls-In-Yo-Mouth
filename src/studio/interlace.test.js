// @vitest-environment node
import { createCanvas, ImageData, loadImage } from "@napi-rs/canvas";
import { FrameRenderer, SVGContext } from "./renderer";
import { defaults, sanitizeConfig } from "./model";

beforeAll(() => {
  global.document = { createElement: () => createCanvas(1, 1) };
  global.ImageData = ImageData;
});
const config = { ...defaults, effect: "interlace", palette: "Loom primary", cellSize: 32, weaveColorMode: "tone" };
function source(alpha = 1) {
  const canvas = createCanvas(320, 180), ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 320, 180);
  gradient.addColorStop(0, "#151b29");
  gradient.addColorStop(0.5, "#699e6f");
  gradient.addColorStop(1, "#eee3c0");
  ctx.globalAlpha = alpha;
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 320, 180);
  return canvas;
}
const pixels = canvas => canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;

test.each(["weave", "bands", "steps"])("%s keeps the same composition in raster and editable SVG", async weavePattern => {
  const input = source(), actual = createCanvas(320, 180), expected = createCanvas(320, 180);
  const c = { ...config, weavePattern };
  const vector = new SVGContext(320, 180);
  new FrameRenderer().render(input, actual, c, 320, 180);
  new FrameRenderer().render(input, createCanvas(320, 180), c, 320, 180, vector);
  const svg = vector.serialize();
  expect(svg).not.toContain("<image");
  expected.getContext("2d").drawImage(await loadImage(Buffer.from(svg)), 0, 0);
  const a = pixels(actual), b = pixels(expected);
  const error = a.reduce((sum, v, i) => sum + Math.abs(v - b[i]), 0) / a.length;
  expect(error).toBeLessThan(8);
});

test("video frames do not depend on playback order or previously rendered effects", () => {
  const input = source(), output = createCanvas(320, 180), renderer = new FrameRenderer();
  renderer.render(input, output, config, 320, 180, null, 12);
  const expected = pixels(output).slice();
  renderer.render(input, output, { ...config, weaveSeed: 48 }, 320, 180, null, 30);
  expect(pixels(output)).not.toEqual(expected);
  renderer.render(input, output, { ...config, effect: "pixel" }, 320, 180, null, 3);
  renderer.render(input, output, config, 320, 180, null, 0);
  expect(pixels(output)).toEqual(expected);
});

test.each(["weave", "steps"])("%s preserves transparent regions and does not compound soft alpha", weavePattern => {
  const input = source(0.5), ctx = input.getContext("2d");
  ctx.clearRect(0, 0, 160, 180);
  const output = createCanvas(320, 180);
  new FrameRenderer().render(input, output, { ...config, weavePattern, transparent: true }, 320, 180);
  const data = pixels(output);
  expect(output.getContext("2d").getImageData(30, 90, 1, 1).data[3]).toBe(0);
  let maximum = 0;
  for (let i = 3; i < data.length; i += 4) maximum = Math.max(maximum, data[i]);
  expect(maximum).toBeGreaterThanOrEqual(126);
  expect(maximum).toBeLessThanOrEqual(129);
});

test("source-color mapping retains broad source colors and reacts to image changes", () => {
  const input = createCanvas(240, 240), ctx = input.getContext("2d");
  const output = createCanvas(240, 240), renderer = new FrameRenderer();
  for (const color of ["#ff0000", "#0070f6"]) {
    ctx.fillStyle = color; ctx.fillRect(0, 0, 240, 240);
    renderer.render(input, output, { ...config, weaveColorMode: "source", weaveDetail: 1 }, 240, 240);
    const data = pixels(output), sums = [0, 0, 0];
    for (let i = 0; i < data.length; i += 4)
      for (let ch = 0; ch < 3; ch++) sums[ch] += data[i + ch];
    expect(color === "#ff0000" ? sums[0] : sums[2]).toBeGreaterThan(color === "#ff0000" ? sums[2] * 4 : sums[0] * 4);
  }
});

test("imported Interlace settings are bounded and retain their selected pattern", () => {
  const c = sanitizeConfig({ ...config, weavePattern: "steps", weaveSeed: 6.7, weaveDetail: 5, weaveWidth: -4, weaveCrossings: 8, cellSize: 1 });
  expect(c).toMatchObject({ effect: "interlace", weavePattern: "steps", weaveSeed: 7, weaveDetail: 1, weaveWidth: 0.2, weaveCrossings: 1, cellSize: 8 });
});
