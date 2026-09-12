import React from "react";

const types = [
  ["mp4", "MP4", "Widely compatible video"],
  ["webm", "WebM", "Video for the web"],
  ["auto", "Auto", "Chooses MP4 or WebM"],
  ["gif", "GIF", "Looping animation"],
  ["png", "PNG", "Current frame image"],
  ["svg", "SVG", "Current frame vector"],
];

export function ExportFormat({ value, onChange, kind, formats }) {
  return (
    <fieldset className="export-types">
      <legend>File type</legend>
      <div className="export-type-grid">
        {types.filter(([id]) => kind === "image"
          ? ["png", "svg"].includes(id)
          : kind !== "camera" || id !== "gif").map(([id, label, description]) => {
          const unavailable = ["mp4", "webm"].includes(id) && !formats.some(f => f.id === id);
          return (
            <label className="export-type" key={id}>
              <input type="radio" name="export-file-type" aria-label={label}
                value={id} checked={value === id} disabled={unavailable}
                onChange={() => onChange(id)} />
              <strong>{label}</strong>
              <span>{unavailable ? "Unavailable in this browser" : description}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
