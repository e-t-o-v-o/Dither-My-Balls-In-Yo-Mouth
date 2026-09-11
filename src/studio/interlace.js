import { luma, rgb } from "./pixels";

// The loom depends only on normalized grid coordinates and an explicit seed.
// Media time and frame order never change the pattern's topology.
function hash(x, y, seed = 0) {
  let n = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263) ^ Math.imul(seed + 1, 69069);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return (n ^ (n >>> 16)) >>> 0;
}
const clamp = (n) => Math.max(0, Math.min(1, n));
const distance = (r, g, b) => r * r * 0.25 + g * g * 0.6 + b * b * 0.15;

export function loomRegions(w, h, seed) {
  const regions = [];
  const split = (x, y, width, height, depth) => {
    const key = hash(x, y, seed + depth);
    if ((width <= 5 && height <= 6) || (width * height <= 24 && key % 5 === 0)) {
      regions.push({ x, y, width, height, key });
      return;
    }
    const vertical = width > 5 && (height <= 6 || width / height > 1.2 || key % 3 === 0);
    const size = vertical ? width : height;
    const cut = Math.max(1, Math.min(size - 1, Math.round(size * (0.3 + (key % 401) / 1000))));
    if (vertical) {
      split(x, y, cut, height, depth + 1);
      split(x + cut, y, width - cut, height, depth + 1);
    } else {
      split(x, y, width, cut, depth + 1);
      split(x, y + cut, width, height - cut, depth + 1);
    }
  };
  split(0, 0, w, h, 0);
  return regions;
}

export class InterlaceRenderer {
  constructor() {
    this.colors = new Map();
    this.groups = new Map();
  }

  // A two-ink reconstruction preserves local image tone while expressing it as
  // solid bands. Tonal inks choose a spatially stable primary thread; source
  // color mode selects the nearest ink before fitting the second one.
  pair(r, g, b, primary, tonal) {
    const target = luma(r, g, b) / 255;
    const key = tonal
      ? 32768 + primary * 256 + Math.round(target * 255)
      : ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    if (this.colors.has(key)) return this.colors.get(key);
    if (tonal) r = g = b = Math.round(target * 255);
    else {
      r = (r >> 3) * 8 + 3.5;
      g = (g >> 3) * 8 + 3.5;
      b = (b >> 3) * 8 + 3.5;
      let nearest = Infinity;
      this.inks.forEach((ink, i) => {
        const error = distance(r - ink[0], g - ink[1], b - ink[2]);
        if (error < nearest) { nearest = error; primary = i; }
      });
    }
    const a = this.inks[primary];
    const tone = tonal ? r / 255 : target;
    let best = Infinity, result = [primary, primary, 0];
    for (let i = 0; i < this.inks.length; i++) {
      if (i === primary) continue;
      const ink = this.inks[i];
      const dr = ink[0] - a[0], dg = ink[1] - a[1], db = ink[2] - a[2];
      const dy = ink[3] - a[3];
      const t = clamp(tonal
        ? (Math.abs(dy) > 0.0001 ? (tone - a[3]) / dy : 0)
        : ((r - a[0]) * dr * 0.25 + (g - a[1]) * dg * 0.6 + (b - a[2]) * db * 0.15) / Math.max(1, distance(dr, dg, db)));
      const error = tonal
        ? (a[3] + dy * t - tone) ** 2 * 100 + (t - 0.5) ** 2 * 0.035
        : distance(r - a[0] - dr * t, g - a[1] - dg * t, b - a[2] - db * t);
      if (error < best) { best = error; result = [primary, i, t]; }
    }
    this.colors.set(key, result);
    return result;
  }

