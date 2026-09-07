import { adjust, dither, edge, nearest, kernels } from "./pixels";
import { defaults } from "./model";
const pixel = (r, g, b, a = 255) => new Uint8ClampedArray([r, g, b, a]);
test("palette matching uses actual color, independent of palette order", () => {
  expect(
    nearest(248, 4, 8, [
      [0, 0, 255],
      [255, 0, 0],
      [0, 255, 0],
    ]),
  ).toBe(1);
  expect([
    ...dither(
      pixel(250, 0, 0),
      1,
      1,
      [
        [0, 0, 255],
        [255, 0, 0],
      ],
      "floyd",
    ),
  ]).toEqual([255, 0, 0, 255]);
});
test.each(["ordered", ...Object.keys(kernels)])(
  "%s preserves black, white, and alpha",
  (method) => {
    const input = new Uint8ClampedArray([
      0, 0, 0, 255, 255, 255, 255, 128, 100, 150, 250, 0,
    ]);
    const out = dither(
      input,
      3,
      1,
      [
        [0, 0, 0],
        [255, 255, 255],
      ],
      method,
    );
    expect([...out]).toEqual([...input]);
    expect(out).not.toBe(input);
  },
);
test("diffusion choices produce distinct patterns", () => {
  const w = 31,
    h = 17,
    input = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    input[i * 4] = input[i * 4 + 1] = input[i * 4 + 2] = (i * 13) % 256;
    input[i * 4 + 3] = 255;
  }
  const patterns = Object.keys(kernels).map((method) =>
    Array.from(
      dither(
        input,
        w,
        h,
        [
          [0, 0, 0],
          [255, 255, 255],
        ],
        method,
      ),
    ).join(","),
  );
  expect(new Set(patterns).size).toBe(5);
});
test("adjustments preserve alpha and key before grading", () => {
  expect([
    ...adjust(pixel(40, 180, 30), { ...defaults, removeGreen: true }),
  ]).toEqual([40, 180, 30, 0]);
  expect(adjust(pixel(40, 50, 60, 128), { ...defaults, invert: true })).toEqual(
    pixel(215, 205, 195, 128),
  );
});
test("edge detector has no wraparound and preserves source transparency", () => {
  const out = edge(
    new Uint8ClampedArray([10, 10, 10, 255, 10, 10, 10, 0]),
    2,
    1,
    10,
  );
  expect([...out]).toEqual([0, 0, 0, 255, 0, 0, 0, 0]);
});
test("transparent cells do not diffuse hidden color into neighbors", () => {
  const out = dither(
    new Uint8ClampedArray([180, 0, 0, 0, 0, 0, 0, 255]),
    2,
    1,
    [
      [0, 0, 0],
      [255, 255, 255],
    ],
    "floyd",
  );
  expect([...out.slice(4)]).toEqual([0, 0, 0, 255]);
});
test.each([
  [0, 0],
  [64, 4],
  [128, 8],
  [192, 12],
  [255, 16],
])(
  "Bayer reproduces level %s across the complete 4×4 tonal range",
  (level, whiteCells) => {
    const input = new Uint8ClampedArray(4 * 4 * 4);
    for (let i = 0; i < input.length; i += 4) {
      input[i] = input[i + 1] = input[i + 2] = level;
      input[i + 3] = 255;
    }
    const out = dither(
      input,
      4,
      4,
      [
        [0, 0, 0],
        [255, 255, 255],
      ],
      "ordered",
    );
    let count = 0;
    for (let i = 0; i < out.length; i += 4) if (out[i] === 255) count++;
    expect(count).toBe(whiteCells);
  },
);
test("diffusion conserves error beyond the RGB endpoints", () => {
  const data = new Uint8ClampedArray([
    250, 250, 250, 255, 250, 250, 250, 255, 128, 128, 128, 255,
  ]);
  const out = dither(
    data,
    3,
    1,
    [
      [20, 20, 20],
      [230, 230, 230],
    ],
    "floyd",
  );
  expect([...out]).toEqual([
    230, 230, 230, 255, 230, 230, 230, 255, 230, 230, 230, 255,
  ]);
});
