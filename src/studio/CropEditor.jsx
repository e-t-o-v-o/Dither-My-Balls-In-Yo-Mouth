import React, { useEffect, useRef, useState } from "react";
import { Dialog } from "./Dialog";
import { cropToAspect } from "./framing";
import { moveCrop, resizeCrop } from "./crop-geometry";
import { drawSignal } from "./renderer";

export function CropEditor({ source, config, time, onApply, onClose }) {
  const [crop, setCrop] = useState(() => ({ cropX: config.cropX, cropY: config.cropY, cropWidth: config.cropWidth, cropHeight: config.cropHeight }));
  const [ratio, setRatio] = useState(0);
  const [ratioName, setRatioName] = useState("Free");
  const canvas = useRef(), area = useRef(), gesture = useRef();
  useEffect(() => {
    const output = canvas.current;
    const scale = Math.min(1, 960 / Math.max(source.width, source.height));
    output.width = Math.round(source.width * scale);
    output.height = Math.round(source.height * scale);
    const frame = source.kind === "demo" ? drawSignal(document.createElement("canvas"), time) : source.element;
    output.getContext("2d").drawImage(frame, 0, 0, output.width, output.height);
  }, [source, time]);
  const update = (base, corner, dx, dy) => corner === "move" ? moveCrop(base, dx, dy) : resizeCrop(base, corner, dx, dy, ratio / (source.width / source.height));
  const handlers = corner => ({
    onPointerDown: event => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      gesture.current = { x: event.clientX, y: event.clientY, crop, corner, bounds: area.current.getBoundingClientRect() };
    },
    onPointerMove: event => {
      const start = gesture.current;
      if (!start || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
      setCrop(update(start.crop, start.corner, (event.clientX - start.x) / start.bounds.width, (event.clientY - start.y) / start.bounds.height));
    },
    onPointerUp: () => { gesture.current = null; },
    onPointerCancel: () => { gesture.current = null; },
    onKeyDown: event => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      const amount = event.shiftKey ? .02 : .005;
      setCrop(update(crop, corner, event.key === "ArrowLeft" ? -amount : event.key === "ArrowRight" ? amount : 0, event.key === "ArrowUp" ? -amount : event.key === "ArrowDown" ? amount : 0));
    },
  });
  return <Dialog title="Crop image" onClose={onClose}>
    <div className="modal-body crop-editor">
      <div className="crop-stage"><div className="crop-image" ref={area} style={{ "--source-aspect": source.width / source.height, aspectRatio: `${source.width}/${source.height}` }}>
        <canvas ref={canvas} aria-label="Original frame for cropping" />
        <div className="crop-region" role="button" tabIndex={0} aria-label="Move crop, use arrow keys for precision" style={{ left: `${crop.cropX * 100}%`, top: `${crop.cropY * 100}%`, width: `${crop.cropWidth * 100}%`, height: `${crop.cropHeight * 100}%` }} {...handlers("move")}><span /><span /></div>
        {[["nw", "top left"], ["ne", "top right"], ["sw", "bottom left"], ["se", "bottom right"]].map(([corner, label]) => <button key={corner} className={`crop-handle ${corner}`} aria-label={`Resize crop ${label}`} style={{ left: `${(crop.cropX + (corner.includes("e") ? crop.cropWidth : 0)) * 100}%`, top: `${(crop.cropY + (corner.includes("s") ? crop.cropHeight : 0)) * 100}%` }} {...handlers(corner)}><span /></button>)}
      </div></div>
      <div className="segmented wrap" role="group" aria-label="Crop proportions">
        {[[0, "Free"], [source.width/source.height, "Original"], [16/9, "16:9"], [9/16, "9:16"], [1, "1:1"], [4/5, "4:5"]].map(([value, label]) => <button key={label} aria-pressed={ratioName === label} onClick={() => { setRatio(value); setRatioName(label); if (value) setCrop(cropToAspect(source, value)); }}>{label}</button>)}
      </div>
      <div className="crop-readout"><span>{Math.round(source.width * crop.cropWidth)} × {Math.round(source.height * crop.cropHeight)} source pixels</span><button className="quiet" onClick={() => { setRatio(0); setRatioName("Free"); setCrop(cropToAspect(source, 0)); }}>Reset</button></div>
      <p className="hint">Drag the image selection to move it. Drag a corner to resize. Arrow keys make fine adjustments.</p>
      <div className="crop-actions"><button onClick={onClose}>Cancel</button><button className="primary" onClick={() => onApply(crop)}>Apply crop</button></div>
    </div>
  </Dialog>;
}
