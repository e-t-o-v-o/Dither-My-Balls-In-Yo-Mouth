import React, { useContext, useEffect, useRef, useState } from "react";
import { AdjustmentContext } from "./Controls";
import { createVideoElement, loadVideo, seek, releaseSource } from "./media";
import { drawSignal } from "./renderer";
export function Filmstrip({ source, trim, changeTrim, disabled, interactive = true }) {
  const adjustment = useContext(AdjustmentContext);
  const [activeHandle, setActiveHandle] = useState(0);
  const [width, setWidth] = useState(0);
  const [images, setImages] = useState([]),
    track = useRef();
  useEffect(() => {
    if (!interactive || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(track.current);
    return () => observer.disconnect();
  }, [interactive]);
  const overlap = interactive && width > 0 && width * (trim[1] - trim[0]) / source.duration < 44;
  useEffect(() => {
    const controller = new AbortController();
    let video;
    setImages([]);
    const timer = setTimeout(async () => {
      try {
        if (source.kind === "video") {
          video = createVideoElement();
          await loadVideo(video, source.url, controller.signal);
        }
        const canvas = document.createElement("canvas"),
          signal = document.createElement("canvas");
        canvas.width = 160;
        canvas.height = 90;
        const next = [];
        for (let i = 0; i < 8; i++) {
          if (controller.signal.aborted) return;
          const at = (source.duration * i) / 8;
          if (video) await seek(video, at, controller.signal);
          const image = video || drawSignal(signal, at),
            ctx = canvas.getContext("2d");
          ctx.drawImage(image, 0, 0, 160, 90);
          next.push(canvas.toDataURL("image/jpeg", 0.65));
        }
        if (!controller.signal.aborted) setImages(next);
      } catch {
      } finally {
        if (video) releaseSource({ element: video });
        video = null;
      }
    }, 600);
    return () => {
      clearTimeout(timer);
      controller.abort();
      if (video) releaseSource({ element: video });
    };
  }, [source]);
  const drag = (event, index) => {
    const bounds = track.current.getBoundingClientRect();
    changeTrim(
      index,
      Math.max(
        0,
        Math.min(
          source.duration,
          ((event.clientX - bounds.left) / bounds.width) * source.duration,
        ),
      ),
    );
  };
  return (
    <>
    <div className={`filmstrip ${interactive ? "interactive" : ""}`} ref={track}>
      <div className="filmstrip-images" aria-hidden="true">
        {images.map((src, i) => (
          <img key={i} src={src} alt="" />
        ))}
      </div>
      <div
        className="trim-window"
        style={{
          left: `${(trim[0] / source.duration) * 100}%`,
          right: `${(1 - trim[1] / source.duration) * 100}%`,
        }}
      />
      {(interactive ? overlap ? [activeHandle] : [0, 1] : []).map((index) => (
        <button
          key={index}
          className={`trim-handle ${index ? "out" : "in"}`}
          role="slider"
          aria-label={index ? "Trim out handle" : "Trim in handle"}
          aria-valuemin={index ? trim[0] + 0.05 : 0}
          aria-valuemax={index ? source.duration : trim[1] - 0.05}
          aria-valuenow={trim[index]}
          aria-valuetext={`${trim[index].toFixed(2)} seconds`}
          disabled={disabled}
          style={{ left: `${(trim[index] / source.duration) * 100}%` }}
          onPointerDown={(event) => {
            adjustment.begin();
            event.currentTarget.setPointerCapture(event.pointerId);
            drag(event, index);
          }}
          onPointerUp={() => adjustment.end()}
          onPointerCancel={() => adjustment.end()}
          onLostPointerCapture={() => adjustment.end()}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              drag(event, index);
          }}
          onKeyDown={(event) => {
            if (
              ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
            ) {
              event.preventDefault();
              if (!event.repeat) adjustment.begin();
              changeTrim(
                index,
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? source.duration
                    : trim[index] +
                      (event.key === "ArrowRight" ? 1 : -1) *
                        (event.shiftKey ? 1 : 0.1),
              );
            }
          }}
          onKeyUp={() => adjustment.end()}
          onBlur={() => adjustment.end()}
        >
          <span />
        </button>
      ))}
    </div>
    {overlap && <div className="handle-choice"><span>Adjust short selection</span><div className="segmented" role="group" aria-label="Trim handle">{[0, 1].map(index => <button key={index} aria-pressed={activeHandle === index} onClick={() => setActiveHandle(index)}>{index ? "Out" : "In"}</button>)}</div></div>}
    </>
  );
}
