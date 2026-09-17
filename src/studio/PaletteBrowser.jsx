import React, { useId, useState } from "react";
import { paletteCatalog, paletteGroups, palettes } from "./palettes";
import { SearchField } from "./SearchField";

export function PaletteBrowser({ value, onChange, label = "Palette" }) {
  const id = useId(), [query, setQuery] = useState("");
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matches = paletteCatalog.filter(item => terms.every(term => `${item.name} ${item.note} ${item.group} ${item.colors.join(" ")}`.toLocaleLowerCase().includes(term)));
  const current = paletteCatalog.find(item => item.name === value);
  return <div className="palette-browser">
    <div className="palette-current">
      <div><strong>{value}</strong><span>{palettes[value].length} colors</span></div>
      <div className="large-swatches" aria-label={`${value} colors`}>
        {palettes[value].map(color => <span key={color} style={{ background: color }} title={color} />)}
      </div>
      <p>{current?.note}</p>
    </div>
    <div className="palette-search">
      <label htmlFor={`${id}-search`} className="sr-only">Search {label.toLowerCase()}s</label>
      <SearchField id={`${id}-search`} value={query} onChange={setQuery} placeholder="Find colors or a palette…" clearLabel="Clear" />
    </div>
    <div className="palette-count" role="status">{matches.length} {matches.length === 1 ? "palette" : "palettes"}{query && ` matching “${query}”`}</div>
    <fieldset className="palette-collection" aria-label={label}>
      {paletteGroups.map(group => {
        const items = matches.filter(item => item.group === group.name);
        return items.length > 0 && <div className="palette-group" key={group.name}>
          <h3>{group.name}</h3>
          <div className="palette-grid">
            {items.map(item => <label key={item.name} className="palette-option" data-selected={value === item.name} title={item.note}>
              <input className="sr-only" type="radio" name={id} value={item.name} aria-label={item.name} checked={value === item.name} onChange={() => onChange(item.name)} />
              <span className="swatches" aria-hidden="true">{item.colors.map(color => <i key={color} style={{ background: color }} title={color} />)}</span>
              <span className="palette-caption"><span>{item.name}</span><small>{item.colors.length}</small></span>
            </label>)}
          </div>
        </div>;
      })}
      {!matches.length && <p className="palette-empty">No matching palettes. Try a color such as blue, rose, or ochre.</p>}
    </fieldset>
  </div>;
}
