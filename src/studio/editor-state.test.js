import { historyReducer } from "./editor-state";
import { defaults, timeLabel } from "./model";
import { createProject, parseProject } from "./projects";
import { cropToAspect, frameDimensions } from "./framing";
const initial = () => ({
  present: { ...defaults, fgColor: "#123456", bgColor: "#fedcba" },
  trim: [0, 8],
  effectSettings: {},
  past: [],
  future: [],
});
test("exploring effects restores their settings without changing ink, framing or selection", () => {
  let s = initial();
  s = historyReducer(s, { key: "maskMode", value: "color" });
  s = historyReducer(s, { type: "effect", value: "ascii" });
  expect(s.present.cellSize).toBe(14);
  s = historyReducer(s, { key: "cellSize", value: 22 });
  s = historyReducer(s, { type: "effect", value: "dither" });
  expect(s.present.cellSize).toBe(8);
  expect(s.present.fgColor).toBe("#123456");
  expect(s.present.bgColor).toBe("#fedcba");
  expect(s.present.maskMode).toBe("color");
  s = historyReducer(s, { type: "effect", value: "ascii" });
  expect(s.present.cellSize).toBe(22);
});
test("undo and redo preserve trim and effect changes in order", () => {
  let s = historyReducer(initial(), { type: "trim", value: [2, 6] });
  s = historyReducer(s, { type: "effect", value: "ascii" });
  s = historyReducer(s, { type: "undo" });
  expect(s.present.effect).toBe("dither");
  expect(s.trim).toEqual([2, 6]);
  s = historyReducer(s, { type: "undo" });
  expect(s.trim).toEqual([0, 8]);
  s = historyReducer(s, { type: "redo" });
  expect(s.trim).toEqual([2, 6]);
});
test("project round trip preserves selection, framing and effect memory, without embedding media", () => {
  const source = {
    kind: "video",
    name: "clip.mp4",
    file: { size: 123 },
    width: 1920,
    height: 1080,
    duration: 8,
  };
  const config = {
    ...defaults,
    ...cropToAspect(source, 9 / 16),
    maskMode: "manual",
    maskStrokes: [
      {
        tool: "lasso",
        mode: "add",
        radius: 0.02,
        points: [
          [0.2, 0.2],
          [0.8, 0.2],
          [0.5, 0.8],
        ],
      },
    ],
  };
  const project = parseProject(
    JSON.parse(
      JSON.stringify(
        createProject({
          source,
          config,
          trim: [1, 7],
          time: 4,
          effectSettings: { ascii: { cellSize: 32 } },
          fonts: {},
          video: {},
        }),
      ),
    ),
  );
  expect(project.config).toEqual(config);
  expect(project.trim).toEqual([1, 7]);
  expect(project.time).toBe(4);
  expect(project.media.size).toBe(123);
  expect(project.media.file).toBeUndefined();
  const restored = historyReducer(initial(), { type: "project", ...project });
  expect(
    historyReducer(restored, { type: "effect", value: "ascii" }).present
      .cellSize,
  ).toBe(32);
  expect(frameDimensions(source, config, "1920", true)).toEqual({
    width: 1080,
    height: 1920,
  });
});
test("clock labels round across minute boundaries", () => {
  expect(timeLabel(59.96)).toBe("01:00.0");
  expect(timeLabel(119.96)).toBe("02:00.0");
});

test("a long adjustment is one undo step and the next gesture is independent", () => {
  let s = historyReducer(initial(), { type: "begin-adjustment" });
  s = historyReducer(s, { key: "cellSize", value: 12 });
  s = { ...s, at: Date.now() - 3000 };
  s = historyReducer(s, { key: "cellSize", value: 25 });
  s = historyReducer(s, { type: "end-adjustment" });
  expect(s.past).toHaveLength(1);
  s = historyReducer(s, { type: "begin-adjustment" });
  s = historyReducer(s, { key: "cellSize", value: 30 });
  s = historyReducer(s, { type: "end-adjustment" });
  s = historyReducer(s, { type: "undo" });
  expect(s.present.cellSize).toBe(25);
  s = historyReducer(s, { type: "undo" });
  expect(s.present.cellSize).toBe(8);
});
