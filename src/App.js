import React, { useRef, useEffect, useState, useReducer, useCallback } from 'react';
import './App.css';
import GIF from 'gif.js/dist/gif.js';
import ControlsPanel from './ControlsPanel';
import { fonts, charPalettes, palette10, decadePalettes, asciiVariants, paletteSets } from './constants';
import C2S from 'canvas2svg';

// Load saved config and define initial settings
const defaultConfig = {
  mode: 'video', effect: 'palette', fgColor: '#FFFFFF', bgColor: '#000000', threshold: 128,
  pixelSize: 20, font: 'Arial', recordingFormat: 'mp4', decadePalette: 'Default', charPalette: 'Default',
  ditherPalette: 'Default',
  smoothFactor: 1,  // 0=static frame, 1=full real-time
  char: '.', fontSize: 20,
  letterCount: 10, outputResolution: 'native', paletteName: 'Channel Colors', ditherMethod: 'ordered', extractCount: 8,
  asciiVariant: 'Default',
  asciiMapping: 'dynamic',
  transparentBg: false,
  imageDownloadType: 'png1x',
  overlayType: 'number',
  removeGreen: false,
  greenReplaceColor: '#000000',
  asciiUnderlay: false,
};

const savedConfig = JSON.parse(localStorage.getItem('config') || 'null');
const initialConfig = savedConfig ? { ...defaultConfig, ...savedConfig } : defaultConfig;

// reducer to manage config state
function configReducer(state, action) {
  switch (action.type) {
    case 'SET': return { ...state, [action.name]: action.value };
    case 'SNAP_FONT': return { ...state, fontSize: state.pixelSize };
    default: return state;
  }
}

