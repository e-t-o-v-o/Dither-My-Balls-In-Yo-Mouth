import { drawSignal } from "./renderer";
import { RenderService } from "./render-service";
import { EchoSampler } from "./echo-sampler";
import { checkAbort, abortError } from "./media";
import { planVideoExport } from "./export-plan";
import { createExportTarget } from "./export-storage";
export { hasPreciseExport, videoBitrate } from "./export-plan";

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
  font,
}) {
  checkAbort(signal);
  const plan = await planVideoExport({
    source,
    config,
    resolution,
    format,
    fps,
    start,
    end,
    includeAudio,
    quality,
    signal,
  });
  const m = await import("mediabunny");
  const { width, height, bitrate, codec, extension, duration } = plan;
  const options = { quality: new m.Quality({ bitrate }) };
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const renderer = new RenderService(),
    echoes = new EchoSampler(source);
  const storage = await createExportTarget(m, plan, signal);
  const target = storage.target;
  let completed = false;
  const output = new m.Output({
    format:
      extension === "mp4"
        ? new m.Mp4OutputFormat({
            fastStart: storage.disk ? false : "in-memory",
          })
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
            const echoFrames = await echoes.frames(
              sample.timestamp,
              config,
              signal,
            );
            await renderer.render(sample, canvas, config, width, height, {
              time: sample.timestamp,
              flatten: true,
              signal,
              font,
              echoFrames,
            });
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
        const at = start + frame / fps;
        const echoFrames = await echoes.frames(at, config, signal);
        await renderer.render(
          drawSignal(signalCanvas, start + frame / fps),
          canvas,
          config,
          width,
          height,
          { time: at, flatten: true, signal, font, echoFrames },
        );
        await video.add(frame / fps, Math.min(1 / fps, duration - frame / fps));
        frames++;
        onProgress?.((frames / count) * 0.98);
      }
      video.close();
      await output.finalize();
    } else throw new Error("Live camera input needs Live recording.");
    checkAbort(signal);
    const blob = await storage.blob();
    if (!blob.size) throw new Error("The encoder returned an empty file.");
    onProgress?.(1);
    completed = true;
    return {
      blob,
      cleanup: storage.cleanup,
      diskBacked: storage.disk,
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
    renderer.dispose();
    echoes.dispose();
    if (!completed) await storage.cleanup();
  }
}
