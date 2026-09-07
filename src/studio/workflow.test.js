import {
  applyStyle,
  videoPreferences,
  exportKey,
  renderClock,
} from "./workflow";
import { defaults } from "./model";

test("trying a style can retain a tuned mask without retaining old effect settings", () => {
  const current = {
    ...defaults,
    maskMode: "color",
    maskColor: "#ff0000",
    maskTolerance: 0.12,
    maskInvert: true,
  };
  const style = { ...defaults, effect: "symbols" };
  expect(applyStyle(style, current, true)).toMatchObject({
    effect: "symbols",
    maskMode: "color",
    maskColor: "#ff0000",
    maskTolerance: 0.12,
    maskInvert: true,
  });
  expect(applyStyle(style, current)).toEqual(style);
  expect(style.maskMode).toBe("none");
  expect(current.effect).toBe(defaults.effect);
});
test("stored video preferences reject invalid values and preserve supported choices", () => {
  expect(
    videoPreferences({
      resolution: "99999",
      fps: 120,
      includeAudio: "false",
      quality: "low",
    }),
  ).toEqual(videoPreferences(null));
  const valid = {
    resolution: "native",
    fps: 60,
    includeAudio: false,
    quality: "maximum",
  };
  expect(videoPreferences(valid)).toEqual(valid);
});
test("export freshness follows the settings that affect each output", () => {
  const job = {
    config: defaults,
    format: "png",
    resolution: "1920",
    time: 1,
    start: 0,
    end: 8,
    fps: 30,
    includeAudio: true,
    quality: "high",
    engine: "precise",
  };
  expect(exportKey(job)).toBe(
    exportKey({
      ...job,
      fps: 60,
      start: 2,
      config: { ...defaults, smooth: 0.2 },
    }),
  );
  expect(exportKey(job)).not.toBe(exportKey({ ...job, time: 2 }));
  expect(exportKey(job)).not.toBe(
    exportKey({ ...job, config: { ...defaults, transparent: true } }),
  );
  const video = { ...job, format: "mp4" };
  expect(exportKey(video)).toBe(exportKey({ ...video, time: 3 }));
  expect(exportKey(video)).not.toBe(exportKey({ ...video, end: 4 }));
  expect(exportKey(video)).not.toBe(
    exportKey({ ...video, includeAudio: false }),
  );
  const gif = { ...job, format: "gif" };
  expect(exportKey(gif)).toBe(
    exportKey({ ...gif, includeAudio: false, quality: "maximum" }),
  );
});
test("camera rendering uses a progressing clock while video uses media time", () => {
  expect(renderClock("camera", 0, 1500)).toBe(1.5);
  expect(renderClock("video", 2, 1500)).toBe(2);
});
