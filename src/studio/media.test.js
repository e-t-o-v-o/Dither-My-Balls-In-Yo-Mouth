import { seek, waitForMedia, loadVideo, loadFile, releaseSource, AudioRouter } from "./media";
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function videoFixture() {
  const video = new EventTarget();
  Object.assign(video, { duration: 5, readyState: 0, seeking: false, paused: true });
  let time = 0;
  Object.defineProperty(video, "currentTime", {
    get: () => time,
    set: (value) => {
      time = value;
      video.seeking = true;
      queueMicrotask(() => {
        video.seeking = false;
        video.dispatchEvent(new Event("seeked"));
      });
    },
  });
  video.load = vi.fn(() => {
    video.readyState = 1;
    video.dispatchEvent(new Event("loadedmetadata"));
  });
  video.pause = vi.fn(() => { video.paused = true; });
  video.play = vi.fn(() => {
    video.paused = false;
    video.readyState = 2;
    video.dispatchEvent(new Event("playing"));
    return Promise.resolve();
  });
  return video;
}

test("video import starts muted decoding synchronously and accepts a frame without loadeddata", async () => {
  const video = videoFixture();
  const promise = loadVideo(video, "blob:movie");
  expect(video.src).toBe("blob:movie");
  expect(video.load).toHaveBeenCalledOnce();
  expect(video.play).toHaveBeenCalledOnce();
  expect(video.muted && video.defaultMuted && video.playsInline).toBe(true);
  await promise;
  expect(video.paused).toBe(true);
  expect(video.currentTime).toBe(0);
});

test("a first frame is sufficient even when the browser never settles play()", async () => {
  const video = videoFixture();
  video.play.mockImplementation(() => {
    video.readyState = 2;
    video.dispatchEvent(new Event("canplay"));
    return new Promise(() => {});
  });
  await loadVideo(video, "blob:movie");
  expect(video.pause).toHaveBeenCalledOnce();
});

test("readiness polling recovers suppressed events without waiting for a timeout", async () => {
  vi.useFakeTimers();
  const video = videoFixture();
  const pending = waitForMedia(video, "loadeddata");
  video.readyState = 2;
  await vi.advanceTimersByTimeAsync(100);
  await pending;
  expect(vi.getTimerCount()).toBe(0);
});

test("metadata alone is not accepted as a drawable frame", async () => {
  const video = videoFixture();
  const c = new AbortController();
  let resolved = false;
  const pending = waitForMedia(video, "loadeddata", c.signal).then(() => { resolved = true; });
  video.readyState = 1;
  video.dispatchEvent(new Event("canplay"));
  await Promise.resolve();
  expect(resolved).toBe(false);
  c.abort();
  await expect(pending).rejects.toHaveProperty("name", "AbortError");
});

test("a ready video does not need to emit loadeddata again", async () => {
  vi.useFakeTimers();
  const video = videoFixture();
  video.readyState = 2;
  await waitForMedia(video, "loadeddata");
  expect(vi.getTimerCount()).toBe(0);
});

test("a playback policy rejection offers a gesture to resume the same file", async () => {
  const video = videoFixture();
  video.play.mockRejectedValueOnce(new DOMException("A gesture is required", "NotAllowedError"));
  const prompt = vi.fn();
  const pending = loadVideo(video, "blob:movie", undefined, { onPlaybackRequired: prompt });
  await Promise.resolve();
  const resume = prompt.mock.calls[0][0];
  expect(resume).toBeTypeOf("function");
  resume();
  await pending;
  expect(video.play).toHaveBeenCalledTimes(2);
  expect(video.currentTime).toBe(0);
  expect(video.paused).toBe(true);
  expect(prompt).toHaveBeenLastCalledWith(null);
  resume();
  expect(video.play).toHaveBeenCalledTimes(2);
});

test("a denied play request can recover through a metadata seek without a tap", async () => {
  const video = videoFixture();
  video.play.mockRejectedValueOnce(new DOMException("Power saving", "NotAllowedError"));
  video.addEventListener("seeked", () => { video.readyState = 2; });
  await loadVideo(video, "blob:movie");
  expect(video.play).toHaveBeenCalledOnce();
  expect(video.currentTime).toBe(0);
});

test("import cancellation removes timers and ignores late playback rejection", async () => {
  vi.useFakeTimers();
  const video = videoFixture(), c = new AbortController(), prompt = vi.fn();
  let rejectPlay;
  video.play.mockImplementation(() => new Promise((_, reject) => { rejectPlay = reject; }));
  const pending = loadVideo(video, "blob:movie", c.signal, { onPlaybackRequired: prompt });
  c.abort();
  await expect(pending).rejects.toHaveProperty("name", "AbortError");
  rejectPlay(new DOMException("Interrupted", "NotAllowedError"));
  await Promise.resolve();
  expect(prompt).toHaveBeenCalledExactlyOnceWith(null);
  expect(video.paused).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});

test("unsupported codecs fail promptly with a decode error", async () => {
  const video = videoFixture();
  video.play.mockRejectedValueOnce(new DOMException("Unsupported", "NotSupportedError"));
  await expect(loadVideo(video, "blob:movie")).rejects.toThrow("cannot be decoded");
  expect(video.paused).toBe(true);
});

test("an imported MOV keeps its original file and dimensions for every render and export path", async () => {
  URL.createObjectURL = vi.fn(() => "blob:original");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(function () {
    Object.defineProperties(this, {
      readyState: { value: 1, writable: true, configurable: true },
      duration: { value: 6, configurable: true },
      videoWidth: { value: 1080, configurable: true },
      videoHeight: { value: 1920, configurable: true },
    });
    this.dispatchEvent(new Event("loadedmetadata"));
  });
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function () {
    this.readyState = 2;
    this.dispatchEvent(new Event("playing"));
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  const file = new File(["fixture"], "phone.MOV", { type: "" });
  const source = await loadFile(file);
  expect(source).toMatchObject({ kind: "video", file, url: "blob:original", width: 1080, height: 1920, duration: 6 });
  expect(source.element.isConnected).toBe(true);
  expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  releaseSource(source);
  expect(source.element.isConnected).toBe(false);
  expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:original");
});

test("aborting an import releases its video and object URL", async () => {
  URL.createObjectURL = vi.fn(() => "blob:cancelled");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => new Promise(() => {}));
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  const c = new AbortController();
  const pending = loadFile(new File(["fixture"], "video.mp4"), c.signal);
  c.abort();
  await expect(pending).rejects.toHaveProperty("name", "AbortError");
  expect(document.querySelector("video")).toBeNull();
  expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:cancelled");
});
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
