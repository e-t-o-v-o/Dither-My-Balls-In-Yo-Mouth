import { act, renderHook } from "@testing-library/react";
import { usePreview } from "./use-preview";
import { defaults } from "./model";

vi.mock("./render-service", () => ({
  RenderService: class {
    invalidate() {}
    dispose() {}
    async render() { return { elapsed: 5, backend: "compatibility" }; }
  },
}));
vi.mock("./echo-sampler", () => ({
  EchoSampler: class { async frames() { return []; } dispose() {} },
}));

let tick;
beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (next) => { tick = next; return 1; });
  vi.stubGlobal("cancelAnimationFrame", () => {});
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage() {} });
});
afterEach(() => vi.unstubAllGlobals());

function options(overrides = {}) {
  const video = {
    currentTime: 4, duration: 4, paused: true, ended: true, readyState: 4,
    pause: vi.fn(),
    play: vi.fn(async () => { video.paused = false; video.ended = false; }),
  };
  return {
    source: { kind: "video", element: video, width: 640, height: 360 },
    config: defaults, playing: true, loop: true,
    timeRef: { current: 4 }, trimRef: { current: [0, 4] },
    canvasRef: { current: document.createElement("canvas") },
    originalRef: {}, rendererRef: {}, fontFaces: { current: {} },
    setTime: vi.fn(), setPlaying: vi.fn(), alert: vi.fn(), previewSize: "auto",
    ...overrides,
  };
}

test("a native video that ends resumes playback at the loop start", async () => {
  const o = options();
  renderHook(() => usePreview(o));
  await act(async () => { await tick(1000); });
  expect(o.source.element.currentTime).toBe(0);
  expect(o.source.element.play).toHaveBeenCalledOnce();
  expect(o.source.element.paused).toBe(false);
  expect(o.timeRef.current).toBe(0);
  expect(o.setPlaying).not.toHaveBeenCalledWith(false);
});

test("the preview stops at the end when looping is disabled", async () => {
  const o = options({ loop: false });
  renderHook(() => usePreview(o));
  await act(async () => { await tick(1000); });
  expect(o.source.element.play).not.toHaveBeenCalled();
  expect(o.source.element.pause).toHaveBeenCalledOnce();
  expect(o.setPlaying).toHaveBeenCalledWith(false);
  expect(o.timeRef.current).toBe(4);
});

test("a blocked loop restart restores the paused controls and reports the problem", async () => {
  const o = options();
  o.source.element.play.mockRejectedValueOnce(new DOMException("Playback interrupted", "NotAllowedError"));
  renderHook(() => usePreview(o));
  await act(async () => { await tick(1000); });
  expect(o.setPlaying).toHaveBeenCalledWith(false);
  expect(o.alert).toHaveBeenCalledWith("Video could not resume: Playback interrupted", true);
});
