import React, { useRef } from "react";
import { Icon } from "./Icon";

export function SearchField({ id, value, onChange, placeholder, disabled = false, clearLabel = "Clear search" }) {
  const input = useRef();
  return <span className="search-field">
    <Icon name="search" />
    <input ref={input} id={id} type="search" value={value} placeholder={placeholder} disabled={disabled}
      onChange={event => onChange(event.target.value)}
      onKeyDown={event => {
        if (event.key === "Escape" && value) { onChange(""); event.stopPropagation(); }
      }} />
    {value && <button type="button" aria-label={clearLabel} disabled={disabled}
      onClick={() => { onChange(""); input.current?.focus(); }}><Icon name="close" /></button>}
  </span>;
}
