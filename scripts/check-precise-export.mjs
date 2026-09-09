// Real codec integration check. Native test adapters are never shipped to browsers.
import "@napi-rs/webcodecs/polyfill";
import { createCanvas, ImageData } from "@napi-rs/canvas";
import { build } from "vite";
import { mkdir, mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import assert from "node:assert/strict";
const root = process.cwd();
const cache = path.join(root, "node_modules/.cache");
await mkdir(cache, { recursive: true });
const dir = await mkdtemp(path.join(cache, "dither-encode-"));
const frameCanvases = new WeakMap();
const NativeFrame = globalThis.VideoFrame;
globalThis.VideoFrame = new Proxy(NativeFrame, {
  construct(Target, args) {
    const frame = new Target(...args);
    if (frameCanvases.has(args[0]))
      frameCanvases.set(frame, frameCanvases.get(args[0]));
    return frame;
  },
});
const cloneFrame = NativeFrame.prototype.clone;
NativeFrame.prototype.clone = function () {
  const clone = cloneFrame.call(this);
  if (frameCanvases.has(this))
    frameCanvases.set(clone, frameCanvases.get(this));
  return clone;
};
const NativeDecoder = globalThis.VideoDecoder;
class CanvasDecoder extends NativeDecoder {
  constructor(init) {
    const pending = new Set();
    super({
      ...init,
      output: (frame) => {
        const task = (async () => {
          const bytes = new Uint8Array(
            frame.displayWidth * frame.displayHeight * 4,
          );
          await frame.copyTo(bytes, { format: "RGBA" });
          const canvas = createCanvas(frame.displayWidth, frame.displayHeight);
          canvas
            .getContext("2d")
            .putImageData(
              new ImageData(
                new Uint8ClampedArray(bytes),
                canvas.width,
                canvas.height,
              ),
              0,
              0,
            );
          frameCanvases.set(frame, canvas);
          init.output(frame);
        })();
        pending.add(task);
        task.finally(() => pending.delete(task));
      },
    });
    this.pending = pending;
  }
  async flush() {
    await super.flush();
    await Promise.all(this.pending);
  }
}
globalThis.VideoDecoder = CanvasDecoder;
const contextPrototype = createCanvas(1, 1).getContext("2d").constructor
  .prototype;
globalThis.CanvasRenderingContext2D = contextPrototype.constructor;
globalThis.OffscreenCanvasRenderingContext2D = contextPrototype.constructor;
const nativeDraw = contextPrototype.drawImage;
contextPrototype.drawImage = function (source, ...args) {
  return nativeDraw.call(this, frameCanvases.get(source) || source, ...args);
};
globalThis.document = { createElement: () => createCanvas(1, 1) };
globalThis.HTMLCanvasElement = createCanvas(1, 1).constructor;
globalThis.OffscreenCanvas = globalThis.HTMLCanvasElement;
globalThis.ImageData = ImageData;
async function bundle(entry, name) {
  const result = await build({
    configFile: false,
    logLevel: "silent",
    build: {
      write: false,
      minify: false,
      lib: { entry, formats: ["es"] },
      rolldownOptions: { external: ["mediabunny"] },
    },
  });
  const code = (Array.isArray(result) ? result[0] : result).output.find(
    (x) => x.type === "chunk" && x.isEntry,
  ).code;
  const file = path.join(dir, name + ".mjs");
  await writeFile(file, code);
  return import(file);
}
// Native codec callbacks do not keep Node's event loop alive on every platform.
// Keep this check alive until completion, and fail boundedly if a codec stalls.
const watchdog = setTimeout(() => {
  throw new Error("Precise export integration check exceeded 120 seconds.");
}, 120_000);
try {
  const { exportPrecise } = await bundle(
    path.join(root, "src/studio/precise-export.js"),
    "export",
  );
  const { defaults, looks } = await bundle(
    path.join(root, "src/studio/model.js"),
    "model",
  );
  const fixture = path.join(dir, "input.mp4");
  execFileSync("ffmpeg", [
    "-v",
    "error",
    "-f",
    "lavfi",
    "-i",
    "testsrc2=size=320x180:rate=30",
    "-f",
    "lavfi",
    "-i",
    "aevalsrc=0.3*sin(2*PI*440*t)*(between(t\\,0.75\\,1.0)+between(t\\,1.75\\,2.0)):s=48000",
    "-t",
    "3",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    fixture,
  ]);
  const source = {
    kind: "video",
    file: new Blob([await readFile(fixture)]),
    width: 320,
    height: 180,
  };
  const results = [];
  for (const format of ["mp4", "webm"]) {
    const config = {
      ...looks.find(
        (look) =>
          look.name === (format === "mp4" ? "Overprint" : "Carbon echoes"),
      ).config,
      ...(format === "mp4" ? { cropX: 0.21875, cropWidth: 0.5625 } : {}),
    };
    console.log(
      `Checking ${format}: ${config.effect}, crop ${config.cropWidth}, echoes ${config.echoCount}`,
    );
    const started = performance.now();
    const output = await exportPrecise({
      source,
      config,
      resolution: "native",
      format,
      fps: 30,
      start: 0.5,
      end: 2.5,
      includeAudio: true,
    });
    console.log(
      `Encoded ${format} in ${Math.round(performance.now() - started)} ms`,
    );
    const file = path.join(dir, "result." + output.extension);
    await writeFile(file, new Uint8Array(await output.blob.arrayBuffer()));
    const probe = JSON.parse(
      execFileSync(
        "ffprobe",
        [
          "-v",
          "error",
          "-count_frames",
          "-show_streams",
          "-show_format",
          "-of",
          "json",
          file,
        ],
        { encoding: "utf8" },
      ),
    );
    const video = probe.streams.find((s) => s.codec_type === "video"),
      audio = probe.streams.find((s) => s.codec_type === "audio");
    assert.equal(video.width, format === "mp4" ? 180 : 320);
    assert.equal(video.height, 180);
    assert.equal(Number(video.nb_read_frames), 60);
    assert.ok(audio, "Source audio is present");
    assert.ok(
      Math.abs(Number(probe.format.duration) - 2) < 0.06,
      "Trim is accurate within audio packet padding",
    );
    // Decode all frames and audio so a valid header alone cannot pass.
    execFileSync("ffmpeg", [
      "-v",
      "error",
      "-i",
      file,
      "-map",
      "0:v:0",
      "-f",
      "null",
      "-",
    ]);
    const pcm = execFileSync("ffmpeg", [
      "-v",
      "error",
      "-i",
      file,
      "-map",
      "0:a:0",
      "-ac",
      "1",
      "-ar",
      "48000",
      "-f",
      "f32le",
      "-",
    ]);
    const level = (t) => {
      let sum = 0;
      for (
        let i = Math.round(t * 48000);
        i < Math.round((t + 0.08) * 48000);
        i++
      )
        sum += pcm.readFloatLE(i * 4) ** 2;
      return Math.sqrt(sum / (0.08 * 48000));
    };
    assert.ok(
      level(0.35) > 0.1 && level(1.35) > 0.1,
      "Both audio pulses align after trimming",
    );
    assert.ok(
      level(0.1) < 0.02 && level(0.8) < 0.02 && level(1.8) < 0.02,
      "Silence between audio pulses is preserved",
    );
    results.push({
      effect: config.effect,
      format: output.extension,
      video: video.codec_name,
      audio: audio.codec_name,
      frames: Number(video.nb_read_frames),
      duration: Number(probe.format.duration),
      size: output.blob.size,
      elapsedMs: Math.round(performance.now() - started),
    });
  }
  // Cancellation must reject cleanly and allow the next export to succeed.
  const controller = new AbortController();
  await assert.rejects(
    exportPrecise({
      source,
      config: defaults,
      resolution: "native",
      format: "mp4",
      fps: 30,
      start: 0,
      end: 3,
      signal: controller.signal,
      onProgress: (p) => {
        if (p > 0.05) controller.abort();
      },
    }),
    { name: "AbortError" },
  );
  const recovery = await exportPrecise({
    source: { kind: "demo", width: 180, height: 320 },
    config: {
      ...looks.find((look) => look.name === "Wayfinding").config,
      maskMode: "luminance",
      maskBackdrop: true,
    },
    resolution: "native",
    format: "mp4",
    fps: 60,
    start: 0,
    end: 0.25,
    includeAudio: false,
  });
  const recoveryFile = path.join(dir, "portrait.mp4");
  await writeFile(
    recoveryFile,
    new Uint8Array(await recovery.blob.arrayBuffer()),
  );
  const recoveryProbe = JSON.parse(
    execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-count_frames",
        "-show_streams",
        "-of",
        "json",
        recoveryFile,
      ],
      { encoding: "utf8" },
    ),
  );
  assert.equal(recoveryProbe.streams[0].width, 180);
  assert.equal(recoveryProbe.streams[0].height, 320);
  assert.equal(Number(recoveryProbe.streams[0].nb_read_frames), 15);
  results.push({
    case: "cancel and recover; portrait 60 fps",
    frames: 15,
    width: 180,
    height: 320,
    duration: 0.25,
  });
  console.log(
    JSON.stringify(
      {
        test: "Actual frame-by-frame pipeline with native WebCodecs test adapters",
        results,
      },
      null,
      2,
    ),
  );
} finally {
  clearTimeout(watchdog);
  await rm(dir, { recursive: true, force: true });
}
