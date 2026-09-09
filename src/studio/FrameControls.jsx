import React from "react";
import { Range } from "./Controls";
import { cropToAspect } from "./framing";
export function FrameControls({
  config: c,
  source,
  setConfig,
  trim,
  time,
  changeTrim,
  setTrim,
}) {
  return (
    <>
      <section className="inspector-section">
        <h2>Framing</h2>
        <div
          className="segmented wrap"
          role="group"
          aria-label="Crop aspect ratio"
        >
          {[
            [0, "Original"],
            [16 / 9, "16:9"],
            [9 / 16, "9:16"],
            [1, "Square"],
            [4 / 5, "4:5"],
          ].map(([ratio, label]) => (
            <button
              key={label}
              onClick={() =>
                setConfig({ ...c, ...cropToAspect(source, ratio) })
              }
            >
              {label}
            </button>
          ))}
        </div>
        <Range
          label="Horizontal position"
          min={0}
          max={100}
          value={c.cropWidth === 1 ? 50 : (c.cropX / (1 - c.cropWidth)) * 100}
          disabled={c.cropWidth === 1}
          unit="%"
          onChange={(v) =>
            setConfig({ ...c, cropX: (v / 100) * (1 - c.cropWidth) })
          }
        />
        <Range
          label="Vertical position"
          min={0}
          max={100}
          value={c.cropHeight === 1 ? 50 : (c.cropY / (1 - c.cropHeight)) * 100}
          disabled={c.cropHeight === 1}
          unit="%"
          onChange={(v) =>
            setConfig({ ...c, cropY: (v / 100) * (1 - c.cropHeight) })
          }
        />
        <p className="hint">
          Framing applies to the preview and every export. Selections stay
          attached to the source.
        </p>
      </section>
      {source.kind !== "image" && (
        <section className="inspector-section frame-trim">
          <h2>
            {source.kind === "camera" ? "Recording length" : "Precise trim"}
          </h2>
          {(source.kind === "camera" ? [1] : [0, 1]).map((index) => (
            <label key={index}>
              {source.kind === "camera" ? "Length" : index ? "Out" : "In"}
              <input
                aria-label={
                  source.kind === "camera"
                    ? "Recording length"
                    : `Frame trim ${index ? "out" : "in"}`
                }
                type="number"
                min={index ? trim[0] + 0.05 : 0}
                max={index ? source.duration || 300 : trim[1] - 0.05}
                step="0.01"
                value={Number(trim[index].toFixed(2))}
                onChange={(e) => changeTrim(index, e.target.value)}
              />
              <span>s</span>
              {source.kind !== "camera" && (
                <button onClick={() => changeTrim(index, time)}>
                  Set here
                </button>
              )}
            </label>
          ))}
          {source.kind !== "camera" && (
            <button onClick={() => setTrim([0, source.duration])}>
              Full clip
            </button>
          )}
        </section>
      )}
    </>
  );
}
