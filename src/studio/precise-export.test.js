import { exportPrecise } from "./precise-export";
import { defaults } from "./model";

const f = vi.hoisted(() => ({ render: vi.fn(), frames: vi.fn(async () => []), disposeRender: vi.fn(), disposeEcho: vi.fn(), cleanup: vi.fn(), target: vi.fn() }));
vi.mock("./render-service", () => ({ RenderService: class { render = f.render; dispose = f.disposeRender; } }));
vi.mock("./echo-sampler", () => ({ EchoSampler: class { frames = f.frames; dispose = f.disposeEcho; } }));
vi.mock("./export-plan", () => ({ planVideoExport: async () => ({ width: 320, height: 180, codec: "avc", extension: "mp4", duration: 2 }), hasPreciseExport: () => true, videoBitrate: () => 1 }));
vi.mock("./export-storage", () => ({ createExportTarget: f.target }));
vi.mock("mediabunny", () => ({
  Quality: class {}, Mp4OutputFormat: class {}, BlobSource: class {}, ALL_FORMATS: [],
  Input: class { dispose() {} },
  Output: class { state = "pending"; async cancel() { this.state = "canceled"; } },
  Conversion: { init: async ({ video, output }) => ({
    discardedTracks: [], isValid: true, utilizedTracks: [{ isVideoTrack: () => true }],
    async execute() { await video.process({ timestamp: 0 }); await video.process({ timestamp: 1 }); output.state = "finalized"; },
    async cancel() { output.state = "canceled"; },
  }) },
}));
beforeEach(() => {
  vi.clearAllMocks();
  f.target.mockResolvedValue({ target: {}, blob: async () => new Blob(["mp4"]), cleanup: f.cleanup });
});
const options = () => ({ source: { kind: "video", file: new Blob(["source"]) }, config: defaults, start: 2, end: 4 });
test("trimmed conversion timestamps are restored for both echoes and animated rendering", async () => {
  await exportPrecise(options());
  expect(f.frames.mock.calls.map(call => call[0])).toEqual([2, 3]);
  expect(f.render.mock.calls.map(call => call[5])).toEqual([
    expect.objectContaining({ time: 2, motionRange: [2, 4] }),
    expect.objectContaining({ time: 3, motionRange: [2, 4] }),
  ]);
  expect(f.disposeRender).toHaveBeenCalledOnce();
  expect(f.cleanup).not.toHaveBeenCalled(); // successful file stays downloadable
});
test("storage setup failure disposes rendering resources before any frame is processed", async () => {
  f.target.mockRejectedValueOnce(new Error("No space"));
  await expect(exportPrecise(options())).rejects.toThrow("No space");
  expect(f.disposeRender).toHaveBeenCalledOnce();
  expect(f.disposeEcho).toHaveBeenCalledOnce();
  expect(f.render).not.toHaveBeenCalled();
});
test("render failures remove partial output and retain the original error", async () => {
  f.render.mockRejectedValueOnce(new Error("Frame failed"));
  await expect(exportPrecise(options())).rejects.toThrow("Frame failed");
  expect(f.cleanup).toHaveBeenCalledOnce();
  expect(f.disposeRender).toHaveBeenCalledOnce();
});
