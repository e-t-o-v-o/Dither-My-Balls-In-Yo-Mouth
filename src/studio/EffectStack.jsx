import React from "react";
import { EffectControls, ColorControls, Range, Select, Icon } from "./Controls";
import { MotionControls } from "./MotionControls";
import { defaults, effects, sanitizeConfig } from "./model";
import { effectDefaults, effectSnapshot } from "./effect-registry";
import { stackEntries, layerConfig, moveLayer } from "./stack";

export function EffectStack({ config, set, source, trim, time, seekTo, customFonts, onFontUpload, view, setView, section = "effect", onMotion }) {
  const { editing = "main", expanded = false } = view;
  const layers = stackEntries(config);
  const selected = layers.find(layer => layer.id === editing) || layers.find(layer => layer.id === "main");
  const main = selected.id === "main", c = layerConfig(config, selected);
  const index = layers.indexOf(selected);
  const updateView = patch => setView(current => ({ ...current, ...patch }));
  const save = next => set("stack", next);
  const patch = (id, changes) => save(layers.map(layer => layer.id === id ? { ...layer, ...changes } : layer));
  const edit = (key, value) => {
    if (main) return set(key, value);
    const settings = key === "effect"
      ? { ...c, ...effectSnapshot(defaults), ...effectDefaults[value], effect: value }
      : key === "effect-reset" ? { ...c, ...value } : { ...c, [key]: value };
    patch(selected.id, { settings: sanitizeConfig(settings) });
  };
  const name = layer => effects.find(([id]) => id === layerConfig(config, layer).effect)?.[1] || "Effect";
  const add = effect => {
    if (!effect) return;
    const id = `layer-${crypto.randomUUID()}`;
    save([...layers, { id, enabled: true, mix: 0.65, settings: sanitizeConfig({ ...defaults, ...effectDefaults[effect], effect, palette: config.palette, bgColor: config.bgColor }) }]);
    updateView({ editing: id, expanded: true });
  };
  return <>
    <section className="effect-stack" aria-label="Effect stack">
      <div className="layer-context">
        <div><span className="eyebrow">{main ? "Main effect" : "Added effect"} · Layer {index + 1}</span>
          {section !== "effect" && <h2>{name(selected)}</h2>}
        </div>
        <button className="small layer-disclosure" aria-label="Manage effect layers" aria-expanded={expanded} onClick={() => updateView({ expanded: !expanded })}><Icon name="layers" />Layers <span className="count">{layers.length}</span></button>
      </div>
      {expanded && <div className="layer-manager">
        <ol className="stack-list">
          {layers.map((layer, position) => <li key={layer.id} data-active={selected.id === layer.id} data-bypassed={!layer.enabled || layer.mix === 0}>
            <span className="layer-number">{position + 1}</span>
            <button className="quiet layer-select" aria-pressed={selected.id === layer.id} aria-label={`Edit ${name(layer)} layer ${position + 1}`} onClick={() => updateView({ editing: layer.id })}><strong>{name(layer)}</strong><small>{layer.enabled && layer.mix > 0 ? `${Math.round(layer.mix * 100)}% blend` : "Bypassed"}</small></button>
            <label className="stack-enable" title={layer.enabled ? "Bypass this effect" : "Enable this effect"}><input type="checkbox" aria-label={`Enable ${name(layer)} layer ${position + 1}`} checked={layer.enabled} onChange={event => patch(layer.id, { enabled: event.target.checked })} /></label>
          </li>)}
        </ol>
        {layers.length > 1 && <div className="stack-actions" role="group" aria-label={`Arrange ${name(selected)}`}>
          <span>Selected layer</span>
          <button className="icon-button" aria-label={`Move layer ${index + 1} up`} disabled={index === 0} onClick={() => save(moveLayer(layers, selected.id, -1))}><Icon name="chevron" style={{ transform: "rotate(180deg)" }} /></button>
          <button className="icon-button" aria-label={`Move layer ${index + 1} down`} disabled={index === layers.length - 1} onClick={() => save(moveLayer(layers, selected.id, 1))}><Icon name="chevron" /></button>
          {!main && <button className="icon-button" aria-label={`Remove ${name(selected)} layer ${index + 1}`} onClick={() => { save(layers.filter(layer => layer.id !== selected.id)); updateView({ editing: "main" }); }}><Icon name="trash" /></button>}
        </div>}
        {layers.length < 3 && <Select label="Add effect" value="" onChange={add}><option value="">Choose another treatment…</option>{effects.filter(([id]) => id !== "dither-ascii").map(([id, label]) => <option key={id} value={id}>{label}</option>)}</Select>}
        {config.stack.length > 0 && <Range label={`${name(selected)} layer blend`} value={selected.mix * 100} min={0} max={100} unit="%" onChange={value => patch(selected.id, { mix: value / 100 })} />}
        <p className="hint layer-order-note">Effects run from top to bottom.</p>
      </div>}
      {!selected.enabled && <p className="layer-status">This effect is bypassed. <button className="small" onClick={() => patch(selected.id, { enabled: true })}>Enable effect</button></p>}
      {section !== "motion" && c.motion.enabled && ["video", "demo"].includes(source.kind) && Object.keys(c.motion.tracks).length > 0 && <button className="motion-active" onClick={onMotion}><Icon name="play" />Animation active · Edit motion</button>}
    </section>
    {section === "effect" ? <EffectControls key={selected.id} config={c} set={edit} customFonts={main ? customFonts : []} onFontUpload={main ? onFontUpload : undefined} />
      : section === "color" ? <ColorControls key={selected.id} config={c} set={edit} motion={source.kind !== "image"} echoes={main && ["demo", "video"].includes(source.kind)} echoControls={main} />
      : <MotionControls key={selected.id} config={c} set={edit} source={source} trim={trim} time={time} seekTo={seekTo} />}
  </>;
}
