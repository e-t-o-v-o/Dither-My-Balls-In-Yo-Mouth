import { luma } from "./pixels";

const TAU = Math.PI * 2;

const stitchCircle = Array.from({ length: 16 }, (_, k) => [Math.cos(k / 16 * TAU), Math.sin(k / 16 * TAU)]);

// Clip a triangle against an isovalue in its linearly interpolated tone field.
// Neighboring triangles share vertices, so their terrace boundaries agree.
function clip(poly, level, above) {
  const out = [];
  for (let i = 0; i < poly.length; i += 3) {
    const j = (i + 3) % poly.length;
    const inside = above ? poly[i + 2] >= level : poly[i + 2] <= level;
    const next = above ? poly[j + 2] >= level : poly[j + 2] <= level;
    if (inside) out.push(poly[i], poly[i + 1], poly[i + 2]);
    if (inside !== next) {
      const t = (level - poly[i + 2]) / (poly[j + 2] - poly[i + 2]);
      out.push(poly[i] + (poly[j] - poly[i]) * t, poly[i + 1] + (poly[j + 1] - poly[i + 1]) * t, level);
    }
  }
  return out;
}

export class MaterialRenderer {
  render(marks, sample, color, tone, c, w, h, hash) {
    if (c.effect === "marbling") this.marble(marks, sample, color, tone, c, w, h, hash);
    else if (c.effect === "topography") this.topography(marks, sample, color, tone, c, w, h);
    else if (c.effect === "threadwork") this.threadwork(marks, sample, color, tone, c, w, h, hash);
  }

  marble(marks, sample, color, tone, c, w, h, hash) {
    const key = `${w}/${h}/${c.artSeed}/${c.marbleSwirl}`;
    const pitch = 1 / h;
    if (key !== this.marbleKey) {
      this.marbleKey = key;
      this.ribbons = [];
      // Each local rotation is a smooth, invertible twist. Compose them to
      // comb parallel ink into eddies without a simulation or frame history.
      const eddies = Array.from({ length: 4 }, (_, i) => ({
        x: 0.1 + hash(i, 3, c.artSeed) * 0.8,
        y: 0.08 + hash(i, 7, c.artSeed) * 0.84,
        radius: 0.2 + hash(i, 11, c.artSeed) * 0.16,
        spin: (i % 2 ? -1 : 1) * c.marbleSwirl * 4.5,
      }));
      const aspect = w / h;
      const warp = (x, y) => {
        for (const e of eddies) {
          const dx = (x - e.x) * aspect, dy = y - e.y, d = Math.hypot(dx, dy) / e.radius;
          if (d >= 1) continue;
          const angle = e.spin * (1 - d * d) ** 3, cos = Math.cos(angle), sin = Math.sin(angle);
          x = e.x + (dx * cos - dy * sin) / aspect;
          y = e.y + dx * sin + dy * cos;
        }
        return [x, y];
      };
      const steps = w * 6;
      for (let row = -1; row <= h; row++) {
        const curve = new Float64Array((steps + 1) * 6);
        for (let k = 0; k <= steps; k++) {
          const x = k / steps, y = (row + 0.5) * pitch;
          const p = warp(x, y), a = warp(x, y - pitch * 0.34), b = warp(x, y + pitch * 0.34);
          curve.set([p[0], p[1], a[0] - p[0], a[1] - p[1], b[0] - p[0], b[1] - p[1]], k * 6);
        }
        this.ribbons.push(curve);
      }
    }
    for (const curve of this.ribbons) {
      let top = [], bottom = [], lastInk, lastAlpha;
      const flush = () => {
        if (!top.length) return;
        for (let i = bottom.length - 2; i >= 0; i -= 2) top.push(bottom[i], bottom[i + 1]);
        marks.add(lastInk, lastAlpha, top);
        top = []; bottom = [];
      };
      const endpoint = (i, p) => {
        const weight = c.marbleWeight * (c.artColorMode === "ink" ? tone(p) : 0.22 + tone(p) * 0.78);
        top.push(curve[i] + curve[i + 2] * weight, curve[i + 1] + curve[i + 3] * weight);
        bottom.push(curve[i] + curve[i + 4] * weight, curve[i + 1] + curve[i + 5] * weight);
      };
      let left = sample(curve[0], curve[1]);
      for (let i = 6; i < curve.length; i += 6) {
        const right = sample(curve[i], curve[i + 1]);
        const alpha = left[3] + right[3];
        if (!alpha) { flush(); left = right; continue; }
        const p = [(left[0] * left[3] + right[0] * right[3]) / alpha,
          (left[1] * left[3] + right[1] * right[3]) / alpha,
          (left[2] * left[3] + right[2] * right[3]) / alpha, Math.round(alpha / 2)];
        const ink = color(p);
        if (ink !== lastInk || p[3] !== lastAlpha) flush();
        if (!top.length) { lastInk = ink; lastAlpha = p[3]; endpoint(i - 6, left); }
        endpoint(i, right);
        left = right;
      }
      flush();
    }
  }

