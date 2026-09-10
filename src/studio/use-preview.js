import { useEffect, useRef, useState } from "react";
import { EchoSampler } from "./echo-sampler";
import { RenderService } from "./render-service";
import { makeCanvas } from "./canvas";
import { drawSignal } from "./renderer";
import { drawSource, frameDimensions } from "./framing";

export function usePreview(options) {
  const latest = useRef(options),
    dirty = useRef(true),
    version = useRef(0),
    changed = useRef(0);
  const [stats, setStats] = useState({
    fps: 0,
    width: 960,
    longEdge: 960,
    backend: "worker",
  });
  latest.current = options;
  useEffect(() => {
    dirty.current = true;
    version.current++;
    changed.current = performance.now();
    options.rendererRef.current?.invalidate();
  }, [
    options.config,
    options.source,
    options.revision,
    options.previewSize,
    options.compare,
    options.showMask,
    options.pickSource,
  ]);
  useEffect(() => {
    const service = new RenderService(),
      stage = makeCanvas(),
      signalCanvas = makeCanvas();
    latest.current.rendererRef.current = service;
    let raf,
      active = true,
      pending = false,
      last = -Infinity,
      previousPlaying = false;
    let clock = 0,
      startTime = 0,
      measured = performance.now(),
      count = 0;
    let autoSize = 960,
      average = 25,
      slow = 0,
      good = 0,
      refined = false;
    let lastSource,
      lastTime = -1,
      uiTime = 0,
      echoes;
    const tick = async (now) => {
      if (!active) return;
      raf = requestAnimationFrame(tick);
      const o = latest.current;
      if (o.busy || pending || !o.canvasRef.current) return;
      if (o.source !== lastSource) {
        echoes?.dispose();
        echoes = new EchoSampler(o.source);
        lastSource = o.source;
        lastTime = -1;
        dirty.current = true;
      }
      if (o.playing && !previousPlaying) {
        clock = now;
        startTime = o.timeRef.current;
      }
      previousPlaying = o.playing;
      let t = o.timeRef.current;
      if (o.source.kind === "video") t = o.source.element.currentTime;
      else if (o.source.kind === "camera") t = now / 1000;
      else if (o.source.kind === "demo" && o.playing)
        t = startTime + (now - clock) / 1000;
      if (
        o.playing &&
        o.source.kind !== "camera" &&
        t >= o.trimRef.current[1]
      ) {
        if (o.loop) {
          t = o.trimRef.current[0];
          startTime = t;
          clock = now;
          if (o.source.kind === "video") o.source.element.currentTime = t;
          service.invalidate();
          dirty.current = true;
        } else {
          o.source.element?.pause?.();
          o.setPlaying(false);
          t = o.trimRef.current[1];
        }
      }
      if (o.source.kind !== "camera") o.timeRef.current = t;
      if (now - uiTime > 100) {
        o.setTime(o.source.kind === "camera" ? 0 : t);
        uiTime = now;
      }
      const moving = o.playing || o.source.kind === "camera";
      const editing = now - changed.current < 220;
      const needsRefine = !moving && !editing && !refined;
      if (
        !dirty.current &&
        !needsRefine &&
        (!moving ||
          now - last < 32 ||
          (o.source.kind === "video" && t === lastTime))
      )
        return;
      if (
        o.source.element &&
        ["video", "camera"].includes(o.source.kind) &&
        o.source.element.readyState < 2
      )
        return;
      const target =
        o.previewSize === "auto"
          ? !moving && !editing
            ? 1280
            : editing
              ? Math.min(640, autoSize)
              : autoSize
          : Number(o.previewSize);
      const size = frameDimensions(o.source, o.config, target);
      const frame =
        o.source.kind === "demo"
          ? drawSignal(signalCanvas, t)
          : o.source.element;
      const generation = version.current;
      pending = true;
      last = now;
      lastTime = t;
      dirty.current = false;
      refined = !editing;
      try {
        const original = o.originalRef.current;
        if (original) {
          original.width = size.width;
          original.height = size.height;
          const ctx = original.getContext("2d");
          ctx.clearRect(0, 0, size.width, size.height);
          drawSource(frame, ctx, o.config, size.width, size.height);
        }
        const echoFrames = await echoes.frames(t, o.config);
        const rendered = await service.render(
          frame,
          stage,
          { ...o.config, maskPreview: o.showMask, sourcePreview: o.pickSource },
          size.width,
          size.height,
          {
            time: t,
            echoFrames,
            font: o.fontFaces.current[o.config.font]?.worker,
          },
        );
        if (!active) return;
        if (generation === version.current) {
          const canvas = o.canvasRef.current;
          canvas.width = size.width;
          canvas.height = size.height;
          canvas.getContext("2d").drawImage(stage, 0, 0);
          const exportPreview = latest.current.exportPreviewRef?.current;
          if (exportPreview && !o.showMask && !o.pickSource) {
            const scale = Math.min(1, 640 / Math.max(size.width, size.height));
            exportPreview.width = Math.round(size.width * scale);
            exportPreview.height = Math.round(size.height * scale);
            exportPreview.getContext("2d").drawImage(stage, 0, 0, exportPreview.width, exportPreview.height);
          }
        } else dirty.current = true;
        average = average * 0.75 + rendered.elapsed * 0.25;
        if (moving && o.previewSize === "auto") {
          slow = average > 38 ? slow + 1 : 0;
          good = average < 18 ? good + 1 : 0;
          const sizes = [320, 480, 640, 960],
            index = sizes.indexOf(autoSize);
          if (slow >= 4 && index > 0) {
            autoSize = sizes[index - 1];
            slow = 0;
            service.invalidate();
          }
          if (good >= 90 && index < sizes.length - 1) {
            autoSize = sizes[index + 1];
            good = 0;
            service.invalidate();
          }
        }
        count++;
        if (now - measured >= 1000 || !moving) {
          setStats({
            fps: moving
              ? Math.round((count * 1000) / Math.max(1, now - measured))
              : 0,
            width: size.width,
            longEdge: Math.max(size.width, size.height),
            backend: rendered.backend,
          });
          measured = now;
          count = 0;
        }
      } catch (error) {
        if (active && error.name !== "AbortError") {
          o.setPlaying(false);
          o.alert(`Preview could not render: ${error.message}`, true);
        }
      } finally {
        pending = false;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      active = false;
      cancelAnimationFrame(raf);
      service.dispose();
      echoes?.dispose();
    };
  }, []);
  return stats;
}
