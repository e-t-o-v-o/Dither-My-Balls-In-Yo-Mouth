import React, { useEffect, useRef, useState } from "react";
import { Dialog } from "./Dialog";
import { looks } from "./model";
import { drawSignal } from "./renderer";
import { RenderService } from "./render-service";
import { EchoSampler } from "./echo-sampler";
import { applyStyle } from "./workflow";
import { frameDimensions } from "./framing";
const thumbnail = (look) =>
  `${import.meta.env.BASE_URL}styles/${look.name.toLowerCase().replace(/\s+/g, "-")}.png`;
export function StyleBrowser({
  config,
  source,
  time,
  keepMask,
  setKeepMask,
  busy,
  onApply,
  onPause,
}) {
  const [open, setOpen] = useState(false),
    [previews, setPreviews] = useState({}),
    [rendering, setRendering] = useState(false),
    [error, setError] = useState("");
  const controller = useRef();
  useEffect(() => () => controller.current?.abort(), []);
  const close = () => {
    controller.current?.abort();
    setOpen(false);
  };
  const preview = async () => {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const service = new RenderService(),
      echoes = new EchoSampler(source);
    setRendering(true);
    setError("");
    setPreviews({});
    try {
      const frame =
        source.kind === "demo"
          ? drawSignal(document.createElement("canvas"), time)
          : source.element;
      const snapshot = document.createElement("canvas"),
        scale = Math.min(1, 960 / Math.max(source.width, source.height));
      snapshot.width = Math.round(source.width * scale);
      snapshot.height = Math.round(source.height * scale);
      snapshot
        .getContext("2d")
        .drawImage(frame, 0, 0, snapshot.width, snapshot.height);
      const output = document.createElement("canvas");
      for (const look of looks) {
        if (abort.signal.aborted) break;
        const c = {
          ...applyStyle(look.config, config, keepMask),
          cropX: config.cropX,
          cropY: config.cropY,
          cropWidth: config.cropWidth,
          cropHeight: config.cropHeight,
        };
        const size = frameDimensions(source, c, "240");
        service.invalidate();
        const echoFrames = await echoes.frames(time, c, abort.signal);
        await service.render(snapshot, output, c, size.width, size.height, {
          signal: abort.signal,
          time,
          echoFrames,
        });
        if (!abort.signal.aborted)
          setPreviews((v) => ({
            ...v,
            [look.name]: output.toDataURL("image/png"),
          }));
      }
    } catch (e) {
      if (e.name !== "AbortError") setError(e.message);
    } finally {
      service.dispose();
      echoes.dispose();
      if (controller.current === abort) setRendering(false);
    }
  };
  const card = (look, expanded = false) => (
    <button
      key={look.name}
      className="look"
      disabled={busy}
      onClick={() => {
        onApply(look);
        close();
      }}
    >
      <img
        className="style-preview"
        src={
          expanded ? previews[look.name] || thumbnail(look) : thumbnail(look)
        }
        alt=""
        loading="lazy"
        width="240"
        height="144"
      />
      <strong>{look.name}</strong>
      <span>{look.note}</span>
    </button>
  );
  return (
    <>
      <section className="looks-section">
        <div className="section-heading">
          <h2>Style starters</h2>
          <button
            className="text-button"
            onClick={() => {
              onPause();
              setOpen(true);
              setPreviews({});
            }}
            disabled={busy}
          >
            All {looks.length} styles
          </button>
        </div>
        {config.maskMode !== "none" && (
          <label className="style-options">
            <input
              type="checkbox"
              checked={keepMask}
              onChange={(e) => setKeepMask(e.target.checked)}
              disabled={busy}
            />
            Keep mask when changing styles
          </label>
        )}
        <div className="looks">
          {looks.slice(0, 6).map((look) => card(look))}
        </div>
      </section>
      {open && (
        <Dialog title="Style library" onClose={close}>
          <div className="modal-body style-library">
            <div className="style-preview-actions">
              <p className="hint">Apply a complete look, then make it yours.</p>
              <button onClick={preview} disabled={rendering}>
                {rendering
                  ? `Rendering ${Object.keys(previews).length} / ${looks.length}…`
                  : "Preview this frame"}
              </button>
            </div>
            {error && <p className="inline-error">{error}</p>}
            <div className="style-library-grid">
              {looks.map((look) => card(look, true))}
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
