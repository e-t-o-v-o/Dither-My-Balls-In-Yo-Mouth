export function abortError() {
  return new DOMException("Export cancelled.", "AbortError");
}
export function checkAbort(signal) {
  if (signal?.aborted) throw abortError();
}
export function waitForMedia(element, event, signal, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const clean = () => {
      clearTimeout(timer);
      element.removeEventListener(event, ok);
      element.removeEventListener("error", fail);
      signal?.removeEventListener("abort", abort);
    };
    const ok = () => {
      clean();
      resolve();
    };
    const fail = () => {
      clean();
      reject(
        new Error(
          "This file cannot be decoded by this browser. Try H.264 MP4 video, PNG, or JPEG.",
        ),
      );
    };
    const abort = () => {
      clean();
      reject(abortError());
    };
    const timer = setTimeout(() => {
      clean();
      reject(
        new Error(
          "The media took too long to load. Try a smaller file or a different codec.",
        ),
      );
    }, timeout);
    element.addEventListener(event, ok, { once: true });
    element.addEventListener("error", fail, { once: true });
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
  });
}
export async function seek(video, time, signal) {
  checkAbort(signal);
  const t = Math.max(0, Math.min(time, Math.max(0, video.duration - 0.001)));
  if (
    Math.abs(video.currentTime - t) < 0.001 &&
    video.readyState >= 2 &&
    !video.seeking
  )
    return;
  const ready = waitForMedia(video, "seeked", signal);
  video.currentTime = t;
  await ready;
  checkAbort(signal);
}
export function createVideoElement() {
  const video = document.createElement("video");
  video.playsInline = true;
  video.muted = true;
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
export async function loadFile(file, signal) {
  if (!file) throw new Error("Choose an image or video.");
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
    if (video) {
      element.playsInline = true;
      element.preload = "auto";
      element.muted = true;
    }
    const ready = waitForMedia(element, image ? "load" : "loadeddata", signal);
    element.src = url;
    await ready;
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
    };
  } catch (e) {
    if (video) {
      element.pause();
      element.removeAttribute("src");
      element.load();
      element.remove();
    }
    URL.revokeObjectURL(url);
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
