// Reproducible visual/performance review of the actual shared renderer.
// Optional arguments: output directory, then a local source image.
import { createCanvas, ImageData, loadImage } from "@napi-rs/canvas";
import { build } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
globalThis.document = { createElement: () => createCanvas(1, 1) };
globalThis.ImageData = ImageData;
async function bundle(entry) {
  const result = await build({ configFile: false, logLevel: "silent",
    build: { write: false, minify: false, lib: { entry: path.resolve(entry), formats: ["es"] } } });
  const code = (Array.isArray(result) ? result[0] : result).output.find(x => x.type === "chunk" && x.isEntry).code;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString("base64")}`);
}
const { FrameRenderer, drawSignal } = await bundle("src/studio/renderer.js");
const { looks } = await bundle("src/studio/model.js");
const outputDir = process.argv[2];
const input = process.argv[3] ? await loadImage(process.argv[3]) : drawSignal(createCanvas(1280, 720), 1.3);
if (outputDir) {
  await mkdir(outputDir, { recursive: true });
  const styleLooks = looks.filter(look => look.config.effect === "interlace");
  const sheet = createCanvas(1600, 1020), ctx = sheet.getContext("2d");
  ctx.fillStyle = "#191919";
  ctx.fillRect(0, 0, sheet.width, sheet.height);
  const items = [{ name: "Source", config: null }, ...styleLooks];
  for (let i = 0; i < items.length; i++) {
    const item = items[i], out = createCanvas(760, 440);
    if (item.config) {
      const ratio = input.width / input.height;
      const width = ratio >= 1 ? 1200 : Math.round(1200 * ratio);
      const height = ratio >= 1 ? Math.round(1200 / ratio) : 1200;
      const full = createCanvas(width, height);
      new FrameRenderer().render(input, full, item.config, width, height);
      await writeFile(path.join(outputDir, item.name.toLowerCase().replaceAll(" ", "-") + ".png"), full.toBuffer("image/png"));
      const scale = Math.min(760 / width, 440 / height);
      out.getContext("2d").drawImage(full, (760 - width * scale) / 2, (440 - height * scale) / 2, width * scale, height * scale);
    } else {
      const scale = Math.min(760 / input.width, 440 / input.height);
      out.getContext("2d").drawImage(input, (760 - input.width * scale) / 2, (440 - input.height * scale) / 2, input.width * scale, input.height * scale);
    }
    const x = 20 + i % 2 * 800, y = 20 + Math.floor(i / 2) * 500;
    ctx.drawImage(out, x, y);
    ctx.fillStyle = "#f2f2f2"; ctx.font = "20px sans-serif";
    ctx.fillText(item.name, x + 12, y + 475);
  }
  await writeFile(path.join(outputDir, "interlace-review.png"), sheet.toBuffer("image/png"));
}
const timings = [];
for (const size of [1280, 1920, 3840]) {
  for (const [detail, cellSize] of [["standard", 32], ["fine", 8]]) {
    const config = { ...looks.find(look => look.name === "Color loom").config, cellSize };
    const renderer = new FrameRenderer(), canvas = createCanvas(size, Math.round(size * 9 / 16));
    const frames = [];
    for (let frame = 0; frame < 12; frame++) {
      const start = performance.now();
      renderer.render(input, canvas, config, canvas.width, canvas.height, null, frame / 30);
      const elapsed = performance.now() - start;
      if (frame > 1) frames.push(elapsed);
    }
    frames.sort((a, b) => a - b);
    timings.push({ width: size, detail, medianMs: Number(frames[5].toFixed(2)), p90Ms: Number(frames[8].toFixed(2)) });
  }
}
console.log(JSON.stringify({ environment: "Native canvas, warm renderer; render-only timings, not device playback FPS", timings }, null, 2));
