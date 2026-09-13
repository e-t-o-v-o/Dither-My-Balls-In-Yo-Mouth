import React from "react";
import { Icon } from "./Controls";
import { ExportReview } from "./ExportReview";

export function ExportResult({ result, current, onNotice }) {
  const share = async () => {
    try {
      const file = new File([result.blob], result.name, { type: result.blob.type });
      if (!navigator.canShare({ files: [file] })) {
        onNotice("Use Download to save this file.");
        return;
      }
      await navigator.share({ files: [file], title: result.name });
    } catch (error) {
      if (error.name !== "AbortError") onNotice("Use Download to save this file.");
    }
  };
  return (
    <div className="export-result">
      <span className="eyebrow">{current ? "READY TO SAVE" : "PREVIOUS EXPORT"}</span>
      <strong>{result.name}</strong>
      <span>{result.effectName} · {result.selection}</span>
      <span>{(result.blob.size / 1024 / 1024).toFixed(2)} MB</span>
      {!current && <p className="hint">
        Your edits or export settings have changed. Create a new export to apply them.
      </p>}
      <ExportReview result={result} />
      {result.engine === "precise" && <p className="hint">Frame-by-frame export</p>}
      {result.actualFps < result.targetFps * 0.85 && <p className="inline-error">
        This device rendered about {Math.round(result.actualFps)} fps. For smoother
        motion, lower the export resolution or increase cell size.
      </p>}
      <a className="button primary full" href={result.url} download={result.name}>
        <Icon name="download" />
        Download {current ? "" : "previous "}{result.extension.toUpperCase()}
      </a>
      {navigator.canShare && navigator.share && <button onClick={share}>Share / Save to Files</button>}
    </div>
  );
}
