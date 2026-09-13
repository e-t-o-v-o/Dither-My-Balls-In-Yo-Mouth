import React from "react";
import { EffectControls, ColorControls, Range, Select, Icon } from "./Controls";
import { MotionControls } from "./MotionControls";
import { defaults, effects, sanitizeConfig } from "./model";
import { effectDefaults, effectSnapshot } from "./effect-registry";
import { stackEntries, layerConfig, moveLayer } from "./stack";

export function EffectStack({ config, set, source, trim, time, seekTo, customFonts, onFontUpload, view, setView }) {
  const { editing = "main", section = "effect", expanded = config.stack.length > 1 } = view;
  const setEditing = editing => setView(current => ({ ...current, editing }));
  const setSection = section => setView(current => ({ ...current, section }));
  const setExpanded = expanded => setView(current => ({ ...current, expanded }));
  const layers = stackEntries(config);
  const selected = layers.find(layer => layer.id === editing) || layers.find(layer => layer.id === "main");
  const main = selected.id === "main", c = layerConfig(config, selected);
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
  return <>
    <section className="effect-stack" aria-label="Effect stack">
      <button className="stack-heading quiet full" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}><strong>Effect stack</strong><span>{layers.length} / 3 · {expanded ? "Hide" : "Show"}</span></button>
      {expanded && <p className="hint">Top to bottom. Each effect works on the result above it.</p>}
      {expanded && <ol className="stack-list">
        {layers.map((layer, index) => <li key={layer.id} data-active={selected.id === layer.id} data-bypassed={!layer.enabled}>
          <div className="stack-layer-title"><span className="mono">{index + 1}</span>
            <button className="quiet" aria-pressed={selected.id === layer.id} aria-label={`Edit ${name(layer)} layer ${index + 1}`} onClick={() => { setEditing(layer.id); setSection("effect"); }}>
              <strong>{name(layer)}</strong><small>{layer.id === "main" ? "Main effect" : "Added effect"}</small>
            </button>
            <label className="stack-enable" title={layer.enabled ? "Bypass this effect" : "Enable this effect"}><input type="checkbox" aria-label={`Enable ${name(layer)} layer ${index + 1}`} checked={layer.enabled} onChange={event => patch(layer.id, { enabled: event.target.checked })} /></label>
          </div>
          {layers.length > 1 && <div className="stack-actions">
            <button className="small" aria-label={`Move layer ${index + 1} up`} disabled={index === 0} onClick={() => save(moveLayer(layers, layer.id, -1))}><Icon name="chevron" style={{ transform: "rotate(180deg)" }} /></button>
            <button className="small" aria-label={`Move layer ${index + 1} down`} disabled={index === layers.length - 1} onClick={() => save(moveLayer(layers, layer.id, 1))}><Icon name="chevron" /></button>
            {layer.id !== "main" && <button className="small" aria-label={`Remove ${name(layer)} layer ${index + 1}`} onClick={() => { save(layers.filter(item => item.id !== layer.id)); if (editing === layer.id) setEditing("main"); }}>Remove</button>}
          </div>}
        </li>)}
      </ol>}
      {layers.length < 3 && <Select label="Add effect" value="" onChange={effect => {
        if (!effect) return;
        const id = `layer-${crypto.randomUUID()}`;
        save([...layers, { id, enabled: true, mix: 0.65, settings: sanitizeConfig({ ...defaults, ...effectDefaults[effect], effect, palette: config.palette, bgColor: config.bgColor }) }]);
        setEditing(id); setSection("effect"); setExpanded(true);
      }}><option value="">Choose another treatment…</option>{effects.filter(([id]) => id !== "dither-ascii").map(([id, label]) => <option key={id} value={id}>{label}</option>)}</Select>}
      {config.stack.length > 0 && <Range label={`${name(selected)} layer blend`} value={selected.mix * 100} min={0} max={100} unit="%" onChange={value => patch(selected.id, { mix: value / 100 })} />}
      {!selected.enabled && <p className="hint">This effect is bypassed. Enable it to see your adjustments.</p>}
      {!main && <div className="segmented" role="group" aria-label="Layer controls">{["effect", "color", "motion"].map(id => <button key={id} aria-pressed={section === id} onClick={() => setSection(id)}>{id === "effect" ? "Effect" : id === "color" ? "Color" : "Motion"}</button>)}</div>}
      {!main && <p className="hint">Editing {name(selected)}. Select the main effect to use its selection, custom font, or color echoes.</p>}
    </section>
    {main || section === "effect" ? <EffectControls key={selected.id} config={c} set={edit} customFonts={main ? customFonts : []} onFontUpload={main ? onFontUpload : undefined} />
      : section === "color" ? <ColorControls config={c} set={edit} motion={source.kind !== "image"} echoControls={false} />
      : <MotionControls config={c} set={edit} source={source} trim={trim} time={time} seekTo={seekTo} />}
  </>;
}
