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
    this.glyphs = new Map();
    this.textLayer = makeCanvas();
    this.reset = true;
  }
  invalidate() {
    this.reset = true;
    this.lastTime = null;
  }
  render(
    source,
    canvas,
    c,
    width,
    height,
    overrideContext = null,
    time = source.timestamp ?? null,
  ) {
    resize(canvas, width, height);
    const ctx = overrideContext || canvas.getContext("2d");
    const cell = Math.max(1, (c.cellSize * Math.max(width, height)) / 1920);
    const w = Math.max(1, Math.ceil(width / cell));
    const h = Math.max(1, Math.ceil(height / cell));
    const cw = width / w,
      ch = height / h;
    resize(this.sample, w, h);
    const sc = this.sample.getContext("2d", { willReadFrequently: true });
    sc.clearRect(0, 0, w, h);
    sc.imageSmoothingEnabled = true;
    sc.imageSmoothingQuality = "high";
    if (typeof source.draw === "function") source.draw(sc, 0, 0, w, h);
    else sc.drawImage(source, 0, 0, w, h);
    if (this.accum.width !== w || this.accum.height !== h) {
      resize(this.accum, w, h);
      this.reset = true;
    }
    if (c.smooth < 1) {
      const ac = this.accum.getContext("2d");
      if (this.reset) ac.clearRect(0, 0, w, h);
      const dt =
        time != null && this.lastTime != null
          ? Math.max(0, Math.min(1, time - this.lastTime))
          : 1 / 30;
      ac.globalAlpha = this.reset ? 1 : 1 - (1 - c.smooth) ** (dt * 30);
      ac.drawImage(this.sample, 0, 0);
      ac.globalAlpha = 1;
      sc.clearRect(0, 0, w, h);
      sc.drawImage(this.accum, 0, 0);
    }
    this.lastTime = time;
    this.reset = false;
    let data = adjust(sc.getImageData(0, 0, w, h).data, c);
    const original = data,
      palHex = palettes[c.palette];
    if (this.palette !== c.palette) {
      this.palette = c.palette;
      this.paletteRGB = palHex.map(rgb);
    }
    const pal = this.paletteRGB;
    if (c.effect === "dither" || c.effect === "dither-ascii")
      data = dither(data, w, h, pal, c.method, c.amount);
    if (c.effect === "edge") data = edge(data, w, h, c.threshold);
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, width, height);
    if (!c.transparent) {
      ctx.fillStyle = c.bgColor;
      ctx.fillRect(0, 0, width, height);
    }
    const fg = rgb(c.fgColor),
      bg = rgb(c.bgColor);
    if (!overrideContext && c.effect === "halftone") {
      if (this.shapePixels?.length !== width * height * 4)
        this.shapePixels = new Uint8ClampedArray(width * height * 4);
      const pixels = this.shapePixels;
      const radii = new Float32Array(w * h),
        inverse = new Uint8Array(w * h);
      for (let cell = 0; cell < w * h; cell++) {
        const tone =
          luma(data[cell * 4], data[cell * 4 + 1], data[cell * 4 + 2]) / 255;
        inverse[cell] = tone > 0.5 ? 1 : 0;
        radii[cell] =
          Math.sqrt((Math.min(tone, 1 - tone) * cw * ch) / Math.PI) *
          Math.min(1, c.dotScale);
      }
      // Rasterize dot coverage directly; no per-cell path tessellation.
      for (let yy = 0; yy < height; yy++) {
        const sy = Math.min(h - 1, Math.floor((yy + 0.5) / ch)),
          dy = yy + 0.5 - (sy + 0.5) * ch;
        for (let xx = 0; xx < width; xx++) {
          const sx = Math.min(w - 1, Math.floor((xx + 0.5) / cw)),
            cell = sy * w + sx;
          const radius = radii[cell],
            dx = xx + 0.5 - (sx + 0.5) * cw;
          const dot =
            radius > 0
              ? Math.max(
                  0,
                  Math.min(1, radius + 0.5 - Math.sqrt(dx * dx + dy * dy)),
                )
              : 0;
          const coverage = inverse[cell] ? 1 - dot : dot,
            i = (yy * width + xx) * 4;
          pixels[i] = fg[0];
          pixels[i + 1] = fg[1];
          pixels[i + 2] = fg[2];
          pixels[i + 3] = coverage * data[cell * 4 + 3];
        }
      }
      resize(this.textLayer, width, height);
      this.textLayer
        .getContext("2d")
        .putImageData(new ImageData(pixels, width, height), 0, 0);
      ctx.drawImage(this.textLayer, 0, 0);
      return canvas;
    }
    if (
      !overrideContext &&
      c.effect === "crosshatch" &&
      data.every(
        (value, index) => index % 4 !== 3 || value === 0 || value === 255,
      )
    ) {
      ctx.fillStyle = c.fgColor;
      ctx.strokeStyle = c.fgColor;
      ctx.lineWidth = Math.min(cw, ch) * c.lineWidth;
      ctx.beginPath();
      const solids = [];
      let batch = 0;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          if (!data[i + 3]) continue;
          const darkness = 1 - luma(data[i], data[i + 1], data[i + 2]) / 255,
            xx = x * cw,
            yy = y * ch;
          if (darkness > 0.9) {
            solids.push(xx, yy);
            continue;
          }
          if (darkness > 0.15) {
            ctx.moveTo(xx, yy + ch);
            ctx.lineTo(xx + cw, yy);
          }
          if (darkness > 0.4) {
            ctx.moveTo(xx, yy);
            ctx.lineTo(xx + cw, yy + ch);
          }
          if (darkness > 0.65) {
            ctx.moveTo(xx, yy + ch / 2);
            ctx.lineTo(xx + cw, yy + ch / 2);
          }
          if (++batch >= 128) {
            ctx.stroke();
            ctx.beginPath();
            batch = 0;
          }
        }
      ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i < solids.length; i += 2) {
        ctx.rect(solids[i], solids[i + 1], cw, ch);
        if (i % 256 === 254) {
          ctx.fill();
          ctx.beginPath();
        }
      }
      ctx.fill();
      return canvas;
    }
    const blockEffects = [
      "dither",
      "pixel",
      "palette",
      "two-tone",
      "edge",
      "channel",
    ];
    // A single image upload replaces tens of thousands of rectangle commands.
    if (!overrideContext && blockEffects.includes(c.effect)) {
      const remap = !["dither", "pixel"].includes(c.effect);
      if (remap && this.blockPixels?.length !== data.length)
        this.blockPixels = new Uint8ClampedArray(data.length);
      const pixels = remap ? this.blockPixels : data;
      if (remap)
        for (let y = 0; y < h; y++)
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            let color = data.subarray(i, i + 3),
              alpha = data[i + 3];
            if (c.effect === "palette")
              color = pal[nearest(data[i], data[i + 1], data[i + 2], pal)];
            if (c.effect === "two-tone" || c.effect === "edge") {
              const on =
                c.effect === "edge"
                  ? data[i] > 0
                  : luma(data[i], data[i + 1], data[i + 2]) > c.threshold;
              color = on ? fg : bg;
              if (!on && c.transparent) alpha = 0;
            }
            if (c.effect === "channel") {
              const panel = Math.min(2, Math.floor((x * 3) / w));
              const sx = Math.min(w - 1, Math.floor(((x * 3) / w - panel) * w));
              const si = (y * w + sx) * 4;
              const v = original[si + panel];
              color = [v, v, v];
              alpha = original[si + 3];
            }
            pixels[i] = color[0];
            pixels[i + 1] = color[1];
            pixels[i + 2] = color[2];
            pixels[i + 3] = alpha;
          }
      resize(this.layer, w, h);
      this.layer
        .getContext("2d")
        .putImageData(new ImageData(pixels, w, h), 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.layer, 0, 0, width, height);
      if (!["palette", "two-tone"].includes(c.effect) || c.overlay === "none")
        return canvas;
    }
    if (c.underlay && ["ascii", "dither-ascii"].includes(c.effect)) {
      resize(this.layer, w, h);
      this.layer
        .getContext("2d")
        .putImageData(new ImageData(original, w, h), 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.layer, 0, 0, width, height);
    }
    ctx.font = `${Math.min(cw, ch) * c.fontScale}px "${c.font}", monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const fingerprint = `${ctx.font}/${cw}/${ch}`;
    if (fingerprint !== this.glyphStyle) {
      this.glyphs.clear();
      this.glyphStyle = fingerprint;
    }
    const chars = Array.from(c.characters);
    let min = 255,
      max = 0;
    if (c.dynamic && ["ascii", "dither-ascii"].includes(c.effect))
      for (let i = 0; i < data.length; i += 4)
        if (data[i + 3]) {
          const v = luma(data[i], data[i + 1], data[i + 2]);
          min = Math.min(min, v);
          max = Math.max(max, v);
        }
    const hasText =
      ["ascii", "dither-ascii"].includes(c.effect) ||
      (["palette", "two-tone"].includes(c.effect) && c.overlay !== "none");
    if (
      !overrideContext &&
      hasText &&
      this.textPixels?.length !== width * height * 4
    )
      this.textPixels = new Uint8ClampedArray(width * height * 4);
    const textPixels = !overrideContext && hasText ? this.textPixels : null;
    textPixels?.fill(0);
    const colorCache = new Map(palHex.map((hex, index) => [hex, pal[index]]));
    colorCache.set(c.fgColor, fg);
    colorCache.set(c.bgColor, bg);
    let cellAlpha = 1;
    const drawText = (glyph, fill, x, y) => {
      if (glyph === " ") return;
      if (overrideContext) {
        ctx.fillStyle = fill;
        ctx.fillText(glyph, x, y);
        return;
      }
      let stamp = this.glyphs.get(glyph);
      if (!stamp) {
        const tile = makeCanvas();
        tile.width = Math.max(4, Math.ceil(cw * 4));
        tile.height = Math.max(4, Math.ceil(ch * 4));
        const tc = tile.getContext("2d", { willReadFrequently: true });
        tc.font = ctx.font;
        tc.textAlign = "center";
        tc.textBaseline = "middle";
        tc.fillStyle = "#ffffff";
        tc.fillText(glyph, tile.width / 2, tile.height / 2);
        const mask = tc.getImageData(0, 0, tile.width, tile.height).data;
        const points = [];
        for (let sy = 0; sy < tile.height; sy++)
          for (let sx = 0; sx < tile.width; sx++) {
            const alpha = mask[(sy * tile.width + sx) * 4 + 3];
            if (alpha) points.push(sx, sy, alpha);
          }
        stamp = {
          width: tile.width,
          height: tile.height,
          points: new Uint16Array(points),
        };
        this.glyphs.set(glyph, stamp);
      }
      const color =
        colorCache.get(fill) ||
        (fill[0] === "#"
          ? rgb(fill)
          : fill.slice(4, -1).split(",").map(Number));
      const ox = Math.round(x - stamp.width / 2),
        oy = Math.round(y - stamp.height / 2),
        points = stamp.points;
      // Blit cached glyph coverage in memory, then upload the entire text layer once.
      for (let k = 0; k < points.length; k += 3) {
        const xx = ox + points[k],
          yy = oy + points[k + 1];
        if (xx < 0 || xx >= width || yy < 0 || yy >= height) continue;
        const i = (yy * width + xx) * 4,
          a = (points[k + 2] / 255) * cellAlpha,
          da = textPixels[i + 3] / 255;
        if (da === 0 || a === 1) {
          textPixels[i] = color[0];
          textPixels[i + 1] = color[1];
          textPixels[i + 2] = color[2];
          textPixels[i + 3] = a * 255;
        } else {
          const alpha = a + da * (1 - a),
            contribution = da * (1 - a);
          textPixels[i] = (color[0] * a + textPixels[i] * contribution) / alpha;
          textPixels[i + 1] =
            (color[1] * a + textPixels[i + 1] * contribution) / alpha;
          textPixels[i + 2] =
            (color[2] * a + textPixels[i + 2] * contribution) / alpha;
          textPixels[i + 3] = alpha * 255;
        }
      }
    };
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (!data[i + 3]) continue;
        const r = data[i],
          g = data[i + 1],
          b = data[i + 2];
        const lum = luma(r, g, b),
          on = lum > c.threshold;
        const pi = nearest(r, g, b, pal),
          xx = x * cw,
          yy = y * ch;
        cellAlpha = data[i + 3] / 255;
        if (overrideContext || !textPixels) ctx.globalAlpha = cellAlpha;
        const block = (fill) => {
          ctx.fillStyle = fill;
          ctx.fillRect(xx, yy, cw, ch);
        };
        const text = (glyph, fill) =>
          drawText(glyph, fill, xx + cw / 2, yy + ch / 2);
        const textColor =
          c.textColor === "source"
            ? `rgb(${original[i]},${original[i + 1]},${original[i + 2]})`
            : c.textColor === "foreground"
              ? c.fgColor
              : palHex[pi];
        const contrast = luma(...pal[pi]) > 128 ? "#101215" : "#f1f2e9";
        switch (c.effect) {
          case "ascii":
          case "dither-ascii": {
            const brightness =
              c.dynamic && max > min ? (lum - min) / (max - min) : lum / 255;
            text(
              chars[
                Math.min(
                  chars.length - 1,
                  Math.max(0, Math.round(brightness * (chars.length - 1))),
                )
              ],
              textColor,
            );
            break;
          }
          case "halftone": {
            // Use complementary holes above 50% so black and white remain exact.
            const coverage = lum / 255;
            const inverse = coverage > 0.5;
            const radius =
              Math.sqrt(
                (Math.min(coverage, 1 - coverage) * cw * ch) / Math.PI,
              ) * Math.min(1, c.dotScale);
            ctx.fillStyle = c.fgColor;
            ctx.beginPath();
            if (inverse) ctx.rect(xx, yy, cw, ch);
            if (radius > 0) {
              ctx.moveTo(xx + cw / 2 + radius, yy + ch / 2);
              ctx.arc(xx + cw / 2, yy + ch / 2, radius, 0, Math.PI * 2);
            }
            ctx.fill("evenodd");
            break;
          }
          case "crosshatch": {
            const darkness = 1 - lum / 255;
            if (darkness > 0.9) {
              block(c.fgColor);
              break;
            }
            ctx.strokeStyle = c.fgColor;
            ctx.lineWidth = Math.min(cw, ch) * c.lineWidth;
            ctx.beginPath();
            if (darkness > 0.15) {
              ctx.moveTo(xx, yy + ch);
              ctx.lineTo(xx + cw, yy);
            }
            if (darkness > 0.4) {
              ctx.moveTo(xx, yy);
              ctx.lineTo(xx + cw, yy + ch);
            }
            if (darkness > 0.65) {
              ctx.moveTo(xx, yy + ch / 2);
              ctx.lineTo(xx + cw, yy + ch / 2);
            }
            ctx.stroke();
            break;
          }
          case "two-tone":
          case "edge": {
            const active = c.effect === "edge" ? !!r : on;
            if (overrideContext && (active || !c.transparent))
              block(active ? c.fgColor : c.bgColor);
            if (c.effect === "two-tone" && c.overlay !== "none")
              text(
                c.overlay === "character"
                  ? c.char
                  : c.overlay === "binary"
                    ? on
                      ? "1"
                      : "0"
                    : String(Math.min(9, Math.floor((lum / 256) * 10))),
                on ? c.bgColor : c.fgColor,
              );
            break;
          }
          case "palette":
            if (overrideContext) block(palHex[pi]);
            if (c.overlay === "number") text(String(pi), contrast);
            if (c.overlay === "character") text(c.char, c.fgColor);
            break;
          case "channel": {
            const panel = Math.min(2, Math.floor((x * 3) / w));
            const sx = Math.min(w - 1, Math.floor(((x * 3) / w - panel) * w)),
              si = (y * w + sx) * 4;
            const v = original[si + panel];
            ctx.globalAlpha = original[si + 3] / 255;
            block(`rgb(${v},${v},${v})`);
            break;
          }
          default:
            block(`rgb(${r},${g},${b})`);
        }
      }
    ctx.globalAlpha = 1;
    if (textPixels) {
      resize(this.textLayer, width, height);
      this.textLayer
        .getContext("2d")
        .putImageData(new ImageData(textPixels, width, height), 0, 0);
      ctx.drawImage(this.textLayer, 0, 0);
    }
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
  beginPath() {
    this.path = [];
    this.circle = null;
    this.box = null;
  }
  rect(x, y, w, h) {
    this.box = { x, y, w, h };
  }
  arc(x, y, r) {
    this.circle = { x, y, r };
  }
  fill() {
    if (this.box) {
      const { x, y, w, h } = this.box;
      const outer = `M${x} ${y}h${w}v${h}h${-w}Z`;
      const inner = this.circle
        ? `M${this.circle.x - this.circle.r} ${this.circle.y}a${this.circle.r} ${this.circle.r} 0 1 0 ${2 * this.circle.r} 0a${this.circle.r} ${this.circle.r} 0 1 0 ${-2 * this.circle.r} 0Z`
        : "";
      this.parts.push(
        `<path d="${outer}${inner}" fill-rule="evenodd" fill="${escape(this.fillStyle)}" opacity="${this.globalAlpha}"/>`,
      );
    } else if (this.circle) {
      const { x, y, r } = this.circle;
      this.parts.push(
        `<circle cx="${x}" cy="${y}" r="${r}" fill="${escape(this.fillStyle)}" opacity="${this.globalAlpha}"/>`,
      );
    }
    this.circle = null;
    this.box = null;
  }
  moveTo(x, y) {
    this.path.push(`M${x} ${y}`);
  }
  lineTo(x, y) {
    this.path.push(`L${x} ${y}`);
  }
  stroke() {
    if (this.path.length)
      this.parts.push(
        `<path d="${this.path.join(" ")}" fill="none" stroke="${escape(this.strokeStyle)}" stroke-width="${this.lineWidth}" opacity="${this.globalAlpha}"/>`,
      );
  }
  serialize() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" viewBox="0 0 ${this.width} ${this.height}"><style>${this.fontFace}</style>${this.parts.join("")}</svg>`;
  }
}
