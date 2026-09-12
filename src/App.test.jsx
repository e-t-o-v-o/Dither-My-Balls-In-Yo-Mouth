import { render, screen, fireEvent, within } from "@testing-library/react";
import App from "./App";
vi.mock("./studio/renderer", () => ({
  FrameRenderer: class {
    invalidate() {}
    render() {}
  },
  drawSignal: () => ({}),
}));
beforeEach(() => {
  localStorage.clear();
  HTMLCanvasElement.prototype.getContext = () => ({
    clearRect: () => {},
    drawImage: () => {},
  });
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
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
  fireEvent.change(within(dialog).getByLabelText("Format"), {
    target: { value: "png" },
  });
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
  const format = within(dialog).getByLabelText("Format");
  fireEvent.change(format, { target: { value: "gif" } });
  expect(
    within(dialog).getByLabelText("Resolution · longest edge"),
  ).toHaveValue("480");
  fireEvent.change(format, { target: { value: "png" } });
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
  fireEvent.change(screen.getByLabelText("Format"), {
    target: { value: "gif" },
  });
  expect(screen.getByLabelText("Resolution · longest edge")).toHaveValue("480");
  fireEvent.change(screen.getByLabelText("Format"), {
    target: { value: "auto" },
  });
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
  fireEvent.change(screen.getByLabelText("Format"), {
    target: { value: "png" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Create frame" }));
  expect(
    await screen.findByRole("link", { name: "Download PNG" }),
  ).toHaveAttribute("href", "blob:completed");
  expect(screen.getByText("READY TO SAVE")).toBeInTheDocument();
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
