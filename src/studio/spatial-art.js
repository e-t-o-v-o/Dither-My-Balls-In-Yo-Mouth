import { ContourPlate } from "./contour-plate";
import { effectScale } from "./effect-scale";
import { rgb, luma } from "./pixels";

const TAU = Math.PI * 2;
const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const hash = (x, y, seed) => {
  let n = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263) ^ Math.imul(seed + 1, 1274126177);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};
const shade = (p, paper, amount) => `rgb(${[0, 1, 2].map(k => Math.round(p[k] * (1 - amount) + paper[k] * amount)).join(",")})`;

// Shared Canvas/SVG geometry. The caller composites source alpha once after
// overlapping ridges, plates, and nested tiles have been assembled.
export class SpatialRenderer {
  render(ctx, sample, color, tone, c, width, height, scale, w, h, data) {
    c = { ...c, cellSize: Math.max(c.cellSize, effectScale(c).min) };
    if (c.effect === "relief") this.relief(ctx, sample, color, tone, c, width, height, scale);
    else if (c.effect === "harmonics") this.harmonics(ctx, sample, tone, c, width, height, w, h);
    else this.tiles(ctx, sample, color, tone, c, width, height, scale, w, h, data);
  }

  relief(ctx, sample, color, tone, c, width, height, scale) {
    const pitch = c.cellSize * scale, steps = Math.ceil(width / (pitch / 4));
    const step = width / steps, paper = rgb(c.bgColor), wire = c.reliefStyle === "wire";
    // Each row is drawn as continuous ink runs, not thousands of tiny facets.
    // Geometry is sampled finely; color is sampled once per ridge-sized cell.
    for (let row = 0; row * pitch < height + pitch * c.reliefDepth; row++) {
      const base = (row + .55) * pitch, points = [], inks = [];
      let ink;
      for (let col = 0; col <= steps; col++) {
        const x = col * step, p = sample(x, base), lift = tone(p) * pitch * c.reliefDepth;
        points.push(x + lift * c.reliefSlant, base - lift);
        if (!(col % 4)) ink = color(p);
        inks.push(ink);
      }
      const drawRun = (start, end, fill, stroke) => {
        ctx.beginPath(); ctx.moveTo(points[start * 2], points[start * 2 + 1]);
        for (let k = start + 1; k <= end; k++) ctx.lineTo(points[k * 2], points[k * 2 + 1]);
        if (fill) {
          ctx.lineTo(end * step, base + pitch * .58); ctx.lineTo(start * step, base + pitch * .58); ctx.closePath();
          ctx.fillStyle = fill; ctx.fill();
        } else {
          ctx.strokeStyle = stroke; ctx.lineWidth = Math.max(.35 * scale, pitch * (wire ? .065 : .09)); ctx.stroke();
        }
      };
      if (wire) drawRun(0, steps, c.bgColor);
      for (let start = 0; start < steps;) {
        let end = start + 1;
        while (end < steps && inks[end] === inks[start]) end++;
        if (!wire) {
          const value = inks[start], inkRGB = value[0] === "#" ? rgb(value) : value.slice(4, -1).split(",").map(Number);
          drawRun(start, end, shade(inkRGB, paper, c.reliefShade));
        }
        drawRun(start, end, null, inks[start]);
        start = end;
      }
    }
  }

