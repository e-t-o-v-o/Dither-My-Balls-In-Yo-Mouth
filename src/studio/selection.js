import { applyMask } from "./masks";
import { makeCanvas } from "./canvas";
import { drawSource } from "./framing";
export class SelectionRenderer {
  constructor() {
    this.canvas = makeCanvas();
    this.matte = null;
  }
  setMatte(matte) {
    if (this.matte !== matte) this.matte?.close?.();
    this.matte = matte;
  }
  apply(data, config, width, height) {
    if (config.maskMode === "none") return data;
    const strokes = config.maskStrokes || [];
    if (!["manual", "matte"].includes(config.maskMode) && !strokes.length)
      return applyMask(data, config);
    const c = this.canvas;
    c.width = width;
    c.height = height;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    const coverage = new Uint8ClampedArray(data.length);
    if (config.maskMode === "matte" && this.matte) {
      drawSource(this.matte, ctx, config, width, height);
      const pixels = ctx.getImageData(0, 0, width, height).data;
      for (let i = 0; i < pixels.length; i += 4) {
        coverage[i] = coverage[i + 1] = coverage[i + 2] = 255;
        coverage[i + 3] =
          (((pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3) * pixels[i + 3]) /
          255;
      }
    } else if (!["manual", "matte"].includes(config.maskMode)) {
      const selected = applyMask(data, { ...config, maskInvert: false });
      for (let i = 0; i < data.length; i += 4) {
        coverage[i] = coverage[i + 1] = coverage[i + 2] = 255;
        coverage[i + 3] = data[i + 3]
          ? (selected[i + 3] / data[i + 3]) * 255
          : 0;
      }
    }
    ctx.putImageData(new ImageData(coverage, width, height), 0, 0);
    for (const stroke of strokes) {
      ctx.globalCompositeOperation =
        stroke.mode === "subtract" ? "destination-out" : "source-over";
      ctx.fillStyle = ctx.strokeStyle = "#ffffff";
      ctx.lineCap = ctx.lineJoin = "round";
      const points = stroke.points.map(([x, y]) => [
        ((x - config.cropX) / config.cropWidth) * width,
        ((y - config.cropY) / config.cropHeight) * height,
      ]);
      if (!points.length) continue;
      const radius =
        stroke.radius *
        Math.min(width / config.cropWidth, height / config.cropHeight);
      ctx.beginPath();
      ctx.moveTo(...points[0]);
      points.slice(1).forEach((point) => ctx.lineTo(...point));
      if (stroke.tool === "lasso" && points.length > 2) {
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.lineWidth = radius * 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(...points[0], radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = "source-over";
    const selected = ctx.getImageData(0, 0, width, height).data;
    const output = new Uint8ClampedArray(data);
    for (let i = 0; i < data.length; i += 4)
      output[i + 3] =
        data[i + 3] *
        (config.maskInvert ? 1 - selected[i + 3] / 255 : selected[i + 3] / 255);
    return output;
  }
}
