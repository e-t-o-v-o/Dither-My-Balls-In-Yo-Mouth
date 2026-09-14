import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import App from "./App";
vi.mock("./studio/renderer", () => ({
  FrameRenderer: class {
    invalidate() {}
    setMatte() {}
    render() {}
  },
  drawSignal: () => ({}),
}));
beforeEach(() => {
  localStorage.clear();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  HTMLCanvasElement.prototype.getContext = () => ({
    clearRect: () => {},
    drawImage: () => {},
  });
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/jpeg;base64,");
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});
afterEach(() => vi.unstubAllGlobals());

test("MP4 is a visible choice, reaches the encoder explicitly, and is remembered", async () => {
  vi.stubGlobal("VideoEncoder", class {});
  const planner = await import("./studio/export-plan");
  vi.spyOn(planner, "planVideoExport").mockResolvedValue({ extension: "mp4", codec: "avc", estimatedBytes: 1000 });
  const exporter = await import("./studio/precise-export");
  const encode = vi.spyOn(exporter, "exportPrecise").mockResolvedValue({ blob: new Blob(["fixture"], { type: "video/mp4" }), extension: "mp4", width: 1920, height: 1080, engine: "precise", codec: "avc", targetFps: 30 });
  URL.createObjectURL = vi.fn(() => "blob:mp4");
  URL.revokeObjectURL = vi.fn();
  const first = render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Export", exact: true }));
  fireEvent.click(screen.getByRole("radio", { name: "MP4", exact: true }));
  expect(screen.getByRole("radio", { name: "MP4", exact: true })).toBeChecked();
  await waitFor(() => expect(screen.getByRole("button", { name: "Create export" })).toBeEnabled());
  const exportDialog = screen.getByRole("dialog", { name: "Export", exact: true });
  exportDialog.scrollTop = 400;
  fireEvent.click(screen.getByRole("button", { name: "Create export" }));
  expect(await screen.findByRole("region", { name: "Export ready" })).toHaveFocus();
  expect(exportDialog.scrollTop).toBe(0);
  expect(await screen.findByRole("link", { name: "Download MP4" })).toHaveAttribute("download", expect.stringMatching(/\.mp4$/));
  expect(encode.mock.calls[0][0].format).toBe("mp4");
  first.unmount();
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Export", exact: true }));
  expect(screen.getByRole("radio", { name: "MP4", exact: true })).toBeChecked();
});

test("an unavailable remembered MP4 stays explicit and cannot silently export WebM", () => {
  vi.stubGlobal("MediaRecorder", { isTypeSupported: mime => mime.startsWith("video/webm") });
  localStorage.setItem("dither.file-type.v1", JSON.stringify("mp4"));
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Export", exact: true }));
  expect(screen.getByRole("radio", { name: "MP4", exact: true })).toBeChecked();
  expect(screen.getByRole("radio", { name: "MP4", exact: true })).toBeDisabled();
  expect(screen.getByRole("button", { name: "Create export" })).toBeDisabled();
  expect(screen.getByText(/MP4 is unavailable/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("radio", { name: "WebM", exact: true }));
  expect(screen.getByRole("button", { name: "Create export" })).toBeEnabled();
});
test("opens directly into a usable studio with no camera permission request", () => {
  const camera = vi.fn();
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia: camera },
    configurable: true,
  });
  render(<App />);
  expect(screen.getByRole("button", { name: "Open media" })).toBeEnabled();
  expect(screen.getByLabelText("Processed media preview")).toBeInTheDocument();
  expect(screen.getByLabelText("Video playhead")).toBeEnabled();
  expect(camera).not.toHaveBeenCalled();
});
test("effect changes can be undone and redone", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Change effect" }));
  fireEvent.click(screen.getByRole("button", { name: "ASCII", exact: true }));
  expect(screen.getByRole("button", { name: "Change effect" })).toHaveTextContent("ASCII");
  fireEvent.click(screen.getByRole("button", { name: "Undo", exact: true }));
  expect(screen.getByRole("button", { name: "Change effect" })).toHaveTextContent("Dither");
  fireEvent.click(screen.getByRole("button", { name: "Redo", exact: true }));
  expect(screen.getByRole("button", { name: "Change effect" })).toHaveTextContent("ASCII");
});

