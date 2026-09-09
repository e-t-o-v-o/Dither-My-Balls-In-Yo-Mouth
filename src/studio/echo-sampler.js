import { makeCanvas } from "./canvas";
import { drawSignal } from "./renderer";
import {
  checkAbort,
  createVideoElement,
  waitForMedia,
  seek,
  releaseSource,
} from "./media";
export const echoTimes = (time, count, spacing) =>
  Array.from(
    { length: count },
    (_, i) =>
      Math.round(
        (Math.floor((time + 1e-7) / spacing) - i - 1) * spacing * 1e6,
      ) / 1e6,
  ).filter((t) => t >= 0);

// Echoes sample a fixed media-time grid, independent of preview/export fps.
// Small cached source frames bound memory and avoid decoding on every render.
export class EchoSampler {
  constructor(source) {
    this.source = source;
    this.cache = new Map();
    this.controller = new AbortController();
  }
  async frames(time, config, signal) {
    signal ||= this.controller.signal;
    checkAbort(signal);
    if (
      !config.echoCount ||
      this.source.kind === "image" ||
      this.source.kind === "camera"
    )
      return [];
    if (this.source.kind === "video" && !this.sink) {
      const m = await import("mediabunny");
      checkAbort(signal);
      this.input = new m.Input({
        source: new m.BlobSource(this.source.file),
        formats: m.ALL_FORMATS,
      });
      const track = await this.input.getPrimaryVideoTrack();
      if (track && (await track.canDecode())) {
        this.sink = new m.CanvasSink(track, {
          width: Math.max(
            1,
            Math.round(
              (480 * this.source.width) /
                Math.max(this.source.width, this.source.height),
            ),
          ),
          alpha: true,
          poolSize: 2,
        });
      } else {
        this.input.dispose();
        this.input = null;
        this.video = createVideoElement();
        const ready = waitForMedia(this.video, "loadeddata", signal);
        this.video.src =
          this.source.url || (this.url = URL.createObjectURL(this.source.file));
        await ready;
        this.sink = {
          getCanvas: async (at) => {
            await seek(this.video, at, signal);
            return { canvas: this.video };
          },
        };
      }
      checkAbort(this.controller.signal);
    }
    const frames = [];
    for (const at of echoTimes(time, config.echoCount, config.echoSpacing)) {
      checkAbort(signal);
      let canvas = this.cache.get(at);
      if (!canvas) {
        const frame =
          this.source.kind === "demo"
            ? drawSignal(makeCanvas(), at)
            : (await this.sink.getCanvas(at))?.canvas;
        if (!frame) continue;
        canvas = makeCanvas(
          Math.max(
            1,
            Math.round(
              (480 * this.source.width) /
                Math.max(this.source.width, this.source.height),
            ),
          ),
          Math.max(
            1,
            Math.round(
              (480 * this.source.height) /
                Math.max(this.source.width, this.source.height),
            ),
          ),
        );
        canvas
          .getContext("2d")
          .drawImage(frame, 0, 0, canvas.width, canvas.height);
        this.cache.set(at, canvas);
      }
      frames.push({ time: at, source: canvas });
    }
    const keep = new Set(frames.map((f) => f.time));
    for (const [key, canvas] of this.cache)
      if (!keep.has(key)) {
        canvas.width = canvas.height = 1;
        this.cache.delete(key);
      }
    return frames;
  }
  dispose() {
    this.controller.abort();
    this.input?.dispose();
    if (this.video) releaseSource({ element: this.video, url: this.url });
    this.cache.clear();
  }
}
