import { rgb, luma, nearest } from "./pixels";

const TAU = Math.PI * 2;
const clamp = (x, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, x));
// Spatial randomness only: seeking or exporting a frame never changes its layout.
function hash(x, y, seed) {
  let n = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263) ^ Math.imul(seed + 1, 1274126177);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

// Shared polygons keep raster, workers and editable SVG on the same geometry.
// Disjoint pieces are batched by ink and alpha so soft selections stay soft.
class Marks {
  constructor() { this.groups = new Map(); }
  add(color, alpha, points) {
    if (!alpha || points.length < 6) return;
    const key = `${color}/${alpha}`;
    let group = this.groups.get(key);
    if (!group) this.groups.set(key, group = { color, alpha, paths: [] });
    group.paths.push(points);
  }
  draw(ctx, width, height, rule = "nonzero", separate = false) {
    for (const { color, alpha, paths } of this.groups.values()) {
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha / 255;
      ctx.beginPath();
      for (const p of paths) {
        if (separate) ctx.beginPath();
        ctx.moveTo(p[0] * width, p[1] * height);
        for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i] * width, p[i + 1] * height);
        ctx.closePath();
        if (separate) ctx.fill(rule);
      }
      if (!separate) ctx.fill(rule);
    }
    ctx.globalAlpha = 1;
  }
}