test("Interlace controls and per-effect settings remain available across effect changes", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Change effect" }));
  fireEvent.click(screen.getByRole("button", { name: "Artistic", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Interlace", exact: true }));
  expect(screen.getByRole("slider", { name: "Module size", exact: true })).toHaveValue("32");
  fireEvent.change(screen.getByLabelText("Structure"), { target: { value: "steps" } });
  fireEvent.change(screen.getByRole("slider", { name: "Image detail", exact: true }), { target: { value: "42" } });
  fireEvent.click(screen.getByRole("button", { name: "Change effect" }));
  fireEvent.click(screen.getByRole("button", { name: "Screenprint", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Change effect" }));
  fireEvent.click(screen.getByRole("button", { name: "Interlace", exact: true }));
  expect(screen.getByLabelText("Structure")).toHaveValue("steps");
  expect(screen.getByRole("slider", { name: "Image detail", exact: true })).toHaveValue("42");
  fireEvent.click(screen.getByRole("tab", { name: "Color", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Loom primary", exact: true }));
  expect(screen.getByLabelText("Palette")).toHaveValue("Loom primary");
});
test("preset save and restore work without blocking prompts", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("tab", { name: "Looks" }));
  fireEvent.click(screen.getByRole("button", { name: /^Saved/ }));
  fireEvent.change(screen.getByLabelText("Preset name"), {
    target: { value: "My look" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save current look" }));
  expect(
    screen.getByRole("button", { name: "Load preset My look" }),
  ).toBeInTheDocument();
  expect(
    JSON.parse(localStorage.getItem("dither.presets.v2"))["My look"].effect,
  ).toBe("dither");
});
test("Artistic is a keyboard-accessible collection with focused previews, controls, and undo", () => {
  render(<App />);
  const looksTab = screen.getByRole("tab", { name: "Looks" });
  fireEvent.click(looksTab);
  expect(screen.queryByRole("button", { name: /Banknote/ })).not.toBeInTheDocument();
  fireEvent.keyDown(looksTab, { key: "ArrowRight" });
  const artisticTab = screen.getByRole("tab", { name: "Artistic" });
  expect(artisticTab).toHaveFocus();
  expect(artisticTab).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("button", { name: /Signal weave/ })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Technique"), { target: { value: "cut-paper" } });
  expect(screen.queryByRole("button", { name: /Signal weave/ })).not.toBeInTheDocument();
  expect(screen.getByText("2 styles")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Paper garden/ }));
  expect(screen.getByRole("button", { name: "Change effect" })).toHaveTextContent("Cut paper");
  fireEvent.change(screen.getByLabelText("Paper shapes"), { target: { value: "petals" } });
  expect(screen.queryByLabelText("Cut leaf veins")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Undo", exact: true }));
  expect(screen.getByLabelText("Paper shapes")).toHaveValue("leaves");
  fireEvent.click(screen.getByRole("tab", { name: "Color", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Cathedral", exact: true }));
  expect(screen.getByLabelText("Palette")).toHaveValue("Cathedral");
  fireEvent.click(screen.getByRole("tab", { name: "Artistic" }));
  expect(screen.getByLabelText("Technique")).toHaveValue("cut-paper");
  fireEvent.click(screen.getByRole("tab", { name: "Looks" }));
  expect(screen.getByRole("button", { name: /Printed matter/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "Color", exact: true }));
  fireEvent.keyDown(screen.getByRole("tab", { name: "Color", exact: true }), { key: "End" });
  expect(screen.getByRole("tab", { name: "Frame", exact: true })).toHaveFocus();
});
test("artistic search recovers from empty results and variations support undo", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("tab", { name: "Artistic" }));
  const search = screen.getByRole("searchbox", { name: "Find a look" });
  fireEvent.change(search, { target: { value: "marbling" } });
  expect(screen.getByText("2 styles")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Indigo stitch/ })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Technique"), { target: { value: "threadwork" } });
  expect(screen.getByText("No matching looks")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Preview looks on this frame" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Show all looks" }));
  expect(search).toHaveValue("");
  fireEvent.change(search, { target: { value: "Floating ink" } });
  fireEvent.click(screen.getByRole("button", { name: /Floating ink/ }));
  expect(screen.getByLabelText("Swirl depth")).toBeInTheDocument();
  const seed = screen.getByLabelText("Pattern seed");
  const initial = seed.value;
  fireEvent.click(screen.getByRole("button", { name: "New variation" }));
  expect(seed.value).not.toBe(initial);
  fireEvent.click(screen.getByRole("button", { name: "Undo", exact: true }));
  expect(seed.value).toBe(initial);
});

test("contour treatments expose meaningful controls without a disconnected seed", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("tab", { name: "Artistic" }));
  fireEvent.click(screen.getByRole("button", { name: /Chromatic atlas/ }));
  expect(screen.queryByLabelText("Pattern seed")).not.toBeInTheDocument();
  expect(screen.getByLabelText("Terrace separation")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Contour treatment"), { target: { value: "isolines" } });
  expect(screen.getByLabelText("Contour coverage")).toBeInTheDocument();
  expect(screen.queryByLabelText("Terrace separation")).not.toBeInTheDocument();
});

test("export offers current-frame formats and explicit dimensions", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Export", exact: true }));
  const dialog = screen.getByRole("dialog");
  fireEvent.click(within(dialog).getByRole("radio", { name: "PNG", exact: true }));
  expect(within(dialog).getByText("1920 × 1080")).toBeInTheDocument();
  expect(
    within(dialog).getByRole("button", { name: "Create frame" }),
  ).toBeEnabled();
});
test("trim controls clamp an invalid range", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Trim", exact: true }));
  fireEvent.change(screen.getByLabelText("Trim start in seconds"), {
    target: { value: "999" },
  });
  fireEvent.blur(screen.getByLabelText("Trim start in seconds"));
  expect(
    Number(screen.getByLabelText("Trim start in seconds").value),
  ).toBeLessThan(Number(screen.getByLabelText("Trim end in seconds").value));
});

test("switching out of GIF restores valid video resolution and frame rate", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Export", exact: true }));
  const dialog = screen.getByRole("dialog");
  fireEvent.click(within(dialog).getByRole("radio", { name: "GIF", exact: true }));
  expect(
    within(dialog).getByLabelText("Resolution · longest edge"),
  ).toHaveValue("480");
  fireEvent.click(within(dialog).getByRole("radio", { name: "PNG", exact: true }));
  expect(
    within(dialog).getByLabelText("Resolution · longest edge"),
  ).toHaveValue("1920");
});

test("keyboard seeking and trim shortcuts select a clip and Full clip restores it", () => {
  render(<App />);
  fireEvent.keyDown(window, { key: "ArrowRight", shiftKey: true });
  expect(Number(screen.getByLabelText("Video playhead").value)).toBe(1);
  fireEvent.keyDown(window, { key: "i" });
  fireEvent.click(screen.getByRole("button", { name: "Trim", exact: true }));
  expect(screen.getByLabelText("Trim start in seconds")).toHaveValue(1);
  fireEvent.click(screen.getByRole("button", { name: "Done", exact: true }));
  fireEvent.keyDown(window, { key: "ArrowRight", shiftKey: true });
  fireEvent.keyDown(window, { key: "o" });
  fireEvent.click(screen.getByRole("button", { name: "Trim", exact: true }));
  expect(screen.getByLabelText("Trim end in seconds")).toHaveValue(2);
  fireEvent.keyDown(screen.getByLabelText("Trim end in seconds"), {
    key: "ArrowRight",
  });
  expect(Number(screen.getByLabelText("Video playhead").value)).toBe(2);
  fireEvent.click(screen.getByRole("button", { name: "Full clip" }));
  expect(screen.getByLabelText("Trim start in seconds")).toHaveValue(0);
  expect(screen.getByLabelText("Trim end in seconds")).toHaveValue(8);
});

test("video resolution survives a GIF detour and a new session", () => {
  const first = render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Export", exact: true }));
  fireEvent.change(screen.getByLabelText("Resolution · longest edge"), {
    target: { value: "1280" },
  });
  fireEvent.click(screen.getByRole("radio", { name: "GIF", exact: true }));
  expect(screen.getByLabelText("Resolution · longest edge")).toHaveValue("480");
  fireEvent.click(screen.getByRole("radio", { name: "Auto", exact: true }));
  expect(screen.getByLabelText("Resolution · longest edge")).toHaveValue(
    "1280",
  );
  first.unmount();
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Export", exact: true }));
  expect(screen.getByLabelText("Resolution · longest edge")).toHaveValue(
    "1280",
  );
});

test("latest effect settings are saved when leaving before the debounce fires", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Change effect" }));
  fireEvent.click(screen.getByRole("button", { name: "ASCII", exact: true }));
  fireEvent(window, new Event("pagehide"));
  expect(JSON.parse(localStorage.getItem("dither.config.v2")).effect).toBe(
    "ascii",
  );
});

test("a completed export remains downloadable and is labeled when later settings differ", async () => {
  const exports = await import("./studio/export");
  vi.spyOn(exports, "exportStill").mockResolvedValueOnce({
    blob: new Blob(["png"], { type: "image/png" }),
    extension: "png",
    width: 1920,
    height: 1080,
  });
  URL.createObjectURL = vi.fn(() => "blob:completed");
  URL.revokeObjectURL = vi.fn();
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Export", exact: true }));
  fireEvent.click(screen.getByRole("radio", { name: "PNG", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Create frame" }));
  expect(
    await screen.findByRole("link", { name: "Download PNG" }),
  ).toHaveAttribute("href", "blob:completed");
  expect(screen.getByText("READY TO SAVE")).toBeInTheDocument();
  const settings = screen.getByText("Adjust export settings").closest("details");
  expect(settings).not.toHaveAttribute("open");
  fireEvent.click(screen.getByText("Adjust export settings"));
  await waitFor(() => expect(settings).toHaveAttribute("open"));
  fireEvent.change(screen.getByLabelText("Resolution · longest edge"), {
    target: { value: "1280" },
  });
  expect(screen.getByText("PREVIOUS EXPORT")).toBeInTheDocument();
  expect(
    screen.getByRole("link", { name: "Download previous PNG" }),
  ).toHaveAttribute("href", "blob:completed");
});

test("a selected mask survives trying styles only when Keep mask is enabled", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("tab", { name: "Looks" }));
  fireEvent.click(screen.getByRole("button", { name: /Mint cutout/ }));
  fireEvent.click(screen.getByRole("tab", { name: "Artistic" }));
  fireEvent.click(screen.getByLabelText("Keep selection when changing looks"));
  fireEvent.click(screen.getByRole("button", { name: /Wayfinding/ }));
  fireEvent.click(screen.getByRole("tab", { name: /^Select/ }));
  expect(screen.getByLabelText("Select by")).toHaveValue("luminance");
  fireEvent.click(screen.getByRole("tab", { name: "Artistic" }));
  fireEvent.click(screen.getByLabelText("Keep selection when changing looks"));
  fireEvent.click(screen.getByRole("button", { name: /Wayfinding/ }));
  fireEvent.click(screen.getByRole("tab", { name: /^Select/ }));
  expect(screen.getByLabelText("Select by")).toHaveValue("none");
});


test("exact adjustments commit on blur, reject empty input, and remain undoable", () => {
  render(<App />);
  const value = screen.getByLabelText("Cell size exact value");
  fireEvent.focus(value);
  fireEvent.change(value, { target: { value: "23" } });
  expect(screen.getByRole("slider", { name: "Cell size", exact: true })).toHaveValue("8");
  fireEvent.blur(value);
  expect(screen.getByRole("slider", { name: "Cell size", exact: true })).toHaveValue("23");
  fireEvent.focus(value);
  fireEvent.change(value, { target: { value: "" } });
  fireEvent.blur(value);
  expect(value).toHaveValue(23);
  fireEvent.click(screen.getByRole("button", { name: "Undo", exact: true }));
  expect(value).toHaveValue(8);
});

test("appearance follows System by default and saves an explicit override without changing effects", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Project", exact: true }));
  expect(screen.getByRole("button", { name: "System", exact: true })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Dark", exact: true }));
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(JSON.parse(localStorage.getItem("dither.theme.v2"))).toBe("dark");
  fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
  expect(screen.getByRole("slider", { name: "Cell size", exact: true })).toHaveValue("8");
});

test("canvas focus retains the current effect and the dock restores editing", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Focus on canvas" }));
  expect(screen.queryByRole("slider", { name: "Cell size", exact: true })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Show editing controls" }));
  expect(screen.getByRole("slider", { name: "Cell size", exact: true })).toHaveValue("8");
});

test("crop edits are staged until Apply and one undo restores the original frame", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("tab", { name: "Frame", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Edit crop on image", exact: true }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "1:1", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel", exact: true }));
  expect(screen.getByLabelText("Horizontal position exact value")).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Edit crop on image", exact: true }));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "1:1", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Apply crop", exact: true }));
  expect(screen.getByLabelText("Horizontal position exact value")).toBeEnabled();
  fireEvent.click(screen.getByRole("button", { name: "Undo", exact: true }));
  expect(screen.getByLabelText("Horizontal position exact value")).toBeDisabled();
});

