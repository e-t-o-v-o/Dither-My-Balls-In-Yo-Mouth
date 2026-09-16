import { makeCanvas } from "./canvas";
import { contourPaths } from "./graphics";
import { rgb, luma, nearest } from "./pixels";
import { PrintPlate } from "./print-plate";

const TAU = Math.PI * 2;
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const css = p => `rgb(${p.slice(0, 3).map(Math.round).join(",")})`;
const hash = (x, y, seed) => {
  let n = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263) ^ Math.imul(seed + 1, 1274126177);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};
const resize = (canvas, w, h) => {
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
};
function disk(ctx, x, y, r) {
  if (r <= 0) return;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
}
// A small drawn alphabet, shared by Canvas and SVG. No font downloads or
// platform-dependent glyph metrics, including inside the export worker.
const glyphs = {
  "0": [[[.25, .08], [.75, .08], [.88, .25], [.88, .75], [.75, .92], [.25, .92], [.12, .75], [.12, .25], [.25, .08]]],
  "1": [[[.25, .28], [.5, .08], [.5, .92]], [[.22, .92], [.8, .92]]],
  "%": [[[.12, .92], [.88, .08]], [[.15, .08], [.35, .08], [.35, .3], [.15, .3], [.15, .08]], [[.65, .7], [.85, .7], [.85, .92], [.65, .92], [.65, .7]]],
  "A": [[[.1, .92], [.5, .08], [.9, .92]], [[.25, .61], [.75, .61]]],
  "B": [[[.12, .92], [.12, .08], [.66, .08], [.85, .23], [.85, .35], [.66, .49], [.12, .49]], [[.66, .49], [.9, .65], [.9, .77], [.68, .92], [.12, .92]]],
  "L": [[[.16, .08], [.16, .92], [.9, .92]]],
  "X": [[[.12, .08], [.88, .92]], [[.88, .08], [.12, .92]]],
  "Y": [[[.1, .08], [.5, .5], [.9, .08]], [[.5, .5], [.5, .92]]],
  "+": [[[.1, .5], [.9, .5]], [[.5, .1], [.5, .9]]],
};
function letter(ctx, char, x, y, size) {
  const width = size * .64;
  ctx.beginPath();
  for (const path of glyphs[char]) path.forEach(([u, v], i) => {
    const px = x + (u - .5) * width, py = y + (v - .5) * size;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  });
  ctx.lineWidth = size * .075; ctx.stroke();
}

