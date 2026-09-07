import { FrameRenderer, SVGContext } from "./renderer";
import { effects, defaults } from "./model";
let contexts;
beforeEach(() => {
  contexts = [];
  HTMLCanvasElement.prototype.getContext = function () {
    if (this._ctx) return this._ctx;
    const c = {
      clearRect: vi.fn(),
      drawImage: vi.fn(),
      putImageData: vi.fn(),
      fillRect: vi.fn(),
      fillText: vi.fn(),
      getImageData: (x, y, w, h) => ({
        data: new Uint8ClampedArray(w * h * 4).fill(128),
      }),
    };
    this._ctx = c;
    contexts.push(c);
    return c;
  };
});
test.each(effects.map(([id]) => id))(
  "%s renders every exposed effect without an empty dispatch",
  (effect) => {
    const canvas = document.createElement("canvas");
    new FrameRenderer().render(
      {},
      canvas,
      { ...defaults, effect, cellSize: 80 },
      96,
      54,
    );
    const ctx = canvas.getContext("2d");
    expect(
      ctx.fillRect.mock.calls.length + ctx.fillText.mock.calls.length,
    ).toBeGreaterThan(1);
  },
);
test("custom character control actually changes glyph output", () => {
  const canvas = document.createElement("canvas");
  new FrameRenderer().render(
    {},
    canvas,
    { ...defaults, effect: "letter-char", char: "Z", cellSize: 80 },
    96,
    54,
  );
  expect(canvas.getContext("2d").fillText.mock.calls[0][0]).toBe("Z");
});
test("SVG escapes user text while retaining vector geometry", () => {
  const ctx = new SVGContext(20, 10);
  ctx.fillStyle = "#fff";
  ctx.font = '12px "test"';
  ctx.fillRect(0, 0, 20, 10);
  ctx.fillText("<&", 2, 4);
  const svg = ctx.serialize();
  expect(svg).toContain('viewBox="0 0 20 10"');
  expect(svg).toContain("&lt;&amp;");
  expect(svg).not.toContain("<&");
  expect(svg).toContain("<rect");
  expect(svg).toContain("<text");
});