test("Enable video resumes the pending import and opens a paused, editable video", async () => {
  const media = await import("./studio/media");
  const video = document.createElement("video");
  video.pause = vi.fn();
  video.load = vi.fn();
  const resume = vi.fn();
  URL.revokeObjectURL = vi.fn();
  const file = new File(["fixture"], "phone.mov", { type: "video/quicktime" });
  vi.spyOn(media, "loadFile").mockImplementationOnce((received, signal, options) => new Promise(resolve => {
    options.onPlaybackRequired(() => {
      resume();
      resolve({ kind: "video", file: received, name: received.name, element: video, url: "blob:phone", width: 1080, height: 1920, duration: 4 });
    });
  }));
  render(<App />);
  fireEvent.change(screen.getByLabelText("Choose image or video"), { target: { files: [file] } });
  expect(await screen.findByRole("button", { name: "Enable video" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Export", exact: true })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "Enable video" }));
  expect(resume).toHaveBeenCalledOnce();
  expect(await screen.findByText("phone.mov")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Enable video" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Play", exact: true })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Export", exact: true })).toBeEnabled();
  expect(screen.getByLabelText("Video playhead")).toHaveValue("0");
});

test("cancelling a slow import restores the workspace without discarding the current effect", async () => {
  const media = await import("./studio/media");
  let signal;
  vi.spyOn(media, "loadFile").mockImplementationOnce((file, abortSignal) => new Promise((_, reject) => {
    signal = abortSignal;
    signal.addEventListener("abort", () => reject(new DOMException("Cancelled", "AbortError")), { once: true });
  }));
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Change effect" }));
  fireEvent.click(screen.getByRole("button", { name: "ASCII", exact: true }));
  fireEvent.change(screen.getByLabelText("Choose image or video"), { target: { files: [new File(["fixture"], "slow.mp4")] } });
  fireEvent.click(await screen.findByRole("button", { name: "Cancel", exact: true }));
  expect(signal.aborted).toBe(true);
  expect(await screen.findByRole("button", { name: "Open media", exact: true })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Project" })).toHaveTextContent("Test signal 01");
  expect(screen.getByRole("button", { name: "Change effect" })).toHaveTextContent("ASCII");
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("motion endpoints are editable, seekable, reversible, and passed to exports", async () => {
  vi.stubGlobal("VideoEncoder", class {});
  const planner = await import("./studio/export-plan");
  vi.spyOn(planner, "planVideoExport").mockResolvedValue({ extension: "mp4", codec: "avc", estimatedBytes: 1000 });
  const exporter = await import("./studio/precise-export");
  const encode = vi.spyOn(exporter, "exportPrecise").mockResolvedValue({ blob: new Blob(["fixture"]), extension: "mp4", width: 1280, height: 720 });
  URL.createObjectURL = vi.fn(() => "blob:motion"); URL.revokeObjectURL = vi.fn();
  render(<App />);
  fireEvent.click(screen.getByRole("tab", { name: "Motion", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Start with an effect reveal" }));
  expect(screen.getByRole("checkbox", { name: "Animate effects" })).toBeChecked();
  expect(screen.getByRole("slider", { name: "Effect blend · start", exact: true })).toHaveValue("0");
  fireEvent.click(screen.getByRole("button", { name: /End 00:08/ }));
  expect(screen.getByRole("slider", { name: "Video playhead" })).toHaveValue("8");
  fireEvent.change(screen.getByRole("slider", { name: "Effect blend · end", exact: true }), { target: { value: "0.75" } });
  fireEvent.click(screen.getByRole("button", { name: "Undo", exact: true }));
  expect(screen.getByRole("slider", { name: "Effect blend · end", exact: true })).toHaveValue("1");
  fireEvent.click(screen.getByRole("button", { name: "Redo", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Export", exact: true }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Create export" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Create export" }));
  await screen.findByRole("link", { name: "Download MP4" });
  expect(encode.mock.lastCall[0]).toMatchObject({ start: 0, end: 8, config: { motion: { enabled: true, tracks: { effectMix: [0, 0.75] } } } });
});

test("effect stacks add, reorder, bypass, edit independently, and undo without losing layers", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Manage effect layers" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Add effect", exact: true }), { target: { value: "marbling" } });
  expect(screen.getByRole("button", { name: "Change effect", exact: true })).toHaveTextContent("Marbled ink");
  fireEvent.change(screen.getByRole("combobox", { name: "Add effect", exact: true }), { target: { value: "screenprint" } });
  expect(screen.queryByRole("combobox", { name: "Add effect", exact: true })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Move layer 3 up" }));
  expect(screen.getByRole("button", { name: "Edit Screenprint layer 2" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("checkbox", { name: "Enable Screenprint layer 2" }));
  expect(screen.getByText(/This effect is bypassed/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Undo", exact: true }));
  expect(screen.getByRole("checkbox", { name: "Enable Screenprint layer 2" })).toBeChecked();
  fireEvent.click(screen.getByRole("tab", { name: "Color", exact: true }));
  fireEvent.click(screen.getByRole("tab", { name: "Frame", exact: true }));
  fireEvent.click(screen.getByRole("tab", { name: "Effect", exact: true }));
  expect(screen.getByRole("button", { name: "Edit Screenprint layer 2" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Change effect", exact: true })).toHaveTextContent("Screenprint");
  fireEvent.click(screen.getByRole("button", { name: "Edit Dither layer 1" }));
  expect(screen.getByRole("button", { name: "Change effect", exact: true })).toHaveTextContent("Dither");
  fireEvent.click(screen.getByRole("button", { name: "Edit Marbled ink layer 3" }));
  fireEvent.click(screen.getByRole("button", { name: "Remove Marbled ink layer 3" }));
  expect(screen.getByRole("combobox", { name: "Add effect", exact: true })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Edit Screenprint layer 2" }));
  fireEvent.click(screen.getByRole("tab", { name: "Artistic" }));
  fireEvent.click(screen.getByRole("button", { name: /Wayfinding/ }));
  expect(screen.getByRole("button", { name: "Change effect", exact: true })).toHaveTextContent("Symbol field");
  expect(screen.getByRole("button", { name: "Edit Screenprint layer 2" })).toHaveAttribute("aria-pressed", "false");
});

test("Color and Motion follow the selected layer without changing the main effect", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Manage effect layers" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Add effect", exact: true }), { target: { value: "marbling" } });
  fireEvent.click(screen.getByRole("tab", { name: "Color", exact: true }));
  fireEvent.change(screen.getByRole("slider", { name: "Saturation", exact: true }), { target: { value: "0.35" } });
  fireEvent.click(screen.getByRole("tab", { name: "Motion", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Start with an effect reveal" }));
  expect(screen.getByRole("checkbox", { name: "Animate effects" })).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Edit Dither layer 1" }));
  expect(screen.getByRole("checkbox", { name: "Animate effects" })).not.toBeChecked();
  fireEvent.click(screen.getByRole("tab", { name: "Color", exact: true }));
  expect(screen.getByRole("slider", { name: "Saturation", exact: true })).toHaveValue("1");
  fireEvent.click(screen.getByRole("button", { name: "Edit Marbled ink layer 2" }));
  expect(screen.getByRole("slider", { name: "Saturation", exact: true })).toHaveValue("0.35");
  fireEvent.click(screen.getByRole("tab", { name: "Motion", exact: true }));
  expect(screen.getByRole("checkbox", { name: "Animate effects" })).toBeChecked();
});

test("expanded artistic gallery preserves filtering and restores keyboard focus", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("tab", { name: "Artistic", exact: true }));
  fireEvent.change(screen.getByRole("searchbox", { name: "Find a look" }), { target: { value: "Wayfinding" } });
  fireEvent.click(screen.getByRole("button", { name: "Open artistic gallery" }));
  const gallery = screen.getByRole("dialog", { name: "Artistic gallery" });
  expect(within(gallery).getByRole("searchbox")).toHaveValue("Wayfinding");
  expect(within(gallery).getAllByRole("button", { name: /Wayfinding/ })).toHaveLength(1);
  fireEvent.click(within(gallery).getByRole("button", { name: "Close dialog" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Open artistic gallery" })).toHaveFocus();
  expect(screen.getByRole("searchbox")).toHaveValue("Wayfinding");
  fireEvent.click(screen.getByRole("button", { name: "Open artistic gallery" }));
  fireEvent.click(screen.getByRole("button", { name: /Wayfinding/ }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Change effect" })).toHaveTextContent("Symbol field");
});

test("compact activities keep editing and browsing navigation separate and keyboard reachable", () => {
  vi.stubGlobal("matchMedia", vi.fn(query => ({ matches: query.includes("max-width: 1049px"), addEventListener() {}, removeEventListener() {} })));
  render(<App />);
  const activities = screen.getByRole("navigation", { name: "Workspace activities" });
  expect(screen.getAllByRole("tab")).toHaveLength(5);
  fireEvent.click(within(activities).getByRole("button", { name: "Browse" }));
  expect(screen.getAllByRole("tab")).toHaveLength(2);
  fireEvent.keyDown(screen.getByRole("tab", { name: "Artistic" }), { key: "ArrowRight" });
  expect(screen.getByRole("tab", { name: "Looks" })).toHaveFocus();
  fireEvent.click(within(activities).getByRole("button", { name: "Adjust" }));
  expect(screen.getByRole("tab", { name: "Effect" })).toHaveAttribute("aria-selected", "true");
  fireEvent.click(within(activities).getByRole("button", { name: "Preview" }));
  expect(document.querySelector(".workspace")).toHaveAttribute("data-tray", "canvas");
  expect(screen.getByRole("button", { name: "Play", exact: true })).toBeEnabled();
  fireEvent.click(within(activities).getByRole("button", { name: "Open export" }));
  expect(screen.getByRole("dialog", { name: /Export/ })).toBeInTheDocument();
});

test("compact navigation returns to the last editing tab, browse collection, and panel size", () => {
  vi.stubGlobal("matchMedia", vi.fn(query => ({ matches: query.includes("max-width: 1049px"), addEventListener() {}, removeEventListener() {} })));
  render(<App />);
  const dock = within(screen.getByRole("navigation", { name: "Workspace activities" }));
  fireEvent.click(screen.getByRole("tab", { name: "Color", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Expand controls" }));
  fireEvent.click(dock.getByRole("button", { name: "Browse" }));
  fireEvent.click(screen.getByRole("tab", { name: "Looks", exact: true }));
  fireEvent.change(screen.getByRole("searchbox", { name: "Find a look" }), { target: { value: "dither" } });
  fireEvent.click(dock.getByRole("button", { name: "Adjust" }));
  expect(screen.getByRole("tab", { name: "Color", exact: true })).toHaveAttribute("aria-selected", "true");
  expect(document.querySelector(".workspace")).toHaveAttribute("data-tray", "detail");
  fireEvent.click(dock.getByRole("button", { name: "Preview" }));
  fireEvent.click(dock.getByRole("button", { name: "Preview" }));
  expect(document.querySelector(".workspace")).toHaveAttribute("data-tray", "detail");
  fireEvent.click(dock.getByRole("button", { name: "Browse" }));
  expect(screen.getByRole("tab", { name: "Looks", exact: true })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("searchbox", { name: "Find a look" })).toHaveValue("dither");
});

test("each collection keeps its search when trying looks and returns focus to editing", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("tab", { name: "Artistic", exact: true }));
  fireEvent.change(screen.getByRole("searchbox", { name: "Find a look" }), { target: { value: "Wayfinding" } });
  fireEvent.click(screen.getByRole("button", { name: /Wayfinding/ }));
  expect(screen.getByRole("tab", { name: "Effect", exact: true })).toHaveFocus();
  fireEvent.click(screen.getByRole("tab", { name: "Looks", exact: true }));
  expect(screen.getByRole("searchbox", { name: "Find a look" })).toHaveValue("");
  fireEvent.change(screen.getByRole("searchbox", { name: "Find a look" }), { target: { value: "pixel" } });
  fireEvent.click(screen.getByRole("tab", { name: "Artistic", exact: true }));
  expect(screen.getByRole("searchbox", { name: "Find a look" })).toHaveValue("Wayfinding");
  fireEvent.click(screen.getByRole("tab", { name: "Looks", exact: true }));
  expect(screen.getByRole("searchbox", { name: "Find a look" })).toHaveValue("pixel");
});

test("scroll position is remembered separately for tabs and selected layers", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Manage effect layers" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Add effect", exact: true }), { target: { value: "screenprint" } });
  fireEvent.click(screen.getByRole("tab", { name: "Color", exact: true }));
  const panel = screen.getByRole("tabpanel", { name: "Color", exact: true });
  fireEvent.scroll(panel, { target: { scrollTop: 360 } });
  fireEvent.click(screen.getByRole("tab", { name: "Frame", exact: true }));
  expect(panel.scrollTop).toBe(0);
  fireEvent.click(screen.getByRole("tab", { name: "Color", exact: true }));
  expect(panel.scrollTop).toBe(360);
  fireEvent.click(screen.getByRole("button", { name: "Edit Dither layer 1" }));
  expect(panel.scrollTop).toBe(0);
  fireEvent.scroll(panel, { target: { scrollTop: 120 } });
  fireEvent.click(screen.getByRole("button", { name: "Edit Screenprint layer 2" }));
  expect(panel.scrollTop).toBe(360);
  fireEvent.click(screen.getByRole("button", { name: "Focus on canvas" }));
  fireEvent.scroll(panel, { target: { scrollTop: 0 } });
  fireEvent.click(screen.getByRole("button", { name: "Show editing controls" }));
  expect(panel.scrollTop).toBe(360);
});

test("motion remembers each layer's endpoint across tabs without seeking on return", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Manage effect layers" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Add effect", exact: true }), { target: { value: "screenprint" } });
  fireEvent.click(screen.getByRole("tab", { name: "Motion", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Start with an effect reveal" }));
  fireEvent.click(screen.getByRole("button", { name: /End 00:08/ }));
  fireEvent.change(screen.getByRole("slider", { name: "Video playhead" }), { target: { value: "3" } });
  fireEvent.click(screen.getByRole("tab", { name: "Color", exact: true }));
  fireEvent.click(screen.getByRole("tab", { name: "Motion", exact: true }));
  expect(screen.getByRole("button", { name: /End 00:08/ })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("slider", { name: "Video playhead" })).toHaveValue("3");
  fireEvent.click(screen.getByRole("button", { name: "Edit Dither layer 1" }));
  expect(screen.getByRole("button", { name: /Start 00:00/ })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Edit Screenprint layer 2" }));
  expect(screen.getByRole("button", { name: /End 00:08/ })).toHaveAttribute("aria-pressed", "true");
});

test("finishing a phone selection returns to the expanded selection controls", () => {
  vi.stubGlobal("matchMedia", vi.fn(query => ({ matches: query.includes("max-width: 1049px"), addEventListener() {}, removeEventListener() {} })));
  render(<App />);
  fireEvent.click(screen.getByRole("tab", { name: "Select", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Expand controls" }));
  fireEvent.click(screen.getByRole("button", { name: "Brush", exact: true }));
  expect(document.querySelector(".workspace")).toHaveAttribute("data-tray", "canvas");
  fireEvent.click(screen.getByRole("button", { name: "Done", exact: true }));
  expect(document.querySelector(".workspace")).toHaveAttribute("data-tray", "detail");
  expect(screen.getByRole("button", { name: "Brush", exact: true })).toHaveAttribute("aria-pressed", "false");
  expect(screen.getByRole("tab", { name: /Select/ })).toHaveFocus();
  fireEvent.click(screen.getByRole("button", { name: "Brush", exact: true }));
  fireEvent.click(within(screen.getByRole("navigation", { name: "Workspace activities" })).getByRole("button", { name: "Adjust", exact: true }));
  expect(screen.queryByText("Paint selection")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Brush", exact: true })).toHaveAttribute("aria-pressed", "false");
});
