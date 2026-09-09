import { makeCanvas } from "./canvas";
import { luma } from "./pixels";
import { contourPaths } from "./graphics";

// Rotated square screens use complementary holes above 50% coverage. This
// preserves ink area in both highlights and shadows, including solid black.
export function screenprint(ctx, data, w, h, config, width, height) {
  if (typeof ctx.getImageData === "function")
    return rasterScreen(ctx, data, w, h, config, width, height);
  const pitch = Math.max(2, (config.cellSize * Math.max(width, height)) / 1920);
  const inks =
    config.screenMode === "duotone"
      ? [config.fgColor, config.accentColor]
      : ["#00ffff", "#ff00ff", "#ffff00", "#000000"];
  const angles = [
    config.screenAngle,
    config.screenAngle + 60,
    config.screenAngle - 15,
    config.screenAngle + 30,
  ];
  const project = (x, y, cos, sin) => [x * cos - y * sin, x * sin + y * cos];
  const extent = Math.hypot(width, height),
    cells = Math.ceil(extent / (2 * pitch)) + 2;
  const offset = (config.registration * Math.max(width, height)) / 1920;
  for (let ink = 0; ink < inks.length; ink++) {
    const angle = (angles[ink] * Math.PI) / 180,
      cos = Math.cos(angle),
      sin = Math.sin(angle);
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = inks[ink];
    const groups = new Map();
    const dx = ink === 0 ? -offset : ink === 1 ? offset : 0,
      dy = ink === 2 ? offset : 0;
    for (let gy = -cells; gy <= cells; gy++)
      for (let gx = -cells; gx <= cells; gx++) {
        const [px, py] = project(
          (gx + 0.5) * pitch,
          (gy + 0.5) * pitch,
          cos,
          sin,
        );
        const x = px + width / 2,
          y = py + height / 2;
        if (x < -pitch || y < -pitch || x > width + pitch || y > height + pitch)
          continue;
        const sx = Math.max(0, Math.min(w - 1, Math.floor((x / width) * w))),
          sy = Math.max(0, Math.min(h - 1, Math.floor((y / height) * h))),
          i = (sy * w + sx) * 4;
        if (!data[i + 3]) continue;
        const r = data[i] / 255,
          g = data[i + 1] / 255,
          b = data[i + 2] / 255,
          k = 1 - Math.max(r, g, b);
        let tone;
        if (config.screenMode === "duotone") {
          const dark = 1 - luma(data[i], data[i + 1], data[i + 2]) / 255;
          tone =
            ink === 0
              ? Math.min(1, dark * 1.5)
              : Math.max(0, (dark - 0.2) / 0.8);
        } else
          tone =
            ink === 3 ? k : k >= 1 ? 0 : (1 - [r, g, b][ink] - k) / (1 - k);
        tone = Math.max(0, Math.min(1, tone * config.inkSpread));
        if (tone <= 0) continue;
        const key = data[i + 3];
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push({ x: x + dx, y: y + dy, tone });
      }
    for (const [alpha, marks] of groups) {
      ctx.globalAlpha = alpha / 255;
      ctx.beginPath();
      for (const { x, y, tone } of marks) {
        if (tone > 0.5) {
          const corners = [
            [-0.5, -0.5],
            [0.5, -0.5],
            [0.5, 0.5],
            [-0.5, 0.5],
          ].map(([cx, cy]) => project(cx * pitch, cy * pitch, cos, sin));
          corners.forEach(([cx, cy], index) =>
            index ? ctx.lineTo(x + cx, y + cy) : ctx.moveTo(x + cx, y + cy),
          );
          ctx.closePath();
        }
        const radius = Math.sqrt(
          (Math.min(tone, 1 - tone) * pitch * pitch) / Math.PI,
        );
        if (radius > 0) {
          ctx.moveTo(x + radius, y);
          ctx.arc(x, y, radius, 0, Math.PI * 2);
        }
      }
      ctx.fill("evenodd");
    }
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
}

// Analytic screen coverage avoids resolving thousands of intersecting vector
// subpaths for every video frame. SVG keeps its editable vector screens above.
const inkLayers = new WeakMap();
function rasterScreen(ctx, data, w, h, c, width, height) {
  const pitch = Math.max(2, (c.cellSize * Math.max(width, height)) / 1920);
  const inks =
    c.screenMode === "duotone"
      ? [c.fgColor, c.accentColor]
      : ["#00ffff", "#ff00ff", "#ffff00", "#000000"];
  const angles = [
    c.screenAngle,
    c.screenAngle + 60,
    c.screenAngle - 15,
    c.screenAngle + 30,
  ];
  const cells = Math.ceil(Math.hypot(width, height) / (2 * pitch)) + 2,
    side = cells * 2 + 1;
  let layer = inkLayers.get(ctx);
  if (
    !layer ||
    layer.canvas.width !== width ||
    layer.canvas.height !== height
  ) {
    const canvas = makeCanvas(width, height);
    layer = { canvas, pixels: new Uint8ClampedArray(width * height * 4) };
    inkLayers.set(ctx, layer);
  }
  const pixels = layer.pixels,
    radii = new Float32Array(side * side),
    alphas = new Uint8Array(side * side),
    holes = new Uint8Array(side * side);
  const offset = (c.registration * Math.max(width, height)) / 1920;
  for (let ink = 0; ink < inks.length; ink++) {
    alphas.fill(0);
    holes.fill(0);
    radii.fill(0);
    const angle = (angles[ink] * Math.PI) / 180,
      cos = Math.cos(angle),
      sin = Math.sin(angle);
    const dx = ink === 0 ? -offset : ink === 1 ? offset : 0,
      dy = ink === 2 ? offset : 0;
    for (let gy = -cells; gy <= cells; gy++)
      for (let gx = -cells; gx <= cells; gx++) {
        const xx = (gx + 0.5) * pitch,
          yy = (gy + 0.5) * pitch,
          x = xx * cos - yy * sin + width / 2,
          y = xx * sin + yy * cos + height / 2;
        if (x < -pitch || y < -pitch || x > width + pitch || y > height + pitch)
          continue;
        const sx = Math.max(0, Math.min(w - 1, Math.floor((x / width) * w))),
          sy = Math.max(0, Math.min(h - 1, Math.floor((y / height) * h))),
          i = (sy * w + sx) * 4;
        if (!data[i + 3]) continue;
        const r = data[i] / 255,
          g = data[i + 1] / 255,
          b = data[i + 2] / 255,
          k = 1 - Math.max(r, g, b);
        const dark = 1 - luma(data[i], data[i + 1], data[i + 2]) / 255;
        let tone =
          c.screenMode === "duotone"
            ? ink === 0
              ? Math.min(1, dark * 1.5)
              : Math.max(0, (dark - 0.2) / 0.8)
            : ink === 3
              ? k
              : k >= 1
                ? 0
                : (1 - [r, g, b][ink] - k) / (1 - k);
        tone = Math.max(0, Math.min(1, tone * c.inkSpread));
        if (!tone) continue;
        const key = (gy + cells) * side + gx + cells;
        alphas[key] = data[i + 3];
        holes[key] = tone > 0.5 ? 1 : 0;
        radii[key] = Math.sqrt(
          (Math.min(tone, 1 - tone) * pitch * pitch) / Math.PI,
        );
      }
    const color = inks[ink].match(/[a-f0-9]{2}/gi).map((v) => parseInt(v, 16));
    for (let y = 0, p = 0; y < height; y++)
      for (let x = 0; x < width; x++, p += 4) {
        const px = x + 0.5 - width / 2 - dx,
          py = y + 0.5 - height / 2 - dy;
        const u = (px * cos + py * sin) / pitch,
          v = (-px * sin + py * cos) / pitch,
          gx = Math.floor(u),
          gy = Math.floor(v),
          key = (gy + cells) * side + gx + cells;
        let coverage;
        if (pitch < 4) {
          coverage = 0;
          // Integrate tiny screens across a pixel instead of aliasing one cell.
          for (let sy = 0; sy < 4; sy++)
            for (let sx = 0; sx < 4; sx++) {
              const ox = (sx + 0.5) / 4 - 0.5,
                oy = (sy + 0.5) / 4 - 0.5;
              const su = u + (ox * cos + oy * sin) / pitch,
                sv = v + (-ox * sin + oy * cos) / pitch,
                sgx = Math.floor(su),
                sgy = Math.floor(sv),
                sk = (sgy + cells) * side + sgx + cells;
              const a = (su - sgx - 0.5) * pitch,
                b = (sv - sgy - 0.5) * pitch;
              const inside = a * a + b * b < radii[sk] * radii[sk];
              if (holes[sk] ? !inside : inside) coverage += alphas[sk];
            }
          coverage /= 16;
        } else {
          const a = (u - gx - 0.5) * pitch,
            b = (v - gy - 0.5) * pitch,
            radius = radii[key];
          const circle = radius
            ? Math.max(0, Math.min(1, radius + 0.5 - Math.sqrt(a * a + b * b)))
            : 0;
          coverage = alphas[key] * (holes[key] ? 1 - circle : circle);
        }
        pixels[p] = color[0];
        pixels[p + 1] = color[1];
        pixels[p + 2] = color[2];
        pixels[p + 3] = coverage;
      }
    layer.canvas
      .getContext("2d")
      .putImageData(new ImageData(pixels, width, height), 0, 0);
    ctx.globalCompositeOperation = "multiply";
    ctx.drawImage(layer.canvas, 0, 0);
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
}

export function contourType(ctx, data, w, h, c, width, height) {
  const size = Math.max(
    3,
    ((c.cellSize * Math.max(width, height)) / 1920) * c.fontScale,
  );
  const spacing = size * 0.75 * c.beadSpacing,
    text = Array.from(c.contourText || "DITHER / ");
  ctx.fillStyle = c.fgColor;
  ctx.font = `${size}px "${c.font}", monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const levels =
    c.contourSource === "alpha"
      ? [c.threshold]
      : Array.from({ length: c.contourLevels }, (_, i) =>
          Math.max(
            1,
            Math.min(254, c.threshold + (i - (c.contourLevels - 1) / 2) * 40),
          ),
        );
  for (const level of levels) {
    const paths = contourPaths(data, w, h, level, c.contourSource === "alpha");
    for (const path of paths) {
      let remaining = spacing / 2,
        index = 0;
      for (let i = 1; i < path.length; i++) {
        const x = (path[i - 1][0] * width) / w,
          y = (path[i - 1][1] * height) / h;
        const dx = ((path[i][0] - path[i - 1][0]) * width) / w,
          dy = ((path[i][1] - path[i - 1][1]) * height) / h,
          length = Math.hypot(dx, dy);
        if (!length) continue;
        const angle = Math.atan2(dy, dx);
        while (remaining < length) {
          const xx = x + (dx * remaining) / length,
            yy = y + (dy * remaining) / length,
            glyph = text[index++ % text.length];
          if (ctx.fillRotatedText) ctx.fillRotatedText(glyph, xx, yy, angle);
          else {
            ctx.save();
            ctx.translate(xx, yy);
            ctx.rotate(angle);
            ctx.fillText(glyph, 0, 0);
            ctx.restore();
          }
          remaining += spacing;
        }
        remaining -= length;
      }
    }
  }
}
