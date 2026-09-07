import React, {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import "./App.css";
import {
  defaults,
  sanitizeConfig,
  migrateConfig,
  readStorage,
  writeStorage,
  parsePresets,
  looks,
  palettes,
  effects,
  dimensions,
  timeLabel,
  filename,
} from "./studio/model";
import { FrameRenderer, drawSignal } from "./studio/renderer";
import {
  loadFile,
  createVideoElement,
  releaseSource,
  waitForMedia,
  AudioRouter,
  seek,
} from "./studio/media";
import {
  exportStill,
  exportGIF,
  recordVideo,
  recordingFormats,
} from "./studio/export";
import {
  Icon,
  EffectControls,
  ColorControls,
  Select,
  Check,
} from "./studio/Controls";
function historyReducer(state, a) {
  if (a.type === "undo") {
    if (!state.past.length) return state;
    return {
      past: state.past.slice(0, -1),
      present: state.past.at(-1),
      future: [state.present, ...state.future],
      group: null,
    };
  }
  if (a.type === "redo") {
    if (!state.future.length) return state;
    return {
      past: [...state.past, state.present],
      present: state.future[0],
      future: state.future.slice(1),
      group: null,
    };
  }
  const present = sanitizeConfig(
    a.config || { ...state.present, [a.key]: a.value },
  );
  const grouped = a.key && state.group === a.key && Date.now() - state.at < 500;
  return {
    past: grouped ? state.past : [...state.past, state.present].slice(-80),
    present,
    future: [],
    group: a.key,
    at: Date.now(),
  };
}
function initialHistory() {
  const saved = readStorage("dither.config.v2", null);
  let c = saved
    ? sanitizeConfig(saved)
    : migrateConfig(readStorage("config", {}));
  if (
    ![
      "monospace",
      "Courier New",
      "Arial",
      "Verdana",
      "Tahoma",
      "Georgia",
      "Times New Roman",
      "Comic Sans MS",
      "Impact",
    ].includes(c.font)
  )
    c.font = "monospace";
  return { past: [], present: c, future: [] };
}
function initialPresets() {
  try {
    return parsePresets(
      readStorage("dither.presets.v2", readStorage("presets", {})),
    );
  } catch {
    return {};
  }
}
const demo = () => ({
  kind: "demo",
  name: "Test signal 01",
  width: 1280,
  height: 720,
  duration: 8,
});
function Dialog({ title, onClose, busy = false, children }) {
  const ref = useRef();
  useEffect(() => {
    const el = ref.current;
    el.showModal();
    return () => el.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      className="modal"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !busy) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
          disabled={busy}
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function App() {
  const [history, dispatch] = useReducer(
      historyReducer,
      undefined,
      initialHistory,
    ),
    config = history.present;
  const [source, setSource] = useState(demo),
    sourceRef = useRef(source);
  const [playing, setPlaying] = useState(false),
    [time, setTime] = useState(0),
    timeRef = useRef(0),
    [trim, setTrim] = useState([0, 8]),
    trimRef = useRef(trim);
  const [tab, setTab] = useState("effects"),
    [compare, setCompare] = useState(false),
    [split, setSplit] = useState(50),
    [previewSize, setPreviewSize] = useState("960");
  const [notice, setNotice] = useState(null),
    [loading, setLoading] = useState(false),
    [dialog, setDialog] = useState(null),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [result, setResult] = useState(null);
  const [format, setFormat] = useState("auto"),
    [resolution, setResolution] = useState("1920"),
    [fps, setFps] = useState(30),
    [includeAudio, setIncludeAudio] = useState(true),
    [muted, setMuted] = useState(true),
    [loop, setLoop] = useState(true);
  const [presetName, setPresetName] = useState(""),
    [presets, setPresets] = useState(initialPresets),
    [selectedPreset, setSelectedPreset] = useState(""),
    [customFonts, setCustomFonts] = useState([]),
    fontFaces = useRef({});
  const [theme, setTheme] = useState(() =>
      readStorage("dither.theme.v2", "dark"),
    ),
    [revision, setRevision] = useState(0),
    [dragging, setDragging] = useState(false),
    [renderFps, setRenderFps] = useState(0);
  const canvasRef = useRef(),
    originalRef = useRef(),
    fileInput = useRef(),
    rendererRef = useRef(),
    signalRef = useRef(),
    abortRef = useRef(),
    loadAbort = useRef(),
    audioRef = useRef(),
    resultURL = useRef(),
    mounted = useRef(true),
    facing = useRef("user");
  const formats = recordingFormats();
  const set = useCallback((key, value) => dispatch({ key, value }), []);
  sourceRef.current = source;
  trimRef.current = trim;
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    writeStorage("dither.theme.v2", theme);
  }, [theme]);
  useEffect(() => {
    writeStorage("dither.config.v2", config);
  }, [config]);
  useEffect(() => {
    const loadedFonts = fontFaces.current;
    mounted.current = true;
    audioRef.current = new AudioRouter();
    rendererRef.current = new FrameRenderer();
    signalRef.current = document.createElement("canvas");
    return () => {
      mounted.current = false;
      loadAbort.current?.abort();
      abortRef.current?.abort();
      releaseSource(sourceRef.current);
      audioRef.current?.close();
      if (resultURL.current) URL.revokeObjectURL(resultURL.current);
      Object.values(loadedFonts).forEach(({ face }) =>
        document.fonts?.delete(face),
      );
    };
  }, []);
  const alert = useCallback(
    (text, error = false) => setNotice({ text, error }),
    [],
  );
  const resetFrame = () => {
    rendererRef.current?.invalidate();
    setRevision((n) => n + 1);
  };
  useEffect(() => {
    if (!rendererRef.current || busy) return;
    let raf = 0,
      last = -Infinity,
      lastUI = 0,
      count = 0,
      fpsStart = performance.now(),
      startClock = performance.now(),
      startTime = timeRef.current,
      failed = false;
    const size = dimensions(source.width, source.height, previewSize);
    const render = (now) => {
      if (failed) return;
      try {
        let t = timeRef.current;
        if (source.kind === "video" || source.kind === "camera")
          t = source.kind === "camera" ? 0 : source.element.currentTime;
        if (source.kind === "demo" && playing)
          t = startTime + (now - startClock) / 1000;
        if (playing && source.kind !== "camera" && t >= trimRef.current[1]) {
          if (loop) {
            t = trimRef.current[0];
            startTime = t;
            startClock = now;
            if (source.kind === "video") source.element.currentTime = t;
            rendererRef.current.invalidate();
          } else {
            source.element?.pause?.();
            setPlaying(false);
            t = trimRef.current[1];
          }
        }
        timeRef.current = t;
        if (now - last >= 1000 / 30 || !playing) {
          const frame =
            source.kind === "demo"
              ? drawSignal(signalRef.current, t)
              : source.element;
          if (
            frame &&
            ((source.kind !== "video" && source.kind !== "camera") ||
              frame.readyState >= 2)
          ) {
            rendererRef.current.render(
              frame,
              canvasRef.current,
              config,
              size.width,
              size.height,
            );
            const original = originalRef.current;
            if (original) {
              if (original.width !== size.width) original.width = size.width;
              if (original.height !== size.height)
                original.height = size.height;
              const ctx = original.getContext("2d");
              ctx.clearRect(0, 0, size.width, size.height);
              ctx.drawImage(frame, 0, 0, size.width, size.height);
            }
            count++;
          }
          last = now;
        }
        if (now - lastUI > 100) {
          setTime(t);
          lastUI = now;
        }
        if (now - fpsStart >= 1000) {
          setRenderFps(Math.round((count * 1000) / (now - fpsStart)));
          count = 0;
          fpsStart = now;
        }
        if (playing || source.kind === "camera")
          raf = requestAnimationFrame(render);
      } catch (e) {
        failed = true;
        setPlaying(false);
        alert(`Preview could not render: ${e.message}`, true);
      }
    };
    render(performance.now());
    return () => cancelAnimationFrame(raf);
  }, [
    source,
    config,
    playing,
    busy,
    previewSize,
    revision,
    loop,
    alert,
    compare,
  ]);
  const adopt = (next) => {
    setPlaying(false);
    audioRef.current?.disconnect();
    releaseSource(sourceRef.current);
    sourceRef.current = next;
    setSource(next);
    timeRef.current = 0;
    setTime(0);
    setTrim([0, next.duration || 10]);
    resetFrame();
    setNotice(null);
  };
  const openFile = async (file) => {
    if (!file || busy) return;
    loadAbort.current?.abort();
    const controller = new AbortController();
    loadAbort.current = controller;
    setLoading(true);
    try {
      const next = await loadFile(file, controller.signal);
      if (controller.signal.aborted) {
        releaseSource(next);
        return;
      }
      adopt(next);
      if (/\.gif$/i.test(file.name))
        alert(
          "Animated GIF input is treated as an image. For editable motion, import a video.",
        );
    } catch (e) {
      if (e.name !== "AbortError") alert(e.message, true);
    } finally {
      if (loadAbort.current === controller) setLoading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };
  const openCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert(
        "Camera access requires a secure connection and a browser with camera support.",
        true,
      );
      return;
    }
    loadAbort.current?.abort();
    const controller = new AbortController();
    loadAbort.current = controller;
    setLoading(true);
    let stream, video;
    try {
      if (sourceRef.current.kind === "camera") {
        sourceRef.current.element.srcObject
          ?.getTracks()
          .forEach((t) => t.stop());
        facing.current = facing.current === "user" ? "environment" : "user";
      }
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing.current },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      if (controller.signal.aborted) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      video = createVideoElement();
      video.muted = true;
      video.playsInline = true;
      const ready = waitForMedia(video, "loadeddata", controller.signal);
      video.srcObject = stream;
      await Promise.all([video.play(), ready]);
      if (!mounted.current || controller.signal.aborted) {
        stream.getTracks().forEach((t) => t.stop());
        video.remove();
        return;
      }
      adopt({
        kind: "camera",
        element: video,
        width: video.videoWidth,
        height: video.videoHeight,
        name: "Live camera",
        duration: 0,
      });
    } catch (e) {
      stream?.getTracks().forEach((t) => t.stop());
      video?.remove();
      if (e.name !== "AbortError")
        alert(
          e.name === "NotAllowedError"
            ? "Camera access was denied. Allow it in your browser’s site settings, then try again."
            : `Camera unavailable: ${e.message}`,
          true,
        );
    } finally {
      if (mounted.current && loadAbort.current === controller)
        setLoading(false);
    }
  };
  const togglePlay = useCallback(async () => {
    if (busy || loading || ["image", "camera"].includes(source.kind)) return;
    if (playing) {
      source.element?.pause?.();
      setPlaying(false);
      return;
    }
    try {
      if (timeRef.current >= trim[1] - 0.02 || timeRef.current < trim[0]) {
        timeRef.current = trim[0];
        if (source.kind === "video") await seek(source.element, trim[0]);
        rendererRef.current.invalidate();
      }
      if (source.kind === "video") {
        if (!muted) await audioRef.current.connect(source.element, true);
        source.element.loop = false;
        await source.element.play();
      }
      setPlaying(true);
    } catch (e) {
      alert(e.message, true);
    }
  }, [busy, loading, source, playing, trim, muted, alert]);
  const scrub = async (value) => {
    source.element?.pause?.();
    setPlaying(false);
    timeRef.current = value;
    setTime(value);
    if (source.kind === "video") {
      source.element.currentTime = Math.min(
        value,
        Math.max(0, source.duration - 0.001),
      );
      source.element.onseeked = resetFrame;
    }
    resetFrame();
  };
  const changeTrim = (index, value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    const next = [...trim];
    next[index] =
      index === 0
        ? Math.max(0, Math.min(n, trim[1] - 0.05))
        : Math.max(trim[0] + 0.05, Math.min(source.duration || 300, n));
    setTrim(next);
  };
  const toggleSound = async () => {
    try {
      if (muted) {
        await audioRef.current.connect(source.element, true);
      } else audioRef.current.mute(true);
      setMuted(!muted);
    } catch (e) {
      alert(e.message, true);
    }
  };
  const showExport = () => {
    if (source.kind === "video") source.element.pause();
    setPlaying(false);
    setDialog("export");
    if (
      source.kind === "image" ||
      (source.kind === "camera" && format === "gif")
    ) {
      setFormat(source.kind === "image" ? "png" : "auto");
      if (["480", "720"].includes(resolution)) setResolution("1920");
      setFps(30);
    }
  };
  useEffect(() => {
    const handler = (e) => {
      if (e.target.closest?.("input,select,textarea,button,dialog") || dialog)
        return;
      const mod = e.metaKey || e.ctrlKey;
      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? "redo" : "undo" });
      } else if (mod && e.key.toLowerCase() === "o") {
        e.preventDefault();
        fileInput.current?.click();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [togglePlay, dialog]);
  const savePreset = () => {
    const name = presetName.trim().slice(0, 60);
    if (!name) return;
    if (name in presets) {
      alert(
        "That name already exists. Choose a new name to keep both presets.",
        true,
      );
      return;
    }
    const next = { ...presets, [name]: config };
    if (Object.keys(next).length > 50) {
      alert("You can save up to 50 presets. Delete one first.", true);
      return;
    }
    setPresets(next);
    setSelectedPreset(name);
    setPresetName("");
    if (!writeStorage("dither.presets.v2", next))
      alert(
        "Preset is available for this session. Browser storage is full; export your presets to keep it.",
        true,
      );
    else alert(`Saved “${name}” on this device.`);
  };
  const importPresets = async (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    try {
      if (f.size > 1024 * 1024)
        throw new Error("Preset files must be smaller than 1 MB.");
      const imported = parsePresets(JSON.parse(await f.text()));
      const next = { ...presets };
      Object.entries(imported).forEach(([name, c]) => {
        let label = name,
          n = 2;
        while (label in next) label = `${name} (${n++})`;
        next[label] = c;
      });
      if (Object.keys(next).length > 50)
        throw new Error("Import would exceed 50 presets. Delete some first.");
      setPresets(next);
      if (!writeStorage("dither.presets.v2", next))
        alert(
          "Imported for this session; storage is unavailable. Export a backup.",
          true,
        );
      else alert("Presets imported.");
    } catch (err) {
      alert(err.message || "This is not a valid presets file.", true);
    }
  };
  const downloadPresets = () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ version: 2, presets }, null, 2)], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "dither-presets.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };
  const uploadFont = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024)
        throw new Error("Choose a font smaller than 5 MB.");
      const name = `Custom ${file.name
        .replace(/\.[^.]+$/, "")
        .replace(/[^\w -]/g, "")
        .slice(0, 50)}`;
      const buffer = await file.arrayBuffer();
      const face = new FontFace(name, buffer);
      await face.load();
      document.fonts.add(face);
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      fontFaces.current[name] = {
        face,
        css: `@font-face {font-family:"${name}";src:url("${data}");}`,
      };
      setCustomFonts((v) => [...new Set([...v, name])]);
      set("font", name);
      alert("Font loaded for this session and embedded in SVG exports.");
    } catch (err) {
      alert(err.message || "This font could not be loaded.", true);
    }
  };
  const startExport = async () => {
    if (abortRef.current) return;
    const c = { ...config },
      s = sourceRef.current,
      at = timeRef.current,
      controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setProgress(0);
    setNotice(null);
    if (source.kind === "video") source.element.pause();
    setPlaying(false);
    let wakeLock;
    try {
      let audioStream;
      const still = ["png", "svg"].includes(format);
      const video = !still && format !== "gif";
      if (video && includeAudio && s.kind === "video")
        audioStream = await audioRef.current.connect(s.element, !muted);
      if (navigator.wakeLock)
        try {
          wakeLock = await navigator.wakeLock.request("screen");
        } catch {}
      const options = {
        source: s,
        config: c,
        resolution,
        format,
        time: at,
        start: trim[0],
        end: trim[1],
        fps,
        signal: controller.signal,
        onProgress: setProgress,
      };
      let output;
      if (still)
        output = await exportStill({
          ...options,
          fontFace: fontFaces.current[c.font]?.css || "",
        });
      else if (format === "gif") {
        if (s.kind === "camera")
          throw new Error(
            "Record your camera as video first, then import it to make a GIF.",
          );
        output = await exportGIF({ ...options, fps: Math.min(15, fps) });
      } else {
        const choice =
          format === "auto" ? formats[0] : formats.find((f) => f.id === format);
        if (!choice)
          throw new Error(
            "This browser does not support video recording. PNG, SVG, and GIF are still available.",
          );
        output = await recordVideo({
          ...options,
          config: { ...c, transparent: false },
          audioStream,
          format: choice,
        });
      }
      if (controller.signal.aborted) return;
      if (resultURL.current) URL.revokeObjectURL(resultURL.current);
      const url = URL.createObjectURL(output.blob);
      resultURL.current = url;
      setResult({ ...output, url, name: filename(s.name, output.extension) });
      setProgress(1);
    } catch (e) {
      if (e.name === "AbortError")
        alert("Export cancelled. Your edits are intact.");
      else
        alert(
          e.message || "Export failed. Try a shorter clip or lower resolution.",
          true,
        );
    } finally {
      await wakeLock?.release().catch(() => {});
      if (s.kind === "video" && mounted.current)
        try {
          await seek(s.element, at);
        } catch {}
      timeRef.current = at;
      resetFrame();
      if (mounted.current) setBusy(false);
      abortRef.current = null;
    }
  };
  const exportDimensions = dimensions(
    source.width,
    source.height,
    format === "gif"
      ? String(Math.min(720, Number(resolution) || 720))
      : resolution,
    !["png", "svg", "gif"].includes(format),
  );
  return (
    <div
      className="studio"
      onDragOver={(e) => {
        e.preventDefault();
        if (!busy) setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!busy) openFile(e.dataTransfer.files[0]);
      }}
    >
      <header className="topbar">
        <a href="#workspace" className="brand" aria-label="Dither workspace">
          <span className="brand-mark" aria-hidden="true">
            ▦
          </span>
          <strong>
            DITHER<span className="brand-dot">.</span>
          </strong>
          <span className="byline">by etovo</span>
        </a>
        <div className="top-actions">
          <button
            className="icon-button"
            title="Undo (⌘/Ctrl Z)"
            aria-label="Undo"
            disabled={!history.past.length || busy}
            onClick={() => dispatch({ type: "undo" })}
          >
            <Icon name="undo" />
          </button>
          <button
            className="icon-button"
            title="Redo (⌘/Ctrl Shift Z)"
            aria-label="Redo"
            disabled={!history.future.length || busy}
            onClick={() => dispatch({ type: "redo" })}
          >
            <Icon name="redo" />
          </button>
          <span className="divider" />
          <button
            className="icon-button"
            aria-label="Help and shortcuts"
            onClick={() => setDialog("help")}
            disabled={busy}
          >
            <Icon name="help" />
          </button>
          <button
            className="primary"
            onClick={showExport}
            disabled={loading || busy}
          >
            <Icon name="download" />
            <span>Export</span>
          </button>
        </div>
      </header>
      <div className="sourcebar">
        <div className="source-actions">
          <input
            ref={fileInput}
            hidden
            type="file"
            accept="image/*,video/*"
            onChange={(e) => openFile(e.target.files[0])}
          />
          <button
            onClick={() => fileInput.current.click()}
            disabled={loading || busy}
          >
            <Icon name="upload" />
            {loading ? "Opening…" : "Open media"}
          </button>
          <button onClick={openCamera} disabled={loading || busy}>
            <Icon name="camera" />
            {source.kind === "camera" ? "Switch camera" : "Camera"}
          </button>
          <button
            className="quiet"
            onClick={() => adopt(demo())}
            disabled={loading || busy}
          >
            Test signal
          </button>
        </div>
        <span className="local-label">Files stay on your device</span>
      </div>
      {notice && (
        <div
          role={notice.error ? "alert" : "status"}
          className={`notice ${notice.error ? "error" : ""}`}
        >
          <span>{notice.text}</span>
          <button
            className="icon-button"
            aria-label="Dismiss message"
            onClick={() => setNotice(null)}
          >
            <Icon name="close" />
          </button>
        </div>
      )}
      <main id="workspace" className="workspace">
        <section className="editing-area" aria-label="Preview and timeline">
          <div className="viewer-bar">
            <div className="file-info">
              <span className="source-badge">
                {source.kind === "demo"
                  ? "DEMO"
                  : source.kind === "camera"
                    ? "LIVE"
                    : source.kind.toUpperCase()}
              </span>
              <span title={source.name}>{source.name}</span>
            </div>
            <button
              className={compare ? "small selected" : "small"}
              aria-pressed={compare}
              onClick={() => setCompare(!compare)}
            >
              Before / after
            </button>
          </div>
          <div className="viewer">
            <div
              className="canvas-wrap"
              style={{
                aspectRatio: `${source.width}/${source.height}`,
                "--media-aspect": source.width / source.height,
              }}
            >
              <canvas ref={canvasRef} aria-label="Processed media preview" />
              {compare && (
                <>
                  <canvas
                    className="original-canvas"
                    ref={originalRef}
                    style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
                    aria-label="Original media preview"
                  />
                  <div className="compare-line" style={{ left: `${split}%` }}>
                    <span>↔</span>
                  </div>
                  <span className="compare-label left">Original</span>
                  <span className="compare-label right">Processed</span>
                  <input
                    className="compare-input"
                    aria-label="Before and after divider"
                    type="range"
                    min="0"
                    max="100"
                    value={split}
                    onChange={(e) => setSplit(Number(e.target.value))}
                  />
                </>
              )}
            </div>
            {source.kind === "demo" && (
              <div className="demo-note">
                A moving test signal.{" "}
                <button onClick={() => fileInput.current.click()}>
                  Open your own video
                </button>
              </div>
            )}
          </div>
          <div className="viewer-footer">
            <span className="mono">
              {source.width} × {source.height}
              <span className="muted"> / SOURCE</span>
            </span>
            <div>
              <label htmlFor="preview-quality">Preview</label>
              <select
                id="preview-quality"
                value={previewSize}
                onChange={(e) => setPreviewSize(e.target.value)}
              >
                <option value="640">Fast · 640 px</option>
                <option value="960">Balanced · 960 px</option>
                <option value="1280">Detailed · 1280 px</option>
              </select>
              {playing && <span className="mono fps">{renderFps} fps</span>}
            </div>
          </div>
          <div className="timeline">
            <div className="transport">
              <div className="transport-buttons">
                <button
                  className="icon-button"
                  aria-label="Back to trim start"
                  disabled={
                    busy || source.kind === "image" || source.kind === "camera"
                  }
                  onClick={() => scrub(trim[0])}
                >
                  <Icon name="back" />
                </button>
                <button
                  className="play-button"
                  aria-label={playing ? "Pause" : "Play"}
                  onClick={togglePlay}
                  disabled={
                    busy ||
                    loading ||
                    source.kind === "image" ||
                    source.kind === "camera"
                  }
                >
                  <Icon name={playing ? "pause" : "play"} />
                </button>
                <span className="timecode">
                  {timeLabel(time)}
                  <span> / {timeLabel(source.duration)}</span>
                </span>
              </div>
              <div className="transport-options">
                {source.kind === "video" && (
                  <button
                    className="icon-button"
                    aria-label={muted ? "Unmute preview" : "Mute preview"}
                    onClick={toggleSound}
                    disabled={busy}
                  >
                    <Icon name={muted ? "mute" : "sound"} />
                  </button>
                )}
                <button
                  className={loop ? "small selected" : "small"}
                  aria-pressed={loop}
                  onClick={() => setLoop(!loop)}
                  disabled={
                    busy || source.kind === "image" || source.kind === "camera"
                  }
                >
                  Loop
                </button>
              </div>
            </div>
            <div className="scrubber">
              <div className="timeline-ruler" aria-hidden="true">
                {[0, 0.25, 0.5, 0.75, 1].map((n) => (
                  <span key={n}>{timeLabel(source.duration * n)}</span>
                ))}
              </div>
              <input
                aria-label="Video playhead"
                type="range"
                min="0"
                max={source.duration || 1}
                step="0.01"
                value={Math.min(time, source.duration || 1)}
                disabled={
                  busy || source.kind === "image" || source.kind === "camera"
                }
                onChange={(e) => scrub(Number(e.target.value))}
              />
            </div>
            {source.kind !== "image" && (
              <div className="trim-row">
                <span className="eyebrow">
                  {source.kind === "camera" ? "RECORD LENGTH" : "EXPORT RANGE"}
                </span>
                {source.kind !== "camera" && (
                  <label>
                    In
                    <input
                      aria-label="Trim start in seconds"
                      type="number"
                      min={0}
                      max={trim[1] - 0.05}
                      step=".1"
                      value={Number(trim[0].toFixed(2))}
                      disabled={busy}
                      onChange={(e) => changeTrim(0, e.target.value)}
                    />
                    <span>s</span>
                    <button
                      className="small"
                      onClick={() => changeTrim(0, time)}
                      disabled={busy}
                    >
                      Set here
                    </button>
                  </label>
                )}
                <label>
                  {source.kind === "camera" ? "Length" : "Out"}
                  <input
                    aria-label={
                      source.kind === "camera"
                        ? "Recording duration in seconds"
                        : "Trim end in seconds"
                    }
                    type="number"
                    min={trim[0] + 0.05}
                    max={source.duration || 300}
                    step=".1"
                    value={Number(trim[1].toFixed(2))}
                    disabled={busy}
                    onChange={(e) => changeTrim(1, e.target.value)}
                  />
                  <span>s</span>
                  {source.kind !== "camera" && (
                    <button
                      className="small"
                      onClick={() => changeTrim(1, time)}
                      disabled={busy}
                    >
                      Set here
                    </button>
                  )}
                </label>
                <span className="duration mono">
                  {(trim[1] - trim[0]).toFixed(1)} s
                </span>
              </div>
            )}
          </div>
          <section className="looks-section">
            <div className="section-heading">
              <h2>Starting points</h2>
              <span>Make it yours</span>
            </div>
            <div className="looks">
              {looks.map((look, i) => (
                <button
                  key={look.name}
                  className={`look look-${i}`}
                  onClick={() => {
                    dispatch({ config: look.config });
                    setSelectedPreset("");
                  }}
                  disabled={busy}
                >
                  <div
                    className="look-pattern"
                    aria-hidden="true"
                    style={{
                      "--ink": palettes[look.config.palette].at(-1),
                      "--paper": palettes[look.config.palette][0],
                    }}
                  >
                    {look.config.effect === "ascii"
                      ? "Aa"
                      : look.config.overlay === "number"
                        ? "012"
                        : "▒▓"}
                  </div>
                  <strong>{look.name}</strong>
                  <span>{look.note}</span>
                </button>
              ))}
            </div>
          </section>
        </section>
        <aside className="inspector" aria-label="Effect inspector">
          <div
            className="inspector-tabs"
            role="tablist"
            aria-label="Inspector panels"
          >
            {[
              ["effects", "Effects"],
              ["color", "Color"],
              ["presets", "Presets"],
            ].map(([id, label]) => (
              <button
                key={id}
                id={`tab-${id}`}
                role="tab"
                aria-selected={tab === id}
                aria-controls={`panel-${id}`}
                tabIndex={tab === id ? 0 : -1}
                onKeyDown={(e) => {
                  if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
                    e.preventDefault();
                    const tabs = ["effects", "color", "presets"],
                      next =
                        tabs[
                          (tabs.indexOf(tab) +
                            (e.key === "ArrowRight" ? 1 : 2)) %
                            3
                        ];
                    setTab(next);
                    document.getElementById(`tab-${next}`).focus();
                  }
                }}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </div>
          <div
            className="inspector-scroll"
            id={`panel-${tab}`}
            role="tabpanel"
            aria-labelledby={`tab-${tab}`}
          >
            <fieldset className="control-fieldset" disabled={busy || loading}>
              {tab === "effects" && (
                <EffectControls
                  config={config}
                  set={set}
                  customFonts={customFonts}
                  onFontUpload={uploadFont}
                />
              )}
              {tab === "color" && <ColorControls config={config} set={set} />}
              {tab === "presets" && (
                <>
                  <section className="inspector-section">
                    <div className="section-heading">
                      <h2>Your presets</h2>
                      <span>{Object.keys(presets).length}/50</span>
                    </div>
                    <p className="hint">
                      Keep an effect setup for your next clip. Saved on this
                      device; export a backup to use elsewhere.
                    </p>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        savePreset();
                      }}
                    >
                      <label className="control">
                        Preset name
                        <input
                          value={presetName}
                          maxLength={60}
                          placeholder="e.g. Midnight terminal"
                          onChange={(e) => setPresetName(e.target.value)}
                        />
                      </label>
                      <button
                        className="primary full"
                        disabled={!presetName.trim()}
                      >
                        Save current look
                      </button>
                    </form>
                    <div className="saved-presets">
                      {Object.entries(presets).map(([name, c]) => (
                        <div key={name} className="saved-preset">
                          <button
                            aria-label={`Load preset ${name}`}
                            aria-pressed={selectedPreset === name}
                            onClick={() => {
                              dispatch({ config: c });
                              setSelectedPreset(name);
                            }}
                          >
                            <span
                              className="preset-dot"
                              style={{ background: palettes[c.palette].at(-1) }}
                            />
                            <span>
                              {name}
                              <small>
                                {effects.find(([id]) => id === c.effect)?.[1]} ·{" "}
                                {c.palette}
                              </small>
                            </span>
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`Delete preset ${name}`}
                            onClick={() => {
                              setSelectedPreset(name);
                              setDialog("delete-preset");
                            }}
                          >
                            <Icon name="close" />
                          </button>
                        </div>
                      ))}
                    </div>
                    {!Object.keys(presets).length && (
                      <p className="empty-note">
                        Your first saved look goes here.
                      </p>
                    )}
                    <div className="button-row">
                      <label className="button file-button">
                        Import
                        <input
                          type="file"
                          accept="application/json,.json"
                          onChange={importPresets}
                        />
                      </label>
                      <button
                        onClick={downloadPresets}
                        disabled={!Object.keys(presets).length}
                      >
                        Export presets
                      </button>
                    </div>
                  </section>
                  <section className="inspector-section">
                    <h2>Workspace</h2>
                    <Check
                      label="Light appearance"
                      value={theme === "light"}
                      onChange={(v) => setTheme(v ? "light" : "dark")}
                    />
                    <button onClick={() => dispatch({ config: defaults })}>
                      Reset effect settings
                    </button>
                    <p className="hint">
                      You can undo a reset. Your media and presets stay
                      available.
                    </p>
                  </section>
                </>
              )}
            </fieldset>
          </div>
          <div className="inspector-bottom">
            <span className="mono">
              {effects.find(([id]) => id === config.effect)?.[1]}
            </span>
            <span>{palettes[config.palette].length} colors</span>
          </div>
        </aside>
      </main>
      <footer className="statusbar">
        <span>
          DITHER STUDIO <b>/</b> 02
        </span>
        <span>Local processing · No uploads</span>
        <span className="keyboard-hint">
          SPACE to play · ⌘ / CTRL Z to undo
        </span>
      </footer>
      {dragging && (
        <div className="drop-overlay">
          <Icon name="upload" />
          <strong>Drop your video or image</strong>
          <span>Release to open it in the studio</span>
        </div>
      )}
      {dialog === "delete-preset" && (
        <Dialog title="Delete preset?" onClose={() => setDialog(null)}>
          <div className="modal-body">
            <p>Delete “{selectedPreset}” from this device?</p>
            <button
              className="primary"
              onClick={() => {
                const next = { ...presets };
                delete next[selectedPreset];
                setPresets(next);
                writeStorage("dither.presets.v2", next);
                setSelectedPreset("");
                setDialog(null);
              }}
            >
              Delete preset
            </button>
          </div>
        </Dialog>
      )}
      {dialog === "help" && (
        <Dialog
          title="A little less smooth. A lot more character."
          onClose={() => setDialog(null)}
        >
          <div className="modal-body help-body">
            <p>
              Open a video, image, or camera. Choose a starting point, then tune
              the effect and palette. Everything runs on your device.
            </p>
            <h3>Video workflow</h3>
            <ol>
              <li>Scrub the timeline and set your In and Out points.</li>
              <li>
                Use Before / after to compare. Preview quality never limits
                export resolution.
              </li>
              <li>
                Export your trim as video or GIF, or save the current frame as
                PNG or SVG.
              </li>
            </ol>
            <h3>Export notes</h3>
            <p>
              MP4 and WebM appear when your browser supports their encoders.
              Video exports run in real time: keep this tab visible and your
              device awake. For very detailed effects, reduce resolution if
              recording cannot keep up.
            </p>
            <p>
              Source audio can be included in video files. Camera recording is
              silent. GIF is silent, loops, and is limited to 30 seconds and a
              memory budget. PNG and SVG preserve transparency. Uploaded fonts
              last for this session and are embedded in SVG.
            </p>
            <p>
              SVG uses vector cells and text; enabling a source underlay embeds
              a raster image. Your original files are never modified.
            </p>
            <h3>Keyboard</h3>
            <p>
              <kbd>Space</kbd> Play / pause <br />
              <kbd>⌘ / Ctrl O</kbd> Open media <br />
              <kbd>⌘ / Ctrl Z</kbd> Undo <br />
              <kbd>⌘ / Ctrl Shift Z</kbd> Redo
            </p>
          </div>
        </Dialog>
      )}
      {dialog === "export" && (
        <Dialog
          title="Export your work"
          onClose={() => setDialog(null)}
          busy={busy}
        >
          <div className="modal-body">
            <div className="export-source">
              <span className="eyebrow">
                {source.kind === "image"
                  ? "STILL IMAGE"
                  : `${(trim[1] - trim[0]).toFixed(1)} SECOND SELECTION`}
              </span>
              <strong>{source.name}</strong>
              <span>
                {effects.find(([id]) => id === config.effect)?.[1]} /{" "}
                {config.palette}
              </span>
            </div>
            <fieldset className="control-fieldset" disabled={busy}>
              <div className="export-grid">
                <Select
                  label="Format"
                  value={format}
                  onChange={(v) => {
                    setFormat(v);
                    if (v === "gif") {
                      setFps(12);
                      setResolution("480");
                    } else {
                      if (fps < 24) setFps(30);
                      if (["480", "720"].includes(resolution))
                        setResolution("1920");
                    }
                  }}
                >
                  {source.kind !== "image" && (
                    <>
                      <option value="auto">Video · best available</option>
                      {formats.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.label} video
                        </option>
                      ))}
                      {source.kind !== "camera" && (
                        <option value="gif">Animated GIF</option>
                      )}
                    </>
                  )}
                  <option value="png">PNG · current frame</option>
                  <option value="svg">SVG · vector frame</option>
                </Select>
                <Select
                  label="Resolution · longest edge"
                  value={resolution}
                  onChange={setResolution}
                >
                  {format === "gif" ? (
                    <>
                      <option value="480">480 px</option>
                      <option value="720">720 px</option>
                    </>
                  ) : (
                    <>
                      <option value="native">Source · up to 4096 px</option>
                      <option value="1280">1280 px · 720p landscape</option>
                      <option value="1920">1920 px · 1080p landscape</option>
                      <option value="3840">3840 px · 4K landscape</option>
                    </>
                  )}
                </Select>
              </div>
              {!["png", "svg"].includes(format) && (
                <>
                  <Select
                    label="Frame rate"
                    value={fps}
                    onChange={(v) => setFps(Number(v))}
                  >
                    {(format === "gif" ? [10, 12, 15] : [24, 30]).map((n) => (
                      <option key={n} value={n}>
                        {n} fps
                      </option>
                    ))}
                  </Select>
                  {format !== "gif" && source.kind === "video" && (
                    <Check
                      label="Include source audio"
                      value={includeAudio}
                      onChange={setIncludeAudio}
                    />
                  )}
                </>
              )}
              <div className="export-spec">
                <span className="mono">
                  {exportDimensions.width} × {exportDimensions.height}
                </span>
                <span>
                  {format === "auto"
                    ? formats[0]?.label || "Video encoder unavailable"
                    : format.toUpperCase()}
                </span>
              </div>
              <p className="hint">
                {format === "gif"
                  ? "Loops forever. Silent. Maximum 30 seconds; larger frames need a shorter selection."
                  : ["png", "svg"].includes(format)
                    ? "Exports the current frame. Transparent backgrounds are preserved."
                    : "Records in real time. Keep this tab visible. Videos use your background color and preserve the source aspect ratio."}
              </p>
              <button
                className="primary full export-button"
                onClick={startExport}
                disabled={
                  busy ||
                  (!["png", "svg", "gif"].includes(format) && !formats.length)
                }
              >
                <Icon name="download" />
                Create {["png", "svg"].includes(format) ? "frame" : "export"}
              </button>
            </fieldset>
            {busy && (
              <div className="export-progress" role="status">
                <div>
                  <span>
                    {format === "gif"
                      ? "Rendering GIF…"
                      : "Creating your export…"}
                  </span>
                  <span className="mono">{Math.round(progress * 100)}%</span>
                </div>
                <progress value={progress} max="1" />
                <button onClick={() => abortRef.current?.abort()}>
                  Cancel export
                </button>
              </div>
            )}
            {notice && (
              <p
                className={notice.error ? "inline-error" : "hint"}
                role={notice.error ? "alert" : "status"}
              >
                {notice.text}
              </p>
            )}
            {result && !busy && (
              <div className="export-result">
                <span className="eyebrow">READY TO SAVE</span>
                <strong>{result.name}</strong>
                <span>
                  {result.width} × {result.height} ·{" "}
                  {(result.blob.size / 1024 / 1024).toFixed(2)} MB
                </span>
                {result.actualFps < result.targetFps * 0.85 && (
                  <p className="inline-error">
                    This device rendered about {Math.round(result.actualFps)}{" "}
                    fps. For smoother motion, lower the export resolution or
                    increase cell size.
                  </p>
                )}
                <a
                  className="button primary full"
                  href={result.url}
                  download={result.name}
                >
                  <Icon name="download" />
                  Download {result.extension.toUpperCase()}
                </a>
                {navigator.canShare && (
                  <button
                    onClick={async () => {
                      try {
                        const file = new File([result.blob], result.name, {
                          type: result.blob.type,
                        });
                        if (!navigator.canShare({ files: [file] })) {
                          alert("Use Download to save this file.");
                          return;
                        }
                        await navigator.share({
                          files: [file],
                          title: result.name,
                        });
                      } catch (e) {
                        if (e.name !== "AbortError")
                          alert("Use Download to save this file.");
                      }
                    }}
                  >
                    Share / Save to Files
                  </button>
                )}
              </div>
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
}
export default App;
