import { moveCrop, resizeCrop } from "./crop-geometry";
const crop = { cropX: .2, cropY: .2, cropWidth: .6, cropHeight: .6 };
test("moving a crop preserves its size and cannot leave the source", () => {
  expect(moveCrop(crop, 2, -2)).toEqual({ cropX: .4, cropY: 0, cropWidth: .6, cropHeight: .6 });
});
test("free resizing keeps the opposite corner anchored and enforces a useful minimum", () => {
  const next = resizeCrop(crop, "nw", 5, 5);
  expect(next.cropWidth).toBe(.05);
  expect(next.cropHeight).toBe(.05);
  expect(next.cropX + next.cropWidth).toBeCloseTo(.8);
  expect(next.cropY + next.cropHeight).toBeCloseTo(.8);
});
test("locked resizing preserves the selected ratio at all four source boundaries", () => {
  for (const corner of ["nw", "ne", "sw", "se"]) {
    const next = resizeCrop(crop, corner, 2, 2, 1);
    expect(next.cropWidth / next.cropHeight).toBeCloseTo(1);
    expect(next.cropX).toBeGreaterThanOrEqual(0);
    expect(next.cropY).toBeGreaterThanOrEqual(0);
    expect(next.cropX + next.cropWidth).toBeLessThanOrEqual(1);
    expect(next.cropY + next.cropHeight).toBeLessThanOrEqual(1);
  }
});