export class ArtisticRenderer {
  constructor() {
    this.colors = new Map();
    this.meshKey = "";
    this.mesh = [];
  }
  render(ctx, data, w, h, c, width, height, palette) {
    const key = `${c.palette}/${c.artColorMode}/${c.fgColor}`;
    if (key !== this.colorKey) {
      this.colorKey = key;
      this.colors.clear();
      this.palette = palette.map(rgb);
      this.tonal = palette.map((hex, i) => ({ hex, tone: luma(...this.palette[i]) })).sort((a, b) => a.tone - b.tone);
    }
    const sample = (x, y) => {
      const sx = clamp(x * w - 0.5, 0, w - 1), sy = clamp(y * h - 0.5, 0, h - 1);
      const ix = Math.floor(sx), iy = Math.floor(sy), fx = sx - ix, fy = sy - iy;
      const offsets = [(iy * w + ix) * 4, (iy * w + Math.min(ix + 1, w - 1)) * 4,
        (Math.min(iy + 1, h - 1) * w + ix) * 4, (Math.min(iy + 1, h - 1) * w + Math.min(ix + 1, w - 1)) * 4];
      const weights = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy];
      const p = [0, 0, 0, 0];
      for (let j = 0; j < 4; j++) {
        const i = offsets[j], a = weights[j] * data[i + 3];
        p[0] += data[i] * a; p[1] += data[i + 1] * a; p[2] += data[i + 2] * a; p[3] += a;
      }
      if (p[3]) { p[0] /= p[3]; p[1] /= p[3]; p[2] /= p[3]; }
      p[3] = Math.round(p[3]);
      return p;
    };
    const color = (p) => {
      if (c.artColorMode === "ink") return c.fgColor;
      // Keep all eight bits in source-color output. Only palette matching uses
      // the bounded lookup table; source footage must not acquire banding.
      if (c.artColorMode === "source") return `rgb(${Math.round(p[0])},${Math.round(p[1])},${Math.round(p[2])})`;
      const k = ((p[0] >> 3) << 10) | ((p[1] >> 3) << 5) | (p[2] >> 3);
      if (!this.colors.has(k)) {
        const q = [(p[0] & 248) + 4, (p[1] & 248) + 4, (p[2] & 248) + 4];
        this.colors.set(k, c.artColorMode === "tone"
          ? this.tonal[Math.round(luma(...q) / 255 * (palette.length - 1))].hex
          : palette[nearest(...q, this.palette)]);
      }
      return this.colors.get(k);
    };
    const bg = luma(...rgb(c.bgColor)), fg = luma(...rgb(c.fgColor));
    const tone = p => c.artColorMode === "ink" && Math.abs(fg - bg) > 24
      ? clamp((luma(p[0], p[1], p[2]) - bg) / (fg - bg))
      : bg > 128 ? 1 - luma(p[0], p[1], p[2]) / 255 : luma(p[0], p[1], p[2]) / 255;
    const marks = new Marks();
    if (c.effect === "guilloche") this.engrave(marks, sample, color, tone, c, w, h);
    else if (c.effect === "cut-paper") this.paper(marks, sample, color, tone, c, w, h);
    else if (c.effect === "glass") this.glass(marks, sample, color, tone, c, Math.ceil(w / 2), Math.ceil(h / 2));
    else this.arcs(marks, sample, color, tone, c, Math.ceil(w / 2), Math.ceil(h / 2));
    // Long wave ribbons are disjoint. Filling each independently avoids an
    // expensive compound-path intersection pass in canvas implementations.
    marks.draw(ctx, width, height, c.effect === "cut-paper" ? "evenodd" : "nonzero", c.effect === "guilloche");
  }

  engrave(marks, sample, color, tone, c, w, h) {
    const pitch = 1 / h, steps = w * 2;
    const curveKey = `${w}/${h}/${c.artSeed}/${c.engraveWarp}`;
    if (curveKey !== this.curveKey) {
      this.curveKey = curveKey;
      this.curves = [];
      const phase = hash(1, 1, c.artSeed) * TAU, amplitude = c.engraveWarp * 0.065;
      // Cache centerlines and their local spacing. The warp's derivative stays
      // positive, so its ribbons cannot fold across their neighboring rows.
      for (let row = -Math.ceil(h * 0.08); row < h * 1.08; row++) {
        const y = (row + 0.5) * pitch, curve = new Float64Array((steps + 1) * 2);
        for (let col = 0; col <= steps; col++) {
          const phaseAt = col / steps * TAU * 1.7 + phase + Math.sin(y * 3.1) * 0.7;
          curve[col * 2] = y + amplitude * Math.sin(phaseAt);
          curve[col * 2 + 1] = 1 + amplitude * Math.cos(phaseAt) * Math.cos(y * 3.1) * 2.17;
        }
        this.curves.push(curve);
      }
    }
    const halfWidth = p => pitch * 0.48 * c.engraveWeight * (c.artColorMode === "ink" ? tone(p) : 0.2 + 0.8 * tone(p));
    for (const curve of this.curves) {
      let top = [], bottom = [], lastInk, lastAlpha;
      const flush = () => {
        if (top.length) {
          for (let i = bottom.length - 2; i >= 0; i -= 2) top.push(bottom[i], bottom[i + 1]);
          marks.add(lastInk, lastAlpha, top);
          top = []; bottom = [];
        }
      };
      let left = sample(0, curve[0]), half0 = halfWidth(left);
      for (let col = 0; col < steps; col++) {
        const x0 = col / steps, x1 = (col + 1) / steps;
        const cy = curve[(col + 1) * 2], right = sample(x1, cy), half1 = halfWidth(right);
        const alpha = (left[3] + right[3]) / 2;
        const p = alpha ? [(left[0] * left[3] + right[0] * right[3]) / (alpha * 2),
          (left[1] * left[3] + right[1] * right[3]) / (alpha * 2),
          (left[2] * left[3] + right[2] * right[3]) / (alpha * 2), Math.round(alpha)] : [0, 0, 0, 0];
        const ink = color(p);
        if (cy < -pitch || cy > 1 + pitch || !p[3] || half0 + half1 < 0.000002) flush();
        else {
          if (ink !== lastInk || p[3] !== lastAlpha) flush();
          if (!top.length) {
            lastInk = ink; lastAlpha = p[3];
            top.push(x0, curve[col * 2] - half0 * curve[col * 2 + 1]); bottom.push(x0, curve[col * 2] + half0 * curve[col * 2 + 1]);
          }
          top.push(x1, cy - half1 * curve[(col + 1) * 2 + 1]); bottom.push(x1, cy + half1 * curve[(col + 1) * 2 + 1]);
        }
        left = right; half0 = half1;
      }
      flush();
    }
  }

  paper(marks, sample, color, tone, c, w, h) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = sample((x + 0.5) / w, (y + 0.5) / h);
      if (!p[3]) continue;
      const ink = color(p), r = hash(x, y, c.artSeed);
      const angle = r * TAU, cos = Math.cos(angle), sin = Math.sin(angle);
      const scale = c.paperFill * (c.artColorMode === "ink" ? Math.sqrt(tone(p)) : 0.8 + 0.2 * tone(p));
      const transform = (u, v) => [(x + 0.5 + (u * cos - v * sin) * scale * 0.46) / w, (y + 0.5 + (u * sin + v * cos) * scale * 0.46) / h];
      const path = [];
      if (c.paperShape === "leaves") {
        for (const side of [1, -1]) for (let k = 0; k <= 16; k++) {
          const t = side === 1 ? k / 16 : 1 - k / 16;
          const u = side * Math.sin(t * Math.PI) * (0.56 + 0.23 * Math.sin(t * Math.PI * 8 + r)) * 0.8;
          path.push(...transform(u, t * 2 - 1));
        }
      } else {
        const lobes = 3 + Math.floor(r * 3);
        for (let k = 0; k < 40; k++) {
          const t = k / 40 * TAU, radius = 0.74 + 0.22 * Math.cos(t * lobes);
          path.push(...transform(Math.cos(t) * radius, Math.sin(t) * radius));
        }
      }
      marks.add(ink, p[3], path);
      if (c.paperVeins && c.paperShape === "leaves") {
        // A cut in the same even-odd path, not a background-colored overlay.
        marks.add(ink, p[3], [...transform(-0.026, -0.57), ...transform(0.026, -0.4), ...transform(0.014, 0.64), ...transform(-0.014, 0.4)]);
      }
    }
  }

  glass(marks, sample, color, tone, c, w, h) {
    const key = `${w}/${h}/${c.artSeed}/${c.glassScatter}`;
    if (key !== this.meshKey) {
      this.meshKey = key;
      const vertices = [];
      for (let y = 0; y <= h; y++) for (let x = 0; x <= w; x++)
        vertices.push([(x + (x && x < w ? (hash(x, y, c.artSeed) - 0.5) * 0.5 * c.glassScatter : 0)) / w,
          (y + (y && y < h ? (hash(x, y, c.artSeed + 41) - 0.5) * 0.5 * c.glassScatter : 0)) / h]);
      this.mesh = [];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const a = vertices[y * (w + 1) + x], b = vertices[y * (w + 1) + x + 1],
          d = vertices[(y + 1) * (w + 1) + x], e = vertices[(y + 1) * (w + 1) + x + 1];
        this.mesh.push(...(hash(x, y, c.artSeed + 17) < 0.5 ? [[a, b, e], [a, e, d]] : [[a, b, d], [b, e, d]]));
      }
    }
    for (const points of this.mesh) {
      const cx = (points[0][0] + points[1][0] + points[2][0]) / 3, cy = (points[0][1] + points[1][1] + points[2][1]) / 3;
      const p = sample(cx, cy);
      if (!p[3]) continue;
      const path = points.flatMap(([x, y]) => [cx + (x - cx) * (1 - c.glassGap), cy + (y - cy) * (1 - c.glassGap)]);
      marks.add(color(p), c.artColorMode === "ink" ? Math.round(p[3] * tone(p)) : p[3], path);
    }
  }

  arcs(marks, sample, color, tone, c, w, h) {
    const bands = c.arcBands;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const flip = hash(x, y, c.artSeed) < 0.5;
      // Quarter circles meet at neighboring edges; symmetric radii preserve
      // that connection for both tile orientations and any number of lanes.
      for (let corner = 0; corner < 2; corner++) for (let lane = 0; lane < bands; lane++) {
        const radius = bands === 1 ? 0.5 : 0.31 + (lane + 0.5) * 0.38 / bands;
        const ox = corner, oy = flip ? 1 - corner : corner;
        const sx = ox ? -1 : 1, sy = oy ? -1 : 1;
        const p = sample((x + ox + sx * radius * Math.SQRT1_2) / w, (y + oy + sy * radius * Math.SQRT1_2) / h);
        if (!p[3]) continue;
        const coverage = c.artColorMode === "ink" ? tone(p) : 0.32 + 0.68 * tone(p);
        const half = (bands === 1 ? 0.18 : 0.18 / bands) * c.arcWeight * coverage;
        if (half < 0.000001) continue;
        const path = [];
        for (const side of [1, -1]) for (let k = 0; k <= 16; k++) {
          const t = (side === 1 ? k : 16 - k) / 16 * Math.PI / 2, r = radius + half * side;
          path.push((x + ox + sx * Math.cos(t) * r) / w, (y + oy + sy * Math.sin(t) * r) / h);
        }
        marks.add(color(p), p[3], path);
      }
    }
  }
}