function App() {
  const [config, dispatch] = useReducer(configReducer, initialConfig);
  const [fontsList, setFontsList] = useState(fonts);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  // Apply theme to document root and save preference
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);
  // Presets management
  const [presets, setPresets] = useState(() => JSON.parse(localStorage.getItem('presets') || '{}'));
  const [selectedPreset, setSelectedPreset] = useState('');
  useEffect(() => { localStorage.setItem('presets', JSON.stringify(presets)); }, [presets]);
  const savePreset = () => {
    const name = prompt('Enter preset name:'); if (!name) return;
    setPresets(ps => ({ ...ps, [name]: config })); setSelectedPreset(name);
  };
  const loadPreset = e => {
    const name = e.target.value; setSelectedPreset(name);
    if (presets[name]) Object.entries(presets[name]).forEach(([k, v]) => dispatch({ type: 'SET', name: k, value: v }));
  };
  const deletePreset = () => {
    if (!selectedPreset) return;
    const { [selectedPreset]: _, ...rest } = presets;
    setPresets(rest); setSelectedPreset('');
  };
  const exportPresets = () => {
    const blob = new Blob([JSON.stringify(presets, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'presets.json';
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  };
  const importPresets = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { try { const obj = JSON.parse(reader.result); setPresets(obj); } catch (err) { console.error(err); } };
    reader.readAsText(file);
  };
  // PWA install prompt
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  useEffect(() => { window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); setDeferredPrompt(e); }); }, []);
  const installApp = async () => { if (!deferredPrompt) return; deferredPrompt.prompt(); await deferredPrompt.userChoice; setDeferredPrompt(null); };

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [recorder, setRecorder] = useState(null);
  const [gifRecorder, setGifRecorder] = useState(null);
  const imageRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [videoFileLoaded, setVideoFileLoaded] = useState(false);
  const ditherWorkerRef = useRef(null);
  const latestBitmapRef = useRef(null);
  const pendingRef = useRef(false);
  // offscreen canvases for processing
  const offscreenRef = useRef(document.createElement('canvas'));
  const offCtxRef = useRef(offscreenRef.current.getContext('2d'));
  const off2screenRef = useRef(document.createElement('canvas'));
  const off2CtxRef = useRef(off2screenRef.current.getContext('2d'));
  const accumRef = useRef(document.createElement('canvas'));
  const accumCtxRef = useRef(accumRef.current.getContext('2d'));
  const edgeCanvasRef = useRef(document.createElement('canvas'));
  const edgeCtxRef = useRef(edgeCanvasRef.current.getContext('2d'));

  const configRef = useRef(config);
  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { localStorage.setItem('config', JSON.stringify(config)); }, [config]);

  const draw = useCallback(() => {
    const cfg = configRef.current;
    const canvas = canvasRef.current; const ctx = canvas.getContext('2d');
    let source;
    if (cfg.mode === 'image') {
      if (!imageLoaded) return;
      source = imageRef.current;
    } else {
      // live or file video
      if (cfg.mode === 'video-file') {
        if (!videoFileLoaded) return;
        source = videoRef.current;
      } else if (cfg.mode === 'video') {
        // always allow live feed for dithering
        if (cfg.effect !== 'dither' && (!videoRef.current || videoRef.current.readyState < 2)) return;
        source = videoRef.current;
      }
    }
    // adjust internal processing resolution
    let resW, resH;
    if (cfg.mode === 'image') {
      resW = source.naturalWidth; resH = source.naturalHeight;
    } else if (cfg.outputResolution === '4k') {
      // always full 4K processing
      resW = 3840; resH = 2160;
    } else if (cfg.outputResolution === '1080p') {
      resW = 1920; resH = 1080;
    } else {
      resW = source.videoWidth; resH = source.videoHeight;
    }
    canvas.width = resW; canvas.height = resH;
    // maintain correct preview aspect ratio
    canvas.style.aspectRatio = `${resW}/${resH}`;
    // temporal smoothing (EMA) for video input
    if (cfg.mode !== 'image') {
      const accum = accumRef.current, accumCtx = accumCtxRef.current;
      if (accum.width !== resW || accum.height !== resH) {
        accum.width = resW; accum.height = resH;
        accumCtx.globalAlpha = 1;
        accumCtx.drawImage(source, 0, 0, resW, resH);
      } else {
        accumCtx.globalAlpha = cfg.smoothFactor;
        accumCtx.drawImage(source, 0, 0, resW, resH);
        accumCtx.globalAlpha = 1;
      }
      source = accum;
    }
    // dither path: process offscreen then draw in onmessage, skip fill and other effects
    if (cfg.effect === 'dither' || cfg.effect === 'dither-ascii') {
      // ensure valid dims
      if (!canvas.width || !canvas.height) return;
      const size = cfg.pixelSize;
      const w = Math.floor(canvas.width / size); if (!w) return;
      const h = Math.floor(canvas.height / size); if (!h) return;
      // reuse offscreen canvas to avoid allocations
      const off = offscreenRef.current;
      if (off.width !== w || off.height !== h) { off.width = w; off.height = h; }
      const offCtx = offCtxRef.current;
      offCtx.imageSmoothingEnabled = false;
      offCtx.drawImage(source, 0, 0, w, h);
      if (!pendingRef.current) {
        pendingRef.current = true;
        // use separate dither palette
        const pal = charPalettes[cfg.ditherPalette] || palette10;
        createImageBitmap(off).then(bitmap =>
          ditherWorkerRef.current.postMessage({ bitmap, palette: pal, method: cfg.ditherMethod, width: w, height: h }, [bitmap])
        );
      }
      const bmp = latestBitmapRef.current;
      if (bmp) {
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
        if (cfg.effect === 'dither-ascii') {
          // ascii overlay
          const size = cfg.pixelSize;
          const cols = Math.floor(canvas.width / size);
          const rows = Math.floor(canvas.height / size);
          const off2 = off2screenRef.current;
          off2.width = cols; off2.height = rows;
          const off2Ctx = off2CtxRef.current;
          off2Ctx.drawImage(source, 0, 0, cols, rows);
          const data2 = off2Ctx.getImageData(0, 0, cols, rows).data;
          const briArr = []; for (let i = 0; i < data2.length; i += 4) { if (data2[i+3] === 0) continue; briArr.push(0.299*data2[i] + 0.587*data2[i+1] + 0.114*data2[i+2]); }
          const minBri = Math.min(...briArr), maxBri = Math.max(...briArr), range = maxBri - minBri || 1;
          const variant = asciiVariants[cfg.asciiVariant] || asciiVariants.Default;
          const pal2 = charPalettes[cfg.charPalette] || palette10;
          ctx.font = `${cfg.fontSize}px ${cfg.font}, monospace`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
              const idx = (y * cols + x) * 4;
              if (data2[idx+3] === 0) continue;
              const bri = 0.299*data2[idx] + 0.587*data2[idx+1] + 0.114*data2[idx+2];
              const scaled = (bri - minBri) / range;
              const vi = cfg.asciiMapping === 'static' ? Math.floor((bri/255) * (variant.length - 1)) : Math.floor(scaled * (variant.length - 1));
              const ch = variant[vi];
              ctx.fillStyle = pal2[vi] || cfg.fgColor;
              ctx.fillText(ch, x*size + size/2, y*size + size/2);
            }
          }
        }
        // overlay original on green areas for removeGreen
        if (cfg.removeGreen) {
          const size = cfg.pixelSize;
          const cols = Math.floor(canvas.width / size);
          const rows = Math.floor(canvas.height / size);
          const mask = off2screenRef.current;
          mask.width = cols; mask.height = rows;
          const maskCtx = off2CtxRef.current;
          maskCtx.clearRect(0,0,cols,rows);
          maskCtx.drawImage(source, 0, 0, cols, rows);
          const maskData = maskCtx.getImageData(0, 0, cols, rows).data;
          for (let yy = 0; yy < rows; yy++) {
            for (let xx = 0; xx < cols; xx++) {
              const mi = (yy * cols + xx) * 4;
              if (maskData[mi + 1] > maskData[mi] * 1.2 && maskData[mi + 1] > maskData[mi + 2] * 1.2 && maskData[mi + 1] > 100) {
                // fill green-dominant block with background color
                ctx.fillStyle = cfg.greenReplaceColor;
                ctx.fillRect(xx*size, yy*size, size, size);
              }
            }
          }
        }
      }
      return;
    }
    ctx.imageSmoothingEnabled = false;
    if (cfg.mode === 'image' || cfg.transparentBg) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = cfg.bgColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const size = cfg.pixelSize;
    // guard zero sizes
    if (!canvas.width || !canvas.height) return;
    const w = Math.floor(canvas.width / size);
    const h = Math.floor(canvas.height / size);
    if (!w || !h) return;
    ctx.font = `${cfg.fontSize}px ${cfg.font}`;

    const off = offscreenRef.current;
    off.width = w;
    off.height = h;
    const offCtx = offCtxRef.current;
    offCtx.imageSmoothingEnabled = false;
    offCtx.drawImage(source, 0, 0, w, h);
    let data;
    try {
      // grab full ImageData for effects
      const imageData = offCtx.getImageData(0, 0, w, h);
      data = imageData.data;
    } catch (err) {
      console.error('offCtx.getImageData error', err);
      return;
    }

    ctx.textBaseline = 'top';
    ctx.textAlign = 'start';

    let errorBuffer;
    if (cfg.effect === 'dither' && cfg.ditherMethod !== 'ordered') {
      errorBuffer = Array.from({ length: h }, () => Array(w).fill(0));
    }

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const px = x * size;
        const py = y * size;
        const i = (y * w + x) * 4;
        // skip transparent source pixels
        const alpha = data[i + 3]; if (alpha === 0) continue;
        const r = data[i], g = data[i+1], b = data[i+2];
        const brightness = (0.299*r + 0.587*g + 0.114*b);
        // fill green-dominant areas with background if enabled
        if (cfg.removeGreen) {
          const isGreen = g > r * 1.2 && g > b * 1.2 && g > 100;
          if (isGreen) {
            ctx.fillStyle = cfg.greenReplaceColor;
            ctx.fillRect(px, py, size, size);
            continue;
          }
        }
        switch (cfg.effect) {
          case 'green-screen': {
            // skip blocks dominated by green
            const isGreen = g > r * 1.2 && g > b * 1.2 && g > 100;
            if (!isGreen) {
              ctx.fillStyle = `rgb(${r},${g},${b})`;
              ctx.fillRect(px, py, size, size);
            }
            break;
          }
          case 'two-tone':
            ctx.fillStyle = brightness > cfg.threshold ? cfg.fgColor : cfg.bgColor;
            ctx.fillRect(px, py, size, size);
            break;
          case 'binary':
            const isOne = brightness > cfg.threshold;
            const bit = isOne ? '1' : '0';
            ctx.fillStyle = isOne ? cfg.fgColor : cfg.bgColor;
            ctx.fillRect(px, py, size, size);
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillStyle = isOne ? cfg.bgColor : cfg.fgColor;
            ctx.fillText(bit, px + size/2, py + size/2);
            break;
          case 'decade': {
            const r0 = r, g0 = g, b0 = b;
            let minDist = Infinity, idx10 = 0;
            for (let k = 0; k < decadePalettes[cfg.decadePalette].length; k++) {
              const col = decadePalettes[cfg.decadePalette][k];
              const pr = parseInt(col.slice(1,3),16), pg = parseInt(col.slice(3,5),16), pb = parseInt(col.slice(5,7),16);
              const d = (r0-pr)**2 + (g0-pg)**2 + (b0-pb)**2;
              if (d < minDist) { minDist = d; idx10 = k; }
            }
            const blockCol = decadePalettes[cfg.decadePalette][idx10];
            ctx.fillStyle = blockCol; ctx.fillRect(px, py, size, size);
            const pr = parseInt(blockCol.slice(1,3),16), pg = parseInt(blockCol.slice(3,5),16), pb = parseInt(blockCol.slice(5,7),16);
            const blockB = 0.299*pr + 0.587*pg + 0.114*pb;
            const txtColor = blockB > 128 ? '#000000' : '#FFFFFF';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillStyle = txtColor; ctx.fillText(idx10.toString(), px+size/2, py+size/2);
            break;
          }
          case 'palette': {
            const pal = paletteSets[cfg.paletteName] || palette10;
            let minDist = Infinity, idxP = 0;
            for (let k = 0; k < pal.length; k++) {
              const c = pal[k];
              const pr = parseInt(c.slice(1,3),16), pg = parseInt(c.slice(3,5),16), pb = parseInt(c.slice(5,7),16);
              const d = (r-pr)*(r-pr) + (g-pg)*(g-pg) + (b-pb)*(b-pb);
              if (d < minDist) { minDist = d; idxP = k; }
            }
            // draw block
            ctx.fillStyle = pal[idxP]; ctx.fillRect(px, py, size, size);
            // overlay if desired
            if (cfg.overlayType !== 'none') {
              ctx.font = `${cfg.fontSize}px ${cfg.font}, monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
              if (cfg.overlayType === 'number') {
                const block = pal[idxP];
                const pr2 = parseInt(block.slice(1,3),16), pg2 = parseInt(block.slice(3,5),16), pb2 = parseInt(block.slice(5,7),16);
                const lum = 0.299*pr2 + 0.587*pg2 + 0.114*pb2;
                ctx.fillStyle = lum > 128 ? '#000000' : '#FFFFFF';
                ctx.fillText(idxP.toString(), px + size/2, py + size/2);
              } else if (cfg.overlayType === 'character') {
                ctx.fillStyle = cfg.fgColor;
                ctx.fillText(cfg.char, px + size/2, py + size/2);
              }
            }
            break;
          }
          case 'dither': {
            const pal = charPalettes[cfg.charPalette] || palette10;
            const L = pal.length;
            if (cfg.ditherMethod === 'ordered') {
              // ordered 4x4 Bayer dithering
              const mat = [[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]];
              const sub = Math.floor(size/4);
              const levelNorm = (brightness/255)*(L-1);
              for (let iy = 0; iy < 4; iy++) {
                for (let ix = 0; ix < 4; ix++) {
                  const thresh = mat[iy][ix]/16;
                  const idx = Math.min(L-1, Math.floor(levelNorm + thresh));
                  ctx.fillStyle = pal[idx] || '#000000';
                  ctx.fillRect(px + ix*sub, py + iy*sub, sub, sub);
                }
              }
            } else {
              // error diffusion algorithms
              const oldPixel = brightness + errorBuffer[y][x];
              const norm = oldPixel/255*(L-1);
              const idx = Math.max(0, Math.min(L-1, Math.round(norm)));
              const quantVal = (idx/(L-1))*255;
              const err = oldPixel - quantVal;
              switch (cfg.ditherMethod) {
                case 'floyd':
                  // Floyd–Steinberg
                  if (x+1 < w) errorBuffer[y][x+1] += err * 7/16;
                  if (y+1 < h) {
                    if (x > 0) errorBuffer[y+1][x-1] += err * 3/16;
                    errorBuffer[y+1][x] += err * 5/16;
                    if (x+1 < w) errorBuffer[y+1][x+1] += err * 1/16;
                  }
                  break;
                case 'jarvis':
                  // Jarvis–Judice–Ninke
                  if (x+1 < w) errorBuffer[y][x+1] += err * 7/48;
                  if (x+2 < w) errorBuffer[y][x+2] += err * 5/48;
                  if (y+1 < h) {
                    if (x-2 >= 0) errorBuffer[y+1][x-2] += err * 3/48;
                    if (x-1 >= 0) errorBuffer[y+1][x-1] += err * 5/48;
                    errorBuffer[y+1][x] += err * 7/48;
                    if (x+1 < w) errorBuffer[y+1][x+1] += err * 5/48;
                    if (x+2 < w) errorBuffer[y+1][x+2] += err * 3/48;
                  }
                  if (y+2 < h) {
                    if (x-2 >= 0) errorBuffer[y+2][x-2] += err * 1/48;
                    if (x-1 >= 0) errorBuffer[y+2][x-1] += err * 3/48;
                    errorBuffer[y+2][x] += err * 5/48;
                    if (x+1 < w) errorBuffer[y+2][x+1] += err * 3/48;
                    if (x+2 < w) errorBuffer[y+2][x+2] += err * 1/48;
                  }
                  break;
                case 'burkes':
                  // Burkes
                  if (x+1 < w) errorBuffer[y][x+1] += err * 8/32;
                  if (x+2 < w) errorBuffer[y][x+2] += err * 4/32;
                  if (y+1 < h) {
                    if (x-2 >= 0) errorBuffer[y+1][x-2] += err * 2/32;
                    if (x-1 >= 0) errorBuffer[y+1][x-1] += err * 4/32;
                    errorBuffer[y+1][x] += err * 8/32;
                    if (x+1 < w) errorBuffer[y+1][x+1] += err * 4/32;
                    if (x+2 < w) errorBuffer[y+1][x+2] += err * 2/32;
                  }
                  break;
                case 'sierra':
                  // Sierra
                  if (x+1 < w) errorBuffer[y][x+1] += err * 5/32;
                  if (x+2 < w) errorBuffer[y][x+2] += err * 3/32;
                  if (y+1 < h) {
                    if (x-2 >= 0) errorBuffer[y+1][x-2] += err * 2/32;
                    if (x-1 >= 0) errorBuffer[y+1][x-1] += err * 4/32;
                    errorBuffer[y+1][x] += err * 5/32;
                    if (x+1 < w) errorBuffer[y+1][x+1] += err * 4/32;
                    if (x+2 < w) errorBuffer[y+1][x+2] += err * 2/32;
                  }
                  if (y+2 < h) {
                    if (x-1 >= 0) errorBuffer[y+2][x-1] += err * 2/32;
                    errorBuffer[y+2][x] += err * 3/32;
                    if (x+1 < w) errorBuffer[y+2][x+1] += err * 2/32;
                  }
                  break;
                case 'atkinson':
                  // Atkinson
                  if (x+1 < w) errorBuffer[y][x+1] += err * 1/8;
                  if (x+2 < w) errorBuffer[y][x+2] += err * 1/8;
                  if (y+1 < h) {
                    if (x-1 >= 0) errorBuffer[y+1][x-1] += err * 1/8;
                    errorBuffer[y+1][x] += err * 1/8;
                    if (x+1 < w) errorBuffer[y+1][x+1] += err * 1/8;
                  }
                  if (y+2 < h) {
                    errorBuffer[y+2][x] += err * 1/8;
                  }
                  break;
                default:
                  // fallback to Floyd–Steinberg
                  if (x+1 < w) errorBuffer[y][x+1] += err * 7/16;
                  if (y+1 < h) {
                    if (x > 0) errorBuffer[y+1][x-1] += err * 3/16;
                    errorBuffer[y+1][x] += err * 5/16;
                    if (x+1 < w) errorBuffer[y+1][x+1] += err * 1/16;
                  }
              }
              ctx.fillStyle = pal[idx] || '#000000';
              ctx.fillRect(px, py, size, size);
            }
           break;
          }
          case 'ascii':
            // center ASCII char with palette colors
            ctx.font = `${cfg.fontSize}px ${cfg.font}, monospace`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            const variant = asciiVariants[cfg.asciiVariant] || asciiVariants.Default;
            const idx = Math.floor((brightness/255)*(variant.length-1));
            const pal = charPalettes[cfg.charPalette] || palette10;
            ctx.fillStyle = pal[idx] || cfg.fgColor;
            ctx.fillText(variant[idx], px + size/2, py + size/2);
            break;
          case 'brightness-map':
            ctx.fillStyle = `rgb(${brightness},${brightness},${brightness})`;
            ctx.fillText(cfg.char, px, py);
            break;
          case 'binary-char': {
            const isOn = brightness > cfg.threshold;
            ctx.fillStyle = isOn ? cfg.fgColor : cfg.bgColor;
            ctx.fillRect(px, py, size, size);
            const idx = Math.floor((brightness/255)*9);
            const pal = charPalettes[cfg.charPalette] || palette10;
            ctx.textAlign='center'; ctx.textBaseline='middle';
            ctx.fillStyle = pal[idx] || '#000000'; ctx.fillText(idx.toString(), px+size/2, py+size/2);
            break;
          }
          case 'numbers-0-9-img':
            const num9 = Math.floor((brightness/255)*9);
            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillText(num9.toString(), px, py);
            break;
          case 'numbers-0-9-palette': {
            const pal = charPalettes[cfg.charPalette] || palette10;
            const idxP = Math.floor((brightness/255)*(pal.length-1));
            ctx.fillStyle = pal[idxP];
            ctx.fillText(idxP.toString(), px, py);
            break;
          }
          case 'letters-palette': {
            const letters5 = ['E','T','O','V','Z'];
            const pal = cfg.letterCount === 5
              ? paletteSets[cfg.paletteName]
              : charPalettes[cfg.charPalette] || palette10;
            const idxP = Math.floor((brightness/255)*(pal.length-1));
            // base index from brightness
            let idxL = Math.floor((brightness/255)*(cfg.letterCount - 1));
            if (cfg.letterCount === 5) {
              // invert: darkest→Z (idx4), brightest→E (idx0)
              idxL = (cfg.letterCount - 1) - idxL;
            }
            const ch = cfg.letterCount === 5 ? letters5[idxL] : String.fromCharCode(65 + idxL);
            // for 5 letters, ensure Z (idx4) is black
            const color = cfg.letterCount === 5 && idxL === cfg.letterCount - 1
              ? '#000000'
              : pal[idxP] || '#000000';
            ctx.fillStyle = color;
            ctx.fillText(ch, px + size/2, py + size/2);
            break;
          }
          case 'letter-char': {
            const isOn = brightness > cfg.threshold;
            ctx.fillStyle = isOn ? cfg.fgColor : cfg.bgColor;
            ctx.fillRect(px, py, size, size);
            const idx = Math.floor((brightness/255)*(cfg.letterCount-1));
            const pal = charPalettes[cfg.charPalette] || palette10;
            const ch = String.fromCharCode(65 + idx);
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillStyle = pal[idx] || '#000000';
            ctx.fillText(ch, px + size/2, py + size/2);
            break;
          }
          case 'circle-palette': {
            const pal = charPalettes[cfg.charPalette] || palette10;
            const idx = Math.floor((brightness/255)*(pal.length-1));
            const radius = (brightness/255)*(size/2);
            ctx.beginPath();
            ctx.arc(px + size/2, py + size/2, radius, 0, 2*Math.PI);
            ctx.fillStyle = pal[idx] || '#000000';
            ctx.fill();
            break;
          }
          case 'edge': {
            const offE = edgeCanvasRef.current; offE.width = w; offE.height = h;
            const eCtx = edgeCtxRef.current;
            const inData = data;
            const out = new Uint8ClampedArray(inData.length);
            for (let y = 0; y < h; y++) {
              for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const b = 0.299*inData[i] + 0.587*inData[i+1] + 0.114*inData[i+2];
                const bR = x < w-1 ? (0.299*inData[i+4] + 0.587*inData[i+5] + 0.114*inData[i+6]) : b;
                const bD = y < h-1 ? (0.299*inData[i+4*w] + 0.587*inData[i+4*w+1] + 0.114*inData[i+4*w+2]) : b;
                const mag = Math.abs(b - bR) + Math.abs(b - bD);
                const v = mag > cfg.threshold ? 255 : 0;
                out[i] = out[i+1] = out[i+2] = v; out[i+3] = 255;
              }
            }
            const outImg = new ImageData(out, w, h);
            eCtx.putImageData(outImg, 0, 0);
            ctx.imageSmoothingEnabled = false;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(offE, 0, 0, canvas.width, canvas.height);
            return;
          }
          default:
            break;
        }
      }
    }
    // ASCII Underlay: draw video/image beneath ASCII overlay
    if (cfg.effect === 'ascii' && cfg.asciiUnderlay) {
      ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    }
  }, [videoFileLoaded, imageLoaded]);

  // Schedule rendering and media streams based on mode and load states
  useEffect(() => {
    let rafId;
    let camStream;
    let lastTime = 0;
    const loop = async (time) => {
      const cfg = configRef.current;
      if (cfg.mode === 'video' && !camStream) {
        try {
          camStream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
          videoRef.current.srcObject = camStream;
          await videoRef.current.play();
        } catch (err) {
          console.error('Webcam error', err);
          return;
        }
      }
      const targetFps = (cfg.outputResolution === '4k') ? 30 : 60;
      const interval = 1000 / targetFps;
      if (time - lastTime >= interval) {
        draw();
        lastTime = time;
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafId);
      if (camStream) camStream.getTracks().forEach(t => t.stop());
    };
  }, [config.mode, videoFileLoaded, imageLoaded, draw]);

  const handleVideoUpload = useCallback((e) => {
    const file = e.target.files[0]; if (!file) return;
    const url = URL.createObjectURL(file);
    const vid = videoRef.current;
    if (vid.srcObject) { vid.srcObject.getTracks().forEach(t => t.stop()); vid.srcObject = null; }
    vid.src = url;
    dispatch({ type: 'SET', name: 'mode', value: 'video-file' });
    vid.onloadeddata = async () => {
      await vid.play();
      setVideoFileLoaded(true);
    };
  }, [dispatch, setVideoFileLoaded]);

  const handleVideoPlay = () => {
    const vid = videoRef.current;
    if (vid && vid.src) {
      if (vid.ended) vid.currentTime = 0;
      vid.play();
    }
  };
  const handleVideoPause = () => {
    const vid = videoRef.current;
    if (vid) vid.pause();
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const parsed = ['threshold','pixelSize','fontSize','letterCount','extractCount'].includes(name)
      ? parseInt(value)
      : value;
    const finalVal = type === 'checkbox' ? checked : parsed;
    dispatch({ type: 'SET', name, value: finalVal });
  };

  const handleImageUpload = useCallback((e) => {
    const file = e.target.files[0]; if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      dispatch({ type: 'SET', name: 'mode', value: 'image' });
      imageRef.current = img;
      setImageLoaded(true);
    };
    img.src = url;
  }, [dispatch, setImageLoaded]);

  const handleFontUpload = e => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const name = file.name.replace(/\.[^.]+$/, '');
    const fontFace = new FontFace(name, `url(${url})`);
    fontFace.load().then(ff => {
      document.fonts.add(ff);
      setFontsList(list => [...list, name]);
      dispatch({ type: 'SET', name: 'font', value: name });
    }).catch(err => console.error('Font load error', err));
  };

  const downloadSVG = () => {
    const canvas = canvasRef.current;
    const cfg = configRef.current;
    // select source
    let source;
    if (cfg.mode === 'image') { if (!imageLoaded) return; source = imageRef.current; }
    else if (cfg.mode === 'video-file') { if (!videoFileLoaded) return; source = videoRef.current; }
    else if (cfg.mode === 'video') { source = videoRef.current; }
    else return;
    const w = canvas.width, h = canvas.height;
    const c2s = new C2S(w, h);
    if (cfg.effect === 'ascii') {
      // vector ASCII only
      if (cfg.asciiUnderlay) {
        // draw underlying source beneath ASCII overlay
        c2s.drawImage(source, 0, 0, w, h);
      } else if (!cfg.transparentBg) {
        c2s.fillStyle = cfg.bgColor; c2s.fillRect(0, 0, w, h);
      }
      const size = cfg.pixelSize;
      const cols = Math.floor(w / size), rows = Math.floor(h / size);
      const off = offscreenRef.current; off.width = cols; off.height = rows;
      const offCtx = offCtxRef.current; offCtx.clearRect(0, 0, cols, rows);
      offCtx.drawImage(source, 0, 0, cols, rows);
      const data = offCtx.getImageData(0, 0, cols, rows).data;
      const variant = asciiVariants[cfg.asciiVariant] || asciiVariants.Default;
      const palSvg = charPalettes[cfg.charPalette] || palette10;
      c2s.font = `${cfg.fontSize}px ${cfg.font}, monospace`; c2s.textAlign = 'center'; c2s.textBaseline = 'middle';
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4; if (data[i + 3] === 0) continue;
        const bri = 0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2];
        const idx = Math.floor((bri/255)*(variant.length-1));
        c2s.fillStyle = palSvg[idx] || cfg.fgColor;
        c2s.fillText(variant[idx], x*size + size/2, y*size + size/2);
      }
    } else if (cfg.effect === 'dither-ascii') {
      // embed raster colored blocks from canvas
      c2s.drawImage(canvas, 0, 0, w, h);
      // overlay vector ASCII
      const size = cfg.pixelSize;
      const cols = Math.floor(w / size), rows = Math.floor(h / size);
      const off = offscreenRef.current; off.width = cols; off.height = rows;
      const offCtx = offCtxRef.current; offCtx.clearRect(0, 0, cols, rows);
      offCtx.drawImage(source, 0, 0, cols, rows);
      const data = offCtx.getImageData(0, 0, cols, rows).data;
      const briArrSvg = [];
      for (let i = 0; i < data.length; i += 4) {
        if (data[i+3] === 0) continue;
        briArrSvg.push(0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2]);
      }
      const minBriSvg = Math.min(...briArrSvg);
      const maxBriSvg = Math.max(...briArrSvg);
      const rangeSvg = maxBriSvg - minBriSvg || 1;
      const variant = asciiVariants[cfg.asciiVariant] || asciiVariants.Default;
      const palSvg = charPalettes[cfg.charPalette] || palette10;
      c2s.font = `${cfg.fontSize}px ${cfg.font}, monospace`; c2s.textAlign = 'center'; c2s.textBaseline = 'middle';
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4; if (data[i + 3] === 0) continue;
        const bri = 0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2];
        const scaled = (bri - minBriSvg) / rangeSvg;
        const idx = cfg.asciiMapping === 'static'
          ? Math.floor((bri/255) * (variant.length - 1))
          : Math.floor(scaled * (variant.length - 1));
        c2s.fillStyle = palSvg[idx] || cfg.fgColor;
        c2s.fillText(variant[idx], x*size + size/2, y*size + size/2);
      }
    } else {
      // embed entire canvas as raster
      c2s.drawImage(canvas, 0, 0, w, h);
    }
    const svg = c2s.getSerializedSvg();
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'export.svg'; a.click();
  };

  const downloadHighResPNG = (scale = 2) => {
    const canvas = canvasRef.current;
    const w = canvas.width, h = canvas.height;
    const temp = document.createElement('canvas');
    temp.width = w * scale;
    temp.height = h * scale;
    const ctx2 = temp.getContext('2d');
    ctx2.imageSmoothingEnabled = false;
    ctx2.scale(scale, scale);
    ctx2.drawImage(canvas, 0, 0);
    temp.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `filtered@${scale}x.png`; a.click();
    }, 'image/png');
  };

  const downloadVideo = () => {
    const canvas = canvasRef.current;
    const stream = canvas.captureStream(30);
    const format = config.recordingFormat;
    let mimeType;
    if (format === 'mp4' && MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
      mimeType = 'video/mp4;codecs=avc1';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
      mimeType = 'video/webm;codecs=vp9';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
      mimeType = 'video/webm;codecs=vp8';
    } else if (MediaRecorder.isTypeSupported('video/webm')) {
      mimeType = 'video/webm';
    } else {
      mimeType = 'video/mp4';
    }
    const bits = canvas.width >= 3840 ? 100_000_000 : 50_000_000;
    const mediaRec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bits });
    const chunks = [];
    mediaRec.ondataavailable = e => chunks.push(e.data);
    mediaRec.onstop = () => { const blob = new Blob(chunks, { type: mimeType }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `processed.${format==='mp4'?'mp4':'webm'}`; a.click(); setRecorder(null); };
    mediaRec.start();
    const vid = videoRef.current;
    vid.currentTime = 0;
    vid.onended = () => mediaRec.stop();
    vid.play();
  };

  const startRecording = () => {
    if (config.recordingFormat === 'gif') {
      if (gifRecorder) {
        console.warn('GIF recorder already running');
        return;
      }
      const canvas = canvasRef.current;
      const gif = new GIF({ workers: 2, quality: 10, width: canvas.width, height: canvas.height });
      gif.on('finished', blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'capture.gif'; a.click();
      });
      setGifRecorder(gif);
      return;
    }
    const canvas = canvasRef.current;
    const stream = canvas.captureStream(30);
    const format = config.recordingFormat;
    let mimeType;
    if (format === 'mp4' && MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')) {
      mimeType = 'video/mp4;codecs=avc1';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
      mimeType = 'video/webm;codecs=vp9';
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
      mimeType = 'video/webm;codecs=vp8';
    } else if (MediaRecorder.isTypeSupported('video/webm')) {
      mimeType = 'video/webm';
    } else {
      mimeType = 'video/mp4';
    }
    const bits = canvas.width >= 3840 ? 100_000_000 : 50_000_000;
    const mediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bits });
    const chunks = [];
    mediaRecorder.ondataavailable = event => chunks.push(event.data);
    mediaRecorder.onstop = () => { const blob = new Blob(chunks, { type: mimeType }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `capture.${format==='mp4'?'mp4':'webm'}`; a.click(); setRecorder(null); };
    mediaRecorder.start(); setRecorder(mediaRecorder);
  };

  const stopRecording = () => {
    if (gifRecorder) {
      try {
        gifRecorder.render();
      } catch (e) {
        if (e.message !== 'Already running') console.error(e);
      }
      setGifRecorder(null);
    } else if (recorder) {
      recorder.stop();
    }
  };

  useEffect(() => {
    console.log('[App] Initializing dither worker');
    ditherWorkerRef.current = new Worker('/ditherWorker.js');
    ditherWorkerRef.current.onerror = e => console.error('Dither worker error', e.message, e);
    ditherWorkerRef.current.onmessage = (e) => {
      latestBitmapRef.current = e.data.bitmap;
      pendingRef.current = false;
    };
    return () => ditherWorkerRef.current.terminate();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0]; if (!f) return;
    if (f.type.startsWith('image/')) handleImageUpload({ target: { files: [f] } });
    else if (f.type.startsWith('video/')) handleVideoUpload({ target: { files: [f] } });
  }, [handleImageUpload, handleVideoUpload]);

  return (
    <div className="App" onDragOver={e => e.preventDefault()} onDrop={handleDrop}>
      <header className="App-header">
        <h1>Camera Effects</h1>
        <button className="theme-toggle" onClick={()=>setTheme(theme==='light'?'dark':'light')}>
          {theme==='light'?'Dark':'Light'} Mode
        </button>
        {deferredPrompt && <button className="install-btn" onClick={installApp}>Install App</button>}
      </header>
      <main className="App-main">
        <section className="preview">
          <canvas ref={canvasRef} className="preview-canvas" />
          <video
            ref={videoRef}
            style={{ display: 'none' }}
            muted
            playsInline
            autoPlay
          />
        </section>
        <ControlsPanel
          config={config}
          dispatch={dispatch}
          handleChange={handleChange}
          handleVideoUpload={handleVideoUpload}
          handleVideoPlay={handleVideoPlay}
          handleVideoPause={handleVideoPause}
          handleImageUpload={handleImageUpload}
          handleFontUpload={handleFontUpload}
          startRecording={startRecording}
          stopRecording={stopRecording}
          downloadSVG={downloadSVG}
          downloadHighResPNG={downloadHighResPNG}
          downloadVideo={downloadVideo}
          videoFileLoaded={videoFileLoaded}
          imageLoaded={imageLoaded}
          recorder={recorder}
          gifRecorder={gifRecorder}
          fontsList={fontsList}
          presets={presets} selectedPreset={selectedPreset}
          onSavePreset={savePreset} onLoadPreset={loadPreset} onDeletePreset={deletePreset}
          onExportPresets={exportPresets} onImportPresets={importPresets}
        />
      </main>
    </div>
  );
}

export default App;