  topography(marks, sample, color, tone, c, w, h) {
    const size = (w + 1) * (h + 1), stride = w + 1;
    if (this.field?.length !== size) {
      this.field = new Float32Array(size);
      this.work = new Float32Array(size);
      this.alpha = new Float32Array(size);
      this.alphaWork = new Float32Array(size);
    }
    let field = this.field, work = this.work, alpha = this.alpha, alphaWork = this.alphaWork;
    for (let y = 0; y <= h; y++) for (let x = 0; x <= w; x++) {
      const p = sample(x / w, y / h), i = y * stride + x;
      // Premultiplied filtering prevents invisible RGB from creating contours.
      alpha[i] = p[3] / 255;
      field[i] = luma(p[0], p[1], p[2]) / 255 * alpha[i];
    }
    for (let pass = 0; pass < c.topoSoftness; pass++) {
      for (let y = 0; y <= h; y++) for (let x = 0; x <= w; x++) {
        const i = y * stride + x, a = y * stride + Math.max(0, x - 1), b = y * stride + Math.min(w, x + 1);
        work[i] = (field[a] + field[i] * 2 + field[b]) / 4;
        alphaWork[i] = (alpha[a] + alpha[i] * 2 + alpha[b]) / 4;
      }
      for (let y = 0; y <= h; y++) for (let x = 0; x <= w; x++) {
        const i = y * stride + x, a = Math.max(0, y - 1) * stride + x, b = Math.min(h, y + 1) * stride + x;
        field[i] = (work[a] + work[i] * 2 + work[b]) / 4;
        alpha[i] = (alphaWork[a] + alphaWork[i] * 2 + alphaWork[b]) / 4;
      }
    }
    for (let i = 0; i < size; i++) field[i] = alpha[i] ? field[i] / alpha[i] : 0;
    const levels = c.topoLevels, isolines = c.topoStyle === "isolines";
    const triangle = (a, b, d) => {
      const points = [a, b, d].flatMap(i => [(i % stride) / w, Math.floor(i / stride) / h, field[i]]);
      const p = sample((points[0] + points[3] + points[6]) / 3, (points[1] + points[4] + points[7]) / 3);
      if (!p[3]) return;
      const min = Math.min(field[a], field[b], field[d]), max = Math.max(field[a], field[b], field[d]);
      const first = Math.min(levels - 1, Math.max(isolines ? 1 : 0, Math.floor(min * levels)));
      const last = Math.min(levels - 1, Math.ceil(max * levels));
      for (let level = first; level <= last; level++) {
        const low = isolines ? (level - c.topoContour / 2) / levels : level / levels;
        const high = isolines ? (level + c.topoContour / 2) / levels : level === levels - 1 ? 1 : (level + 1 - c.topoContour) / levels;
        if (min > high || max < low) continue;
        let poly = min < low ? clip(points, low, true) : points;
        if (max > high) poly = clip(poly, high, false);
        if (poly.length < 9) continue;
        const path = [];
        for (let k = 0; k < poly.length; k += 3) path.push(poly[k], poly[k + 1]);
        const value = (level + (isolines ? 0 : 0.5)) / levels * 255;
        const ink = color(c.artColorMode === "tone" ? [value, value, value, p[3]] : p);
        marks.add(ink, c.artColorMode === "ink" && !isolines ? Math.round(p[3] * tone(p)) : p[3], path);
      }
    };
    // Uniform terrace interiors become horizontal runs. Only boundaries need
    // triangle clipping; large flat areas do not carry thousands of tiny paths.
    for (let y = 0; y < h; y++) {
      let start = 0, runInk, runAlpha;
      const flush = x => {
        if (runInk) marks.add(runInk, runAlpha, [start / w, y / h, x / w, y / h, x / w, (y + 1) / h, start / w, (y + 1) / h]);
        runInk = null;
      };
      for (let x = 0; x < w; x++) {
        const a = y * stride + x;
        const min = Math.min(field[a], field[a + 1], field[a + stride], field[a + stride + 1]);
        const max = Math.max(field[a], field[a + 1], field[a + stride], field[a + stride + 1]);
        const level = Math.min(levels - 1, Math.floor(min * levels));
        if (!isolines && max <= (level === levels - 1 ? 1 : (level + 1 - c.topoContour) / levels) && c.artColorMode === "tone") {
          const p = sample((x + 0.5) / w, (y + 0.5) / h), value = (level + 0.5) / levels * 255;
          const ink = color([value, value, value, p[3]]);
          if (runInk !== ink || runAlpha !== p[3]) { flush(x); start = x; runInk = ink; runAlpha = p[3]; }
        } else {
          flush(x);
          triangle(a, a + 1, a + stride + 1);
          triangle(a, a + stride + 1, a + stride);
        }
      }
      flush(w);
    }
  }

