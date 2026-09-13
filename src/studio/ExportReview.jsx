import React, { useEffect, useRef, useState } from "react";

export function ExportReview({ result }) {
  const video = useRef(null);
  const [error, setError] = useState(false);
  const [playGIF, setPlayGIF] = useState(false);
  const [duration, setDuration] = useState(result.duration);
  const isVideo = ["mp4", "webm"].includes(result.extension);
  useEffect(() => {
    const element = video.current;
    return () => { element?.pause(); element?.removeAttribute("src"); element?.load(); };
  }, []);
  return <section className="export-review" aria-label="Export review">
    <h3>Review your export</h3>
    <p className="hint">This is the finished file, ready to play or save.</p>
    {!error && (isVideo ? <video ref={video} src={result.url} controls playsInline preload="metadata" aria-label="Play exported video"
      onLoadedMetadata={event => { const seconds = event.currentTarget.duration; if (Number.isFinite(seconds) && seconds > 0) setDuration(seconds); }}
      onError={() => setError(true)} />
      : result.extension === "gif" && !playGIF ? null
      : <img src={result.url} alt={result.extension === "gif" ? "Exported animation" : "Exported frame"} onError={() => setError(true)} />)}
    {result.extension === "gif" && !error && <button className="full" aria-pressed={playGIF} onClick={() => setPlayGIF(!playGIF)}>{playGIF ? "Stop GIF preview" : "Play GIF preview"}</button>}
    {error && <p className="hint" role="status">This browser cannot preview the file here. You can still download it below.</p>}
    <dl className="export-metadata">
      <div><dt>File type</dt><dd>{result.extension.toUpperCase()}{result.codec ? ` · ${result.codec.toUpperCase()}` : ""}</dd></div>
      <div><dt>Dimensions</dt><dd>{result.width} × {result.height}</dd></div>
      {Number.isFinite(duration) && <div><dt>Duration</dt><dd>{duration.toFixed(2)} s</dd></div>}
      {result.targetFps && <div><dt>Frame rate</dt><dd>{result.targetFps} fps{result.engine === "live" ? " target" : result.extension === "gif" ? " nominal" : ""}</dd></div>}
      {(isVideo || result.extension === "gif") && <div><dt>Audio</dt><dd>{result.hasAudio === true ? "Included" : result.hasAudio === false || result.extension === "gif" ? "Silent" : "Not reported"}</dd></div>}
    </dl>
  </section>;
}
