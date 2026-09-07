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