  render(ctx, data, w, h, c, width, height, palette) {
    const signature = palette.join("/");
    if (signature !== this.palette) {
      this.palette = signature;
      this.inks = palette.map((hex) => { const color = rgb(hex); return [...color, luma(...color) / 255]; });
      this.colors.clear();
    }
    const topology = `${w}/${h}/${c.weaveSeed}`;
    if (topology !== this.topology) {
      this.topology = topology;
      this.regions = loomRegions(w, h, c.weaveSeed);
    }
    this.groups.clear();
    const cw = width / w, ch = height / h;
    const group = (ink, alpha) => {
      const key = ink * 256 + alpha;
      if (!this.groups.has(key)) this.groups.set(key, { ink, alpha, rectangles: [], polygons: [] });
      return this.groups.get(key);
    };
    const rectangle = (ink, alpha, x, y, rw, rh) => {
      if (rw > 0.00001 && rh > 0.00001) group(ink, alpha).rectangles.push(x, y, rw, rh);
    };
    const polygon = (ink, alpha, points) => group(ink, alpha).polygons.push(points);
    for (const region of this.regions) {
      let red = 0, green = 0, blue = 0, weight = 0;
      for (let y = region.y; y < region.y + region.height; y++)
        for (let x = region.x; x < region.x + region.width; x++) {
          const i = (y * w + x) * 4, alpha = data[i + 3];
          red += data[i] * alpha; green += data[i + 1] * alpha; blue += data[i + 2] * alpha; weight += alpha;
        }
      if (!weight) continue;
      red /= weight; green /= weight; blue /= weight;
      const horizontal = c.weavePattern !== "steps" && region.key % 7 < 2;
      const lanes = c.weavePattern === "steps" ? 1 : [1, 1, 2, 2, 4][region.key % 5];
      const primary = region.key % palette.length;
      for (let y = region.y; y < region.y + region.height; y++)
        for (let x = region.x; x < region.x + region.width; x++) {
          const i = (y * w + x) * 4, alpha = data[i + 3];
          if (!alpha) continue;
          const detail = c.weaveDetail;
          const [a, b, mix] = this.pair(
            red + (data[i] - red) * detail,
            green + (data[i + 1] - green) * detail,
            blue + (data[i + 2] - blue) * detail,
            primary, c.weaveColorMode === "tone",
          );
          const fill = clamp(mix * c.weaveWidth * 2);
          if (a === b || fill < 0.005 || fill > 0.995) {
            rectangle(fill > 0.995 ? b : a, alpha, x * cw, y * ch, cw, ch);
            continue;
          }
          const crossRow = (y - region.y + region.key % 3) % 4 === 2;
          const crossing = c.weavePattern !== "bands" && crossRow &&
            (hash(region.x, y, c.weaveSeed) % 1000) / 1000 < c.weaveCrossings &&
            (x - region.x) % 3 !== 2;
          const turn = crossing ? !horizontal : horizontal;
          const count = crossing ? 2 : lanes;
          for (let lane = 0; lane < count; lane++) {
            const lo = (1 - fill) / 2, hi = lo + fill;
            const ox = x * cw, oy = y * ch;
            const stepped = c.weavePattern === "steps" && !crossing;
            if (stepped) {
              const shift = (1 - fill) * 0.32;
              const phase = (y + region.key) % 4;
              const start = phase < 2 ? -shift : shift;
              const end = phase === 1 || phase === 2 ? shift : -shift;
              const left = [[0, 0], [lo + start, 0], [lo + start, 0.5], [lo + end, 0.85], [lo + end, 1], [0, 1]];
              const center = [[lo + start, 0], [hi + start, 0], [hi + start, 0.5], [hi + end, 0.85], [hi + end, 1], [lo + end, 1], [lo + end, 0.85], [lo + start, 0.5]];
              const right = [[hi + start, 0], [1, 0], [1, 1], [hi + end, 1], [hi + end, 0.85], [hi + start, 0.5]];
              for (const [ink, points] of [[a, left], [b, center], [a, right]])
                polygon(ink, alpha, points.map(([u, v]) => [ox + (lane + u) / count * cw, oy + v * ch]));
            } else if (turn) {
              rectangle(a, alpha, ox, oy + lane / count * ch, cw, lo / count * ch);
              rectangle(b, alpha, ox, oy + (lane + lo) / count * ch, cw, fill / count * ch);
              rectangle(a, alpha, ox, oy + (lane + hi) / count * ch, cw, (1 - hi) / count * ch);
            } else {
              rectangle(a, alpha, ox + lane / count * cw, oy, lo / count * cw, ch);
              rectangle(b, alpha, ox + (lane + lo) / count * cw, oy, fill / count * cw, ch);
              rectangle(a, alpha, ox + (lane + hi) / count * cw, oy, (1 - hi) / count * cw, ch);
            }
          }
        }
    }
    // Group by ink/coverage to avoid thousands of canvas state changes. Regions
    // partition the image; soft masks are not darkened by overlapping layers.
    for (const { ink, alpha, rectangles, polygons } of this.groups.values()) {
      ctx.fillStyle = palette[ink];
      ctx.globalAlpha = alpha / 255;
      ctx.beginPath();
      for (let i = 0; i < rectangles.length; i += 4)
        ctx.rect(rectangles[i], rectangles[i + 1], rectangles[i + 2], rectangles[i + 3]);
      for (const points of polygons) {
        points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
        ctx.closePath();
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