  harmonics(ctx, sample, tone, c, width, height, w, h) {
    const key = `${width}/${height}/${w}/${h}/${c.cellSize}/${c.harmonicStructure}/${c.harmonicWarp}/${c.harmonicPhase}/${c.artSeed}`;
    if (this.harmonicKey !== key) {
      this.harmonicKey = key;
      this.field = new Float32Array(w * h);
      this.plate = new Float32Array((w + 2) * (h + 2));
      this.contours ||= new ContourPlate();
      const long = Math.max(width, height), pitch = c.cellSize / 1920 * long * 2;
      const phase = c.harmonicPhase * TAU, offset = hash(3, 7, c.artSeed) * TAU;
      const warp = c.harmonicWarp * 1.9;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const u = (x + .5) / w * width / pitch * TAU + offset;
        const v = (y + .5) / h * height / pitch * TAU;
        this.field[y * w + x] = c.harmonicStructure === "lattice"
          ? Math.sin(u + phase) * Math.sin(v) + .35 * warp * Math.cos((u + v) * .5 - phase)
          : (Math.sin(u + warp * Math.sin(v * .5 + phase)) + Math.sin(v + warp * Math.cos(u * .5 - phase))) * .65;
      }
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, p = sample((x + .5) * width / w, (y + .5) * height / h);
      const value = clamp(.5 + (this.field[i] - 1.3 + tone(p) * 2.6 * c.harmonicWeight) * .23) * 255;
      this.plate[(y + 1) * (w + 2) + x + 1] = value;
    }
    const draw = (level, ink) => {
      ctx.fillStyle = ink;
      this.contours.draw(ctx, this.plate, w, h, level, width, height);
    };
    if (c.harmonicAccent > 0) draw(128 - c.harmonicAccent * 28, c.accentColor);
    draw(128, c.fgColor);
  }

  tiles(ctx, sample, color, tone, c, width, height, scale, w, h, data) {
    // Summed-area moments consider every sampled pixel in each tile, so small
    // details between probe points are not missed. Alpha weights ignore hidden RGB.
    const stride = w + 1, length = stride * (h + 1);
    if (this.detailSum?.length !== length) {
      this.detailSum = new Float64Array(length); this.detailSquare = new Float64Array(length); this.detailAlpha = new Float64Array(length);
    }
    const sum = this.detailSum, square = this.detailSquare, alpha = this.detailAlpha;
    sum.fill(0); square.fill(0); alpha.fill(0);
    for (let y = 0; y < h; y++) {
      let s = 0, sq = 0, a = 0;
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4, t = luma(data[i], data[i + 1], data[i + 2]) / 255, opacity = data[i + 3] / 255;
        s += t * opacity; sq += t * t * opacity; a += opacity;
        const dest = (y + 1) * stride + x + 1;
        sum[dest] = sum[dest - stride] + s; square[dest] = square[dest - stride] + sq; alpha[dest] = alpha[dest - stride] + a;
      }
    }
    const detail = (x, y, side) => {
      const x0 = clamp(Math.floor(x / width * w), 0, w), y0 = clamp(Math.floor(y / height * h), 0, h);
      const x1 = clamp(Math.ceil((x + side) / width * w), 0, w), y1 = clamp(Math.ceil((y + side) / height * h), 0, h);
      const a = y0 * stride + x0, b = y0 * stride + x1, d = y1 * stride + x0, e = y1 * stride + x1;
      const weight = alpha[e] - alpha[b] - alpha[d] + alpha[a];
      if (weight < .000001) return 0;
      const mean = (sum[e] - sum[b] - sum[d] + sum[a]) / weight;
      return Math.sqrt(Math.max(0, (square[e] - square[b] - square[d] + square[a]) / weight - mean * mean)) * 2.5;
    };
    const size = c.cellSize * scale * 4, gap = c.tileGap;
    const stamp = (x, y, side, p, depth) => {
      const ink = color(p), t = tone(p), inset = side * gap / 2;
      const xx = x + inset, yy = y + inset, s = side * (1 - gap);
      if (s <= 0) return;
      ctx.fillStyle = ink; ctx.fillRect(xx, yy, s, s);
      const seed = hash(Math.round(x / scale), Math.round(y / scale), c.artSeed);
      const motif = c.tileMotif === "mixed" ? Math.floor(seed * 3) : c.tileMotif === "chambers" ? 0 : 1;
      ctx.fillStyle = c.bgColor;
      if (motif === 0) {
        const border = s * (.08 + t * .15), hole = s - border * 2;
        ctx.fillRect(xx + border, yy + border, hole, hole);
        ctx.fillStyle = ink;
        const a = s * (.22 + .18 * t), corner = (depth + Math.floor(seed * 4)) % 4;
        ctx.fillRect(xx + (corner % 2 ? s - border - a : border), yy + (corner > 1 ? s - border - a : border), a, a);
      } else if (motif === 1) {
        const bars = 3, band = s / (bars * 2 + 1), vertical = seed < .5;
        for (let i = 0; i < bars; i++) {
          const start = band * (i * 2 + 1), span = band * (.65 + t * .9);
          ctx.fillRect(xx + (vertical ? start : 0), yy + (vertical ? 0 : start), vertical ? span : s, vertical ? s : span);
        }
      } else {
        ctx.beginPath(); ctx.arc(xx + s / 2, yy + s / 2, s * .36, 0, TAU); ctx.fill();
        ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(xx + s / 2, yy + s / 2, s * (.1 + t * .18), 0, TAU); ctx.fill();
      }
    };
    const visit = (x, y, side, depth, opacity = 1) => {
      if (x >= width || y >= height) return;
      const p = sample(x + side / 2, y + side / 2);
      const variation = detail(x, y, side);
      const threshold = .46 - c.tileDetail * .42;
      let split = depth < 3 ? clamp((variation - threshold + .035) / .07) : 0;
      split = split * split * (3 - 2 * split);
      ctx.globalAlpha = opacity;
      // Children crossfade over an opaque parent inside the printed plate.
      // The transition reduces abrupt tree changes in moving footage.
      if (split < 1) stamp(x, y, side, p, depth);
      if (split > 0) {
        ctx.fillStyle = c.bgColor; ctx.globalAlpha = opacity * split;
        ctx.fillRect(x, y, side, side);
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) visit(x + dx * side / 2, y + dy * side / 2, side / 2, depth + 1, opacity * split);
      }
    };
    for (let y = 0; y < height; y += size) for (let x = 0; x < width; x += size) visit(x, y, size, 0);
    ctx.globalAlpha = 1;
  }
}
