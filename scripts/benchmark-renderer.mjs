import { createCanvas, ImageData } from "@napi-rs/canvas";
import { build } from "vite";
import { execFileSync } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
const root = process.cwd();
globalThis.document = { createElement: () => createCanvas(1, 1) };
globalThis.ImageData = ImageData;
const dir = await mkdtemp(path.join(tmpdir(), "dither-benchmark-"));
async function bundle(entry) {
  const built = await build({
    configFile: false,
    logLevel: "silent",
    build: { write: false, minify: false, lib: { entry, formats: ["es"] } },
  });
  const code = (Array.isArray(built) ? built[0] : built).output.find(
    (x) => x.type === "chunk" && x.isEntry,
  ).code;
  return import(
    `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
  );
}
try {
  const current = await bundle(path.join(root, "src/studio/renderer.js"));
  const model = await bundle(path.join(root, "src/studio/model.js"));
  let baseline;
  const ref = process.argv[2];
  if (ref) {
    let renderer = execFileSync(
      "git",
      ["show", `${ref}:src/studio/renderer.js`],
      { encoding: "utf8" },
    );
    renderer = renderer
      .replace(
        '"./model"',
        JSON.stringify(path.join(root, "src/studio/model.js")),
      )
      .replace('"./pixels"', '"./pixels.js"');
    await writeFile(path.join(dir, "renderer.js"), renderer);
    await writeFile(
      path.join(dir, "pixels.js"),
      execFileSync("git", ["show", `${ref}:src/studio/pixels.js`]),
    );
    baseline = await bundle(path.join(dir, "renderer.js"));
  }
  const input = createCanvas(1920, 1080),
    ctx = input.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 1920, 1080);
  gradient.addColorStop(0, "#101215");
  gradient.addColorStop(0.4, "#237acf");
  gradient.addColorStop(0.7, "#d6a558");
  gradient.addColorStop(1, "#f1f2e9");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1920, 1080);
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = i % 2 ? "#a8c682" : "#2e2848";
    ctx.fillRect(i * 64, 200 + (i % 3) * 80, 40, 300);
  }
  function measure(Renderer, c, width) {
    const renderer = new Renderer(),
      canvas = createCanvas(width, (width * 9) / 16),
      times = [];
    for (let i = 0; i < 15; i++) {
      const start = performance.now();
      renderer.render(input, canvas, c, width, (width * 9) / 16);
      if (i >= 3) times.push(performance.now() - start);
    }
    times.sort((a, b) => a - b);
    return times[Math.floor(times.length / 2)];
  }
  const cases = [
    ["Bayer preview", "dither", "ordered", 960],
    ["Bayer 1080p", "dither", "ordered", 1920],
    ["Bayer 4K", "dither", "ordered", 3840],
    ["Floyd 1080p", "dither", "floyd", 1920],
    ["ASCII 1080p", "ascii", "ordered", 1920],
    ["Edges 1080p", "edge", "ordered", 1920],
    ["Halftone 1080p", "halftone", "ordered", 1920],
    ["Crosshatch 1080p", "crosshatch", "ordered", 1920],
  ];
  const rows = cases.map(([name, effect, method, width]) => {
    const c = { ...model.defaults, effect, method };
    const before =
      baseline && !["halftone", "crosshatch"].includes(effect)
        ? measure(baseline.FrameRenderer, c, width)
        : null;
    const after = measure(current.FrameRenderer, c, width);
    return {
      case: name,
      beforeMs: before && +before.toFixed(2),
      afterMs: +after.toFixed(2),
      speedup: before && +(before / after).toFixed(2),
    };
  });
  console.log(
    JSON.stringify(
      {
        runtime:
          "Node + Skia Canvas; warmed median of 12 frames; excludes video decode and encode",
        cellSize: 8,
        baseline: ref || null,
        results: rows,
      },
      null,
      2,
    ),
  );
} finally {
  await rm(dir, { recursive: true, force: true });
}
