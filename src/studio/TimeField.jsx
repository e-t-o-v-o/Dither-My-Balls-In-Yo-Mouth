import React, { useEffect, useId, useRef, useState } from "react";
export function TimeField({ label, caption, value, min, max, onCommit }) {
  const id = useId();
  const dirty = useRef(false);
  const [draft, setDraft] = useState(String(Number(value.toFixed(3))));
  useEffect(() => setDraft(String(Number(value.toFixed(3)))), [value]);
  return <label className="control time-field" htmlFor={id}>{caption || label}
    <span><input id={id} aria-label={label} type="number" min={min} max={max} step="0.001" inputMode="decimal" value={draft}
      onFocus={() => { dirty.current = false; }}
      onChange={e => { dirty.current = true; setDraft(e.target.value); }}
      onBlur={() => {
        const next = draft.trim() && Number.isFinite(Number(draft)) ? Math.max(min, Math.min(max, Number(draft))) : value;
        if (dirty.current) onCommit(next);
        dirty.current = false;
        setDraft(String(Number(next.toFixed(3))));
      }}
      onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); if (e.key === "Escape") { e.stopPropagation(); dirty.current = false; setDraft(String(Number(value.toFixed(3)))); } }} /> <span>s</span></span>
  </label>;
}
