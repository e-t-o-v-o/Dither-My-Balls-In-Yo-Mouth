const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export function moveCrop(crop, dx, dy) {
  return { ...crop, cropX: clamp(crop.cropX + dx, 0, 1 - crop.cropWidth), cropY: clamp(crop.cropY + dy, 0, 1 - crop.cropHeight) };
}
export function resizeCrop(crop, corner, dx, dy, ratio = 0) {
  const east = corner.includes("e"), south = corner.includes("s");
  const anchorX = crop.cropX + (east ? 0 : crop.cropWidth);
  const anchorY = crop.cropY + (south ? 0 : crop.cropHeight);
  const maxWidth = east ? 1 - anchorX : anchorX;
  const maxHeight = south ? 1 - anchorY : anchorY;
  let width = clamp(crop.cropWidth + (east ? dx : -dx), .05, maxWidth);
  let height = clamp(crop.cropHeight + (south ? dy : -dy), .05, maxHeight);
  if (ratio > 0) {
    const desired = Math.abs(dx) >= Math.abs(dy * ratio) ? width : height * ratio;
    width = clamp(desired, Math.max(.05, .05 * ratio), Math.min(maxWidth, maxHeight * ratio));
    height = width / ratio;
  }
  return { cropX: east ? anchorX : anchorX - width, cropY: south ? anchorY : anchorY - height, cropWidth: width, cropHeight: height };
}
