import { makeCanvas } from "./canvas";
import { palettes } from "./model";
import { luma } from "./pixels";
import { drawSource } from "./framing";
export class FinishingRenderer {
  constructor(selection) {
    this.selection = selection;
    this.source = makeCanvas();
    this.echo = makeCanvas();
    this.grain = makeCanvas();
  }
  drawOriginal(ctx, source, c, width, height) {
    this.source.width = width;
    this.source.height = height;
    drawSource(source, this.source.getContext("2d"), c, width, height);
    ctx.drawImage(this.source, 0, 0, width, height);
  }
  echoes(ctx, frames, c, width, height) {
    const colors = palettes[c.echoPalette];
    for (let index = frames.length - 1; index >= 0; index--) {
      const frame = frames[index].bitmap || frames[index].source;
      const w = Math.max(
          1,
          Math.round((480 * width) / Math.max(width, height)),
        ),
        h = Math.max(1, Math.round((480 * height) / Math.max(width, height)));
      const canvas = this.echo;
      canvas.width = w;
      canvas.height = h;
      const ec = canvas.getContext("2d", { willReadFrequently: true });
      drawSource(frame, ec, c, w, h);
      const data = this.selection.apply(
        ec.getImageData(0, 0, w, h).data,
        c,
        w,
        h,
      );
      const color = colors[index % colors.length]
        .match(/[a-f0-9]{2}/gi)
        .map((v) => parseInt(v, 16));
      for (let i = 0; i < data.length; i += 4) {
        if (
          c.maskMode === "none" &&
          luma(data[i], data[i + 1], data[i + 2]) > c.echoThreshold
        )
          data[i + 3] = 0;
        data[i] = color[0];
        data[i + 1] = color[1];
        data[i + 2] = color[2];
        data[i + 3] *= c.echoOpacity;
      }
      ec.putImageData(new ImageData(data, w, h), 0, 0);
      ctx.drawImage(canvas, 0, 0, width, height);
    }
  }
  paper(ctx, c, width, height) {
    if (!c.grain) return;
    const canvas = this.grain;
    // Fixed normalized texture, with no random seed changes between frames.
    const w = Math.max(1, Math.round((960 * width) / Math.max(width, height))),
      h = Math.max(1, Math.round((960 * height) / Math.max(width, height)));
    if (canvas.width !== w || canvas.height !== h || this.amount !== c.grain) {
      canvas.width = w;
      canvas.height = h;
      this.amount = c.grain;
      const pixels = new Uint8ClampedArray(w * h * 4);
      for (let p = 0; p < w * h; p++) {
        let n = Math.imul(p + 1, 374761393);
        n = Math.imul(n ^ (n >>> 13), 1274126177);
        const v = ((n ^ (n >>> 16)) >>> 0) / 4294967296;
        pixels[p * 4] =
          pixels[p * 4 + 1] =
          pixels[p * 4 + 2] =
            v > 0.5 ? 255 : 0;
        pixels[p * 4 + 3] = Math.abs(v - 0.5) * c.grain * 255;
      }
      canvas.getContext("2d").putImageData(new ImageData(pixels, w, h), 0, 0);
    }
    // Grain is clipped to existing alpha in raster; SVG uses a matching mask.
    if (ctx.beginAlphaGrain) ctx.beginAlphaGrain();
    else ctx.globalCompositeOperation = "source-atop";
    ctx.drawImage(canvas, 0, 0, width, height);
    if (ctx.endAlphaGrain) ctx.endAlphaGrain();
    ctx.globalCompositeOperation = "source-over";
  }
}
