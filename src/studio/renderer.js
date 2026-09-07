import { palettes } from "./model";
import { adjust, dither, edge, rgb, luma, nearest } from "./pixels";
const makeCanvas = () => document.createElement("canvas");
function resize(c, w, h) {
  if (c.width !== w) c.width = w;
  if (c.height !== h) c.height = h;
}
export function drawSignal(canvas, time = 0) {
  resize(canvas, 1280, 720);
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createLinearGradient(0, 0, 1280, 720);
  gradient.addColorStop(0, "#171944");
  gradient.addColorStop(0.35, "#cd5035");
  gradient.addColorStop(0.65, "#f4d4a1");
  gradient.addColorStop(1, "#163f92");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 1280, 720);
  for (let i = 0; i < 8; i++) {
    const x = 640 + Math.sin(time * 0.8 + i * 0.6) * 370,
      y = 340 + Math.cos(time * 0.6 + i * 0.8) * 160;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 200 - i * 15);
    g.addColorStop(0, i % 2 ? "#f4edcb" : "#151629");
    g.addColorStop(1, "transparent");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1280, 720);
  }
  ctx.fillStyle = "#f1f2e9";
  ctx.font = "bold 84px monospace";
  ctx.fillText("DITHER", 72, 138);
  ctx.font = "24px monospace";
  ctx.fillText("MOTION / COLOR / TEXTURE", 76, 180);
  const colors = [
    "#fff",
    "#ddd",
    "#bbb",
    "#999",
    "#777",
    "#555",
    "#333",
    "#111",
  ];
  colors.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(72 + i * 142, 570, 142, 80);
  });
  ctx.fillStyle = "#f1f2e9";
  ctx.font = "18px monospace";
  ctx.fillText("ETOVO   /   TEST SIGNAL 01", 72, 690);
  ctx.fillText(`${time.toFixed(2).padStart(5, "0")} S`, 1090, 690);
  return canvas;
}
export class FrameRenderer {
  constructor() {
    this.sample = makeCanvas();
    this.accum = makeCanvas();
    this.layer = makeCanvas();
    this.reset = true;
  }
  invalidate() {
    this.reset = true;
  }
  render(source, canvas, c, width, height, overrideContext = null) {
    resize(canvas, width, height);
    const ctx = overrideContext || canvas.getContext("2d");
    const long = Math.max(width, height),
      cell = Math.max(1, (c.cellSize * long) / 1920);
    const w = Math.max(1, Math.ceil(width / cell)),
      h = Math.max(1, Math.ceil(height / cell));
    resize(this.sample, w, h);
    const sc = this.sample.getContext("2d", { willReadFrequently: true });
    sc.clearRect(0, 0, w, h);
    sc.imageSmoothingEnabled = true;
    sc.drawImage(source, 0, 0, w, h);
    if (this.accum.width !== w || this.accum.height !== h) {
      resize(this.accum, w, h);
      this.reset = true;
    }
    if (c.smooth < 1) {
      const ac = this.accum.getContext("2d");
      if (this.reset) ac.clearRect(0, 0, w, h);
      ac.globalAlpha = this.reset ? 1 : c.smooth;
      ac.drawImage(this.sample, 0, 0);
      ac.globalAlpha = 1;
      sc.clearRect(0, 0, w, h);
      sc.drawImage(this.accum, 0, 0);
    }
    this.reset = false;
    let data = adjust(sc.getImageData(0, 0, w, h).data, c);
    const original = data,
      palHex = palettes[c.palette],
      pal = palHex.map(rgb);
    if (c.effect === "dither" || c.effect === "dither-ascii")
      data = dither(data, w, h, pal, c.method, c.amount);
    if (c.effect === "edge") data = edge(data, w, h, c.threshold);
    ctx.clearRect(0, 0, width, height);
    if (!c.transparent) {
      ctx.fillStyle = c.bgColor;
      ctx.fillRect(0, 0, width, height);
    }
    if (c.underlay && ["ascii", "dither-ascii"].includes(c.effect)) {
      resize(this.layer, w, h);
      this.layer
        .getContext("2d")
        .putImageData(new ImageData(original, w, h), 0, 0);
      ctx.drawImage(this.layer, 0, 0, width, height);
    }
    const cw = width / w,
      ch = height / h;
    ctx.imageSmoothingEnabled = false;
    ctx.font = `${Math.min(cw, ch) * c.fontScale}px "${c.font}", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const chars = Array.from(c.characters);
    let min = 255,
      max = 0;
    if (c.dynamic)
      for (let i = 0; i < data.length; i += 4) {
        if (!data[i + 3]) continue;
        const l = luma(data[i], data[i + 1], data[i + 2]);
        min = Math.min(min, l);
        max = Math.max(max, l);
      }
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (!data[i + 3]) continue;
        const r = data[i],
          g = data[i + 1],
          b = data[i + 2],
          lum = luma(r, g, b),
          pi = nearest(r, g, b, pal),
          on = lum > c.threshold;
        const brightness =
          c.dynamic && max > min ? (lum - min) / (max - min) : lum / 255;
        const glyph =
          chars[
            Math.min(
              chars.length - 1,
              Math.max(0, Math.floor(brightness * (chars.length - 1))),
            )
          ];
        const color = `rgb(${r},${g},${b})`,
          xx = x * cw,
          yy = y * ch;
        ctx.globalAlpha = data[i + 3] / 255;
        const block = (fill) => {
          ctx.fillStyle = fill;
          ctx.fillRect(xx, yy, cw + 0.02, ch + 0.02);
        };
        const text = (v, fill) => {
          ctx.fillStyle = fill;
          ctx.fillText(v, xx + cw / 2, yy + ch / 2);
        };
        const contrast = luma(...pal[pi]) > 128 ? "#101215" : "#f1f2e9";
        const textColor =
          c.textColor === "source"
            ? `rgb(${original[i]},${original[i + 1]},${original[i + 2]})`
            : c.textColor === "foreground"
              ? c.fgColor
              : palHex[pi];
        switch (c.effect) {
          case "dither":
          case "green-screen":
            block(color);
            break;
          case "dither-ascii":
          case "ascii":
            text(glyph, textColor);
            break;
          case "two-tone":
            if (on || !c.transparent) block(on ? c.fgColor : c.bgColor);
            break;
          case "edge":
            if (r || !c.transparent) block(r ? c.fgColor : c.bgColor);
            break;
          case "binary":
            block(on ? c.fgColor : c.bgColor);
            text(on ? "1" : "0", on ? c.bgColor : c.fgColor);
            break;
          case "binary-char":
            block(on ? c.fgColor : c.bgColor);
            text(
              String(Math.min(9, Math.floor((lum / 256) * 10))),
              on ? c.bgColor : c.fgColor,
            );
            break;
          case "letter-char":
            block(on ? c.fgColor : c.bgColor);
            text(c.char, on ? c.bgColor : c.fgColor);
            break;
          case "letters-palette":
            text(
              String.fromCharCode(
                65 +
                  Math.min(
                    c.letterCount - 1,
                    Math.floor((lum / 256) * c.letterCount),
                  ),
              ),
              textColor,
            );
            break;
          case "decade":
            block(palHex[pi]);
            text(String(pi), contrast);
            break;
          case "palette":
            block(palHex[pi]);
            if (c.overlay === "number") text(String(pi), contrast);
            if (c.overlay === "character") text(c.char, c.fgColor);
            break;
          case "channel": {
            const channel = x < w / 3 ? 0 : x < (2 * w) / 3 ? 1 : 2;
            const sx = Math.min(w - 1, Math.floor((x % (w / 3)) * 3));
            const v = original[(y * w + sx) * 4 + channel];
            block(`rgb(${v},${v},${v})`);
            break;
          }
          default:
            block(color);
        }
      }
    ctx.globalAlpha = 1;
    return canvas;
  }
}
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (ch) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[ch],
  );
export class SVGContext {
  constructor(width, height, fontFace = "") {
    this.width = width;
    this.height = height;
    this.parts = [];
    this.globalAlpha = 1;
    this.fontFace = fontFace;
  }
  clearRect() {}
  fillRect(x, y, w, h) {
    this.parts.push(
      `<rect x="${x.toFixed(3)}" y="${y.toFixed(3)}" width="${w.toFixed(3)}" height="${h.toFixed(3)}" fill="${escape(this.fillStyle)}" opacity="${this.globalAlpha}"/>`,
    );
  }
  fillText(text, x, y) {
    this.parts.push(
      `<text x="${x.toFixed(3)}" y="${y.toFixed(3)}" text-anchor="middle" dominant-baseline="central" style="font:${escape(this.font)}" fill="${escape(this.fillStyle)}" opacity="${this.globalAlpha}">${escape(text)}</text>`,
    );
  }
  drawImage(source, x, y, w, h) {
    this.parts.push(
      `<image x="${x}" y="${y}" width="${w}" height="${h}" href="${source.toDataURL("image/png")}"/>`,
    );
  }
  serialize() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}"><style>${this.fontFace}</style>${this.parts.join("")}</svg>`;
  }
}