export class EditorialRenderer {
  constructor() {
    this.layer = makeCanvas();
    this.alpha = makeCanvas();
    this.plate = new PrintPlate();
    this.colors = new Map();
  }
  render(target, data, w, h, c, width, height, palette) {
    let partial = false, visible = false;
    for (let i = 3; i < data.length; i += 4) {
      partial ||= data[i] !== 255; visible ||= data[i] !== 0;
    }
    if (!visible) return;
    const vector = typeof target.beginAlphaMask === "function";
    // Composite the entire printed plate through source alpha ONCE. Overlapping
    // rings, labels and paper must never turn a soft selection opaque.
    let ctx = target;
    if (partial && !vector) {
      resize(this.layer, width, height);
      ctx = this.layer.getContext("2d");
      ctx.clearRect(0, 0, width, height);
    } else if (partial) target.beginAlphaMask(data, w, h);
    ctx.globalAlpha = 1;
    this.vector = vector;
    this.rasterMarks = !vector && ["signal-paths", "print-collage"].includes(c.effect);
    if (this.rasterMarks) this.plate.begin(width, height);
    const long = Math.max(width, height), scale = long / 1920;
    const sample = (x, y) => {
      const sx = clamp(x / width * w - .5, 0, w - 1), sy = clamp(y / height * h - .5, 0, h - 1);
      const ix = Math.floor(sx), iy = Math.floor(sy), fx = sx - ix, fy = sy - iy;
      const offsets = [(iy * w + ix) * 4, (iy * w + Math.min(w - 1, ix + 1)) * 4,
        (Math.min(h - 1, iy + 1) * w + ix) * 4, (Math.min(h - 1, iy + 1) * w + Math.min(w - 1, ix + 1)) * 4];
      const weights = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy], p = [0, 0, 0, 0];
      for (let j = 0; j < 4; j++) {
        const i = offsets[j], a = weights[j] * data[i + 3];
        p[0] += data[i] * a; p[1] += data[i + 1] * a; p[2] += data[i + 2] * a; p[3] += a;
      }
      if (p[3]) { p[0] /= p[3]; p[1] /= p[3]; p[2] /= p[3]; }
      return p;
    };
    const bg = luma(...rgb(c.bgColor));
    const tone = p => bg > 128 ? 1 - luma(...p) / 255 : luma(...p) / 255;
    if (c.effect === "optical-press") {
      if (this.tones?.length !== w * h) this.tones = new Float32Array(w * h);
      const tones = this.tones;
      for (let j = 0; j < tones.length; j++) {
        const i = j * 4, lum = luma(data[i], data[i + 1], data[i + 2]) / 255;
        tones[j] = (bg > 128 ? 1 - lum : lum) * data[i + 3];
      }
      this.opticalTone = (x, y) => {
        const sx = clamp(x / width * w - .5, 0, w - 1), sy = clamp(y / height * h - .5, 0, h - 1);
        const ix = Math.floor(sx), iy = Math.floor(sy), fx = sx - ix, fy = sy - iy;
        const a = iy * w + ix, b = iy * w + Math.min(w - 1, ix + 1), d = Math.min(h - 1, iy + 1) * w + ix, e = Math.min(h - 1, iy + 1) * w + Math.min(w - 1, ix + 1);
        const aa = (1 - fx) * (1 - fy), bb = fx * (1 - fy), dd = (1 - fx) * fy, ee = fx * fy;
        const opacity = data[a * 4 + 3] * aa + data[b * 4 + 3] * bb + data[d * 4 + 3] * dd + data[e * 4 + 3] * ee;
        return opacity ? (tones[a] * aa + tones[b] * bb + tones[d] * dd + tones[e] * ee) / opacity : 0;
      };
    }
    const key = `${c.palette}/${c.artColorMode}/${c.shapeColor}/${c.fgColor}`;
    if (key !== this.colorKey) {
      this.colorKey = key; this.colors.clear();
      this.palette = palette.map(rgb);
      this.tonal = [...palette].sort((a, b) => luma(...rgb(a)) - luma(...rgb(b)));
    }
    const color = p => {
      if (c.artColorMode === "ink") return c.fgColor;
      if (c.artColorMode === "source") return css(p);
      const k = ((p[0] >> 3) << 10) | ((p[1] >> 3) << 5) | (p[2] >> 3);
      if (!this.colors.has(k)) {
        const q = [(p[0] & 248) + 4, (p[1] & 248) + 4, (p[2] & 248) + 4];
        this.colors.set(k, c.artColorMode === "tone" ? this.tonal[Math.round(luma(...q) / 255 * (palette.length - 1))] : palette[nearest(...q, this.palette)]);
      }
      return this.colors.get(k);
    };
    if (c.effect === "signal-paths") this.signal(ctx, sample, tone, c, width, height, scale);
    else if (c.effect === "schematic") this.schematic(ctx, data, w, h, sample, tone, c, width, height, scale);
    else if (c.effect === "print-collage") this.collage(ctx, sample, color, tone, c, width, height, scale);
    else if (c.effect === "optical-press") this.optical(ctx, c, width, height, scale);
    else this.targets(ctx, sample, c, width, height, scale, palette);
    if (this.rasterMarks) this.plate.finish(ctx);
    ctx.globalAlpha = 1;
    if (partial && !vector) {
      resize(this.alpha, w, h);
      const bytes = new Uint8ClampedArray(data.length);
      for (let i = 3; i < bytes.length; i += 4) bytes[i] = data[i];
      this.alpha.getContext("2d").putImageData(new ImageData(bytes, w, h), 0, 0);
      ctx.globalCompositeOperation = "destination-in";
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.alpha, 0, 0, width, height);
      ctx.imageSmoothingEnabled = true;
      ctx.globalCompositeOperation = "source-over";
      target.drawImage(this.layer, 0, 0, width, height);
    } else if (partial) target.endAlphaMask();
  }
  glyph(ctx, char, x, y, size, ink) {
    if (size < .2) return;
    if (this.rasterMarks) this.plate.stamp(char, x, y, size, ink, (tc, xx, yy, s) => letter(tc, char, xx, yy, s));
    else {
      const s = Math.max(.5, Math.round(size * 4) / 4), tile = Math.ceil(s) + 4;
      ctx.strokeStyle = ink;
      letter(ctx, char, Math.round(x - tile / 2) + tile / 2, Math.round(y - tile / 2) + tile / 2, s);
    }
  }
  dot(ctx, x, y, radius, ink) {
    if (this.rasterMarks) this.plate.stamp("dot", x, y, radius * 2, ink, (tc, xx, yy, s) => disk(tc, xx, yy, s / 2));
    else {
      const s = Math.max(.5, Math.round(radius * 8) / 4), tile = Math.ceil(s) + 4;
      ctx.fillStyle = ink;
      disk(ctx, Math.round(x - tile / 2) + tile / 2, Math.round(y - tile / 2) + tile / 2, s / 2);
    }
  }
  rect(ctx, x, y, width, height, ink) {
    if (this.rasterMarks) this.plate.rect(x, y, width, height, ink);
    else { ctx.fillStyle = ink; ctx.fillRect(Math.round(x), Math.round(y), Math.round(x + width) - Math.round(x), Math.round(y + height) - Math.round(y)); }
  }
  signal(ctx, sample, tone, c, width, height, scale) {
    const pitch = Math.max(16, c.cellSize) * scale;
    const angle = c.signalAngle * Math.PI / 180, ca = Math.cos(angle), sa = Math.sin(angle);
    const span = Math.hypot(width, height) / 2 + pitch * 2;
    const cols = Math.ceil(span / pitch), rows = Math.ceil(span / pitch);
    const phase = hash(1, 3, c.artSeed) * TAU;
    for (let y = -rows; y <= rows; y++) for (let x = -cols; x <= cols; x++) {
      const u = x * pitch, v = y * pitch;
      const warped = v + c.signalWarp * Math.min(width, height) * .09 * Math.sin(u / Math.max(width, height) * 8 + phase);
      const xx = width / 2 + u * ca - warped * sa, yy = height / 2 + u * sa + warped * ca;
      if (xx < -pitch || yy < -pitch || xx > width + pitch || yy > height + pitch) continue;
      const p = sample(xx, yy); if (!p[3]) continue;
      const t = clamp(tone(p) * c.signalDensity), r = hash(x, y, c.artSeed);
      const ink = r < c.accentAmount ? c.accentColor : c.fgColor;
      if (t < .18) { const s = pitch * (.04 + t * .85); this.rect(ctx, xx - s / 2, yy - s / 2, s, s, ink); }
      else if (t < .46) this.dot(ctx, xx, yy, pitch * (.16 + t * .57), ink);
      else if (t < .64 || r < c.accentAmount) this.glyph(ctx, "ABL+"[Math.floor(r * 4)], xx, yy, pitch * .83, ink);
      else {
        const s = pitch * .98; this.rect(ctx, xx - s / 2, yy - s / 2, s, s, ink);
        this.glyph(ctx, "01%"[Math.floor(r * 3)], xx, yy, pitch * .68, c.fillColor);
      }
    }
  }
  schematic(ctx, data, w, h, sample, tone, c, width, height, scale) {
    const unit = Math.max(12, c.cellSize) * scale, grid = unit * 6;
    const fg = rgb(c.fgColor), bg = rgb(c.bgColor);
    const ghost = css(fg.map((v, i) => bg[i] + (v - bg[i]) * c.schematicGrid * .55));
    const line = (x0, y0, x1, y1, dashed = false) => {
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
      if (!len) return;
      ctx.beginPath();
      if (dashed) for (let s = 0; s < len; s += 7 * scale) {
        const end = Math.min(len, s + 3.5 * scale);
        ctx.moveTo(x0 + dx * s / len, y0 + dy * s / len); ctx.lineTo(x0 + dx * end / len, y0 + dy * end / len);
      } else { ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); }
      ctx.stroke();
    };
    ctx.lineWidth = Math.max(.3, scale * c.schematicWeight);
    for (let y = 0; y < Math.ceil(height / grid); y++) for (let x = 0; x < Math.ceil(width / grid); x++) {
      const xx = (x + .5) * grid, yy = (y + .5) * grid, p = sample(xx, yy);
      if (!p[3]) continue;
      const t = tone(p), r = hash(x, y, c.artSeed);
      const gx = luma(...sample(xx + unit, yy)) - luma(...sample(xx - unit, yy));
      const gy = luma(...sample(xx, yy + unit)) - luma(...sample(xx, yy - unit));
      const energy = Math.hypot(gx, gy) / 255;
      ctx.strokeStyle = ghost;
      if (c.schematicGrid > 0) {
        const bw = grid * (.35 + t * .6), bh = grid * (.32 + (1 - t) * .62);
        line(xx - bw / 2, yy - bh / 2, xx + bw / 2, yy - bh / 2, true);
        line(xx - bw / 2, yy + bh / 2, xx + bw / 2, yy + bh / 2, true);
        line(xx - bw / 2, yy - bh / 2, xx - bw / 2, yy + bh / 2, true);
        line(xx + bw / 2, yy - bh / 2, xx + bw / 2, yy + bh / 2, true);
        line(xx - unit * .2, yy, xx + unit * .2, yy); line(xx, yy - unit * .2, xx, yy + unit * .2);
      }
      if (energy > .08 && r < c.schematicLabels) {
        ctx.strokeStyle = c.accentColor; ctx.fillStyle = c.accentColor;
        const dx = xx + (r > .5 ? 1 : -1) * unit * 1.6, dy = yy - unit * 1.25;
        line(xx, yy, dx, dy); line(dx, dy, dx + unit, dy);
        disk(ctx, xx, yy, unit * .2);
        ctx.font = `${Math.max(1, unit * .46)}px monospace`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(`${String.fromCharCode(65 + (x + y * 3) % 26)}${String(y + 1).padStart(2, "0")}`, dx + unit * .4, dy - unit * .4);
      }
    }
    ctx.strokeStyle = c.fgColor; ctx.lineWidth = Math.max(.35, 1.8 * scale * c.schematicWeight);
    const levels = c.contourSource === "alpha" ? 1 : c.contourLevels;
    for (let level = 0; level < levels; level++) {
      const threshold = clamp(c.threshold + (level - (levels - 1) / 2) * 44, 1, 254);
      for (const path of contourPaths(data, w, h, threshold, c.contourSource === "alpha")) {
        let distance = 0;
        ctx.beginPath();
        for (let i = 1; i < path.length; i++) {
          const [a, b] = [path[i - 1], path[i]], x0 = a[0] * width / w, y0 = a[1] * height / h;
          const x1 = b[0] * width / w, y1 = b[1] * height / h, len = Math.hypot(x1 - x0, y1 - y0);
          // The marching-square border is not an image feature.
          if (Math.min(x0, x1) < scale || Math.min(y0, y1) < scale || Math.max(x0, x1) > width - scale || Math.max(y0, y1) > height - scale) continue;
          if (!c.schematicDashed) { ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); continue; }
          const period = 10 * scale;
          for (let s = 0; s < len;) {
            const phase = (distance + s) % period, step = Math.min(len - s, (phase < period * .6 ? period * .6 : period) - phase + .00001);
            if (phase < period * .6) { ctx.moveTo(x0 + (x1 - x0) * s / len, y0 + (y1 - y0) * s / len); ctx.lineTo(x0 + (x1 - x0) * (s + step) / len, y0 + (y1 - y0) * (s + step) / len); }
            s += step;
          }
          distance += len;
        }
        ctx.stroke();
      }
    }
  }
  collage(ctx, sample, color, tone, c, width, height, scale) {
    const pitch = Math.max(24, c.cellSize) * 3 * scale, detail = c.collageDetail;
    const cell = pitch / detail, letters = "ABXY01%L";
    for (let ty = 0; ty < Math.ceil(height / pitch); ty++) for (let tx = 0; tx < Math.ceil(width / pitch); tx++) {
      const r = hash(tx, ty, c.artSeed), type = c.collageStyle === "type" ? 2 : Math.floor(hash(tx, ty, c.artSeed + 5) * 4);
      const printed = r < c.collageCoverage, panel = printed && c.collageStyle === "patchwork";
      const ink = r < .5 ? c.fgColor : c.accentColor;
      for (let y = 0; y < detail; y++) for (let x = 0; x < detail; x++) {
        const xx = tx * pitch + (x + .5) * cell, yy = ty * pitch + (y + .5) * cell;
        if (xx - cell / 2 >= width || yy - cell / 2 >= height) continue;
        const p = sample(xx, yy); if (!p[3]) continue;
        const t = tone(p);
        const base = !printed ? css(p) : panel ? c.fillColor : c.artColorMode === "ink" ? c.bgColor : color(p);
        this.rect(ctx, xx - cell / 2, yy - cell / 2, cell + .05, cell + .05, base);
        if (!printed) continue;
        const baseTone = c.artColorMode === "source" ? luma(...p) : luma(...rgb(base));
        const mark = panel ? ink : c.artColorMode === "ink" || baseTone > 128 ? c.fgColor : c.fillColor;
        if (type === 0) this.dot(ctx, xx, yy, cell * .47 * Math.sqrt(t), mark);
        else if (type === 1) { const s = cell * (.03 + t * .94); this.rect(ctx, xx - cell * .46, yy - s / 2, cell * .92, s, mark); }
        else if (type === 2) {
          const q = hash(tx * detail + x, ty * detail + y, c.artSeed + 2);
          if (t > .06) this.glyph(ctx, letters[Math.floor(q * letters.length)], xx, yy, cell * (.25 + .6 * t), mark);
          if (panel && t > .65) this.rect(ctx, xx - cell * .43, yy + cell * .35, cell * .86, cell * .12 * (t - .65) / .35, mark);
        } else {
          const on = t > hash(x, y, c.artSeed + 11);
          if (on) this.rect(ctx, xx - cell / 2, yy - cell / 2, cell + .05, cell + .05, mark);
        }
      }
      if (panel && c.collageBorders > 0) {
        const edge = Math.max(.2, scale * c.collageBorders * 2.5), x = tx * pitch + cell * .08, y = ty * pitch + cell * .08, size = pitch - cell * .16;
        this.rect(ctx, x, y, size, edge, ink); this.rect(ctx, x, y + size - edge, size, edge, ink);
        this.rect(ctx, x, y, edge, size, ink); this.rect(ctx, x + size - edge, y, edge, size, ink);
      }
    }
  }
  optical(ctx, c, width, height, scale) {
    const pitch = Math.max(14, c.cellSize) * scale, long = Math.max(width, height);
    const cx = c.opticalCenterX * width, cy = c.opticalCenterY * height;
    const phase = c.opticalPhase * TAU;
    const key = [width, height, c.cellSize, c.opticalCenterX, c.opticalCenterY, c.opticalPhase, c.opticalBend, c.opticalPattern].join("/");
    if (key !== this.opticalKey) {
      this.opticalKey = key;
      this.opticalCurves = [[], []];
      const add = (plate, points) => this.opticalCurves[plate].push({ points: new Float32Array(points), widths: new Float32Array(points.length / 4) });
      for (let plate = 0; plate < 2; plate++) {
        const ox = cx + (plate ? long * .13 : 0), oy = cy - (plate ? long * .08 : 0);
        const squeeze = plate ? .66 : 1;
        const radius = Math.hypot(Math.max(Math.abs(ox), Math.abs(width - ox)), Math.max(Math.abs(oy), Math.abs(height - oy)) / squeeze) + pitch * 2;
        if (c.opticalPattern === "rays" && plate === 0) {
          const count = Math.max(12, Math.round(1920 / c.cellSize * 1.3));
          for (let ray = 0; ray < count; ray++) {
            const angle = ray / count * TAU + phase * .12, points = [];
            for (let r = pitch * .6; r < radius; r += pitch * .6) {
              const theta = angle + c.opticalBend * .11 * Math.sin(r / long * 11 + phase);
              const ca = Math.cos(theta), sa = Math.sin(theta), spread = r * TAU / count;
              points.push(ox + ca * r, oy + sa * r, -sa * spread, ca * spread);
            }
            add(plate, points);
          }
        } else if (c.opticalPattern === "waves") {
          const steps = Math.ceil(width / pitch * 2);
          for (let row = -5; row < height / pitch + 5; row++) {
            const points = [];
            for (let i = 0; i <= steps; i++) {
              const x = i / steps * width, y = row * pitch + Math.sin(x / long * (plate ? 29 : 22) + phase + row * .07) * pitch * (1 + c.opticalBend * 3);
              points.push(x, y, 0, pitch);
            }
            add(plate, points);
          }
        } else {
          for (let ring = 1; ring * pitch < radius; ring++) {
            const r = (ring + c.opticalPhase) * pitch, steps = Math.max(32, Math.ceil(TAU * r / pitch * 1.35)), points = [];
            for (let i = 0; i <= steps; i++) {
              const theta = i / steps * TAU, ca = Math.cos(theta), sa = Math.sin(theta);
              const rr = r + c.opticalBend * pitch * .32 * Math.sin(theta * 11 + r / long * 18 + phase);
              points.push(ox + ca * rr, oy + sa * rr * squeeze, ca * pitch, sa * pitch * squeeze);
            }
            add(plate, points);
          }
        }
      }
    }
    for (let plate = 0; plate < (c.opticalInterference > 0 ? 2 : 1); plate++) {
      const strength = c.opticalWeight * (plate ? c.opticalInterference * .62 : 1);
      ctx.fillStyle = plate ? c.accentColor : c.fgColor;
      for (const { points, widths } of this.opticalCurves[plate]) {
        ctx.beginPath();
        for (let i = 0; i < points.length; i += 4) {
          const x = points[i], y = points[i + 1];
          // Outside the canvas only the path geometry matters. No source lookup
          // is needed; this also bounds work for centers at the frame's edges.
          const t = x < -pitch || y < -pitch || x > width + pitch || y > height + pitch ? 0 : this.opticalTone(x, y);
          const half = (.025 + t * .4) * strength; widths[i / 4] = half;
          const xx = x - points[i + 2] * half, yy = y - points[i + 3] * half;
          i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
        }
        for (let i = points.length - 4; i >= 0; i -= 4) ctx.lineTo(points[i] + points[i + 2] * widths[i / 4], points[i + 1] + points[i + 3] * widths[i / 4]);
        ctx.closePath(); ctx.fill();
      }
    }
  }
  targets(ctx, sample, c, width, height, scale, palette) {
    const pitch = Math.max(16, c.cellSize) * 2 * scale;
    for (let y = 0; y < Math.ceil(height / pitch); y++) for (let x = 0; x < Math.ceil(width / pitch); x++) {
      const r = hash(x, y, c.artSeed), xx = (x + .5 + (r - .5) * c.targetSpread * .6) * pitch;
      const yy = (y + .5 + (hash(x, y, c.artSeed + 4) - .5) * c.targetSpread * .6) * pitch;
      const p = sample(xx, yy); if (!p[3]) continue;
      const t = 1 - luma(...p) / 255;
      const radius = pitch * .35 * c.dotScale * (.2 + .8 * Math.sqrt(t));
      const pi = nearest(...p.slice(0, 3), this.palette);
      for (let ring = 0; ring < c.targetRings; ring++) {
        const ink = c.shapeColor === "palette" ? palette[(pi + ring * 2 + Math.floor(r * palette.length)) % palette.length]
          : c.shapeColor === "ink" ? [c.fgColor, c.accentColor, c.fillColor][ring % 3]
            : css(sample(xx + ring * pitch * .22, yy + ring * pitch * .14));
        this.dot(ctx, xx, yy, radius * (1 - ring / c.targetRings), ink);
      }
    }
  }
}
