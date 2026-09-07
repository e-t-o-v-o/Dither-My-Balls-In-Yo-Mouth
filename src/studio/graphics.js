import { rgb, luma, nearest } from "./pixels";

// Marching squares with shared edge vertices. Chains keep bead spacing continuous
// across cell boundaries instead of restarting dots at every short segment.
export function contourPaths(data, w, h, threshold, alphaOnly = false) {
  const nodes = new Map(),
    segments = [];
  const field = new Float32Array(w * h);
  for (let p = 0; p < field.length; p++) {
    const i = p * 4;
    field[p] = alphaOnly
      ? data[i + 3]
      : (luma(data[i], data[i + 1], data[i + 2]) * data[i + 3]) / 255;
  }
  const sample = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return 0;
    return field[y * w + x];
  };
  const level = Math.max(0.5, Math.min(254.5, threshold));
  for (let y = -1; y < h; y++)
    for (let x = -1; x < w; x++) {
      const values = [
        sample(x, y),
        sample(x + 1, y),
        sample(x + 1, y + 1),
        sample(x, y + 1),
      ];
      if (values.every((v) => v >= level) || values.every((v) => v < level))
        continue;
      const points = [
        [x + 0.5, y + 0.5],
        [x + 1.5, y + 0.5],
        [x + 1.5, y + 1.5],
        [x + 0.5, y + 1.5],
      ];
      const keys = [
        `h${x},${y}`,
        `v${x + 1},${y}`,
        `h${x},${y + 1}`,
        `v${x},${y}`,
      ];
      const edges = [];
      for (let k = 0; k < 4; k++) {
        const next = (k + 1) % 4;
        if (values[k] >= level === values[next] >= level) continue;
        const key = keys[k];
        if (!nodes.has(key)) {
          const t = (level - values[k]) / (values[next] - values[k]);
          nodes.set(key, {
            point: [
              points[k][0] + t * (points[next][0] - points[k][0]),
              points[k][1] + t * (points[next][1] - points[k][1]),
            ],
            edges: [],
          });
        }
        edges.push(key);
      }
      const add = (a, b) => {
        const id = segments.length;
        segments.push([edges[a], edges[b]]);
        nodes.get(edges[a]).edges.push(id);
        nodes.get(edges[b]).edges.push(id);
      };
      if (edges.length === 2) add(0, 1);
      else if (edges.length === 4) {
        const center = values.reduce((a, b) => a + b, 0) / 4 >= level;
        if (values[0] >= level === center) {
          add(0, 1);
          add(2, 3);
        } else {
          add(0, 3);
          add(1, 2);
        }
      }
    }
  const visited = new Uint8Array(segments.length),
    paths = [];
  const trace = (start) => {
    let key = start;
    const points = [nodes.get(key).point];
    for (;;) {
      const id = nodes.get(key).edges.find((e) => !visited[e]);
      if (id === undefined) break;
      visited[id] = 1;
      const pair = segments[id];
      key = pair[0] === key ? pair[1] : pair[0];
      points.push(nodes.get(key).point);
      if (key === start) break;
    }
    if (points.length > 1) paths.push(points);
  };
  for (const [key, node] of nodes) if (node.edges.length === 1) trace(key);
  for (const [key, node] of nodes)
    if (node.edges.some((e) => !visited[e])) trace(key);
  return paths;
}
export function spacedPoints(path, spacing, scaleX = 1, scaleY = 1) {
  const points = [];
  let remaining = spacing / 2;
  for (let k = 1; k < path.length; k++) {
    const x = path[k - 1][0] * scaleX,
      y = path[k - 1][1] * scaleY;
    const dx = (path[k][0] - path[k - 1][0]) * scaleX,
      dy = (path[k][1] - path[k - 1][1]) * scaleY;
    const length = Math.hypot(dx, dy);
    if (!length) continue;
    while (remaining < length) {
      points.push([
        x + (dx * remaining) / length,
        y + (dy * remaining) / length,
      ]);
      remaining += spacing;
    }
    remaining -= length;
  }
  return points;
}
const hash = (x, y) => {
  let n = Math.imul(x + 1, 374761393) ^ Math.imul(y + 1, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};
function primitive(ctx, shape, x, y, size) {
  const r = size / 2;
  ctx.beginPath();
  if (shape === "dot" || shape === "ring") {
    if (shape === "ring") {
      // Even-odd hole is shared by Canvas and SVG.
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.moveTo(x + r * 0.62, y);
      ctx.arc(x, y, r * 0.62, 0, Math.PI * 2);
    } else ctx.arc(x, y, r, 0, Math.PI * 2);
  } else if (shape === "square") ctx.rect(x - r, y - r, size, size);
  else {
    const vertices =
      shape === "diamond"
        ? [
            [0, -1],
            [1, 0],
            [0, 1],
            [-1, 0],
          ]
        : shape === "cross"
          ? [
              [-0.25, -1],
              [0.25, -1],
              [0.25, -0.25],
              [1, -0.25],
              [1, 0.25],
              [0.25, 0.25],
              [0.25, 1],
              [-0.25, 1],
              [-0.25, 0.25],
              [-1, 0.25],
              [-1, -0.25],
              [-0.25, -0.25],
            ]
          : shape === "arrow"
            ? [
                [-1, -1],
                [1, -1],
                [1, 1],
                [0.4, 1],
                [0.4, 0],
                [-0.6, 1],
                [-1, 0.6],
                [0, -0.4],
                [-1, -0.4],
              ]
            : [
                [-0.9, 0.55],
                [0.55, -0.9],
                [0.9, -0.55],
                [-0.55, 0.9],
              ];
    vertices.forEach(([xx, yy], i) =>
      i
        ? ctx.lineTo(x + xx * r, y + yy * r)
        : ctx.moveTo(x + xx * r, y + yy * r),
    );
    ctx.closePath();
  }
  ctx.fill("evenodd");
}
export class GraphicRenderer {
  constructor() {
    this.stamps = new Map();
    this.layer = document.createElement("canvas");
  }
  begin(ctx, width, height, vector) {
    this.ctx = ctx;
    this.width = width;
    this.height = height;
    this.vector = vector;
    if (!vector) {
      if (this.pixels?.length !== width * height * 4)
        this.pixels = new Uint8ClampedArray(width * height * 4);
      else this.pixels.fill(0);
    }
  }
  stamp(shape, x, y, size, color, alpha = 1) {
    if (size <= 0 || alpha <= 0) return;
    if (this.vector) {
      this.ctx.fillStyle = `rgb(${color.map(Math.round).join(",")})`;
      this.ctx.globalAlpha = alpha;
      primitive(this.ctx, shape, x, y, size);
      return;
    }
    const diameter = Math.max(1, Math.round(size * 2) / 2),
      key = `${shape}/${diameter}`;
    let stamp = this.stamps.get(key);
    if (!stamp) {
      const tile = document.createElement("canvas");
      tile.width = tile.height = Math.ceil(diameter) + 4;
      const tc = tile.getContext("2d", { willReadFrequently: true });
      tc.fillStyle = "#ffffff";
      primitive(tc, shape, tile.width / 2, tile.height / 2, diameter);
      const data = tc.getImageData(0, 0, tile.width, tile.height).data,
        points = [];
      for (let yy = 0; yy < tile.height; yy++)
        for (let xx = 0; xx < tile.width; xx++) {
          const a = data[(yy * tile.width + xx) * 4 + 3];
          if (a) points.push(xx, yy, a);
        }
      stamp = { points: new Uint16Array(points), size: tile.width };
      if (this.stamps.size >= 96) this.stamps.clear();
      this.stamps.set(key, stamp);
    }
    const ox = Math.round(x - stamp.size / 2),
      oy = Math.round(y - stamp.size / 2),
      p = this.pixels;
    for (let k = 0; k < stamp.points.length; k += 3) {
      const xx = ox + stamp.points[k],
        yy = oy + stamp.points[k + 1];
      if (xx < 0 || yy < 0 || xx >= this.width || yy >= this.height) continue;
      const i = (yy * this.width + xx) * 4,
        a = (stamp.points[k + 2] / 255) * alpha;
      if (!p[i + 3] || a === 1) {
        p[i] = color[0];
        p[i + 1] = color[1];
        p[i + 2] = color[2];
        p[i + 3] = a * 255;
        continue;
      }
      const old = (p[i + 3] / 255) * (1 - a),
        out = a + old;
      p[i] = (color[0] * a + p[i] * old) / out;
      p[i + 1] = (color[1] * a + p[i + 1] * old) / out;
      p[i + 2] = (color[2] * a + p[i + 2] * old) / out;
      p[i + 3] = out * 255;
    }
  }
  finish() {
    this.ctx.globalAlpha = 1;
    if (this.vector) return;
    if (this.layer.width !== this.width) this.layer.width = this.width;
    if (this.layer.height !== this.height) this.layer.height = this.height;
    this.layer
      .getContext("2d")
      .putImageData(new ImageData(this.pixels, this.width, this.height), 0, 0);
    this.ctx.drawImage(this.layer, 0, 0);
  }
  render(ctx, data, w, h, c, width, height, palette, vector) {
    this.begin(ctx, width, height, vector);
    const cw = width / w,
      ch = height / h,
      cell = Math.min(cw, ch),
      fg = rgb(c.fgColor),
      accent = rgb(c.accentColor);
    if (c.effect === "beads") {
      const paths = contourPaths(
        data,
        w,
        h,
        c.threshold,
        c.contourSource === "alpha",
      );
      if (c.contourFill) {
        ctx.fillStyle = c.fillColor;
        ctx.beginPath();
        for (const path of paths) {
          path.forEach(([x, y], i) =>
            i ? ctx.lineTo(x * cw, y * ch) : ctx.moveTo(x * cw, y * ch),
          );
          ctx.closePath();
        }
        ctx.fill("evenodd");
      }
      const spacing = cell * c.beadSpacing,
        size = cell * c.beadSize;
      for (const path of paths)
        for (const [x, y] of spacedPoints(path, spacing, cw, ch)) {
          this.stamp("dot", x, y, size, accent);
          this.stamp("dot", x, y, size * (1 - c.beadRing), fg);
        }
    } else {
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          let alpha = data[i + 3] / 255,
            r = data[i],
            g = data[i + 1],
            b = data[i + 2];
          if (
            c.effect === "mosaic" &&
            c.mosaicLayout === "staggered" &&
            y % 2 &&
            x + 1 < w
          ) {
            const nextAlpha = data[i + 7] / 255,
              sum = alpha + nextAlpha;
            if (sum) {
              r = (r * alpha + data[i + 4] * nextAlpha) / sum;
              g = (g * alpha + data[i + 5] * nextAlpha) / sum;
              b = (b * alpha + data[i + 6] * nextAlpha) / sum;
            }
            alpha = sum / 2;
          }
          if (!alpha) continue;
          const color =
            c.shapeColor === "palette"
              ? palette[nearest(r, g, b, palette)]
              : c.shapeColor === "ink"
                ? c.effect === "symbols" && hash(x, y) < c.accentAmount
                  ? accent
                  : fg
                : [r, g, b];
          let xx = (x + 0.5) * cw,
            yy = (y + 0.5) * ch;
          if (c.effect === "mosaic") {
            if (c.mosaicLayout === "staggered") xx += ((y % 2) * cw) / 2;
            this.stamp("dot", xx, yy, cell * 0.88 * c.dotScale, color, alpha);
          } else {
            const darkness = 1 - luma(data[i], data[i + 1], data[i + 2]) / 255;
            if (darkness < 0.04) continue;
            const bucket = Math.min(4, Math.floor(darkness * 5));
            const shape =
              c.symbolSet === "orbital"
                ? bucket < 3
                  ? "ring"
                  : "dot"
                : c.symbolSet === "directional"
                  ? bucket < 2
                    ? "slash"
                    : "arrow"
                  : [
                      "dot",
                      "ring",
                      hash(x + 9, y) > 0.5 ? "cross" : "slash",
                      "diamond",
                      hash(x, y + 7) > 0.5 ? "arrow" : "square",
                    ][bucket];
            const scale = bucket === 0 ? 0.2 + darkness : 0.48 + darkness * 0.4;
            this.stamp(shape, xx, yy, cell * scale, color, alpha);
          }
        }
    }
    this.finish();
  }
}
