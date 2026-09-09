import { FrameRenderer, SVGContext } from "./renderer";
import { canvasBlob } from "./canvas";
const renderer = new FrameRenderer();
const canvas = new OffscreenCanvas(1, 1);
let fontKey = "";
self.onmessage = async ({ data }) => {
  const {
    id,
    bitmap,
    config,
    width,
    height,
    time,
    reset,
    flatten,
    format,
    font,
    matte,
    echoFrames,
  } = data;
  try {
    if (font && font.key !== fontKey) {
      const face = new FontFace(font.name, font.buffer);
      await face.load();
      self.fonts.add(face);
      fontKey = font.key;
    }
    if (matte !== undefined) renderer.setMatte(matte);
    if (reset) renderer.invalidate();
    const context =
      format === "svg" ? new SVGContext(width, height, data.fontFace) : null;
    const started = performance.now();
    renderer.render(
      bitmap,
      canvas,
      config,
      width,
      height,
      context,
      time,
      flatten,
      echoFrames,
    );
    const elapsed = performance.now() - started;
    if (format) {
      const blob = context
        ? new Blob([await context.serializeAsync()], { type: "image/svg+xml" })
        : await canvasBlob(canvas);
      self.postMessage({ id, blob, elapsed });
    } else {
      const result = canvas.transferToImageBitmap();
      self.postMessage({ id, bitmap: result, elapsed }, [result]);
    }
  } catch (error) {
    self.postMessage({ id, error: error.message });
  } finally {
    bitmap?.close();
    echoFrames?.forEach((frame) => frame.bitmap?.close());
  }
};
