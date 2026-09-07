// @vitest-environment node
import { createCanvas, ImageData, loadImage } from "@napi-rs/canvas";
import { FrameRenderer, SVGContext } from "./renderer";
import { effects, defaults, sanitizeConfig } from "./model";
beforeAll(() => {
  global.document = { createElement: () => createCanvas(1, 1) };
  global.ImageData = ImageData;
});
function source() {
  const canvas = createCanvas(192, 108),
    ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 192, 108);
  gradient.addColorStop(0, "#03030a");
  gradient.addColorStop(0.5, "#73bc62");
  gradient.addColorStop(1, "#ffffff");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 192, 108);
  ctx.fillStyle = "#000000";
  ctx.fillRect(70, 30, 30, 50);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(100, 30, 25, 50);
  return canvas;
}
test.each(effects.map(([id]) => id))(
  "%s produces real canvas pixels",
  (effect) => {
    const output = createCanvas(192, 108);
    new FrameRenderer().render(
      source(),
      output,
      { ...defaults, effect, cellSize: 40 },
      192,
      108,
    );
    const pixels = output.getContext("2d").getImageData(0, 0, 192, 108).data;
    const colors = new Set();
    for (let i = 0; i < pixels.length; i += 4)
      colors.add(
        `${pixels[i]},${pixels[i + 1]},${pixels[i + 2]},${pixels[i + 3]}`,
      );
    expect(colors.size).toBeGreaterThan(1);
  },
);
test.each([
  "dither",
  "palette",
  "two-tone",
  "edge",
  "pixel",
  "channel",
  "halftone",
  "crosshatch",
])("%s raster and SVG preserve the same image", async (effect) => {
  const c = { ...defaults, effect, cellSize: 40 };
  const raster = createCanvas(192, 108),
    vector = new SVGContext(192, 108);
  new FrameRenderer().render(source(), raster, c, 192, 108);
  new FrameRenderer().render(
    source(),
    createCanvas(192, 108),
    c,
    192,
    108,
    vector,
  );
  const decoded = await loadImage(Buffer.from(vector.serialize()));
  const svgCanvas = createCanvas(192, 108);
  svgCanvas.getContext("2d").drawImage(decoded, 0, 0);
  const a = raster.getContext("2d").getImageData(0, 0, 192, 108).data;
  const b = svgCanvas.getContext("2d").getImageData(0, 0, 192, 108).data;
  // Cell boundaries can antialias differently between the SVG and bitmap rasterizers.
  let error = 0;
  for (let i = 0; i < a.length; i++) error += Math.abs(a[i] - b[i]);
  expect(error / a.length).toBeLessThan(18);
});
test("halftone preserves black, white, and transparent negative space", () => {
  const input = createCanvas(40, 40),
    output = createCanvas(40, 40),
    ctx = input.getContext("2d");
  for (const [color, expected] of [
    ["#000000", 0],
    ["#ffffff", 255],
  ]) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 40, 40);
    new FrameRenderer().render(
      input,
      output,
      {
        ...defaults,
        effect: "halftone",
        fgColor: "#ffffff",
        transparent: true,
      },
      40,
      40,
    );
    const pixels = output.getContext("2d").getImageData(0, 0, 40, 40).data;
    expect(pixels[3]).toBe(expected);
  }
});
test("consolidated custom character preset retains its glyph", () => {
  const vector = new SVGContext(192, 108);
  new FrameRenderer().render(
    source(),
    createCanvas(192, 108),
    sanitizeConfig({ ...defaults, effect: "letter-char", char: "Z" }),
    192,
    108,
    vector,
  );
  expect(vector.serialize()).toContain(">Z</text>");
});
test("SVG escapes user text while retaining vector geometry", () => {
  const ctx = new SVGContext(20, 10);
  ctx.fillStyle = "#fff";
  ctx.font = '12px "test"';
  ctx.fillRect(0, 0, 20, 10);
  ctx.fillText("<&", 2, 4);
  expect(ctx.serialize()).toContain("&lt;&amp;");
  expect(ctx.serialize()).toContain("<rect");
});
