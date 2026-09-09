const maskKeys = [
  "maskMode",
  "maskLow",
  "maskHigh",
  "maskColor",
  "maskTolerance",
  "maskSoftness",
  "maskInvert",
  "maskBackdrop",
  "maskStrokes",
  "maskImage",
];
export function applyStyle(style, current, keepMask = false) {
  return keepMask && current.maskMode !== "none"
    ? {
        ...style,
        ...Object.fromEntries(maskKeys.map((key) => [key, current[key]])),
      }
    : { ...style };
}
export function videoPreferences(input) {
  const p = input && typeof input === "object" ? input : {};
  return {
    resolution: ["native", "1280", "1920", "3840"].includes(p.resolution)
      ? p.resolution
      : "1920",
    fps: [24, 30, 60].includes(p.fps) ? p.fps : 30,
    includeAudio: typeof p.includeAudio === "boolean" ? p.includeAudio : true,
    quality: p.quality === "maximum" ? "maximum" : "high",
  };
}
export function exportKey({
  config,
  format,
  resolution,
  fps,
  includeAudio,
  quality,
  engine,
  time,
  start,
  end,
  fontFace,
}) {
  const still = ["png", "svg"].includes(format);
  return JSON.stringify({
    config: still ? { ...config, smooth: 1 } : config,
    format,
    resolution,
    ...(still
      ? { time, fontFace: format === "svg" ? fontFace : undefined }
      : {
          start,
          end,
          fps,
          ...(format === "gif" ? {} : { includeAudio, quality, engine }),
        }),
  });
}
export const renderClock = (kind, mediaTime, now) =>
  kind === "camera" ? now / 1000 : mediaTime;
