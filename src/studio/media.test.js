import { seek, waitForMedia, releaseSource, AudioRouter } from "./media";
test("seek waits until the decoded frame is ready", async () => {
  const video = new EventTarget();
  Object.assign(video, { duration: 5, currentTime: 0, readyState: 2 });
  const promise = seek(video, 3);
  expect(video.currentTime).toBe(3);
  video.dispatchEvent(new Event("seeked"));
  await promise;
});
test("seek is immediately cancellable", async () => {
  const video = new EventTarget();
  Object.assign(video, { duration: 5, currentTime: 0, readyState: 2 });
  const c = new AbortController();
  const promise = seek(video, 3, c.signal);
  c.abort();
  await expect(promise).rejects.toHaveProperty("name", "AbortError");
});
test("decode errors reject instead of hanging", async () => {
  const element = new EventTarget();
  const promise = waitForMedia(element, "load");
  element.dispatchEvent(new Event("error"));
  await expect(promise).rejects.toThrow("cannot be decoded");
});
test("releasing a source stops tracks and revokes its file URL", () => {
  URL.revokeObjectURL = vi.fn();
  const stop = vi.fn(),
    element = {
      pause: vi.fn(),
      srcObject: { getTracks: () => [{ stop }] },
      removeAttribute: vi.fn(),
      load: vi.fn(),
    };
  releaseSource({ element, url: "blob:test" });
  expect(stop).toHaveBeenCalled();
  expect(element.srcObject).toBeNull();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test");
});
test("monitor mute does not mute the export audio route", async () => {
  const connect = vi.fn(),
    gain = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() },
    stream = { getTracks: () => [] };
  const create = vi.fn(() => ({ connect, disconnect: vi.fn() }));
  window.AudioContext = class {
    constructor() {
      this.destination = {};
    }
    createMediaElementSource = create;
    createMediaStreamDestination = () => ({ stream });
    createGain = () => gain;
    resume = () => Promise.resolve();
    close = () => Promise.resolve();
  };
  const router = new AudioRouter(),
    video = { muted: true };
  expect(await router.connect(video, false)).toBe(stream);
  expect(video.muted).toBe(false);
  expect(gain.gain.value).toBe(0);
  expect(connect).toHaveBeenCalledTimes(2);
  await router.connect(video, true);
  expect(create).toHaveBeenCalledTimes(1);
  expect(gain.gain.value).toBe(1);
  router.close();
  delete window.AudioContext;
});
