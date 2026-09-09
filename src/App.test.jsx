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
  const ascii = screen.getByRole("button", { name: "ASCII" });
  fireEvent.click(ascii);
  expect(ascii).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  expect(ascii).toHaveAttribute("aria-pressed", "false");
  fireEvent.click(screen.getByRole("button", { name: "Redo" }));
  expect(ascii).toHaveAttribute("aria-pressed", "true");
});
test("preset save and restore work without blocking prompts", () => {
  render(<App />);
  fireEvent.click(screen.getByRole("tab", { name: "Presets" }));
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
  fireEvent.change(screen.getByLabelText("Trim start in seconds"), {
    target: { value: "999" },
  });
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
  expect(screen.getByLabelText("Trim start in seconds")).toHaveValue(1);
  fireEvent.keyDown(window, { key: "ArrowRight", shiftKey: true });
  fireEvent.keyDown(window, { key: "o" });
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
  fireEvent.click(screen.getByRole("button", { name: /All \d+ styles/ }));
  fireEvent.click(screen.getByRole("button", { name: /Mint cutout/ }));
  fireEvent.click(screen.getByLabelText("Keep mask when changing styles"));
  fireEvent.click(screen.getByRole("button", { name: /Wayfinding/ }));
  fireEvent.click(screen.getByRole("tab", { name: /^Mask/ }));
  expect(screen.getByLabelText("Select by")).toHaveValue("luminance");
  fireEvent.click(screen.getByLabelText("Keep mask when changing styles"));
  fireEvent.click(screen.getByRole("button", { name: /Wayfinding/ }));
  fireEvent.click(screen.getByRole("tab", { name: /^Mask/ }));
  expect(screen.getByLabelText("Select by")).toHaveValue("none");
});
