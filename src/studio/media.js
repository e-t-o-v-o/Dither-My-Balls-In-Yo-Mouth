export function abortError() {
  return new DOMException("Operation cancelled.", "AbortError");
}
export function checkAbort(signal) {
  if (signal?.aborted) throw abortError();
}
function decodeError(element) {
  return new Error(element.error?.code === 2
    ? "The video file could not be read. Download it to your device, then open it again."
    : "This file cannot be decoded by this browser. Try an H.264 MP4 video, PNG, or JPEG.");
}

export function waitForMedia(element, event, signal, timeout = 30000) {
  return new Promise((resolve, reject) => {
    // Safari may provide a usable frame without firing loadeddata for a blob.
    const frame = event === "loadeddata";
    const events = frame
      ? ["loadeddata", "canplay", "playing", "seeked", "timeupdate"]
      : [event];
    const isReady = () => frame
      ? element.readyState >= 2 && !element.seeking
      : event === "loadedmetadata" && element.readyState >= 1;
    const clean = () => {
      clearTimeout(timer);
      clearInterval(poll);
      events.forEach((name) => element.removeEventListener(name, ok));
      element.removeEventListener("error", fail);
      signal?.removeEventListener("abort", abort);
    };
    const ok = () => {
      if (frame && !isReady()) return;
      clean();
      resolve();
    };
    const fail = () => {
      clean();
      reject(decodeError(element));
    };
    const abort = () => {
      clean();
      reject(abortError());
    };
    const timer = setTimeout(() => {
      clean();
      reject(
        new Error(
          "The browser did not finish reading this file. If it is stored in iCloud or another cloud service, download it to your device and open it again.",
        ),
      );
    }, timeout);
    const poll = frame ? setInterval(() => { if (isReady()) ok(); }, 100) : null;
    events.forEach((name) => element.addEventListener(name, ok));
    element.addEventListener("error", fail, { once: true });
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    else if (element.error) fail();
    else if (isReady()) ok();
  });
}
export async function seek(video, time, signal) {
  checkAbort(signal);
  const end = Number.isFinite(video.duration)
    ? Math.max(0, video.duration - 0.001) : Infinity;
  const t = Math.max(0, Math.min(time, end));
  if (
    Math.abs(video.currentTime - t) < 0.001 &&
    video.readyState >= 2 &&
    !video.seeking
  )
    return;
  const ready = waitForMedia(video, "seeked", signal);
  video.currentTime = t;
  await ready;
  if (video.readyState < 2 || video.seeking)
    await waitForMedia(video, "loadeddata", signal);
  checkAbort(signal);
}
export function createVideoElement() {
  const video = document.createElement("video");
  video.playsInline = true;
  video.muted = true;
  video.defaultMuted = true;
  video.preload = "auto";
  video.tabIndex = -1;
  video.setAttribute("aria-hidden", "true");
  Object.assign(video.style, {
    position: "fixed",
    width: "1px",
    height: "1px",
    opacity: "0",
    pointerEvents: "none",
    bottom: "0",
    left: "0",
  });
  document.body.appendChild(video);
  return video;
}

// Start decoding in the file-picker gesture, before awaiting metadata. On iOS,
// preload alone can stop at HAVE_METADATA indefinitely, even for a local MP4.
// Pause and rewind once the first real frame is available; never import playing.
export async function loadVideo(video, url, signal, { onPlaybackRequired } = {}) {
  checkAbort(signal);
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  let active = true, blocked = false, nudged = false, failure;
  const nudge = () => {
    if (!active || !blocked || nudged || video.readyState !== 1) return;
    // Seeking also requests decoding when a power-saving policy rejects play().
    if (video.duration > 0) {
      nudged = true;
      try { video.currentTime = Math.min(0.001, video.duration / 2); }
      catch { /* The explicit Enable video action can still start decoding. */ }
    }
  };
  const playFailed = (error) => {
    if (!active || controller.signal.aborted || video.readyState >= 2) return;
    if (error.name === "NotAllowedError") {
      blocked = true;
      nudge();
      onPlaybackRequired?.(play);
    } else if (error.name !== "AbortError") {
      failure = decodeError(video);
      controller.abort();
    }
  };
  const play = () => {
    if (!active || controller.signal.aborted) return;
    try {
      // Catch even late rejections after pause/abort. A playable first frame
      // does not require the play promise itself to settle.
      video.play()?.catch(playFailed);
    } catch (error) { playFailed(error); }
  };
  video.addEventListener("loadedmetadata", nudge);
  video.muted = video.defaultMuted = true;
  video.playsInline = true;
  video.preload = "auto";
  const ready = waitForMedia(video, "loadeddata", controller.signal);
  try {
    video.src = url;
    video.load();
    play();
    await ready;
  } catch (error) {
    if (signal?.aborted) throw abortError();
    if (failure) throw failure;
    if (blocked && error.name !== "AbortError")
      throw new Error("Your browser paused video loading. Open the file again and tap Enable video to continue.");
    throw error;
  } finally {
    active = false;
    controller.abort();
    // Also observe ready if assigning/loading the source failed synchronously.
    ready.catch(() => {});
    video.pause();
    video.removeEventListener("loadedmetadata", nudge);
    signal?.removeEventListener("abort", abort);
    onPlaybackRequired?.(null);
  }
  await seek(video, 0, signal);
}

