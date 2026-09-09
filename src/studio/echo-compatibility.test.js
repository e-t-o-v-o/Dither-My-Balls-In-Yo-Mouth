// @vitest-environment node
import { createCanvas } from "@napi-rs/canvas";
import { EchoSampler } from "./echo-sampler";
import { defaults } from "./model";
import { seek, releaseSource } from "./media";
vi.mock("mediabunny", () => ({
  Input: class {
    async getPrimaryVideoTrack() {
      return { canDecode: async () => false };
    }
    dispose() {}
  },
  BlobSource: class {},
  ALL_FORMATS: [],
}));
vi.mock("./media", async (importOriginal) => ({
  ...(await importOriginal()),
  createVideoElement: () => createCanvas(640, 360),
  waitForMedia: async () => {},
  seek: vi.fn(async () => {}),
  releaseSource: vi.fn(),
}));
test("echoes use independent HTML video decoding when WebCodecs cannot decode", async () => {
  vi.stubGlobal("document", { createElement: () => createCanvas(1, 1) });
  const sampler = new EchoSampler({
    kind: "video",
    file: new Blob(),
    url: "blob:fixture",
    width: 640,
    height: 360,
  });
  try {
    const config = { ...defaults, echoCount: 2, echoSpacing: 0.15 };
    const frames = await sampler.frames(0.6, config);
    expect(frames.map((frame) => frame.time)).toEqual([0.45, 0.3]);
    expect(frames[0].source.width).toBe(480);
    expect(seek).toHaveBeenCalledTimes(2);
    await sampler.frames(0.62, config);
    expect(seek).toHaveBeenCalledTimes(2);
  } finally {
    sampler.dispose();
    vi.unstubAllGlobals();
  }
  expect(releaseSource).toHaveBeenCalledOnce();
});
