self.onmessage = async function(e) {
  const { bitmap, palette, method, width, height } = e.data;
  const offscreen = new OffscreenCanvas(width, height);
  const ctx = offscreen.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const L = palette.length;
  const mat = [
    [0,8,2,10], [12,4,14,6], [3,11,1,9], [15,7,13,5]
  ];

  if (method === 'ordered') {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const r = data[i], g = data[i+1], b = data[i+2];
        const brightness = 0.299*r + 0.587*g + 0.114*b;
        const levelNorm = (brightness/255)*(L-1);
        const thresh = mat[y % 4][x % 4] / 16;
        const idx = Math.min(L-1, Math.floor(levelNorm + thresh));
        const col = palette[idx] || '#000000';
        data[i] = parseInt(col.slice(1,3),16);
        data[i+1] = parseInt(col.slice(3,5),16);
        data[i+2] = parseInt(col.slice(5,7),16);
      }
    }
  } else {
    const errorBuffer = Array.from({ length: height }, () => new Float32Array(width));
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const r = data[i], g = data[i+1], b = data[i+2];
        const brightness = 0.299*r + 0.587*g + 0.114*b;
        const oldPixel = brightness + errorBuffer[y][x];
        const norm = (oldPixel/255)*(L-1);
        const idx = Math.max(0, Math.min(L-1, Math.round(norm)));
        const col = palette[idx] || '#000000';
        data[i] = parseInt(col.slice(1,3),16);
        data[i+1] = parseInt(col.slice(3,5),16);
        data[i+2] = parseInt(col.slice(5,7),16);
        const quantVal = (idx/(L-1))*255;
        const err = oldPixel - quantVal;
        if (x+1 < width) errorBuffer[y][x+1] += err * 7/16;
        if (y+1 < height) {
          if (x > 0) errorBuffer[y+1][x-1] += err * 3/16;
          errorBuffer[y+1][x] += err * 5/16;
          if (x+1 < width) errorBuffer[y+1][x+1] += err * 1/16;
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  const processed = offscreen.transferToImageBitmap();
  self.postMessage({ bitmap: processed }, [processed]);
};
