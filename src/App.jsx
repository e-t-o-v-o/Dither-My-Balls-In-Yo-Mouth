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
  palettes,
  effects,
  timeLabel,
  filename,
  usesPalette,
} from "./studio/model";
import { planVideoExport } from "./studio/export-plan";
import { exportPrecise, hasPreciseExport } from "./studio/precise-export";
import { applyStyle, videoPreferences, exportKey } from "./studio/workflow";
import { usePreview } from "./studio/use-preview";
import { frameDimensions } from "./studio/framing";
import { SelectionOverlay } from "./studio/SelectionOverlay";
import { Dialog } from "./studio/Dialog";
import { StyleBrowser } from "./studio/StyleBrowser";
import { Timeline } from "./studio/Timeline";
import { ProjectDownload } from "./studio/ProjectDownload";
import { FrameControls } from "./studio/FrameControls";
import {
  createProject,
  parseProject,
  autosaveProject,
  loadAutosave,
} from "./studio/projects";
import { drawSignal } from "./studio/renderer";
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
  MaskControls,
  Select,
  Check,
} from "./studio/Controls";
import { historyReducer } from "./studio/editor-state";
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
  return { past: [], present: c, future: [], effectSettings: {}, trim: [0, 8] };
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
function App() {
  const [history, dispatch] = useReducer(
      historyReducer,
      undefined,
      initialHistory,
    ),
    config = history.present;
  const paletteEffect = usesPalette(config);
  const colorSummary =
    config.effect === "screenprint" && config.screenMode === "cmyk"
      ? "CMYK inks"
      : paletteEffect
        ? `${palettes[config.palette].length} palette colors`
        : ["pixel", "channel"].includes(config.effect) ||
            (config.effect === "ascii" && config.textColor === "source") ||
            (["mosaic", "symbols"].includes(config.effect) &&
              config.shapeColor === "source")
          ? "Source color"
          : "Custom ink";
  const [source, setSource] = useState(demo),
    sourceRef = useRef(source),
    sourceVersion = useRef(0);
  const [playing, setPlaying] = useState(false),
    [time, setTime] = useState(0),
    timeRef = useRef(0),
    trim = history.trim,
    setTrim = (value) => dispatch({ type: "trim", value }),
    trimRef = useRef(trim);
  const [tab, setTab] = useState("effects"),
    [keepMask, setKeepMask] = useState(false),
    [compare, setCompare] = useState(false),
    [split, setSplit] = useState(50),
    [previewSize, setPreviewSize] = useState("auto"),
    [showMask, setShowMask] = useState(false),
    [selectionTool, setSelectionTool] = useState("none"),
    [zoom, setZoom] = useState("fit"),
    [brushRadius, setBrushRadius] = useState(0.025),
    [pendingProject, setPendingProject] = useState(null),
    [savedSession, setSavedSession] = useState(null),
    [autosaveStatus, setAutosaveStatus] = useState(""),
    projectInput = useRef();
  const [notice, setNotice] = useState(null),
    [loading, setLoading] = useState(false),
    [dialog, setDialog] = useState(null),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [result, setResult] = useState(null),
    [exportPlan, setExportPlan] = useState(null),
    resultCleanup = useRef();
  const [exportDefaults] = useState(() =>
    videoPreferences(readStorage("dither.video.v1", null)),
  );
  const videoSettings = useRef(exportDefaults);
  const [format, setFormat] = useState("auto"),
    [resolution, setResolution] = useState(exportDefaults.resolution),
    [fps, setFps] = useState(
      hasPreciseExport()
        ? exportDefaults.fps
        : Math.min(30, exportDefaults.fps),
    ),
    [includeAudio, setIncludeAudio] = useState(exportDefaults.includeAudio),
    [engine, setEngine] = useState(hasPreciseExport() ? "precise" : "live"),
    [quality, setQuality] = useState(exportDefaults.quality),
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
    [dragging, setDragging] = useState(false);
  const canvasRef = useRef(),
    originalRef = useRef(),
    fileInput = useRef(),
    rendererRef = useRef(),
    abortRef = useRef(),
    loadAbort = useRef(),
    audioRef = useRef(),
    resultURL = useRef(),
    mounted = useRef(true),
    facing = useRef("user");
  const liveFormats = recordingFormats();
  const usePrecise = engine === "precise" && source.kind !== "camera";
  const formats =
    usePrecise && hasPreciseExport()
      ? [
          { id: "mp4", label: "MP4" },
          { id: "webm", label: "WEBM" },
        ]
      : liveFormats;
  const set = useCallback((key, value) => {
    if (key === "effect") dispatch({ type: "effect", value });
    else dispatch({ key, value });
  }, []);
  sourceRef.current = source;
  trimRef.current = trim;
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    writeStorage("dither.theme.v2", theme);
  }, [theme]);
  useEffect(() => {
    const persist = () => writeStorage("dither.config.v2", config);
    const timer = setTimeout(persist, 250);
    window.addEventListener("pagehide", persist);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pagehide", persist);
    };
  }, [config]);
  useEffect(() => {
    if (source.kind !== "camera" && ["auto", "mp4", "webm"].includes(format)) {
      videoSettings.current = videoPreferences({
        resolution,
        fps,
        includeAudio,
        quality,
      });
      writeStorage("dither.video.v1", videoSettings.current);
    }
  }, [format, resolution, fps, includeAudio, quality, source.kind]);
  useEffect(() => {
    const loadedFonts = fontFaces.current;
    mounted.current = true;
    audioRef.current = new AudioRouter();
    return () => {
      mounted.current = false;
      loadAbort.current?.abort();
      abortRef.current?.abort();
      releaseSource(sourceRef.current);
      audioRef.current?.close();
      if (resultURL.current) URL.revokeObjectURL(resultURL.current);
      resultCleanup.current?.();
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
  const previewStats = usePreview({
    source,
    config,
    playing,
    busy,
    previewSize,
    revision,
    loop,
    compare,
    showMask,
    pickSource: selectionTool === "pick",
    timeRef,
    trimRef,
    rendererRef,
    canvasRef,
    originalRef,
    setTime,
    setPlaying,
    alert,
    fontFaces,
  });
  const projectSnapshot = () =>
    createProject({
      config,
      source,
      trim,
      time: timeRef.current,
      effectSettings: history.effectSettings,
      fonts: fontFaces.current,
      video: videoSettings.current,
    });
  useEffect(() => {
    loadAutosave()
      .then(setSavedSession)
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (
      pendingProject ||
      busy ||
      source.kind === "camera" ||
      (source.kind === "demo" && !history.past.length)
    )
      return;
    const timer = setTimeout(
      () =>
        autosaveProject(projectSnapshot())
          .then(() => setAutosaveStatus("Session saved on this device"))
          .catch(() =>
            setAutosaveStatus("Save a project file to keep this session"),
          ),
      1200,
    );
    return () => clearTimeout(timer);
  }, [config, trim, source, customFonts, pendingProject, busy]);
  const applyProject = async (project, media) => {
    for (const font of project.fonts) {
      const buffer = await (await fetch(font.data)).arrayBuffer();
      const face = new FontFace(font.name, buffer);
      await face.load();
      document.fonts.add(face);
      fontFaces.current[font.name] = {
        face,
        data: font.data,
        css: `@font-face {font-family:"${font.name}";src:url("${font.data}");}`,
        worker: { key: `${font.name}-${Date.now()}`, name: font.name, buffer },
      };
      setCustomFonts((v) => [...new Set([...v, font.name])]);
    }
    adopt(media);
    const duration = media.duration || 8,
      start = Math.min(project.trim[0], Math.max(0, duration - 0.05)),
      end = Math.max(start + 0.05, Math.min(duration, project.trim[1]));
    dispatch({
      type: "project",
      config: project.config,
      trim: [start, end],
      effectSettings: project.effectSettings,
    });
    const at = Math.min(end, Math.max(start, project.time));
    if (media.kind === "video") await seek(media.element, at);
    timeRef.current = at;
    setTime(at);
    setPendingProject(null);
    setDialog(null);
    setResolution(project.video.resolution);
    setFps(project.video.fps);
    setQuality(project.video.quality);
    setIncludeAudio(project.video.includeAudio);
    setSelectionTool("none");
    setShowMask(false);
    resetFrame();
    alert("Project restored.");
  };
  const openProject = async (project) => {
    const parsed = parseProject(project);
    if (parsed.media.kind === "demo") await applyProject(parsed, demo());
    else if (
      source.file?.name === parsed.media.name &&
      source.file?.size === parsed.media.size
    ) {
      // Keep ownership of the existing media while applying the project.
      const media = { ...source };
      await applyProject(parsed, media);
    } else {
      setPendingProject(parsed);
      setDialog(null);
      setPlaying(false);
      source.element?.pause?.();
    }
  };
  const importProject = async (event) => {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > 16 * 1024 * 1024)
        throw new Error("Project files must be smaller than 16 MB.");
      await openProject(JSON.parse(await file.text()));
    } catch (error) {
      alert(error.message || "This project could not be opened.", true);
    }
  };
  const importMatte = async (event) => {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    try {
      const image = await createImageBitmap(file);
      const scale = Math.min(1, 1536 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas
        .getContext("2d")
        .drawImage(image, 0, 0, canvas.width, canvas.height);
      image.close();
      const data = canvas.toDataURL("image/png");
      if (data.length >= 4 * 1024 * 1024)
        throw new Error("Use a simpler matte or a smaller image.");
      dispatch({ config: { ...config, maskMode: "matte", maskImage: data } });
      setShowMask(true);
    } catch (error) {
      alert(error.message || "This matte could not be opened.", true);
    }
  };
  const pickColor = ([x, y]) => {
    const frame =
      source.kind === "demo"
        ? drawSignal(document.createElement("canvas"), timeRef.current)
        : source.element;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(
      frame,
      (config.cropX + x * config.cropWidth) * source.width,
      (config.cropY + y * config.cropHeight) * source.height,
      1,
      1,
      0,
      0,
      1,
      1,
    );
    const color = Array.from(ctx.getImageData(0, 0, 1, 1).data)
      .slice(0, 3)
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("");
    dispatch({
      config: { ...config, maskMode: "color", maskColor: `#${color}` },
    });
    setSelectionTool("none");
    setShowMask(true);
  };
  const adopt = (next) => {
    setPlaying(false);
    if (next.kind === "camera") setFps((value) => Math.min(30, value));
    else if (sourceRef.current?.kind === "camera")
      setFps(
        hasPreciseExport() && engine === "precise"
          ? videoSettings.current.fps
          : Math.min(30, videoSettings.current.fps),
      );
    audioRef.current?.disconnect();
    if (sourceRef.current?.element !== next.element)
      releaseSource(sourceRef.current);
    sourceVersion.current += 1;
    sourceRef.current = next;
    setSource(next);
    timeRef.current = 0;
    setTime(0);
    dispatch({ type: "source", trim: [0, next.duration || 10] });
    resetFrame();
    setNotice(
      next.kind === "camera" && config.echoCount
        ? {
            text: "Color echoes are paused for live camera. Import a recording to use them.",
            error: false,
          }
        : null,
    );
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
      if (pendingProject) await applyProject(pendingProject, next);
      else adopt(next);
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
      if (sourceRef.current?.kind === "camera") {
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
  const scrub = (value) => {
    if (busy || loading || ["image", "camera"].includes(source.kind)) return;
    value = Math.max(0, Math.min(source.duration, value));
    source.element?.pause?.();
    setPlaying(false);
    timeRef.current = value;
    setTime(value);
    if (source.kind === "video") {
      source.element.onseeked = resetFrame;
      source.element.currentTime = Math.min(
        value,
        Math.max(0, source.duration - 0.001),
      );
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
      if (
        e.target.closest?.(
          'input,select,textarea,button,dialog,[contenteditable]:not([contenteditable="false"])',
        ) ||
        dialog ||
        busy ||
        loading
      )
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
      } else if (
        !mod &&
        !e.altKey &&
        !["image", "camera"].includes(source.kind)
      ) {
        if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
          e.preventDefault();
          scrub(
            timeRef.current +
              (e.key === "ArrowRight" ? 1 : -1) * (e.shiftKey ? 1 : 0.1),
          );
        } else if (["i", "o"].includes(e.key.toLowerCase())) {
          e.preventDefault();
          changeTrim(e.key.toLowerCase() === "i" ? 0 : 1, timeRef.current);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [togglePlay, dialog, busy, loading, source, trim]);
  const savePreset = () => {
    const name = presetName.trim().slice(0, 60);
    if (!name) return;
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
        worker: {
          key: `${name}-${file.size}-${file.lastModified}`,
          name,
          buffer,
        },
        data,
      };
      setCustomFonts((v) => [...new Set([...v, name])]);
      set("font", name);
      alert("Font loaded for this session and embedded in SVG exports.");
    } catch (err) {
      alert(err.message || "This font could not be loaded.", true);
    }
  };
  useEffect(() => {
    if (
      dialog !== "export" ||
      !usePrecise ||
      !["auto", "mp4", "webm"].includes(format)
    ) {
      setExportPlan(null);
      return;
    }
    const controller = new AbortController();
    setExportPlan({ checking: true });
    const timer = setTimeout(
      () =>
        planVideoExport({
          source,
          config,
          resolution,
          format,
          fps,
          start: trim[0],
          end: trim[1],
          includeAudio,
          quality,
          signal: controller.signal,
        })
          .then((plan) => {
            if (!controller.signal.aborted) setExportPlan(plan);
          })
          .catch((error) => {
            if (!controller.signal.aborted)
              setExportPlan({ error: error.message });
          }),
      250,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    dialog,
    usePrecise,
    source,
    config,
    resolution,
    format,
    fps,
    trim,
    includeAudio,
    quality,
  ]);
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
      if (video && !usePrecise && includeAudio && s.kind === "video")
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
        font: fontFaces.current[c.font]?.worker,
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
        if (usePrecise)
          output = await exportPrecise({ ...options, includeAudio, quality });
        else
          output = await recordVideo({
            ...options,
            config: c,
            audioStream,
            format: choice,
          });
      }
      if (controller.signal.aborted) {
        await output.cleanup?.();
        return;
      }
      resultCleanup.current?.();
      resultCleanup.current = output.cleanup;
      if (resultURL.current) URL.revokeObjectURL(resultURL.current);
      const url = URL.createObjectURL(output.blob);
      resultURL.current = url;
      setResult({
        ...output,
        url,
        name: filename(s.name, output.extension),
        sourceVersion: sourceVersion.current,
        key: exportKey({
          config: c,
          format,
          resolution,
          fps,
          includeAudio,
          quality,
          engine: usePrecise ? "precise" : "live",
          time: at,
          start: trim[0],
          end: trim[1],
          fontFace: fontFaces.current[c.font]?.css || "",
        }),
        effectName: effects.find(([id]) => id === c.effect)?.[1],
        selection: still
          ? `Frame at ${timeLabel(at)}`
          : `${timeLabel(trim[0])} – ${timeLabel(trim[1])}`,
      });
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
      setTime(at);
      resetFrame();
      if (mounted.current) setBusy(false);
      abortRef.current = null;
    }
  };
  const exportDimensions = frameDimensions(
    source,
    config,
    format === "gif"
      ? String(Math.min(720, Number(resolution) || 720))
      : resolution,
    !["png", "svg", "gif"].includes(format),
  );
  const resultCurrent =
    result?.sourceVersion === sourceVersion.current &&
    result?.key ===
      exportKey({
        config,
        format,
        resolution,
        fps,
        includeAudio,
        quality,
        engine: usePrecise ? "precise" : "live",
        time,
        start: trim[0],
        end: trim[1],
        fontFace: fontFaces.current[config.font]?.css || "",
      });
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
            disabled={busy || loading}
            onClick={() => setDialog("project")}
          >
            Project
          </button>
          <button
            className="icon-button"
            title="Change appearance"
            aria-label="Change appearance"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? "☼" : "◐"}
          </button>
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
      <input
        hidden
        ref={projectInput}
        type="file"
        accept=".dither,.json,application/json"
        onChange={importProject}
      />
      {pendingProject && (
        <div className="notice" role="status">
          <span>
            Relink <strong>{pendingProject.media.name}</strong> to restore this
            project.
          </span>
          <button onClick={() => fileInput.current.click()}>
            Choose media
          </button>
          <button onClick={() => setPendingProject(null)}>Cancel</button>
        </div>
      )}
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
          <div className={`viewer ${zoom === "100" ? "zoom-actual" : ""}`}>
            {selectionTool !== "none" && (
              <div className="selection-toolbar">
                <span>
                  {selectionTool === "pick"
                    ? "Pick a source color"
                    : `${selectionTool === "lasso" ? "Lasso" : selectionTool === "erase" ? "Erase" : "Paint"} selection`}
                </span>
                <button
                  className="small"
                  onClick={() => setSelectionTool("none")}
                >
                  Done
                </button>
              </div>
            )}
            <div
              className="canvas-wrap"
              style={{
                aspectRatio: `${source.width * config.cropWidth}/${source.height * config.cropHeight}`,
                "--media-aspect":
                  (source.width * config.cropWidth) /
                  (source.height * config.cropHeight),
                ...(zoom === "100"
                  ? {
                      width: previewStats.width,
                      maxWidth: "none",
                      maxHeight: "none",
                      flexShrink: 0,
                    }
                  : {}),
              }}
            >
              <canvas ref={canvasRef} aria-label="Processed media preview" />
              {selectionTool !== "none" && (
                <SelectionOverlay
                  tool={selectionTool}
                  config={config}
                  setConfig={(c) => dispatch({ config: c })}
                  radius={brushRadius}
                  onPick={pickColor}
                  onFinish={() => setShowMask(true)}
                />
              )}
              {compare && selectionTool === "none" && (
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
              <select
                aria-label="Preview zoom"
                value={zoom}
                onChange={(event) => setZoom(event.target.value)}
              >
                <option value="fit">Fit</option>
                <option value="100">100%</option>
              </select>
              <label htmlFor="preview-quality">Preview</label>
              <select
                id="preview-quality"
                value={previewSize}
                onChange={(e) => setPreviewSize(e.target.value)}
              >
                <option value="auto">Auto · {previewStats.longEdge} px</option>
                <option value="640">Fast · 640 px</option>
                <option value="960">Balanced · 960 px</option>
                <option value="1280">Detailed · 1280 px</option>
              </select>
              {playing && (
                <span className="mono fps">{previewStats.fps} fps</span>
              )}
            </div>
          </div>
          <Timeline
            source={source}
            time={time}
            trim={trim}
            busy={busy}
            loading={loading}
            playing={playing}
            loop={loop}
            muted={muted}
            scrub={scrub}
            togglePlay={togglePlay}
            toggleSound={toggleSound}
            setLoop={setLoop}
            changeTrim={changeTrim}
            setTrim={setTrim}
          />
          <StyleBrowser
            config={config}
            source={source}
            time={timeRef.current}
            keepMask={keepMask}
            setKeepMask={setKeepMask}
            busy={busy}
            onApply={(look) => {
              dispatch({
                config: {
                  ...applyStyle(look.config, config, keepMask),
                  cropX: config.cropX,
                  cropY: config.cropY,
                  cropWidth: config.cropWidth,
                  cropHeight: config.cropHeight,
                },
              });
              setSelectedPreset("");
              setTab("effects");
            }}
            onPause={() => {
              setPlaying(false);
              source.element?.pause?.();
            }}
          />
        </section>
        <aside className="inspector" aria-label="Effect inspector">
          <div
            className="inspector-tabs"
            role="tablist"
            aria-label="Inspector panels"
          >
            {[
              ["effects", "Effects"],
              ["color", "Finish"],
              ["frame", "Frame"],
              ["mask", "Mask"],
              ["presets", "Presets"],
            ].map(([id, label]) => (
              <button
                key={id}
                id={`tab-${id}`}
                role="tab"
                aria-label={
                  id === "mask" && config.maskMode !== "none"
                    ? "Mask, active"
                    : label
                }
                aria-selected={tab === id}
                aria-controls={`panel-${id}`}
                tabIndex={tab === id ? 0 : -1}
                onKeyDown={(e) => {
                  if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
                    e.preventDefault();
                    const tabs = [
                        "effects",
                        "color",
                        "frame",
                        "mask",
                        "presets",
                      ],
                      next =
                        tabs[
                          (tabs.indexOf(tab) +
                            (e.key === "ArrowRight" ? 1 : 4)) %
                            5
                        ];
                    setTab(next);
                    document.getElementById(`tab-${next}`).focus();
                  }
                }}
                onClick={() => setTab(id)}
              >
                {label}
                {id === "mask" && config.maskMode !== "none" && (
                  <span className="mask-indicator" aria-hidden="true" />
                )}
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
              {tab === "color" && (
                <ColorControls
                  config={config}
                  set={set}
                  motion={source.kind !== "image"}
                  echoes={["demo", "video"].includes(source.kind)}
                />
              )}
              {tab === "frame" && (
                <FrameControls
                  config={config}
                  source={source}
                  setConfig={(c) => dispatch({ config: c })}
                  trim={trim}
                  time={time}
                  changeTrim={changeTrim}
                  setTrim={setTrim}
                />
              )}
              {tab === "mask" && (
                <MaskControls
                  config={config}
                  set={set}
                  setConfig={(c) => dispatch({ config: c })}
                  showMask={showMask}
                  setShowMask={setShowMask}
                  tool={selectionTool}
                  setTool={(tool) => {
                    setSelectionTool(tool);
                    setPlaying(false);
                    source.element?.pause?.();
                  }}
                  radius={brushRadius}
                  setRadius={setBrushRadius}
                  onMatteUpload={importMatte}
                />
              )}
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
                        {presetName.trim() in presets
                          ? "Update saved look"
                          : "Save current look"}
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
            <span>{colorSummary}</span>
          </div>
        </aside>
      </main>
      <footer className="statusbar">
        <span>
          DITHER STUDIO <b>/</b> 03
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
      {dialog === "project" && (
        <Dialog title="Project" onClose={() => setDialog(null)}>
          <div className="modal-body project-dialog">
            <p>
              Keep your effect settings, selection, trim, framing, and custom
              font together. Media stays in its original file.
            </p>
            <ProjectDownload project={projectSnapshot()} />
            <button
              className="full"
              onClick={() => projectInput.current.click()}
            >
              Open project
            </button>
            {savedSession && (
              <button
                className="full"
                onClick={() =>
                  openProject(savedSession).catch((e) => alert(e.message, true))
                }
              >
                Restore last session · {savedSession.media.name}
              </button>
            )}
            <p className="hint">{autosaveStatus}</p>
            <details>
              <summary>Camera & workspace</summary>
              <button
                onClick={() => {
                  setDialog(null);
                  openCamera();
                }}
              >
                {source.kind === "camera" ? "Switch camera" : "Open camera"}
              </button>
              {source.kind === "camera" && (
                <button
                  onClick={() => {
                    adopt(demo());
                    setDialog(null);
                  }}
                >
                  Stop camera
                </button>
              )}
              <button
                onClick={() => {
                  dispatch({ config: defaults });
                  setDialog(null);
                }}
              >
                Reset effect settings
              </button>
            </details>
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
              Frame-by-frame export saves every frame at 24, 30, or 60 fps when
              supported. Auto chooses a compatible video and audio format. High
              quality balances detail and size; Maximum gives dense textures
              more bitrate. Live recording is available for cameras and browser
              compatibility; keep the tab visible during recording.
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
              <kbd>⌘ / Ctrl Shift Z</kbd> Redo <br />
              <kbd>← / →</kbd> Seek 0.1 seconds <br />
              <kbd>Shift ← / →</kbd> Seek 1 second <br />
              <kbd>I / O</kbd> Set trim in / out
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
                {paletteEffect ? config.palette : colorSummary}
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
                      if (
                        format === "gif" ||
                        (["png", "svg"].includes(format) &&
                          ["auto", "mp4", "webm"].includes(v))
                      ) {
                        setFps(
                          usePrecise
                            ? videoSettings.current.fps
                            : Math.min(30, videoSettings.current.fps),
                        );
                        setResolution(videoSettings.current.resolution);
                      }
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
                    {(format === "gif"
                      ? [10, 12, 15]
                      : usePrecise
                        ? [24, 30, 60]
                        : [24, 30]
                    ).map((n) => (
                      <option key={n} value={n}>
                        {n} fps
                      </option>
                    ))}
                  </Select>
                  {format !== "gif" && source.kind !== "camera" && (
                    <Select
                      label="Export mode"
                      value={engine}
                      onChange={(v) => {
                        setEngine(v);
                        if (v === "live" && fps > 30) setFps(30);
                      }}
                    >
                      {hasPreciseExport() && (
                        <option value="precise">
                          Frame by frame · best quality
                        </option>
                      )}
                      <option value="live">
                        Live recording · compatibility
                      </option>
                    </Select>
                  )}
                  {format !== "gif" && usePrecise && (
                    <Select
                      label="Encoding quality"
                      value={quality}
                      onChange={setQuality}
                    >
                      <option value="high">High · balanced file size</option>
                      <option value="maximum">Maximum · crisp texture</option>
                    </Select>
                  )}
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
                    ? usePrecise
                      ? "Auto codec"
                      : formats[0]?.label || "Video encoder unavailable"
                    : format.toUpperCase()}
                </span>
              </div>
              <p className="hint">
                {format === "gif"
                  ? "Loops forever. Silent. Maximum 30 seconds; larger frames need a shorter selection."
                  : ["png", "svg"].includes(format)
                    ? "Exports the current frame. Transparent backgrounds are preserved."
                    : usePrecise
                      ? "Renders every frame at the selected rate, independent of playback speed. Audio and video share the same trim. Videos use your background color."
                      : hasPreciseExport()
                        ? "Records in real time. Keep this tab visible. Slow rendering can drop frames; choose Frame by frame for reliable motion."
                        : "This browser supports live recording only. Keep this tab visible. Frame rate depends on playback and device speed."}
              </p>
              {exportDimensions.width > source.width && (
                <p className="hint">
                  Source detail: {source.width} × {source.height}. Larger
                  exports redraw the effect geometry at the selected size.
                </p>
              )}
              {exportPlan && (
                <p
                  className={
                    exportPlan.error ? "inline-error" : "export-preflight hint"
                  }
                  role="status"
                >
                  {exportPlan.checking
                    ? "Checking video, audio, and available space…"
                    : exportPlan.error ||
                      `${exportPlan.extension.toUpperCase()} · ${exportPlan.codec.toUpperCase()} · approximately ${(exportPlan.estimatedBytes / 1024 / 1024).toFixed(1)} MB · ${exportPlan.disk ? "disk-backed export" : "memory checked"}`}
                </p>
              )}
              <button
                className="primary full export-button"
                onClick={startExport}
                disabled={
                  busy ||
                  !!exportPlan?.checking ||
                  !!exportPlan?.error ||
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
                <span className="eyebrow">
                  {resultCurrent ? "READY TO SAVE" : "PREVIOUS EXPORT"}
                </span>
                <strong>{result.name}</strong>
                <span>
                  {result.effectName} · {result.selection}
                </span>
                <span>
                  {result.width} × {result.height} ·{" "}
                  {(result.blob.size / 1024 / 1024).toFixed(2)} MB
                </span>
                {!resultCurrent && (
                  <p className="hint">
                    Your edits or export settings have changed. Create a new
                    export to apply them.
                  </p>
                )}
                {result.engine === "precise" && (
                  <p className="hint">
                    {result.targetFps} fps · {result.codec.toUpperCase()} ·
                    frame-by-frame export
                  </p>
                )}
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
                  Download {resultCurrent ? "" : "previous "}
                  {result.extension.toUpperCase()}
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
