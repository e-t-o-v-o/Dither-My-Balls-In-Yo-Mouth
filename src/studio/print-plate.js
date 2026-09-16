import { makeCanvas } from "./canvas";
import { rgb } from "./pixels";

const littleEndian = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
// Small raster marks are composited in one reusable buffer, then uploaded once.
// This avoids thousands of canvas drawImage/fillRect calls per video frame.
// SVG continues to use the original geometry, not this raster acceleration.
export class PrintPlate {
  constructor() {
    this.canvas = makeCanvas();
    this.masks = new Map();
    this.colors = new Map();
  }
  begin(width, height) {
    this.width = width; this.height = height;
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    if (this.image?.width !== width || this.image?.height !== height) {
      this.image = new ImageData(new Uint8ClampedArray(width * height * 4), width, height);
      this.pixels = this.image.data;
      this.words = new Uint32Array(this.pixels.buffer);
    } else this.words.fill(0);
  }
  color(ink) {
    let color = this.colors.get(ink);
    if (!color) {
      color = ink[0] === "#" ? rgb(ink) : ink.slice(4, -1).split(",").map(Number);
      if (this.colors.size >= 32768) this.colors.clear();
      this.colors.set(ink, color);
    }
    return color;
  }
  rect(x, y, width, height, ink) {
    const [r, g, b] = this.color(ink), value = littleEndian ? (255 << 24) | (b << 16) | (g << 8) | r : (r << 24) | (g << 16) | (b << 8) | 255;
    const x0 = Math.max(0, Math.round(x)), y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.width, Math.round(x + width)), y1 = Math.min(this.height, Math.round(y + height));
    if (x0 >= x1 || y0 >= y1) return;
    for (let yy = y0; yy < y1; yy++) this.words.fill(value, yy * this.width + x0, yy * this.width + x1);
  }
  stamp(key, x, y, size, ink, draw) {
    if (size <= 0) return;
    const diameter = Math.max(.5, Math.round(size * 4) / 4), id = `${key}/${diameter}`;
    let mask = this.masks.get(id);
    if (!mask) {
      const tile = makeCanvas(Math.ceil(diameter) + 4, Math.ceil(diameter) + 4), ctx = tile.getContext("2d", { willReadFrequently: true });
      ctx.fillStyle = ctx.strokeStyle = "#ffffff";
      draw(ctx, tile.width / 2, tile.height / 2, diameter);
      const bytes = ctx.getImageData(0, 0, tile.width, tile.height).data, points = [];
      for (let yy = 0; yy < tile.height; yy++) for (let xx = 0; xx < tile.width; xx++) {
        const a = bytes[(yy * tile.width + xx) * 4 + 3];
        if (a) points.push(xx, yy, a);
      }
      mask = { size: tile.width, points: new Uint16Array(points) };
      if (this.masks.size >= 512) this.masks.clear();
      this.masks.set(id, mask);
    }
    const ox = Math.round(x - mask.size / 2), oy = Math.round(y - mask.size / 2), p = this.pixels;
    const [r, g, b] = this.color(ink);
    for (let k = 0; k < mask.points.length; k += 3) {
      const xx = ox + mask.points[k], yy = oy + mask.points[k + 1];
      if (xx < 0 || yy < 0 || xx >= this.width || yy >= this.height) continue;
      const i = (yy * this.width + xx) * 4, coverage = mask.points[k + 2];
      if (coverage === 255 || !p[i + 3]) { p[i] = r; p[i + 1] = g; p[i + 2] = b; p[i + 3] = coverage; }
      else {
        const a = coverage / 255, old = p[i + 3] / 255 * (1 - a), out = a + old;
        p[i] = (r * a + p[i] * old) / out;
        p[i + 1] = (g * a + p[i + 1] * old) / out;
        p[i + 2] = (b * a + p[i + 2] * old) / out;
        p[i + 3] = out * 255;
      }
    }
  }
  finish(ctx) {
    this.canvas.getContext("2d").putImageData(this.image, 0, 0);
    ctx.drawImage(this.canvas, 0, 0);
  }
}
