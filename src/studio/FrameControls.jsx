import React from "react";
import { Range } from "./Controls";
import { cropToAspect } from "./framing";
import { TimeField } from "./TimeField";
export function FrameControls({
  config: c,
  source,
  setConfig,
  trim,
  time,
  changeTrim,
  setTrim,
  onEditCrop,
}) {
  return (
    <>
      <section className="inspector-section">
        <h2>Framing</h2>
        <button className="full" onClick={onEditCrop}>Edit crop on image</button>
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
            <div className="frame-trim-row" key={index}>
              <TimeField
                caption={source.kind === "camera" ? "Length" : index ? "Out" : "In"}
                label={
                  source.kind === "camera"
                    ? "Recording length"
                    : `Frame trim ${index ? "out" : "in"}`
                }
                min={index ? trim[0] + 0.05 : 0}
                max={index ? source.duration || 300 : trim[1] - 0.05}
                value={trim[index]}
                onCommit={(value) => changeTrim(index, value)}
              />
              {source.kind !== "camera" && (
                <button onClick={() => changeTrim(index, time)}>
                  Set here
                </button>
              )}
            </div>
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
