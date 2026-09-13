import { configAtTime, motionProgress, sanitizeMotion } from "./motion";
import { defaults, sanitizeConfig } from "./model";
import { parseProject } from "./projects";
import { exportKey } from "./workflow";
import { exportTiming } from "./ExportProgress";

const config = sanitizeConfig({ ...defaults, effect: "marbling", motion: {
  enabled: true, easing: "linear", tracks: { effectMix: [0, 1], marbleSwirl: [0.2, 0.8], stitchWidth: [0.2, 1] },
} });
test("motion follows source timestamps within a nonzero trim, clamping outside it", () => {
  expect(configAtTime(config, 1, [2, 6]).effectMix).toBe(0);
  expect(configAtTime(config, 4, [2, 6])).toMatchObject({ effectMix: 0.5, marbleSwirl: 0.5, stitchWidth: defaults.stitchWidth });
  expect(configAtTime(config, 9, [2, 6]).effectMix).toBe(1);
  expect(config.motion.tracks.effectMix).toEqual([0, 1]);
  expect(configAtTime({ ...config, motion: { ...config.motion, enabled: false } }, 4, [2, 6]).effectMix).toBe(1);
  expect(configAtTime(config, 4)).toBe(config);
});
test("return motion reaches its destination halfway and closes at the same value", () => {
  const motion = { playback: "return", easing: "smooth" };
  expect([2, 3, 4, 5, 6].map(t => motionProgress(t, [2, 6], motion))).toEqual([0, 0.5, 1, 0.5, 0]);
  expect(motionProgress(NaN, [2, 6], motion)).toBe(0);
  expect(motionProgress(2, [2, 2], motion)).toBe(0);
});
test("easing preserves endpoints with distinct intermediate motion", () => {
  for (const easing of ["smooth", "linear", "in", "out"]) {
    expect(motionProgress(0, [0, 1], { easing })).toBe(0);
    expect(motionProgress(1, [0, 1], { easing })).toBe(1);
  }
  expect(motionProgress(0.25, [0, 1], { easing: "in" })).toBe(0.0625);
  expect(motionProgress(0.25, [0, 1], { easing: "out" })).toBe(0.4375);
});
test("project data cannot animate topology, frame dimensions, unknown or unbounded values", () => {
  expect(sanitizeMotion({ enabled: "true", easing: "bad", tracks: {
    effectMix: [-100, 400], cropWidth: [0, 1], artSeed: [0, 99], brightness: [NaN, 1], grain: [0, Infinity], contrast: ["1", 3],
  } })).toEqual({ enabled: false, easing: "smooth", playback: "once", tracks: { effectMix: [0, 1] } });
  expect(sanitizeConfig({ motion: null }).motion).toEqual(sanitizeMotion());
  const project = parseProject({ app: "dither-studio", version: 1, config, media: { kind: "video", duration: 8 }, trim: [2, 6] });
  expect(project.config.motion).toEqual(config.motion);
  const job = { config, format: "png", time: 3, start: 2, end: 6 };
  expect(exportKey(job)).not.toBe(exportKey({ ...job, end: 8 }));
});
test("export estimates wait for useful progress and do not invent a stalled countdown", () => {
  expect(exportTiming(2, 0.5, 0)).toBe("");
  expect(exportTiming(20, 0, 0)).toBe("");
  expect(exportTiming(10, 0.5, 0)).toBe("About 10s remaining");
  expect(exportTiming(20, 0.98, 0)).toBe("");
  expect(exportTiming(20, 0.5, 0, false)).toBe("");
  expect(exportTiming(40, 0.5, 22)).toMatch(/Waiting for the encoder/);
});
