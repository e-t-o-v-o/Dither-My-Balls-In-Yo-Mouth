import React from "react";
import { Icon } from "./Controls";
import { timeLabel } from "./model";
import { Filmstrip } from "./Filmstrip";
export function Timeline({
  source,
  time,
  trim,
  busy,
  loading,
  playing,
  loop,
  muted,
  scrub,
  togglePlay,
  toggleSound,
  setLoop,
  changeTrim,
  setTrim,
}) {
  return (
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
        {!["image", "camera"].includes(source.kind) && (
          <Filmstrip
            source={source}
            trim={trim}
            changeTrim={changeTrim}
            disabled={busy}
          />
        )}
        <input
          aria-label="Video playhead"
          type="range"
          min="0"
          max={source.duration || 1}
          step="0.01"
          value={Math.min(time, source.duration || 1)}
          disabled={busy || source.kind === "image" || source.kind === "camera"}
          onChange={(e) => scrub(Number(e.target.value))}
        />
      </div>
      {source.kind !== "image" && (
        <details className="trim-details">
          <summary>
            {source.kind === "camera" ? "Recording length" : "Precise trim"} ·{" "}
            {(trim[1] - trim[0]).toFixed(1)} s
          </summary>
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
            {source.kind !== "camera" && (
              <button
                className="small"
                disabled={
                  busy || (trim[0] === 0 && trim[1] === source.duration)
                }
                onClick={() => setTrim([0, source.duration])}
              >
                Full clip
              </button>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
