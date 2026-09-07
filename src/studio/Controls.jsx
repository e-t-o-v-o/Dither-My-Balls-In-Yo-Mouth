import React, { useId, useState, useEffect } from "react";
import {
  effects,
  methods,
  palettes,
  fonts,
  asciiVariants,
  usesPalette,
} from "./model";
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
  return (
    <div className="control">
      <div className="control-label">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>
          {Number(value)
            .toFixed(step < 1 ? 2 : 0)
            .replace(/\.00$/, "")}
          {unit}
        </output>
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
function ColorInput({ label, value, onChange }) {
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
        <span className="mono">{value.toUpperCase()}</span>
      </span>
    </label>
  );
}
export function MaskControls({ config: c, set }) {
  return (
    <>
      <section className="inspector-section">
        <div className="section-heading">
          <h2>Selection mask</h2>
          <span>{c.maskMode === "none" ? "OFF" : "ON"}</span>
        </div>
        <p className="hint">
          Choose the colors or tones that receive the effect. Transparent areas
          in your source always stay excluded.
        </p>
        <Select
          label="Select by"
          value={c.maskMode}
          onChange={(v) => set("maskMode", v)}
        >
          <option value="none">Whole image</option>
          <option value="luminance">Brightness range</option>
          <option value="color">Color range</option>
        </Select>
        {c.maskMode !== "none" && (
          <>
            {c.maskMode === "luminance" ? (
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
            ) : (
              <>
                <ColorInput
                  label="Selected color"
                  value={c.maskColor}
                  onChange={(v) => set("maskColor", v)}
                />
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
            <Range
              label="Edge softness"
              value={c.maskSoftness * 100}
              min={0}
              max={30}
              unit="%"
              onChange={(v) => set("maskSoftness", v / 100)}
            />
            <Check
              label="Invert selection"
              value={c.maskInvert}
              onChange={(v) => set("maskInvert", v)}
            />
            <Check
              label="Keep original behind effect"
              description="Off isolates the selection on your background color or transparency."
              value={c.maskBackdrop}
              onChange={(v) => set("maskBackdrop", v)}
            />
            <button className="full" onClick={() => set("maskMode", "none")}>
              Clear mask
            </button>
          </>
        )}
      </section>
      <section className="inspector-section">
        <h2>Working with cutouts</h2>
        <p className="hint">
          A transparent PNG gives you an exact silhouette. For video, color and
          brightness masks follow each frame. These are color selections, not
          automatic person detection.
        </p>
        <p className="hint">
          Try Dot mosaic or Letterpress with an isolated selection. Contour
          beads can trace its transparency edge.
        </p>
      </section>
    </>
  );
}
export function EffectControls({ config: c, set, customFonts, onFontUpload }) {
  const graphicEffects = [
    "beads",
    "mosaic",
    "symbols",
    "halftone",
    "crosshatch",
    "edge",
  ];
  const [family, setFamily] = useState(null);
  useEffect(() => setFamily(null), [c.effect]);
  const activeFamily =
    family || (graphicEffects.includes(c.effect) ? "Graphic" : "Digital");
  const text =
    ["ascii", "dither-ascii"].includes(c.effect) ||
    (["palette", "two-tone"].includes(c.effect) && c.overlay !== "none");
  return (
    <>
      <section className="inspector-section">
        <div className="section-heading">
          <h2>Effect</h2>
          <span>01</span>
        </div>
        <div
          className="effect-families"
          role="group"
          aria-label="Effect families"
        >
          {["Graphic", "Digital"].map((name) => (
            <button
              key={name}
              aria-pressed={activeFamily === name}
              onClick={() => setFamily(name)}
            >
              {name}
              <span>{name === "Graphic" ? "06" : "07"}</span>
            </button>
          ))}
        </div>
        <div className="effect-grid">
          {effects
            .filter(
              ([id]) =>
                graphicEffects.includes(id) === (activeFamily === "Graphic"),
            )
            .map(([id, name, n, description]) => (
              <button
                key={id}
                aria-label={name}
                title={description}
                className={c.effect === id ? "effect selected" : "effect"}
                aria-pressed={c.effect === id}
                onClick={() => set("effect", id)}
              >
                <span className={`effect-art art-${id}`} aria-hidden="true">
                  {id.includes("ascii") ? "Aa" : id === "channel" ? "RGB" : ""}
                </span>
                <span className="effect-name">{name}</span>
              </button>
            ))}
        </div>
        <p className="effect-description">
          {effects.find(([id]) => id === c.effect)?.[3]}
        </p>
      </section>
      <section className="inspector-section">
        <div className="section-heading">
          <h2>Texture</h2>
          <span>02</span>
        </div>
        {usesPalette(c) && (
          <Select
            label="Effect palette"
            value={c.palette}
            onChange={(v) => set("palette", v)}
          >
            {Object.keys(palettes).map((p) => (
              <option key={p}>{p}</option>
            ))}
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
        <Range
          label="Cell size"
          value={c.cellSize}
          min={c.effect === "beads" ? 6 : 2}
          max={80}
          onChange={(v) => set("cellSize", v)}
        />
        <p className="hint">
          Smaller cells preserve more detail. The pattern scales with your
          export.
        </p>
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
    </>
  );
}
export function ColorControls({ config: c, set }) {
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
          {["fgColor", "bgColor"].map((k, i) => (
            <label key={k}>
              <span>{i ? "Background" : "Foreground"}</span>
              <span className="color-input">
                <input
                  aria-label={i ? "Background color" : "Foreground color"}
                  type="color"
                  value={c[k]}
                  onChange={(e) => set(k, e.target.value)}
                />
                <span className="mono">{c[k].toUpperCase()}</span>
              </span>
            </label>
          ))}
        </div>
        <Check
          label="Transparent background"
          description="Preserved in PNG and SVG. Videos and GIF use the background color."
          value={c.transparent}
          onChange={(v) => set("transparent", v)}
        />
      </section>
      <section className="inspector-section">
        <div className="section-heading">
          <h2>Motion & keying</h2>
        </div>
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
          100% follows each frame. Lower values leave a soft motion trail.
        </p>
        <Check
          label="Remove green"
          value={c.removeGreen}
          onChange={(v) => set("removeGreen", v)}
        />
        {(c.removeGreen || c.effect === "green-screen") && (
          <Range
            label="Green separation"
            value={c.greenTolerance}
            min={1.05}
            max={2}
            step={0.05}
            onChange={(v) => set("greenTolerance", v)}
          />
        )}
      </section>
    </>
  );
}
