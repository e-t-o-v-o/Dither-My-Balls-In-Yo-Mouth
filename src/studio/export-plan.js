import { frameDimensions } from "./framing";
import { checkAbort } from "./media";
export const hasPreciseExport = () => typeof VideoEncoder !== "undefined";
export const hasDiskExport = () =>
  typeof navigator !== "undefined" &&
  typeof navigator.storage?.getDirectory === "function";
export function videoBitrate(width, height, fps, quality = "high") {
  return Math.round(
    Math.min(
      100_000_000,
      Math.max(
        2_000_000,
        width * height * fps * (quality === "maximum" ? 0.5 : 0.28),
      ),
    ),
  );
}
export async function planVideoExport({
  source,
  config,
  resolution,
  fps = 30,
  quality = "high",
  format = "auto",
  includeAudio = true,
  start = 0,
  end,
  signal,
}) {
  checkAbort(signal);
  if (!hasPreciseExport())
    throw new Error(
      "Frame-by-frame export is unavailable. Choose Live recording.",
    );
  const m = await import("mediabunny");
  const { width, height } = frameDimensions(source, config, resolution, true),
    bitrate = videoBitrate(width, height, fps, quality);
  const duration = end - start;
  if (!(duration > 0)) throw new Error("Choose a non-empty export range.");
  let needsAudio = false,
    input;
  try {
    if (source.kind === "video") {
      if (!source.file)
        throw new Error("Reopen your video to export frame by frame.");
      input = new m.Input({
        source: new m.BlobSource(source.file),
        formats: m.ALL_FORMATS,
      });
      const video = await input.getPrimaryVideoTrack();
      if (!video || !(await video.canDecode()))
        throw new Error(
          "This browser cannot decode this video for frame-by-frame export. Try Live recording or an H.264 MP4.",
        );
      if (includeAudio) {
        const audio = await input.getPrimaryAudioTrack();
        needsAudio = !!audio;
        if (audio && !(await audio.canDecode()))
          throw new Error(
            "The source audio cannot be decoded. Turn off source audio or use another file.",
          );
      }
    }
  } finally {
    input?.dispose();
  }
  checkAbort(signal);
  const options = { width, height, quality: new m.Quality({ bitrate }) };
  let codec;
  if (
    format !== "webm" &&
    (!needsAudio || (await m.canEncodeAudio("aac"))) &&
    (await m.canEncodeVideo("avc", options))
  )
    codec = "avc";
  if (
    !codec &&
    format !== "mp4" &&
    (!needsAudio || (await m.canEncodeAudio("opus")))
  ) {
    for (const candidate of quality === "maximum"
      ? ["vp9", "vp8"]
      : ["vp8", "vp9"])
      if (await m.canEncodeVideo(candidate, options)) {
        codec = candidate;
        break;
      }
  }
  checkAbort(signal);
  if (!codec)
    throw new Error(
      "This format cannot encode at the selected size and frame rate. Try Auto, a lower resolution, or Live recording.",
    );
  const estimatedBytes = Math.ceil(
      ((duration * (bitrate + (needsAudio ? 192_000 : 0))) / 8) * 1.08,
    ),
    disk = hasDiskExport();
  if (!disk && estimatedBytes > 450 * 1024 * 1024)
    throw new Error(
      "This export exceeds the safe memory budget here. Shorten the range or reduce resolution or quality.",
    );
  if (disk && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate();
    if (
      estimate.quota &&
      estimate.quota - (estimate.usage || 0) < estimatedBytes * 1.2
    )
      throw new Error(
        "There is not enough browser storage for this export. Shorten the range or free up space.",
      );
  }
  return {
    width,
    height,
    bitrate,
    codec,
    extension: codec === "avc" ? "mp4" : "webm",
    needsAudio,
    estimatedBytes,
    disk,
    duration,
  };
}
