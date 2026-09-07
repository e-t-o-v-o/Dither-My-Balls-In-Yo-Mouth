import {
  recordingFormats,
  mimeExtension,
  gifBudget,
  recordVideo,
} from "./export";
import { defaults } from "./model";
vi.mock("./renderer", () => ({
  FrameRenderer: class {
    render() {}
  },
  drawSignal: () => ({}),
  SVGContext: class {},
}));
test("only supported formats are offered", () => {
  expect(
    recordingFormats({ isTypeSupported: (m) => m.startsWith("video/webm") }),
  ).toEqual([
    { id: "webm", mime: "video/webm;codecs=vp9,opus", label: "WEBM" },
  ]);
  expect(recordingFormats(null)).toEqual([]);
});
test("MP4 prefers H.264/AAC when supported and falls back to the native encoder", () => {
  expect(recordingFormats({ isTypeSupported: () => true })[0].mime)
    .toBe("video/mp4;codecs=avc1,mp4a.40.2");
  expect(recordingFormats({ isTypeSupported: (mime) => mime === "video/mp4" }))
    .toEqual([{ id: "mp4", mime: "video/mp4", label: "MP4" }]);
});
test("the extension follows the actual container, never a requested label", () => {
  expect(mimeExtension("video/webm;codecs=vp8")).toBe("webm");
  expect(mimeExtension("video/mp4")).toBe("mp4");
  expect(() => mimeExtension("audio/aac")).toThrow();
});
test("GIF memory budget considers frame count, dimensions, and duration", () => {
  expect(gifBudget(480, 270, 5, 12)).toBe(true);
  expect(gifBudget(720, 405, 30, 15)).toBe(false);
  expect(gifBudget(100, 100, 31, 10)).toBe(false);
});
describe("recorder lifecycle", () => {
  let stopTrack, recorder, c;
  beforeEach(() => {
    recorder = undefined;
    stopTrack = vi.fn();
    HTMLCanvasElement.prototype.captureStream = () => ({
      getTracks: () => [{ stop: stopTrack }],
      addTrack: vi.fn(),
    });
    global.MediaRecorder = class {
      constructor(stream, options) {
        this.state = "inactive";
        this.mimeType = "video/webm";
        recorder = this;
      }
      start() {
        this.state = "recording";
      }
      stop() {
        this.state = "inactive";
        this.ondataavailable({
          data: new Blob(["webm"], { type: "video/webm" }),
        });
        this.onstop();
      }
    };
    c = new AbortController();
  });
  afterEach(() => {
    delete global.MediaRecorder;
    delete HTMLCanvasElement.prototype.captureStream;
  });
  const options = () => ({
    source: { kind: "demo", width: 320, height: 180 },
    config: defaults,
    resolution: "1280",
    format: { mime: "video/webm" },
    fps: 30,
    start: 0,
    end: 2,
    signal: c.signal,
  });
  test("cancel stops capture tracks and rejects without a partial download", async () => {
    const promise = recordVideo(options());
    await Promise.resolve();
    c.abort();
    await expect(promise).rejects.toHaveProperty("name", "AbortError");
    expect(recorder.state).toBe("inactive");
    expect(stopTrack).toHaveBeenCalled();
  });
  test("already-cancelled work never starts recording", async () => {
    c.abort();
    await expect(recordVideo(options())).rejects.toHaveProperty(
      "name",
      "AbortError",
    );
    expect(recorder).toBeUndefined();
  });
  test("codec setup failures release the stream", async () => {
    global.MediaRecorder = class {
      constructor() {
        throw new Error("unsupported");
      }
    };
    await expect(recordVideo(options())).rejects.toThrow("not supported");
    expect(stopTrack).toHaveBeenCalled();
  });
  test("cancelling camera recording keeps its preview source running", async () => {
    const element = { pause: vi.fn(), ended: false };
    const promise = recordVideo({
      ...options(),
      source: { kind: "camera", element, width: 320, height: 180 },
    });
    await Promise.resolve();
    c.abort();
    await expect(promise).rejects.toHaveProperty("name", "AbortError");
    expect(element.pause).not.toHaveBeenCalled();
    expect(stopTrack).toHaveBeenCalled();
  });
});
