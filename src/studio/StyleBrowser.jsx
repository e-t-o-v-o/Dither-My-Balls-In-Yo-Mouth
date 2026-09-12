import React, { useEffect, useRef, useState } from "react";
import { looks, artisticEffects, effects } from "./model";
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
  collection = "studio",
  technique = "all",
  onTechniqueChange,
}) {
  const [previews, setPreviews] = useState({}),
    [rendering, setRendering] = useState(false),
    [error, setError] = useState("");
  const artistic = collection === "artistic";
  const collectionLooks = looks.filter(look => artisticEffects.includes(look.config.effect) === artistic);
  const visibleLooks = collectionLooks.filter(look => technique === "all" || look.config.effect === technique);
  const controller = useRef();
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    controller.current?.abort();
    setPreviews({});
    setRendering(false);
    setError("");
  }, [config, source, keepMask, collection, technique]);
  const close = () => {
    controller.current?.abort();
  };
  const preview = async () => {
    onPause();
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
      for (const look of visibleLooks) {
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
  const card = (look) => (
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
        src={previews[look.name] || thumbnail(look)}
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
    <section className="looks-section">
      <div className="section-heading"><h2>{artistic ? "Artistic collection" : "Studio looks"}</h2><span>{visibleLooks.length} styles</span></div>
      <p className="hint">{artistic ? "Cut paper, engraved lines, colored glass. Choose a material and make it yours." : "Classic digital treatments and saved starting points."}</p>
      {artistic && <label className="control">Technique
        <select value={technique} onChange={e => onTechniqueChange(e.target.value)} disabled={busy}>
          <option value="all">All techniques</option>
          {effects.filter(([id]) => artisticEffects.includes(id)).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </label>}
      {config.maskMode !== "none" && <label className="check style-options"><input type="checkbox" checked={keepMask} onChange={e => setKeepMask(e.target.checked)} disabled={busy} /><span>Keep selection when changing looks</span></label>}
      <button className="full style-preview-button" onClick={preview} disabled={rendering || busy}>
        {rendering ? `Previewing ${Object.keys(previews).length} / ${visibleLooks.length}…` : "Preview looks on this frame"}
      </button>
      {error && <p className="inline-error">{error}</p>}
      <div className="style-library-grid">{visibleLooks.map(card)}</div>
    </section>
  );
}
