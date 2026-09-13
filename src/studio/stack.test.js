// @vitest-environment node
import { createCanvas, ImageData, loadImage } from "@napi-rs/canvas";
import { FrameRenderer, SVGContext } from "./renderer";
import { defaults, effects, sanitizeConfig } from "./model";
import { configAtTime } from "./motion";
import { moveLayer } from "./stack";
import { parseProject } from "./projects";
import { exportKey } from "./workflow";
beforeAll(() => { global.document = { createElement: () => createCanvas(1, 1) }; global.ImageData = ImageData; });
const main = { id: "main", enabled: true, mix: 1 };
const added = (effect, more = {}) => ({ id: effect, enabled: true, mix: 0.65, settings: { ...defaults, effect, cellSize: 32, ...more } });
const pixels = canvas => canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
function source() {
  const canvas = createCanvas(96, 64), ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ee2211"; ctx.fillRect(0, 0, 48, 64);
  ctx.fillStyle = "#2255ee"; ctx.fillRect(48, 0, 48, 64);
  ctx.fillStyle = "#ffffff"; ctx.fillRect(60, 20, 20, 24);
  return canvas;
}
function render(config, input = source(), renderer = new FrameRenderer()) {
  const canvas = createCanvas(96, 64); renderer.render(input, canvas, config, 96, 64); return canvas;
}
test("stack import is bounded, nonrecursive, and never mutates defaults", () => {
  const recursive = {}; recursive.stack = [{ id: "nested", settings: recursive }];
  const c = sanitizeConfig({ stack: [added("pixel", recursive), main, added("ascii", { font: "unembedded-font", maskMode: "manual", cropWidth: 0.1 }), added("extra")] });
  expect(c.stack).toHaveLength(3);
  expect(c.stack[0].settings.stack).toEqual([]);
  expect(c.stack[2].settings).toMatchObject({ font: "monospace", maskMode: "none", cropWidth: 1 });
  expect(defaults.stack).toEqual([]);
  expect(sanitizeConfig().stack).toEqual([]);
  expect(sanitizeConfig({ stack: [main, main, added("pixel"), added("pixel")] }).stack).toHaveLength(2);
  const project = parseProject({ app: "dither-studio", version: 1, config: c, media: { kind: "image" } });
  expect(project.config.stack).toEqual(c.stack);
});
test.each(effects.map(([effect]) => effect))("%s can process another layer's output", effect => {
  const c = sanitizeConfig({ ...defaults, effect: "pixel", stack: [main, added(effect)] });
  const data = pixels(render(c));
  expect(data.some((v, i) => i % 4 !== 3 && v > 0)).toBe(true);
  expect(data.every(Number.isFinite)).toBe(true);
});
test("bypassing extra layers exactly restores the original renderer, including crop and selection", () => {
  const base = sanitizeConfig({ effect: "dither", cropX: 0.5, cropWidth: 0.5, maskMode: "luminance", maskLow: 60, maskSoftness: 0.1, transparent: true });
  const stack = { ...base, stack: [main, { ...added("glass"), enabled: false }] };
  const renderer = new FrameRenderer();
  render({ ...stack, stack: [main, added("glass")] }, source(), renderer);
  expect(pixels(render(stack, source(), renderer))).toEqual(pixels(render(base)));
  expect(renderer.stackRenderers.size).toBe(0);
});
test("crop is applied once regardless of layer order; bypassing everything shows the crop", () => {
  const input = source();
  for (const stack of [[main, added("pixel")], [added("pixel"), main], [{ ...main, enabled: false }, { ...added("pixel"), enabled: false }]]) {
    const c = sanitizeConfig({ effect: "pixel", cellSize: 8, cropX: 0.5, cropWidth: 0.5, stack });
    const out = render(c, input), data = pixels(out);
    // The red left half is outside the crop and can never enter any stage.
    for (let i = 0; i < data.length; i += 4) expect(data[i]).toBeLessThanOrEqual(data[i + 2] + 2);
    // The source's white inset stays centered; repeated cropping would shift it.
    const white = out.getContext("2d").getImageData(48, 32, 1, 1).data;
    expect(white[0]).toBeGreaterThan(220);
  }
});
test("reordering three treatments changes the result and keeps settings with each layer", () => {
  const c = sanitizeConfig({ effect: "threadwork", cellSize: 32, stack: [main, added("screenprint"), added("contour-type")] });
  const reordered = { ...c, stack: moveLayer(c.stack, "main", 1) };
  expect(reordered.stack[1]).toEqual(main);
  expect(pixels(render(c))).not.toEqual(pixels(render(reordered)));
});
test("transparent stacked output keeps source alpha", () => {
  const input = createCanvas(96, 64); input.getContext("2d").fillRect(48, 0, 48, 64);
  const c = sanitizeConfig({ effect: "pixel", transparent: true, stack: [main, added("pixel", { transparent: true })] });
  expect(render(c, input).getContext("2d").getImageData(10, 10, 1, 1).data[3]).toBe(0);
});
test("added-layer motion works with main animation off and invalidates still exports on trim changes", () => {
  const c = sanitizeConfig({ stack: [main, added("pixel", { motion: { enabled: true, easing: "linear", tracks: { brightness: [-100, 100] } } })] });
  expect(configAtTime(c, 3, [2, 4]).stack[1].settings.brightness).toBe(0);
  expect(configAtTime(c, 4, [2, 4]).stack[1].settings.brightness).toBe(100);
  expect(c.stack[1].settings.brightness).toBe(0);
  const job = { config: c, format: "png", time: 3, start: 2, end: 4 };
  expect(exportKey(job)).not.toBe(exportKey({ ...job, end: 6 }));
});
test("stacked SVG retains the same composition and embeds preceding raster content when blended", async () => {
  const c = sanitizeConfig({ effect: "pixel", cellSize: 24, stack: [main, added("halftone", { cellSize: 80 })] });
  const context = new SVGContext(96, 64);
  new FrameRenderer().render(source(), createCanvas(96, 64), c, 96, 64, context);
  const xml = context.serialize(); expect(xml).toContain("data:image/png");
  // Skia's SVG decoder omits embedded images. Verify that raster stage,
  // then compose the final vector group over it; browser QA covers the full SVG.
  const embedded = xml.match(/data:image\/png;base64,([^"\s]+)/);
  const image = await loadImage(Buffer.from(embedded[1], "base64"));
  const out = createCanvas(96, 64), ctx = out.getContext("2d");
  ctx.drawImage(image, 0, 0);
  expect(pixels(out)).toEqual(pixels(render({ ...c, stack: [] })));
  const finalStage = new SVGContext(96, 64);
  finalStage.parts = context.parts.filter(part => part.startsWith("<g opacity="));
  expect(finalStage.parts).toHaveLength(1);
  ctx.drawImage(await loadImage(Buffer.from(finalStage.serialize())), 0, 0);
  const a = pixels(render(c)), b = pixels(out);
  const difference = a.reduce((sum, value, i) => sum + Math.abs(value - b[i]), 0) / a.length;
  expect(difference).toBeLessThan(18);
});
