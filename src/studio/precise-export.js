import { FrameRenderer, drawSignal } from "./renderer";
import { dimensions } from "./model";
import { checkAbort, abortError } from "./media";

export const hasPreciseExport = () => typeof VideoEncoder !== "undefined";
export function videoBitrate(width, height, fps, quality = "high") {
  return Math.round(
    Math.min(
      100_000_000,
      Math.max(
        2_000_000,
        width * height * fps * (quality === "maximum" ? 0.5 : 0.28),
      ),
    ),
  );
}
export async function exportPrecise({
  source,
  config,
  resolution,
  format = "auto",
  fps = 30,
  start = 0,
  end,
  includeAudio = true,
  quality = "high",
  signal,
  onProgress,
}) {
  checkAbort(signal);
  if (!hasPreciseExport())
    throw new Error(
      "Frame-by-frame video export is unavailable here. Choose Live recording or use a browser with WebCodecs support.",
    );
  const m = await import("mediabunny");
  checkAbort(signal);
  const { width, height } = dimensions(
    source.width,
    source.height,
    resolution,
    true,
  );
  const bitrate = videoBitrate(width, height, fps, quality);
  const options = { width, height, quality: new m.Quality({ bitrate }) };
  let needsAudio = false;
  if (source.kind === "video" && source.file && includeAudio) {
    const probe = new m.Input({
      source: new m.BlobSource(source.file),
      formats: m.ALL_FORMATS,
    });
    try {
      needsAudio = !!(await probe.getPrimaryAudioTrack());
    } finally {
      probe.dispose();
    }
    checkAbort(signal);
  }
  const aacAvailable = !needsAudio || (await m.canEncodeAudio("aac"));
  const mp4 =
    aacAvailable &&
    format !== "webm" &&
    (await m.canEncodeVideo("avc", options));
  let codec = mp4 ? "avc" : null;
  if (!codec && format !== "mp4") {
    for (const candidate of quality === "maximum"
      ? ["vp9", "vp8"]
      : ["vp8", "vp9"])
      if (await m.canEncodeVideo(candidate, options)) {
        codec = candidate;
        break;
      }
  }
  if (!codec)
    throw new Error(
      "This video format cannot encode at the selected size. Try Auto format, a lower resolution, or Live recording.",
    );
  const extension = codec === "avc" ? "mp4" : "webm";
  const duration = end - start;
  if (
    !(duration > 0) ||
    (duration * (bitrate + 256_000)) / 8 > 450 * 1024 * 1024
  )
    throw new Error(
      "This export may exceed the 512 MB memory limit. Shorten the selection or reduce resolution or quality.",
    );
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const renderer = new FrameRenderer();
  const target = new m.BufferTarget();
  target.on("write", ({ end: byteEnd }) => {
    checkAbort(signal);
    if (byteEnd > 512 * 1024 * 1024)
      throw new Error(
        "Export reached the 512 MB memory limit. Use a shorter selection.",
      );
  });
  const output = new m.Output({
    format:
      extension === "mp4"
        ? new m.Mp4OutputFormat({ fastStart: "in-memory" })
        : new m.WebMOutputFormat(),
    target,
  });
  let input,
    conversion,
    frames = 0;
  let lastYield = performance.now();
  const yieldUI = async () => {
    if (performance.now() - lastYield > 24) {
      await new Promise((r) => setTimeout(r, 0));
      lastYield = performance.now();
    }
    checkAbort(signal);
  };
  const abort = () => {
    void (conversion ? conversion.cancel() : output.cancel()).catch(() => {});
  };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    checkAbort(signal);
    if (source.kind === "video") {
      if (!source.file)
        throw new Error("Reopen your video to use frame-by-frame export.");
      input = new m.Input({
        source: new m.BlobSource(source.file),
        formats: m.ALL_FORMATS,
      });
      conversion = await m.Conversion.init({
        input,
        output,
        tracks: "primary",
        tags: {},
        trim: { start, end },
        video: {
          codec,
          quality: options.quality,
          frameRate: fps,
          keyFrameInterval: 2,
          allowRotationMetadata: false,
          processedWidth: width,
          processedHeight: height,
          process: async (sample) => {
            await yieldUI();
            renderer.render(
              sample,
              canvas,
              { ...config, transparent: false },
              width,
              height,
            );
            frames++;
            return canvas;
          },
        },
        audio: includeAudio
          ? {
              codec: extension === "mp4" ? "aac" : "opus",
              quality: new m.Quality({ bitrate: 192_000 }),
            }
          : { discard: true },
      });
      checkAbort(signal);
      const missing = conversion.discardedTracks.filter(
        (t) => t.reason !== "discarded_by_user",
      );
      if (!conversion.isValid || missing.length)
        throw new Error(
          "This browser cannot decode or encode every selected track. No audio was silently removed. Try another format, turn off source audio, or choose Live recording.",
        );
      if (!conversion.utilizedTracks.some((t) => t.isVideoTrack()))
        throw new Error("No decodable video track was found.");
      conversion.onProgress = (p) => onProgress?.(p * 0.98);
      await conversion.execute();
    } else if (source.kind === "demo") {
      const video = new m.CanvasSource(canvas, {
        codec,
        quality: options.quality,
        keyFrameInterval: 2,
      });
      output.addVideoTrack(video, { frameRate: fps });
      await output.start();
      const signalCanvas = document.createElement("canvas");
      const count = Math.ceil(duration * fps);
      for (let frame = 0; frame < count; frame++) {
        await yieldUI();
        renderer.render(
          drawSignal(signalCanvas, start + frame / fps),
          canvas,
          { ...config, transparent: false },
          width,
          height,
          null,
          start + frame / fps,
        );
        await video.add(frame / fps, Math.min(1 / fps, duration - frame / fps));
        frames++;
        onProgress?.((frames / count) * 0.98);
      }
      video.close();
      await output.finalize();
    } else throw new Error("Live camera input needs Live recording.");
    checkAbort(signal);
    if (!target.buffer?.byteLength)
      throw new Error("The encoder returned an empty file.");
    onProgress?.(1);
    return {
      blob: new Blob([target.buffer], { type: `video/${extension}` }),
      extension,
      width,
      height,
      frames,
      duration,
      targetFps: fps,
      engine: "precise",
      codec,
    };
  } catch (e) {
    if (signal?.aborted) throw abortError();
    throw e;
  } finally {
    signal?.removeEventListener("abort", abort);
    if (output.state !== "finalized" && output.state !== "canceled")
      await output.cancel().catch(() => {});
    input?.dispose();
  }
}
