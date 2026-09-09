import { dimensions } from "./model";
export function frameDimensions(source, config, resolution, even = false) {
  return dimensions(
    source.width * (config.cropWidth || 1),
    source.height * (config.cropHeight || 1),
    resolution,
    even,
  );
}
export function drawSource(source, ctx, config, width, height) {
  const w = width / (config.cropWidth || 1),
    h = height / (config.cropHeight || 1);
  const x = -(config.cropX || 0) * w,
    y = -(config.cropY || 0) * h;
  if (typeof source.draw === "function") source.draw(ctx, x, y, w, h);
  else ctx.drawImage(source, x, y, w, h);
}
export function cropToAspect(source, aspect) {
  const ratio = source.width / source.height;
  const width = aspect && aspect < ratio ? aspect / ratio : 1;
  const height = aspect && aspect > ratio ? ratio / aspect : 1;
  return {
    cropX: (1 - width) / 2,
    cropY: (1 - height) / 2,
    cropWidth: width,
    cropHeight: height,
  };
}
