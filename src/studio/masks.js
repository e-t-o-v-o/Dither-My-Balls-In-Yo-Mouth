import { luma, rgb } from "./pixels";
const smooth = (a, b, value) => {
  if (a === b) return value >= b ? 1 : 0;
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
// Selection is made from source colors before grading. Source alpha is never expanded.
export function applyMask(data, c) {
  if (c.maskMode === "none") return data;
  const out = new Uint8ClampedArray(data),
    target = rgb(c.maskColor);
  const feather = c.maskSoftness;
  for (let i = 0; i < data.length; i += 4) {
    let coverage;
    if (c.maskMode === "color") {
      const distance =
        Math.hypot(
          data[i] - target[0],
          data[i + 1] - target[1],
          data[i + 2] - target[2],
        ) / Math.sqrt(3 * 255 ** 2);
      coverage =
        1 - smooth(c.maskTolerance, c.maskTolerance + feather, distance);
    } else {
      const value = luma(data[i], data[i + 1], data[i + 2]) / 255;
      coverage =
        (c.maskLow === 0
          ? 1
          : smooth(c.maskLow / 255 - feather, c.maskLow / 255, value)) *
        (c.maskHigh === 255
          ? 1
          : 1 - smooth(c.maskHigh / 255, c.maskHigh / 255 + feather, value));
    }
    out[i + 3] = data[i + 3] * (c.maskInvert ? 1 - coverage : coverage);
  }
  return out;
}
