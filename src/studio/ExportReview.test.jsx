import { fireEvent, render, screen } from "@testing-library/react";
import { ExportReview } from "./ExportReview";
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
});
const result = { url: "blob:completed", extension: "mp4", width: 1080, height: 1920, duration: 2, targetFps: 30, hasAudio: true, codec: "avc" };
test("review plays the encoded URL, reports its tracks, and stops playback when closed", () => {
  const view = render(<ExportReview result={result} />);
  const video = screen.getByLabelText("Play exported video");
  expect(video).toHaveAttribute("src", result.url);
  expect(video).toHaveAttribute("controls"); expect(video).toHaveAttribute("playsinline");
  expect(video).not.toHaveAttribute("autoplay");
  expect(screen.getByText("Included")).toBeInTheDocument();
  Object.defineProperty(video, "duration", { value: 2.02 });
  fireEvent.loadedMetadata(video);
  expect(screen.getByText("2.02 s")).toBeInTheDocument();
  view.unmount(); expect(video.pause).toHaveBeenCalled(); expect(video).not.toHaveAttribute("src");
});
test("preview failure preserves a clear route to the download", () => {
  render(<ExportReview result={{ ...result, hasAudio: false }} />);
  fireEvent.error(screen.getByLabelText("Play exported video"));
  expect(screen.getByRole("status")).toHaveTextContent("still download");
  expect(screen.getByText("Silent")).toBeInTheDocument();
});
test("GIF preview starts only on request and can be stopped", () => {
  render(<ExportReview result={{ ...result, extension: "gif" }} />);
  expect(screen.queryByAltText("Exported animation")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Play GIF preview" }));
  expect(screen.getByAltText("Exported animation")).toHaveAttribute("src", result.url);
  fireEvent.click(screen.getByRole("button", { name: "Stop GIF preview" }));
  expect(screen.queryByAltText("Exported animation")).not.toBeInTheDocument();
});
