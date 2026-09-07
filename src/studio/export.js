import { FrameRenderer, drawSignal, SVGContext } from "./renderer";
import { dimensions } from "./model";
import { seek, checkAbort, abortError } from "./media";
export function recordingFormats(
  recorder = typeof MediaRecorder !== "undefined" ? MediaRecorder : null,
) {
  if (!recorder?.isTypeSupported) return [];
  return [
    ["mp4", ["video/mp4;codecs=avc1,mp4a.40.2", "video/mp4"]],
    [
      "webm",
      [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
      ],
    ],
  ].flatMap(([id, mimes]) => {
    const mime = mimes.find((m) => recorder.isTypeSupported(m));
    return mime ? [{ id, mime, label: id.toUpperCase() }] : [];
  });
}
export function mimeExtension(mime) {
  if (mime.startsWith("video/mp4")) return "mp4";
  if (mime.startsWith("video/webm")) return "webm";
  throw new Error("The browser returned an unknown recording format.");
}
function sourceFrame(source, time, signalCanvas) {
  return source.kind === "demo"
    ? drawSignal(signalCanvas, time)
    : source.element;
}
export async function exportStill({
  source,
  config,
  resolution,
  format,
  time = 0,
  fontFace = "",
}) {
  if (source.kind === "video") await seek(source.element, time);
  const canvas = document.createElement("canvas"),
    signalCanvas = document.createElement("canvas"),
    renderer = new FrameRenderer();
  const { width, height } = dimensions(source.width, source.height, resolution);
  if (
    format === "svg" &&
    (Math.ceil(1920 / config.cellSize) ** 2 * Math.min(width, height)) /
      Math.max(width, height) >
      250000
  )
    throw new Error(
      "This SVG would contain too many vector cells. Increase cell size or export a PNG.",
    );
  const context =
    format === "svg" ? new SVGContext(width, height, fontFace) : null;
  renderer.render(
    sourceFrame(source, time, signalCanvas),
    canvas,
    { ...config, smooth: 1 },
    width,
    height,
    context,
  );
  if (context)
    return {
      blob: new Blob([context.serialize()], { type: "image/svg+xml" }),
      extension: "svg",
      width,
      height,
    };
  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b
          ? resolve(b)
          : reject(
              new Error(
                "The image could not be exported. Try a smaller resolution.",
              ),
            ),
      "image/png",
    ),
  );
  return { blob, extension: "png", width, height };
}
export async function recordVideo({
  source,
  config,
  resolution,
  format,
  fps,
  start,
  end,
  audioStream,
  signal,
  onProgress,
}) {
  checkAbort(signal);
  const canvas = document.createElement("canvas"),
    signalCanvas = document.createElement("canvas"),
    renderer = new FrameRenderer();
  if (!canvas.captureStream)
    throw new Error(
      "Video recording is unavailable in this browser. You can still export PNG, SVG, and GIF.",
    );
  const { width, height } = dimensions(
    source.width,
    source.height,
    resolution,
    true,
  );
  if (source.kind === "video") {
    source.element.pause();
    await seek(source.element, start, signal);
  }
  const render = (time) =>
    renderer.render(
      sourceFrame(source, time, signalCanvas),
      canvas,
      config,
      width,
      height,
      null,
      time,
    );
  render(start);
  checkAbort(signal);
  const stream = canvas.captureStream(fps);
  let recorder;
  try {
    if (audioStream)
      audioStream.getAudioTracks().forEach((t) => stream.addTrack(t.clone()));
    recorder = new MediaRecorder(stream, {
      mimeType: format.mime,
      videoBitsPerSecond: Math.min(
        60000000,
        Math.max(4000000, width * height * fps * 0.22),
      ),
      audioBitsPerSecond: 192000,
    });
  } catch (e) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error(
      "This resolution or recording format is not supported. Try 1080p or another format.",
    );
  }
  return new Promise((resolve, reject) => {
    let raf = 0,
      timer = 0,
      bytes = 0,
      error = null,
      settled = false,
      startClock = 0,
      lastRender = -Infinity,
      lastMediaTime = start,
      lastMovement = performance.now(),
      frames = 0;
    const chunks = [];
    const cleanup = () => {
      clearTimeout(raf);
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      document.removeEventListener("visibilitychange", visibility);
      if (source.kind === "video") source.element.pause();
      stream.getTracks().forEach((t) => t.stop());
    };
    const finishError = (e) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(e);
    };
    const stop = (e) => {
      if (e) error = e;
      clearTimeout(raf);
      if (recorder.state !== "inactive") {
        recorder.stop();
        if (!settled)
          timer = setTimeout(
            () =>
              finishError(
                error ||
                  new Error("Recording did not finish. Try a shorter clip."),
              ),
            10000,
          );
      } else finishError(error || new Error("Recording stopped unexpectedly."));
    };
    const abort = () => stop(abortError());
    const visibility = () => {
      if (document.hidden)
        stop(
          new Error(
            "Export stopped because this tab was hidden. Keep Dither visible and your device awake during export.",
          ),
        );
    };
    recorder.ondataavailable = (e) => {
      if (e.data.size) {
        chunks.push(e.data);
        bytes += e.data.size;
        if (bytes > 512 * 1024 * 1024)
          stop(
            new Error(
              "Export reached the 512 MB memory limit. Use a shorter trim or lower resolution.",
            ),
          );
      }
    };
    recorder.onerror = (e) =>
      stop(
        new Error(
          e.error?.message ||
            "The browser could not encode this video. Try a lower resolution.",
        ),
      );
    recorder.onstop = async () => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) {
        reject(error);
        return;
      }
      const elapsed = performance.now() - startClock;
      const mime = recorder.mimeType || format.mime;
      let blob = new Blob(chunks, { type: mime });
      if (!blob.size) {
        reject(
          new Error(
            "The browser produced an empty recording. Try another format.",
          ),
        );
        return;
      }
      try {
        if (mime.startsWith("video/webm")) {
          const { default: fixDuration } = await import("fix-webm-duration");
          blob = await fixDuration(blob, elapsed, { logger: false });
        }
        checkAbort(signal);
      } catch (e) {
        reject(e);
        return;
      }
      resolve({
        blob,
        extension: mimeExtension(mime),
        width,
        height,
        frames,
        duration: end - start,
        actualFps: Math.min(fps, frames / (end - start)),
        targetFps: fps,
      });
    };
    signal?.addEventListener("abort", abort, { once: true });
    document.addEventListener("visibilitychange", visibility);
    const frame = (now) => {
      if (error || settled) return;
      try {
        const time =
          source.kind === "video"
            ? source.element.currentTime
            : start + (now - startClock) / 1000;
        if (source.kind === "video") {
          if (Math.abs(time - lastMediaTime) > 0.01) {
            lastMovement = now;
            lastMediaTime = time;
          } else if (now - lastMovement > 15000) {
            stop(
              new Error(
                "Video playback stalled during export. Try a smaller file.",
              ),
            );
            return;
          }
        }
        if (now - lastRender >= 1000 / fps - 0.5) {
          render(Math.min(time, end));
          lastRender = now;
          frames++;
          onProgress?.(Math.min(1, (time - start) / (end - start)));
        }
        if (time >= end || source.element?.ended) {
          stop();
          return;
        }
        raf = setTimeout(
          () => frame(performance.now()),
          Math.max(1, 1000 / fps - (performance.now() - now)),
        );
      } catch (e) {
        stop(e);
      }
    };
    (async () => {
      try {
        checkAbort(signal);
        recorder.start(1000);
        startClock = performance.now();
        lastMovement = startClock;
        if (source.kind === "video") {
          source.element.loop = false;
          source.element.playbackRate = 1;
          await source.element.play();
        }
        checkAbort(signal);
        raf = setTimeout(() => frame(performance.now()), 0);
      } catch (e) {
        stop(e);
      }
    })();
  });
}
// GIF stores centiseconds. Round cumulative timestamps so errors do not accumulate.
export function gifFrameDelay(frame, fps, duration) {
  return Math.max(
    10,
    (Math.round(Math.min(duration, (frame + 1) / fps) * 100) -
      Math.round((frame / fps) * 100)) *
      10,
  );
}
export function gifBudget(width, height, seconds, fps) {
  return width * height * Math.ceil(seconds * fps) <= 60000000 && seconds <= 30;
}
export async function exportGIF({
  source,
  config,
  resolution,
  start,
  end,
  fps = 12,
  signal,
  onProgress,
}) {
  checkAbort(signal);
  const { default: GIF } = await import("gif.js/dist/gif.js");
  checkAbort(signal);
  const { width, height } = dimensions(
    source.width,
    source.height,
    String(Math.min(720, Number(resolution) || 720)),
  );
  if (!gifBudget(width, height, end - start, fps))
    throw new Error(
      "This GIF is too large for browser memory. Shorten the trim or use 480 px / 10 fps.",
    );
  const canvas = document.createElement("canvas"),
    signalCanvas = document.createElement("canvas"),
    renderer = new FrameRenderer();
  const gif = new GIF({
    workers: 2,
    quality: 10,
    width,
    height,
    repeat: 0,
    workerScript: `${import.meta.env.BASE_URL}gif.worker.js`,
  });
  const count = Math.ceil((end - start) * fps);
  try {
    for (let frame = 0; frame < count; frame++) {
      checkAbort(signal);
      const time = start + frame / fps;
      if (source.kind === "video") await seek(source.element, time, signal);
      renderer.render(
        sourceFrame(source, time, signalCanvas),
        canvas,
        { ...config, transparent: false },
        width,
        height,
        null,
        time,
      );
      gif.addFrame(canvas, {
        copy: true,
        delay: gifFrameDelay(frame, fps, end - start),
      });
      onProgress?.((frame / count) * 0.65);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    checkAbort(signal);
    const blob = await new Promise((resolve, reject) => {
      let timer;
      const clean = () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
      };
      const abort = () => {
        clean();
        gif.abort();
        reject(abortError());
      };
      timer = setTimeout(() => {
        clean();
        gif.abort();
        reject(new Error("GIF encoding timed out. Try a shorter clip."));
      }, 120000);
      signal?.addEventListener("abort", abort, { once: true });
      gif.on("progress", (p) => onProgress?.(0.65 + p * 0.35));
      gif.on("finished", (b) => {
        clean();
        resolve(b);
      });
      gif.render();
    });
    return { blob, extension: "gif", width, height };
  } finally {
    gif.abort();
    [...(gif.freeWorkers || []), ...(gif.activeWorkers || [])].forEach((w) =>
      w.terminate(),
    );
  }
}