  threadwork(marks, sample, color, tone, c, w, h, hash) {
    const light = (x, y, fallback) => {
      const p = sample(x / w, y / h);
      return p[3] ? luma(p[0], p[1], p[2]) : fallback;
    };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const cx = x + 0.5 + (hash(x, y, c.artSeed) - 0.5) * 0.08;
      const cy = y + 0.5 + (hash(x, y, c.artSeed + 19) - 0.5) * 0.08;
      const p = sample(cx / w, cy / h);
      if (!p[3]) continue;
      const lum = luma(p[0], p[1], p[2]);
      const dx = light(cx + 1, cy, lum) - light(cx - 1, cy, lum);
      const dy = light(cx, cy + 1, lum) - light(cx, cy - 1, lum);
      const strength = Math.hypot(dx, dy);
      const follow = strength / (strength + 24) * c.stitchFollow;
      const ground = Math.sin(x / w * TAU + c.artSeed) * 0.65 + Math.cos(y / h * TAU * 0.6) * 0.75;
      const tangent = Math.atan2(dy, dx) + Math.PI / 2;
      // An unoriented line field (double angles) avoids 180-degree flips.
      const angle = Math.atan2(Math.sin(ground * 2) * (1 - follow) + Math.sin(tangent * 2) * follow,
        Math.cos(ground * 2) * (1 - follow) + Math.cos(tangent * 2) * follow) / 2;
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const coverage = c.artColorMode === "ink" ? Math.sqrt(tone(p)) : 0.5 + tone(p) * 0.5;
      const length = c.stitchLength * 0.4;
      const width = c.stitchWidth * 0.23 * coverage;
      if (width < 0.00001) continue;
      const ink = color(p);
      for (let strand = 0; strand < c.stitchStrands; strand++) {
        const offset = (strand + 0.5 - c.stitchStrands / 2) * width * 2 / c.stitchStrands;
        const radius = width * 0.74 / c.stitchStrands;
        const path = [];
        for (const [tx, ty] of stitchCircle) {
          const u = tx * length, v = offset + ty * radius;
          path.push((cx + u * cos - v * sin) / w, (cy + u * sin + v * cos) / h);
        }
        marks.add(ink, p[3], path);
      }
    }
  }
}
