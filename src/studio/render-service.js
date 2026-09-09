import { FrameRenderer, SVGContext } from "./renderer";
import { makeCanvas, canvasBlob } from "./canvas";
import { checkAbort, abortError } from "./media";

// One request in flight per service provides backpressure. Preview and export
// use separate services so cancelling one cannot disturb the other.
export class RenderService {
  constructor() {
    this.renderer = null;
    this.worker = null;
    this.disabled = false;
    this.sequence = 0;
    this.reset = true;
    this.assets = "";
    this.capture = makeCanvas();
  }
  invalidate() {
    this.reset = true;
    this.renderer?.invalidate();
  }
  dispose() {
    this.disposed = true;
    this.worker?.terminate();
    this.worker = null;
    this.pending?.reject(abortError());
    this.pending = null;
    this.matte?.close?.();
    this.matte = null;
  }
  async render(source, destination, config, width, height, options = {}) {
    const {
      signal,
      time = null,
      flatten = false,
      format,
      font,
      fontFace = "",
      echoFrames,
    } = options;
    checkAbort(signal);
    if (this.disposed) throw abortError();
    if (this.pending) throw new Error("A frame is already being rendered.");
    if (
      !this.disabled &&
      typeof Worker !== "undefined" &&
      typeof OffscreenCanvas !== "undefined" &&
      typeof createImageBitmap === "function"
    ) {
      if (!this.worker) {
        this.worker = new Worker(
          new URL("./render-worker.js", import.meta.url),
          { type: "module" },
        );
        this.assets = "";
        this.sentFont = "";
        this.reset = true;
        this.worker.onmessage = ({ data }) => {
          const pending = this.pending;
          if (pending?.id !== data.id) {
            data.bitmap?.close();
            return;
          }
          this.pending = null;
          data.error
            ? pending.reject(new Error(data.error))
            : pending.resolve(data);
        };
        this.worker.onerror = () => {
          this.disabled = true;
          const pending = this.pending;
          this.pending = null;
          this.worker?.terminate();
          this.worker = null;
          pending?.reject(
            new Error(
              "Worker rendering is unavailable. Using compatibility rendering.",
            ),
          );
        };
      }
      const bitmap = await this.bitmap(source);
      let matte;
      if ((config.maskImage || "") !== this.assets) {
        matte = config.maskImage
          ? await createImageBitmap(
              await (await fetch(config.maskImage)).blob(),
            )
          : null;
        this.assets = config.maskImage || "";
      }
      const frames = [];
      for (const frame of echoFrames || [])
        frames.push({
          time: frame.time,
          bitmap: await this.bitmap(frame.bitmap || frame.source),
        });
      if (signal?.aborted || this.disposed) {
        bitmap.close();
        matte?.close();
        frames.forEach((f) => f.bitmap.close());
        throw abortError();
      }
      const id = ++this.sequence;
      const abort = () => {
        this.dispose();
      };
      signal?.addEventListener("abort", abort, { once: true });
      try {
        const reset = this.reset;
        this.reset = false;
        const result = await new Promise((resolve, reject) => {
          this.pending = { id, resolve, reject };
          const sendFont =
            font && this.sentFont !== font.key ? font : undefined;
          if (sendFont) this.sentFont = font.key;
          try {
            this.worker.postMessage(
              {
                id,
                bitmap,
                config: { ...config, maskImage: "" },
                width,
                height,
                time,
                reset,
                flatten,
                format,
                font: sendFont,
                fontFace,
                matte,
                echoFrames: frames.length ? frames : undefined,
              },
              [
                bitmap,
                ...(matte ? [matte] : []),
                ...frames.map((f) => f.bitmap),
              ],
            );
          } catch (error) {
            this.pending = null;
            this.reset = true;
            this.assets = "";
            this.sentFont = "";
            bitmap.close();
            matte?.close();
            frames.forEach((frame) => frame.bitmap.close());
            reject(error);
          }
        });
        checkAbort(signal);
        if (result.bitmap) {
          destination.width = width;
          destination.height = height;
          const ctx = destination.getContext("2d");
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(result.bitmap, 0, 0);
          result.bitmap.close();
        }
        return { ...result, backend: "worker" };
      } catch (error) {
        if (!this.disabled || signal?.aborted) throw error;
        // An unavailable worker falls back using the original, still-owned source.
      } finally {
        signal?.removeEventListener("abort", abort);
      }
    }
    checkAbort(signal);
    // Give the browser an opportunity to deliver cancellation before a frame.
    await new Promise((resolve) => setTimeout(resolve, 0));
    checkAbort(signal);
    if (this.disposed) throw abortError();
    this.renderer ||= new FrameRenderer();
    if ((config.maskImage || "") !== this.mainAssets) {
      this.matte?.close?.();
      this.matte = config.maskImage
        ? await this.decodeMatte(config.maskImage)
        : null;
      this.renderer.setMatte(this.matte);
      this.mainAssets = config.maskImage || "";
    }
    if (this.reset) this.renderer.invalidate();
    this.reset = false;
    const context =
      format === "svg" ? new SVGContext(width, height, fontFace) : null;
    const started = performance.now();
    this.renderer.render(
      source,
      destination,
      config,
      width,
      height,
      context,
      time,
      flatten,
      echoFrames,
    );
    checkAbort(signal);
    const blob = format
      ? context
        ? new Blob([await context.serializeAsync()], { type: "image/svg+xml" })
        : await canvasBlob(destination)
      : undefined;
    checkAbort(signal);
    return {
      blob,
      elapsed: performance.now() - started,
      backend: "compatibility",
    };
  }
  async decodeMatte(data) {
    if (typeof createImageBitmap === "function")
      return createImageBitmap(await (await fetch(data)).blob());
    const img = new Image();
    img.src = data;
    await img.decode();
    return img;
  }
  async bitmap(source) {
    if (typeof source.draw !== "function") return createImageBitmap(source);
    const w = source.displayWidth || source.width,
      h = source.displayHeight || source.height;
    this.capture.width = w;
    this.capture.height = h;
    source.draw(this.capture.getContext("2d"), 0, 0, w, h);
    return createImageBitmap(this.capture);
  }
}
