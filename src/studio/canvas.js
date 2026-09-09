// DOM canvases are retained for browsers without worker canvas support.
export const makeCanvas = (width = 1, height = 1) => {
  if (typeof document === "undefined")
    return new OffscreenCanvas(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

export async function canvasBlob(canvas, type = "image/png") {
  if (canvas.convertToBlob) return canvas.convertToBlob({ type });
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Image encoding failed.")),
      type,
    ),
  );
}
