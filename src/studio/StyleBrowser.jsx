import React, { useEffect, useId, useRef, useState } from "react";
import { looks, artisticEffects, effects } from "./model";
import { drawSignal } from "./renderer";
import { RenderService } from "./render-service";
import { EchoSampler } from "./echo-sampler";
import { applyStyle } from "./workflow";
import { frameDimensions } from "./framing";
import { Dialog } from "./Dialog";
import { Icon } from "./Controls";
const thumbnail = (look) =>
  `${import.meta.env.BASE_URL}styles/${look.name.toLowerCase().replace(/\s+/g, "-")}.png`;
export function StyleBrowser({
  config,
  source,
  time,
  trim,
  keepMask,
  setKeepMask,
  busy,
  onApply,
  onPause,
  collection = "studio",
  technique = "all",
  onTechniqueChange,
}) {
  const searchId = useId();
  const [expanded, setExpanded] = useState(false);
  const galleryButton = useRef();
  const wasExpanded = useRef(false);
  useEffect(() => {
    if (wasExpanded.current && !expanded) galleryButton.current?.focus();
    wasExpanded.current = expanded;
  }, [expanded]);
  const [previews, setPreviews] = useState({}),
    [rendering, setRendering] = useState(false),
    [query, setQuery] = useState(""),
    [error, setError] = useState("");
  const artistic = collection === "artistic";
  const collectionLooks = looks.filter(look => artisticEffects.includes(look.config.effect) === artistic);
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const visibleLooks = collectionLooks.filter(look => (technique === "all" || look.config.effect === technique)
    && terms.every(term => `${look.name} ${look.note} ${effects.find(([id]) => id === look.config.effect)?.[3] || ""}`.toLocaleLowerCase().includes(term)));
  const controller = useRef();
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    controller.current?.abort();
    setPreviews({});
    setRendering(false);
    setError("");
  }, [config, source, keepMask, collection, technique, query, time, trim]);
  useEffect(() => setQuery(""), [collection]);
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
        const c = applyStyle(look.config, config, keepMask);
        const size = frameDimensions(source, c, expanded ? "480" : "320");
        service.invalidate();
        const echoFrames = await echoes.frames(time, c, abort.signal);
        await service.render(snapshot, output, c, size.width, size.height, {
          signal: abort.signal,
          time,
          motionRange: trim,
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
      aria-label={`${look.name} ${look.note}`}
      disabled={busy}
      onClick={() => {
        onApply(look);
        close();
      }}
    >
      <span className="look-artwork"><img
        className="style-preview"
        src={previews[look.name] || thumbnail(look)}
        alt=""
        loading="lazy"
        width="240"
        height="144"
      />
      <span className="look-preview-label">{previews[look.name] ? "Your frame" : "Sample"}</span></span>
      <strong>{look.name}</strong>
      <span className="look-caption">{look.note.split("/").at(-1).trim()}</span>
    </button>
  );
  const content = <>
      <div className="gallery-heading"><div><span className="eyebrow">{artistic ? "Materials & patterns" : "Digital & print"}</span><h2>{artistic ? "Artistic collection" : "Studio looks"}</h2></div>
        {!expanded && <button ref={galleryButton} className="icon-button" aria-label={artistic ? "Open artistic gallery" : "Open looks gallery"} onClick={() => { onPause(); setExpanded(true); }}><Icon name="gallery" /></button>}
      </div>
      <div className="gallery-filters">
      <div className="control style-search"><label className="sr-only" htmlFor={searchId}>Find a look</label>
        <span className="style-search-field">
          <input id={searchId} type="search" value={query} placeholder={artistic ? "Try marbling, silk, contours…" : "Search studio looks…"} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === "Escape") { setQuery(""); e.stopPropagation(); } }} disabled={busy} />
          {query && <button type="button" className="style-search-clear" aria-label="Clear look search" onClick={() => setQuery("")} disabled={busy}>×</button>}
        </span>
      </div>
      {artistic && <label className="control technique-filter"><span className="sr-only">Technique</span>
        <select value={technique} onChange={e => onTechniqueChange(e.target.value)} disabled={busy}>
          <option value="all">All techniques</option>
          {effects.filter(([id]) => artisticEffects.includes(id)).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </label>}
      </div>
      {config.maskMode !== "none" && <label className="check style-options"><input type="checkbox" checked={keepMask} onChange={e => setKeepMask(e.target.checked)} disabled={busy} /><span>Keep selection when changing looks</span></label>}
      {config.stack.length > 1 && <p className="hint gallery-scope">Replaces the main effect · Keeps your added layers</p>}
      <div className="gallery-toolbar"><span>{visibleLooks.length} styles</span><button className="small style-preview-button" aria-label={rendering ? `Stop previews · ${Object.keys(previews).length} / ${visibleLooks.length}` : "Preview looks on this frame"} onClick={rendering ? close : preview} disabled={busy || !visibleLooks.length}>
        {rendering ? `Stop previews · ${Object.keys(previews).length} / ${visibleLooks.length}` : "Preview your frame"}
      </button></div>
      {error && <p className="inline-error">{error}</p>}
      {!visibleLooks.length && <div className="style-empty" role="status"><strong>No matching looks</strong><p className="hint">Try a different word or technique.</p><button className="full" onClick={() => { setQuery(""); if (artistic) onTechniqueChange("all"); }}>Show all looks</button></div>}
      <div className="style-library-grid">{visibleLooks.map(card)}</div>
    </>;
  return expanded
    ? <Dialog title={artistic ? "Artistic gallery" : "Looks gallery"} onClose={() => setExpanded(false)}><div className="modal-body looks-section looks-gallery">{content}</div></Dialog>
    : <section className="looks-section">{content}</section>;
}
