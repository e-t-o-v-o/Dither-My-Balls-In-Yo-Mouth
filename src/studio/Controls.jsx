import React, { createContext, useContext, useId, useRef, useState, useEffect } from "react";
import { effectFamily, effectDefaults, effectSnapshot } from "./effect-registry";
import { Dialog } from "./Dialog";
import {
  effects,
  defaults,
  looks,
  methods,
  palettes,
  fonts,
  asciiVariants,
  usesPalette,
} from "./model";
export const AdjustmentContext = createContext({ begin() {}, end() {} });
export function Icon({ name, ...props }) {
  const paths = {
    play: "M8 5l11 7-11 7V5Z",
    pause: "M8 5v14M16 5v14",
    upload: "M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5",
    download: "M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4",
    camera:
      "M4 7h4l2-3h4l2 3h4v13H4V7Zm8 3a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z",
    undo: "M8 4 3 9l5 5M3 9h10a7 7 0 0 1 7 7v3",
    redo: "M16 4l5 5-5 5m5-5h-10a7 7 0 0 0-7 7v3",
    close: "m6 6 12 12M18 6 6 18",
    sound: "m4 9 4 0 5-4v14l-5-4H4V9Zm13-2a7 7 0 0 1 0 10",
    mute: "m4 9 4 0 5-4v14l-5-4H4V9Zm13 0 5 6m0-6-5 6",
    help: "M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3v1M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z",
    back: "M6 5v14M19 5 8 12l11 7V5Z",
    spark: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z",
    chevron: "m8 10 4 4 4-4",
    expand: "m8 9 4-4 4 4m-8 6 4-4 4 4",
    collapse: "m8 8 4 4 4-4m-8 7 4 4 4-4",
    more: "M5 12h.1M12 12h.1M19 12h.1",
    document: "M6 3h8l4 4v14H6V3Zm8 0v5h4",
    looks: "M3 4h8v8H3zM15 4h6v5h-6zM3 16h8v5H3zM15 13h6v8h-6z",
    effect: "M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6",
    color: "M12 3a9 9 0 1 0 0 18h2a2 2 0 0 0 0-4c-1 0-1-2 1-2h3a3 3 0 0 0 3-3 9 9 0 0 0-9-9ZM7 9h.1M11 6h.1M16 8h.1",
    select: "M8 3H4v5M16 3h4v5M20 16v5h-4M8 21H4v-5M8 12l3 3 5-6",
    frame: "M6 3v15h15M3 6h15v15",
    compare: "M12 3v18M9 4H4v16h5M15 4h5v16h-5",
    loop: "m17 3 4 4-4 4M21 7H7a4 4 0 0 0-4 4m4 10-4-4 4-4m-4 4h14a4 4 0 0 0 4-4",
    next: "M18 5v14M5 5l11 7-11 7V5Z",
    panel: "M3 4h18v16H3V4Zm12 0v16",
    sun: "M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z",
  };
  return (
    <svg
      {...props}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.spark} />
    </svg>
  );
}
export function Range({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = "",
  disabled = false,
}) {
  const id = useId();
  const adjustment = useContext(AdjustmentContext);
  const formatValue = v => String(Number(Number(v).toFixed(step < 1 ? Math.min(4, Math.ceil(-Math.log10(step)) + 1) : 2)));
  const dirty = useRef(false);
  const [draft, setDraft] = useState(formatValue(value));
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setDraft(formatValue(value));
  }, [value, editing]);
  const commit = () => {
    if (dirty.current && draft.trim() && Number.isFinite(Number(draft))) {
      const snapped = min + Math.round((Number(draft) - min) / step) * step;
      adjustment.begin();
      onChange(Number(Math.max(min, Math.min(max, snapped)).toFixed(6)));
      adjustment.end();
    }
    setEditing(false);
    setDraft(formatValue(value));
    dirty.current = false;
  };
  return (
    <div className="control range-control">
      <div className="control-label">
        <label htmlFor={id}>{label}</label>
        <span className="value-field">
          <input type="number" aria-label={`${label} exact value`}
            min={min} max={max} step={step} disabled={disabled}
            value={draft} inputMode={min < 0 ? "text" : "decimal"}
            onFocus={(e) => { dirty.current = false; setEditing(true); e.target.select(); }}
            onChange={(e) => { dirty.current = true; setDraft(e.target.value); }} onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") { dirty.current = false; setDraft(formatValue(value)); setEditing(false); e.stopPropagation(); }
            }} />
          {unit && <span>{unit}</span>}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{
          "--range-progress": `${((value - min) / (max - min)) * 100}%`,
        }}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerDown={(e) => { adjustment.begin(); e.currentTarget.setPointerCapture?.(e.pointerId); }}
        onPointerUp={() => adjustment.end()}
        onPointerCancel={() => adjustment.end()}
        onLostPointerCapture={() => adjustment.end()}
        onKeyDown={(e) => {
          if (!e.repeat && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(e.key)) adjustment.begin();
        }}
        onKeyUp={() => adjustment.end()}
        onBlur={() => adjustment.end()}
        disabled={disabled}
      />
    </div>
  );
}
export function Select({ label, value, onChange, children, ...props }) {
  const id = useId();
  return (
    <div className="control">
      <label htmlFor={id}>{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
export function Check({ label, value, onChange, description }) {
  return (
    <label className="check">
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        {label}
        {description && <small>{description}</small>}
      </span>
    </label>
  );
}
export function ColorInput({ label, value, onChange }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <label className="control">
      {label}
      <span className="color-input">
        <input
          aria-label={label}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          className="hex-input mono"
          aria-label={`${label} hex`}
          value={draft.toUpperCase()}
          maxLength={7}
          onChange={(event) => {
            const v = event.target.value;
            setDraft(v);
            if (/^#[a-f0-9]{6}$/i.test(v)) onChange(v);
          }}
          onBlur={() => setDraft(value)}
        />
      </span>
    </label>
  );
}
export function MaskControls({
  config: c,
  set,
  setConfig,
  showMask,
  setShowMask,
  tool,
  setTool,
  radius,
  setRadius,
  onMatteUpload,
}) {
  return (
    <>
      <section className="inspector-section">
        <h2>Select the subject</h2>
        <Select
          label="Select by"
          value={c.maskMode}
          onChange={(v) => set("maskMode", v)}
        >
          <option value="none">Whole image</option>
          <option value="luminance">Brightness range</option>
          <option value="color">Color range</option>
          <option value="manual">Painted selection</option>
          <option value="matte">Imported matte</option>
        </Select>
        {c.maskMode === "luminance" && (
          <>
            <Range
              label="Dark limit"
              value={c.maskLow}
              min={0}
              max={c.maskHigh}
              onChange={(v) => set("maskLow", v)}
            />
            <Range
              label="Light limit"
              value={c.maskHigh}
              min={c.maskLow}
              max={255}
              onChange={(v) => set("maskHigh", v)}
            />
          </>
        )}
        {c.maskMode === "color" && (
          <>
            <ColorInput
              label="Selected color"
              value={c.maskColor}
              onChange={(v) => set("maskColor", v)}
            />
            <button
              className={tool === "pick" ? "full selected" : "full"}
              aria-pressed={tool === "pick"}
              onClick={() => setTool(tool === "pick" ? "none" : "pick")}
            >
              Pick color from preview
            </button>
            <Range
              label="Color range"
              value={c.maskTolerance * 100}
              min={1}
              max={100}
              unit="%"
              onChange={(v) => set("maskTolerance", v / 100)}
            />
          </>
        )}
        {c.maskMode === "matte" && (
          <>
            <label className="button full">
              {c.maskImage ? "Replace matte" : "Import matte"}
              <input
                hidden
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={onMatteUpload}
              />
            </label>
            <p className="hint">
              White selects; black excludes. Use an image with the same framing
              as your source.
            </p>
          </>
        )}
        {["color", "luminance"].includes(c.maskMode) && (
          <Range
            label="Edge softness"
            value={c.maskSoftness * 100}
            min={0}
            max={30}
            unit="%"
            onChange={(v) => set("maskSoftness", v / 100)}
          />
        )}
        <div
          className="segmented wrap"
          role="group"
          aria-label="Selection tools"
        >
          {[
            ["brush", "Brush"],
            ["erase", "Erase"],
            ["lasso", "Lasso"],
          ].map(([id, name]) => (
            <button
              key={id}
              aria-pressed={tool === id}
              onClick={() => setTool(tool === id ? "none" : id)}
            >
              {name}
            </button>
          ))}
        </div>
        {["brush", "erase"].includes(tool) && (
          <Range
            label="Brush size"
            value={radius * 200}
            min={1}
            max={30}
            unit="%"
            onChange={(v) => setRadius(v / 200)}
          />
        )}
        {tool !== "none" && (
          <p className="hint">
            {tool === "pick"
              ? "Tap the source color in the preview."
              : "Draw directly on the preview. Undo restores the previous selection."}
          </p>
        )}
        {c.maskMode !== "none" && (
          <>
            <Check
              label="Show selection overlay"
              value={showMask}
              onChange={setShowMask}
              description="Pink marks excluded areas. The overlay is never exported."
            />
            <Check
              label="Invert selection"
              value={c.maskInvert}
              onChange={(v) => set("maskInvert", v)}
            />
            <Check
              label="Keep original behind effect"
              value={c.maskBackdrop}
              onChange={(v) => set("maskBackdrop", v)}
            />
            <button
              className="full"
              onClick={() => {
                setConfig({
                  ...c,
                  maskMode: "none",
                  maskStrokes: [],
                  maskImage: "",
                });
                setTool("none");
                setShowMask(false);
              }}
            >
              Clear mask
            </button>
          </>
        )}
      </section>
      <details className="inspector-section">
        <summary>Green screen</summary>
        <Check
          label="Remove green"
          value={c.removeGreen}
          onChange={(v) => set("removeGreen", v)}
        />
        {c.removeGreen && (
          <Range
            label="Green separation"
            value={c.greenTolerance}
            min={1.05}
            max={2}
            step={0.05}
            onChange={(v) => set("greenTolerance", v)}
          />
        )}
      </details>
    </>
  );
}
export function EffectControls({ config: c, set, customFonts, onFontUpload }) {
  const [family, setFamily] = useState(null);
  const [choosing, setChoosing] = useState(false);
  useEffect(() => setFamily(null), [c.effect]);
  const activeFamily = family || effectFamily(c.effect);
  const text =
    c.effect === "contour-type" ||
    ["ascii", "dither-ascii"].includes(c.effect) ||
    (["palette", "two-tone"].includes(c.effect) && c.overlay !== "none");
  return (
    <>
      <section className="effect-current">
        <button className="effect-picker" aria-label="Change effect" onClick={() => setChoosing(true)}>
          <span><small>{effectFamily(c.effect)}</small><strong>{effects.find(([id]) => id === c.effect)?.[1]}</strong></span><Icon name="chevron" />
        </button>
        <p className="effect-description">{effects.find(([id]) => id === c.effect)?.[3]}</p>
      </section>
      {choosing && <Dialog title="Choose an effect" onClose={() => setChoosing(false)}>
        <div className="modal-body effect-library">
          <div className="segmented effect-families" role="group" aria-label="Effect families">
            {["Graphic", "Digital", "Utilities"].map(name => <button key={name} aria-pressed={activeFamily === name} onClick={() => setFamily(name)}>{name}</button>)}
          </div>
          <div className="effect-grid">
            {effects.filter(([id]) => id !== "dither-ascii" && effectFamily(id) === activeFamily).map(([id, name, n, description]) => {
              const look = looks.find(look => look.config.effect === id);
              const active = c.effect === id || (id === "ascii" && c.effect === "dither-ascii");
              return <button key={id} aria-label={name} title={description} className="effect" aria-pressed={active} onClick={() => { set("effect", id); setChoosing(false); }}>
                {look && <img src={`${import.meta.env.BASE_URL}styles/${look.name.toLowerCase().replace(/\s+/g, "-")}.png`} alt="" loading="lazy" width="240" height="144" />}
                <span className="effect-name">{name}</span><span className="effect-note">{description}</span>
              </button>;
            })}
          </div>
        </div>
      </Dialog>}
      <section className="inspector-section effect-adjustments">
        <Range
          label="Cell size"
          value={c.cellSize}
          min={
            c.effect === "screenprint"
              ? 8
              : ["beads", "contour-type"].includes(c.effect)
                ? 6
                : 2
          }
          max={80}
          onChange={(v) => set("cellSize", v)}
        />
        <p className="hint">
          Smaller cells preserve more detail. The pattern scales with your
          export.
        </p>

        {["ascii", "dither-ascii"].includes(c.effect) && (
          <Select
            label="ASCII mode"
            value={c.effect}
            onChange={(v) => set("effect", v)}
          >
            <option value="ascii">Continuous tone</option>
            <option value="dither-ascii">Dithered tone</option>
          </Select>
        )}
        {c.effect.includes("dither") && (
          <>
            <Select
              label="Dithering algorithm"
              value={c.method}
              onChange={(v) => set("method", v)}
            >
              {methods.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </Select>
            <Range
              label="Dither strength"
              value={c.amount}
              min={0}
              max={2}
              step={0.05}
              onChange={(v) => set("amount", v)}
            />
          </>
        )}
        {["two-tone", "edge"].includes(c.effect) && (
          <Range
            label="Threshold"
            value={c.threshold}
            min={0}
            max={255}
            onChange={(v) => set("threshold", v)}
          />
        )}
        {["palette", "two-tone"].includes(c.effect) && (
          <Select
            label="Cell overlay"
            value={c.overlay}
            onChange={(v) => set("overlay", v)}
          >
            <option value="none">None</option>
            {c.effect === "palette" ? (
              <option value="number">Palette number</option>
            ) : (
              <>
                <option value="binary">Binary · 0 / 1</option>
                <option value="luma">Brightness · 0–9</option>
              </>
            )}
            <option value="character">Custom character</option>
          </Select>
        )}
        {["palette", "two-tone"].includes(c.effect) &&
          c.overlay === "character" && (
            <label className="control">
              Character
              <input
                type="text"
                value={c.char}
                maxLength={4}
                onChange={(e) => set("char", e.target.value)}
              />
            </label>
          )}
        {["halftone", "mosaic"].includes(c.effect) && (
          <Range
            label="Dot scale"
            value={c.dotScale}
            min={0.25}
            max={1}
            step={0.05}
            onChange={(v) => set("dotScale", v)}
          />
        )}
        {["mosaic", "symbols"].includes(c.effect) && (
          <Select
            label="Mark color"
            value={c.shapeColor}
            onChange={(v) => set("shapeColor", v)}
          >
            <option value="source">Source color</option>
            <option value="palette">Effect palette</option>
            <option value="ink">Custom ink</option>
          </Select>
        )}
        {c.effect === "mosaic" && (
          <Select
            label="Dot layout"
            value={c.mosaicLayout}
            onChange={(v) => set("mosaicLayout", v)}
          >
            <option value="staggered">Staggered rows</option>
            <option value="square">Square grid</option>
          </Select>
        )}
        {c.effect === "symbols" && (
          <>
            <Select
              label="Symbol family"
              value={c.symbolSet}
              onChange={(v) => set("symbolSet", v)}
            >
              <option value="mixed">Mixed geometry</option>
              <option value="orbital">Orbital · dots & rings</option>
              <option value="directional">
                Directional · arrows & slashes
              </option>
            </Select>
            {c.shapeColor === "ink" && (
              <>
                <ColorInput
                  label="Accent color"
                  value={c.accentColor}
                  onChange={(v) => set("accentColor", v)}
                />
                <Range
                  label="Accent frequency"
                  value={c.accentAmount * 100}
                  min={0}
                  max={100}
                  unit="%"
                  onChange={(v) => set("accentAmount", v / 100)}
                />
              </>
            )}
          </>
        )}
        {c.effect === "beads" && (
          <>
            <Select
              label="Trace from"
              value={c.contourSource}
              onChange={(v) => set("contourSource", v)}
            >
              <option value="luminance">Brightness contours</option>
              <option value="alpha">Transparency / mask edge</option>
            </Select>
            <Range
              label="Contour level"
              value={c.threshold}
              min={1}
              max={254}
              onChange={(v) => set("threshold", v)}
            />
            <Range
              label="Bead spacing"
              value={c.beadSpacing}
              min={0.65}
              max={2.5}
              step={0.05}
              onChange={(v) => set("beadSpacing", v)}
            />
            <Range
              label="Bead size"
              value={c.beadSize}
              min={0.25}
              max={1.5}
              step={0.05}
              onChange={(v) => set("beadSize", v)}
            />
            <Range
              label="Ring width"
              value={c.beadRing * 100}
              min={0}
              max={60}
              unit="%"
              onChange={(v) => set("beadRing", v / 100)}
            />
            <ColorInput
              label="Ring color"
              value={c.accentColor}
              onChange={(v) => set("accentColor", v)}
            />
            <Check
              label="Fill contour interior"
              value={c.contourFill}
              onChange={(v) => set("contourFill", v)}
            />
            {c.contourFill && (
              <ColorInput
                label="Interior color"
                value={c.fillColor}
                onChange={(v) => set("fillColor", v)}
              />
            )}
          </>
        )}
        {c.effect === "screenprint" && (
          <>
            <Select
              label="Ink process"
              value={c.screenMode}
              onChange={(v) => set("screenMode", v)}
            >
              <option value="cmyk">CMYK · four inks</option>
              <option value="duotone">Duotone · custom inks</option>
            </Select>
            <Range
              label="Screen angle"
              value={c.screenAngle}
              min={0}
              max={90}
              unit="°"
              onChange={(v) => set("screenAngle", v)}
            />
            <Range
              label="Registration offset"
              value={c.registration}
              min={0}
              max={12}
              step={0.25}
              onChange={(v) => set("registration", v)}
            />
            <Range
              label="Ink spread"
              value={c.inkSpread}
              min={0.5}
              max={1.5}
              step={0.05}
              onChange={(v) => set("inkSpread", v)}
            />
            {c.screenMode === "duotone" && (
              <ColorInput
                label="Second ink"
                value={c.accentColor}
                onChange={(v) => set("accentColor", v)}
              />
            )}
            <p className="hint">
              Ink multiplies over the background. A light paper color gives the
              clearest separations.
            </p>
          </>
        )}
        {c.effect === "contour-type" && (
          <>
            <label className="control">
              Contour text
              <input
                value={c.contourText}
                maxLength={128}
                onChange={(e) => set("contourText", e.target.value)}
              />
            </label>
            <Select
              label="Trace from"
              value={c.contourSource}
              onChange={(v) => set("contourSource", v)}
            >
              <option value="luminance">Brightness contours</option>
              <option value="alpha">Transparency / mask edge</option>
            </Select>
            <Range
              label="Contour level"
              value={c.threshold}
              min={1}
              max={254}
              onChange={(v) => set("threshold", v)}
            />
            {c.contourSource === "luminance" && (
              <Range
                label="Contour lines"
                value={c.contourLevels}
                min={1}
                max={5}
                onChange={(v) => set("contourLevels", v)}
              />
            )}
            <Range
              label="Letter spacing"
              value={c.beadSpacing}
              min={0.65}
              max={2.5}
              step={0.05}
              onChange={(v) => set("beadSpacing", v)}
            />
          </>
        )}
        {c.effect === "crosshatch" && (
          <Range
            label="Stroke weight"
            value={c.lineWidth}
            min={0.04}
            max={0.3}
            step={0.01}
            onChange={(v) => set("lineWidth", v)}
          />
        )}
      </section>
      {text && (
        <section className="inspector-section">
          <div className="section-heading">
            <h2>Typography</h2>
            <span>03</span>
          </div>
          {["ascii", "dither-ascii"].includes(c.effect) && (
            <>
              <Select
                label="Character set"
                value={
                  Object.entries(asciiVariants).find(
                    ([, v]) => v.join("") === c.characters,
                  )?.[0] || "custom"
                }
                onChange={(v) =>
                  v !== "custom" && set("characters", asciiVariants[v].join(""))
                }
              >
                <option value="custom">Custom ramp</option>
                {Object.keys(asciiVariants).map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </Select>
              <label className="control">
                Characters · dark to light
                <input
                  className="mono"
                  value={c.characters}
                  maxLength={128}
                  onChange={(e) => set("characters", e.target.value)}
                />
              </label>
              <Check
                label="Normalize character mapping"
                description="Expand this frame’s brightness range."
                value={c.dynamic}
                onChange={(v) => set("dynamic", v)}
              />
              <Check
                label="Fill beneath type"
                value={c.underlay}
                onChange={(v) => set("underlay", v)}
              />
              {c.underlay && (
                <Select
                  label="Type backdrop"
                  value={c.underlayMode}
                  onChange={(v) => set("underlayMode", v)}
                >
                  <option value="source">Source color</option>
                  <option value="palette">Flat palette colors</option>
                </Select>
              )}
            </>
          )}
          <Select label="Font" value={c.font} onChange={(v) => set("font", v)}>
            {[...new Set([...fonts, ...customFonts])].map((f) => (
              <option key={f}>{f}</option>
            ))}
          </Select>
          <label className="button file-button">
            Upload font
            <input
              type="file"
              accept=".ttf,.otf,.woff,.woff2"
              onChange={onFontUpload}
            />
          </label>
          <Range
            label="Glyph scale"
            value={c.fontScale}
            min={0.4}
            max={2}
            step={0.05}
            onChange={(v) => set("fontScale", v)}
          />
          {["ascii", "dither-ascii"].includes(c.effect) && (
            <Select
              label="Text color"
              value={c.textColor}
              onChange={(v) => set("textColor", v)}
            >
              <option value="palette">Effect palette</option>
              <option value="source">Source color</option>
              <option value="foreground">Foreground color</option>
              <option value="contrast">Automatic contrast</option>
            </Select>
          )}
        </section>
      )}
      <button className="quiet full reset-effect" onClick={() => {
        const reset = { ...effectSnapshot(defaults), ...(effectDefaults[c.effect] || {}) };
        set("effect-reset", reset);
      }}><Icon name="undo" />Reset this effect</button>
    </>
  );
}
export function ColorControls({
  config: c,
  set,
  motion = false,
  echoes = false,
}) {
  return (
    <>
      {usesPalette(c) && (
        <section className="inspector-section">
          <div className="section-heading">
            <h2>Color palette</h2>
            <span>{palettes[c.palette].length} colors</span>
          </div>
          <div className="large-swatches">
            {palettes[c.palette].map((col, i) => (
              <span
                key={`${col}-${i}`}
                style={{ background: col }}
                title={col}
              />
            ))}
          </div>
          <Select
            label="Palette"
            value={c.palette}
            onChange={(v) => set("palette", v)}
          >
            {Object.keys(palettes).map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
          <div className="palette-grid">
            {[
              "Paper",
              "Phosphor",
              "Amber",
              "Electric",
              "Vaporwave Aurora",
              "Brutalist Neon Clash",
            ].map((p) => (
              <button
                key={p}
                className={
                  c.palette === p ? "palette-option selected" : "palette-option"
                }
                onClick={() => set("palette", p)}
                aria-pressed={c.palette === p}
              >
                <span className="swatches">
                  {palettes[p].map((col, i) => (
                    <i key={i} style={{ background: col }} />
                  ))}
                </span>
                <span>{p}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      <section className="inspector-section">
        <div className="section-heading">
          <h2>Adjustments</h2>
          <span>RGB</span>
        </div>
        <Range
          label="Brightness"
          value={c.brightness}
          min={-100}
          max={100}
          onChange={(v) => set("brightness", v)}
        />
        <Range
          label="Contrast"
          value={c.contrast}
          min={0.2}
          max={3}
          step={0.05}
          onChange={(v) => set("contrast", v)}
        />
        <Range
          label="Saturation"
          value={c.saturation}
          min={0}
          max={2}
          step={0.05}
          onChange={(v) => set("saturation", v)}
        />
        <Check
          label="Invert colors"
          value={c.invert}
          onChange={(v) => set("invert", v)}
        />
        <div className="color-pair">
          {!usesPalette(c) &&
            !["pixel", "channel"].includes(c.effect) &&
            !(c.effect === "screenprint" && c.screenMode === "cmyk") &&
            !(c.effect === "ascii" && c.textColor !== "foreground") &&
            !(
              ["mosaic", "symbols"].includes(c.effect) &&
              c.shapeColor === "source"
            ) && (
              <ColorInput
                label="Foreground color"
                value={c.fgColor}
                onChange={(v) => set("fgColor", v)}
              />
            )}
          <ColorInput
            label="Background color"
            value={c.bgColor}
            onChange={(v) => set("bgColor", v)}
          />
        </div>
        <Check
          label="Transparent background"
          description="Preserved in PNG and SVG. Videos and GIF use the background color."
          value={c.transparent}
          onChange={(v) => set("transparent", v)}
        />
      </section>
      <section className="inspector-section">
        <h2>Finishing</h2>
        <Range
          label="Effect mix"
          value={c.effectMix * 100}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => set("effectMix", v / 100)}
        />
        <Range
          label="Paper grain"
          value={c.grain * 100}
          min={0}
          max={30}
          unit="%"
          onChange={(v) => set("grain", v / 100)}
        />
      </section>
      {motion && (
        <section className="inspector-section">
          <h2>Motion</h2>
          <Range
            label="Frame response"
            value={c.smooth * 100}
            min={5}
            max={100}
            step={5}
            unit="%"
            onChange={(v) => set("smooth", v / 100)}
          />
          <p className="hint">
            Lower response blends frames into a soft trail.
          </p>
          <Range
            label="Color echoes"
            value={echoes ? c.echoCount : 0}
            min={0}
            max={4}
            disabled={!echoes}
            onChange={(v) => set("echoCount", v)}
          />
          {!echoes && (
            <p className="hint">Import a recording to add color echoes.</p>
          )}
          {echoes && c.echoCount > 0 && (
            <>
              <Range
                label="Echo spacing"
                value={c.echoSpacing}
                min={0.05}
                max={0.5}
                step={0.01}
                unit=" s"
                onChange={(v) => set("echoSpacing", v)}
              />
              <Range
                label="Echo opacity"
                value={c.echoOpacity * 100}
                min={10}
                max={100}
                unit="%"
                onChange={(v) => set("echoOpacity", v / 100)}
              />
              <Range
                label="Echo silhouette threshold"
                value={c.echoThreshold}
                min={0}
                max={255}
                onChange={(v) => set("echoThreshold", v)}
              />
              <Select
                label="Echo palette"
                value={c.echoPalette}
                onChange={(v) => set("echoPalette", v)}
              >
                {Object.keys(palettes).map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </Select>
              <p className="hint">
                Echoes follow the selection. Without a mask, they follow dark
                shapes.
              </p>
            </>
          )}
        </section>
      )}
    </>
  );
}
