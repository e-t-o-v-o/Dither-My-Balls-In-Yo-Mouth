import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { StyleBrowser } from "./StyleBrowser";
import { defaults } from "./model";
const { renderFrame } = vi.hoisted(() => ({ renderFrame: vi.fn(async () => {}) }));
vi.mock("./render-service", () => ({ RenderService: class { render = renderFrame; invalidate() {} dispose() {} } }));
vi.mock("./echo-sampler", () => ({ EchoSampler: class { async frames() { return []; } dispose() {} } }));
beforeEach(() => {
  renderFrame.mockClear();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage() {} });
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue("data:image/png;base64,cHJldmlldw==");
});
test("look thumbnails include added layers and their animation timing, then expire when the frame changes", async () => {
  const config = { ...defaults, cropX: 0.2, cropWidth: 0.6, stack: [
    { id: "main", enabled: true, mix: 1 },
    { id: "detail", enabled: true, mix: 0.5, settings: { ...defaults, effect: "pixel", motion: { enabled: true, tracks: { brightness: [-100, 100] } } } },
  ] };
  const props = { config, source: { kind: "video", width: 1280, height: 720, element: document.createElement("video") }, time: 3, trim: [2, 4], onPause: vi.fn(), onApply: vi.fn() };
  const view = render(<StyleBrowser {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Preview looks on this frame" }));
  await waitFor(() => expect(renderFrame).toHaveBeenCalled());
  await screen.findByRole("button", { name: "Preview looks on this frame" });
  for (const call of renderFrame.mock.calls) {
    expect(call[2]).toMatchObject({ stack: config.stack, cropX: 0.2, cropWidth: 0.6 });
    expect(call[5]).toMatchObject({ time: 3, motionRange: [2, 4] });
  }
  expect(view.container.querySelector(".style-preview").src).toContain("data:image/png");
  view.rerender(<StyleBrowser {...props} time={3.5} />);
  expect(view.container.querySelector(".style-preview").src).not.toContain("data:image/png");
});

test("stopping a preview is immediate and a late failure cannot replace the current gallery", async () => {
  let reject;
  renderFrame.mockImplementationOnce(() => new Promise((_, fail) => { reject = fail; }));
  const props = { config: defaults, source: { kind: "video", width: 1280, height: 720, element: document.createElement("video") }, time: 1, trim: [0, 2], onPause: vi.fn(), onApply: vi.fn() };
  const view = render(<StyleBrowser {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Preview looks on this frame" }));
  await waitFor(() => expect(reject).toBeTypeOf("function"));
  fireEvent.click(screen.getByRole("button", { name: /Stop previews/ }));
  expect(screen.getByRole("button", { name: "Preview looks on this frame" })).toBeEnabled();
  view.rerender(<StyleBrowser {...props} time={2} />);
  await act(async () => reject(new Error("Old preview failed")));
  expect(screen.queryByText("Old preview failed")).not.toBeInTheDocument();
  expect(view.container.querySelector(".style-preview").src).not.toContain("data:image/png");
});
