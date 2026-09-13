import React, { useEffect, useRef, useState } from "react";

export function exportTiming(elapsed, progress, idle, estimating = true) {
  if (idle >= 20) return "Waiting for the encoder. You can cancel without losing your edits.";
  if (!estimating || elapsed < 5 || progress < 0.05 || progress >= 0.95) return "";
  const seconds = Math.max(5, Math.round(elapsed * (1 - progress) / progress / 5) * 5);
  return seconds < 60 ? `About ${seconds}s remaining` : `About ${Math.ceil(seconds / 60)} min remaining`;
}
export function ExportProgress({ progress, phase, format, onCancel }) {
  const started = useRef(performance.now());
  const moved = useRef(started.current);
  const [now, setNow] = useState(started.current);
  useEffect(() => { moved.current = performance.now(); }, [progress, phase]);
  useEffect(() => {
    const timer = setInterval(() => setNow(performance.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const elapsed = Math.max(0, (now - started.current) / 1000);
  const detail = exportTiming(elapsed, progress, (now - moved.current) / 1000, format !== "gif" && phase === "rendering");
  const labels = { preparing: "Preparing export…", rendering: format === "gif" ? "Creating GIF…" : "Rendering video…", finalizing: "Finishing file…" };
  return <div className="export-progress">
    <div role="status"><span>{labels[phase] || "Creating your export…"}</span><span className="mono">{Math.min(100, Math.round(progress * 100))}%</span></div>
    <progress aria-label="Export progress" value={progress} max="1" />
    <p className="hint">{Math.floor(elapsed / 60)}:{String(Math.floor(elapsed % 60)).padStart(2, "0")} elapsed{detail && ` · ${detail}`}</p>
    <button onClick={onCancel}>Cancel export</button>
  </div>;
}
