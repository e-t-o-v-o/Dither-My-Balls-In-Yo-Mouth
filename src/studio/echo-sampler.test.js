import { EchoSampler, echoTimes } from "./echo-sampler";
import { loadVideo, seek } from "./media";
const reader = vi.hoisted(() => ({ dispose: vi.fn(), read: vi.fn() }));
vi.mock("mediabunny", () => ({
  ALL_FORMATS: [],
  BlobSource: class {},
  Input: class {
    getPrimaryVideoTrack = reader.read;
    dispose = reader.dispose;
  },
}));
vi.mock("./media", async (original) => ({
  ...await original(),
  createVideoElement: () => ({}),
  loadVideo: vi.fn().mockResolvedValue(undefined),
  seek: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("./canvas", () => ({
  makeCanvas: () => ({ width: 1, height: 1, getContext: () => ({ drawImage() {} }) }),
}));
test("echo sampling is deterministic across frame rates and seeks", () => {
  expect(echoTimes(0.6, 3, 0.15)).toEqual([0.45, 0.3, 0.15]);
  expect(echoTimes(0.62, 3, 0.15)).toEqual([0.45, 0.3, 0.15]);
  expect(echoTimes(0, 4, 0.15)).toEqual([]);
  expect(echoTimes(0.1, 4, 0.1)).toEqual([0]);
});

test("opening a video with echoes does not start a second decoder before there is history", async () => {
  const sampler = new EchoSampler({ kind: "video" });
  expect(await sampler.frames(0, { echoCount: 3, echoSpacing: 0.2 })).toEqual([]);
  expect(reader.read).not.toHaveBeenCalled();
  expect(loadVideo).not.toHaveBeenCalled();
  sampler.dispose();
});

test.each(["unsupported container", "unsupported codec"])("echoes fall back to the native video reader for an %s", async (reason) => {
  vi.clearAllMocks();
  if (reason === "unsupported container") reader.read.mockRejectedValueOnce(new Error(reason));
  else reader.read.mockResolvedValueOnce({ canDecode: async () => false });
  const sampler = new EchoSampler({ kind: "video", url: "blob:original", file: new Blob(["fixture"]), width: 640, height: 360 });
  const frames = await sampler.frames(0.4, { echoCount: 2, echoSpacing: 0.2 });
  expect(frames.map(frame => frame.time)).toEqual([0.2, 0]);
  expect(loadVideo).toHaveBeenCalledOnce();
  expect(loadVideo.mock.calls[0][1]).toBe("blob:original");
  expect(seek.mock.calls.map(call => call[1])).toEqual([0.2, 0]);
  expect(reader.dispose).toHaveBeenCalledOnce();
  sampler.dispose();
});
