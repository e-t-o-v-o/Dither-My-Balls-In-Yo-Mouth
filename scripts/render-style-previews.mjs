// Thumbnails are actual renderer outputs, generated once rather than during playback.
import { createCanvas, ImageData } from "@napi-rs/canvas";
import { build } from "vite";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
globalThis.document = { createElement: () => createCanvas(1, 1) };
globalThis.ImageData = ImageData;
async function bundle(entry) {
  const result = await build({
    configFile: false,
    logLevel: "silent",
    build: { write: false, minify: false, lib: { entry, formats: ["es"] } },
  });
  const code = (Array.isArray(result) ? result[0] : result).output.find(
    (x) => x.type === "chunk" && x.isEntry,
  ).code;
  return import(
    `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
  );
}
const { FrameRenderer, drawSignal } = await bundle(
  path.resolve("src/studio/renderer.js"),
);
const { looks } = await bundle(path.resolve("src/studio/model.js"));
const input = drawSignal(createCanvas(1280, 720), 1.3);
const dir = path.resolve("public/styles");
await mkdir(dir, { recursive: true });
const sheet = createCanvas(960, (looks.length / 4) * 188),
  sc = sheet.getContext("2d");
sc.fillStyle = "#161719";
sc.fillRect(0, 0, sheet.width, sheet.height);
for (const [i, look] of looks.entries()) {
  const output = createCanvas(480, 288);
  new FrameRenderer().render(input, output, look.config, 480, 288);
  const thumb = createCanvas(240, 144);
  thumb.getContext("2d").drawImage(output, 0, 0, 240, 144);
  await writeFile(
    path.join(dir, look.name.toLowerCase().replace(/\s+/g, "-") + ".png"),
    thumb.toBuffer("image/png"),
  );
  const x = (i % 4) * 240,
    y = Math.floor(i / 4) * 188;
  sc.drawImage(thumb, x, y);
  sc.fillStyle = "#fff";
  sc.font = "16px sans-serif";
  sc.fillText(look.name, x + 10, y + 169);
}
if (process.argv[2])
  await writeFile(process.argv[2], sheet.toBuffer("image/png"));
console.log(`Rendered ${looks.length} style previews.`);