export async function loadFile(file, signal, options) {
  checkAbort(signal);
  if (!file) throw new Error("Choose an image or video.");
  if (!file.size) throw new Error("This file is empty. Download the original and open it again.");
  if (file.size > 2 * 1024 ** 3)
    throw new Error("Choose a file smaller than 2 GB.");
  const image =
    file.type.startsWith("image/") ||
    /\.(png|jpe?g|webp|gif|avif|bmp)$/i.test(file.name);
  const video =
    file.type.startsWith("video/") ||
    /\.(mp4|mov|m4v|webm|ogv)$/i.test(file.name);
  if (!image && !video) throw new Error("Choose an image or video file.");
  const url = URL.createObjectURL(file),
    element = image ? new Image() : createVideoElement();
  try {
    if (image) {
      const ready = waitForMedia(element, "load", signal);
      element.src = url;
      await ready;
    } else {
      await loadVideo(element, url, signal, options);
    }
    checkAbort(signal);
    const width = image ? element.naturalWidth : element.videoWidth,
      height = image ? element.naturalHeight : element.videoHeight;
    if (!width || !height)
      throw new Error("This file has no readable video or image frames.");
    if (video && (!Number.isFinite(element.duration) || element.duration <= 0))
      throw new Error(
        "The video has no usable duration. Re-export it as an MP4 and try again.",
      );
    return {
      kind: image ? "image" : "video",
      element,
      url,
      width,
      height,
      duration: image ? 0 : element.duration,
      name: file.name,
      file,
    };
  } catch (e) {
    releaseSource({ element, url });
    throw e;
  }
}
export function releaseSource(source) {
  if (!source) return;
  if (source.element?.pause) {
    source.element.onseeked = null;
    source.element.pause();
    source.element.srcObject?.getTracks().forEach((t) => t.stop());
    source.element.srcObject = null;
    source.element.removeAttribute("src");
    source.element.load();
    source.element.remove?.();
  }
  if (source.url) URL.revokeObjectURL(source.url);
}
export class AudioRouter {
  constructor() {
    this.context = null;
    this.source = null;
    this.video = null;
  }
  async connect(video, monitor = false) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC)
      throw new Error(
        "Audio export is unavailable in this browser. Turn off Include audio or try another browser.",
      );
    if (!this.context) this.context = new AC();
    if (this.video !== video) {
      this.source?.disconnect();
      this.gain?.disconnect();
      this.destination?.stream.getTracks().forEach((t) => t.stop());
      this.video = video;
      this.source = this.context.createMediaElementSource(video);
      this.destination = this.context.createMediaStreamDestination();
      this.gain = this.context.createGain();
      this.source.connect(this.destination);
      this.source.connect(this.gain);
      this.gain.connect(this.context.destination);
    }
    this.gain.gain.value = monitor ? 1 : 0;
    video.muted = false;
    await this.context.resume();
    return this.destination.stream;
  }
  mute(value) {
    if (this.gain) this.gain.gain.value = value ? 0 : 1;
  }
  disconnect() {
    this.source?.disconnect();
    this.gain?.disconnect();
    this.destination?.stream.getTracks().forEach((t) => t.stop());
    this.source = null;
    this.video = null;
  }
  close() {
    this.disconnect();
    this.context?.close().catch(() => {});
    this.context = null;
  }
}
