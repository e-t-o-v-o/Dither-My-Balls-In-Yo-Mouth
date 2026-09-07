export const kernels = {
  floyd: [
    [1, 0, 7 / 16],
    [-1, 1, 3 / 16],
    [0, 1, 5 / 16],
    [1, 1, 1 / 16],
  ],
  atkinson: [
    [1, 0, 1 / 8],
    [2, 0, 1 / 8],
    [-1, 1, 1 / 8],
    [0, 1, 1 / 8],
    [1, 1, 1 / 8],
    [0, 2, 1 / 8],
  ],
  jarvis: [
    [1, 0, 7 / 48],
    [2, 0, 5 / 48],
    [-2, 1, 3 / 48],
    [-1, 1, 5 / 48],
    [0, 1, 7 / 48],
    [1, 1, 5 / 48],
    [2, 1, 3 / 48],
    [-2, 2, 1 / 48],
    [-1, 2, 3 / 48],
    [0, 2, 5 / 48],
    [1, 2, 3 / 48],
    [2, 2, 1 / 48],
  ],
  burkes: [
    [1, 0, 8 / 32],
    [2, 0, 4 / 32],
    [-2, 1, 2 / 32],
    [-1, 1, 4 / 32],
    [0, 1, 8 / 32],
    [1, 1, 4 / 32],
    [2, 1, 2 / 32],
  ],
  sierra: [
    [1, 0, 5 / 32],
    [2, 0, 3 / 32],
    [-2, 1, 2 / 32],
    [-1, 1, 4 / 32],
    [0, 1, 5 / 32],
    [1, 1, 4 / 32],
    [2, 1, 2 / 32],
    [-1, 2, 2 / 32],
    [0, 2, 3 / 32],
    [1, 2, 2 / 32],
  ],
};
export const rgb = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
export const luma = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
const clamp = (n) => Math.min(255, Math.max(0, n));
export function nearest(r, g, b, palette) {
  let best = 0,
    dist = Infinity;
  for (let k = 0; k < palette.length; k++) {
    const p = palette[k],
      d = (r - p[0]) ** 2 + (g - p[1]) ** 2 + (b - p[2]) ** 2;
    if (d < dist) {
      dist = d;
      best = k;
    }
  }
  return best;
}
export function adjust(data, c) {
  if (
    !c.removeGreen &&
    c.effect !== "green-screen" &&
    c.saturation === 1 &&
    c.contrast === 1 &&
    c.brightness === 0 &&
    !c.invert
  )
    return data;
  const out = new Uint8ClampedArray(data);
  for (let i = 0; i < out.length; i += 4) {
    let r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    if (
      (c.removeGreen || c.effect === "green-screen") &&
      g > r * c.greenTolerance &&
      g > b * c.greenTolerance &&
      g > 60
    ) {
      out[i + 3] = 0;
      continue;
    }
    const lum = luma(r, g, b);
    for (let j = 0; j < 3; j++) {
      let v = lum + (data[i + j] - lum) * c.saturation;
      v = (v - 128) * c.contrast + 128 + c.brightness;
      out[i + j] = c.invert ? 255 - clamp(v) : clamp(v);
    }
  }
  return out;
}
export function dither(data, w, h, palette, method = "ordered", amount = 1) {
  const out = new Uint8ClampedArray(data),
    errors = method === "ordered" ? null : new Float32Array(w * 3 * 3);
  const matrix = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const kernel = kernels[method] || kernels.floyd;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4,
        e = ((y % 3) * w + x) * 3;
      if (!out[i + 3]) {
        if (errors) errors[e] = errors[e + 1] = errors[e + 2] = 0;
        continue;
      }
      const offset =
        method === "ordered"
          ? ((matrix[(y % 4) * 4 + (x % 4)] + 0.5) / 16 - 0.5) * 256 * amount
          : 0;
      const r = data[i] + (method === "ordered" ? offset : errors[e]);
      const g = data[i + 1] + (method === "ordered" ? offset : errors[e + 1]);
      const b = data[i + 2] + (method === "ordered" ? offset : errors[e + 2]);
      if (errors) errors[e] = errors[e + 1] = errors[e + 2] = 0;
      const p = palette[nearest(r, g, b, palette)];
      out[i] = p[0];
      out[i + 1] = p[1];
      out[i + 2] = p[2];
      if (method !== "ordered")
        for (const [dx, dy, f] of kernel) {
          const xx = x + dx,
            yy = y + dy;
          if (xx < 0 || xx >= w || yy >= h || !data[(yy * w + xx) * 4 + 3])
            continue;
          const ei = ((yy % 3) * w + xx) * 3;
          errors[ei] += (r - p[0]) * f * amount;
          errors[ei + 1] += (g - p[1]) * f * amount;
          errors[ei + 2] += (b - p[2]) * f * amount;
        }
    }
  return out;
}
export function edge(data, w, h, threshold) {
  const out = new Uint8ClampedArray(data.length);
  const value = (x, y) => {
    const i =
      (Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))) *
      4;
    return luma(data[i], data[i + 1], data[i + 2]);
  };
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const gx =
        -value(x - 1, y - 1) +
        value(x + 1, y - 1) -
        2 * value(x - 1, y) +
        2 * value(x + 1, y) -
        value(x - 1, y + 1) +
        value(x + 1, y + 1);
      const gy =
        -value(x - 1, y - 1) -
        2 * value(x, y - 1) -
        value(x + 1, y - 1) +
        value(x - 1, y + 1) +
        2 * value(x, y + 1) +
        value(x + 1, y + 1);
      const i = (y * w + x) * 4,
        v = Math.hypot(gx, gy) > threshold * 4 ? 255 : 0;
      out[i] = out[i + 1] = out[i + 2] = v;
      out[i + 3] = data[i + 3];
    }
  return out;
}
