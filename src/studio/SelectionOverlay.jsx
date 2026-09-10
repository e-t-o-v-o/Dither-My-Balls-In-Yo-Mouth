import React, { useEffect, useRef } from "react";
export function SelectionOverlay({
  tool,
  navigation,
  config,
  setConfig,
  radius,
  onPick,
  onFinish,
}) {
  const canvasRef = useRef(),
    path = useRef(null);
  const clear = () => {
    path.current = null;
    const canvas = canvasRef.current;
    canvas?.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  };
  useEffect(() => {
    if (!navigation) return;
    navigation.current.cancelSelection = clear;
    return () => { navigation.current.cancelSelection = null; };
  }, [navigation]);
  const point = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return [
      Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
    ];
  };
  const draw = () => {
    const canvas = canvasRef.current,
      bounds = canvas.getBoundingClientRect();
    canvas.width = Math.round(bounds.width * devicePixelRatio);
    canvas.height = Math.round(bounds.height * devicePixelRatio);
    const ctx = canvas.getContext("2d"),
      points = path.current;
    ctx.strokeStyle = "#ff716e";
    ctx.fillStyle = "#ff716e44";
    ctx.lineJoin = ctx.lineCap = "round";
    ctx.lineWidth =
      tool === "lasso"
        ? 2 * devicePixelRatio
        : radius *
          Math.min(
            canvas.width / config.cropWidth,
            canvas.height / config.cropHeight,
          ) *
          2;
    ctx.beginPath();
    points.forEach(([x, y], i) =>
      i
        ? ctx.lineTo(x * canvas.width, y * canvas.height)
        : ctx.moveTo(x * canvas.width, y * canvas.height),
    );
    if (tool === "lasso") {
      ctx.closePath();
      ctx.fill();
    }
    ctx.stroke();
  };
  return (
    <canvas
      ref={canvasRef}
      className={`selection-overlay tool-${tool}`}
      aria-label={
        tool === "pick" ? "Pick a source color" : "Draw selection on preview"
      }
      onPointerDown={(event) => {
        if (event.button !== 0 || navigation?.current.active) return;
        const p = point(event);
        if (tool === "pick") {
          onPick(p);
          return;
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        path.current = [p];
        draw();
      }}
      onPointerMove={(event) => {
        if (navigation?.current.active) { clear(); return; }
        if (!path.current) return;
        const p = point(event),
          last = path.current.at(-1);
        if (Math.hypot(p[0] - last[0], p[1] - last[1]) < 0.002) return;
        if (path.current.length < 2048) path.current.push(p);
        draw();
      }}
      onPointerUp={(event) => {
        if (navigation?.current.active) { clear(); return; }
        if (!path.current) return;
        const points = path.current.map(([x, y]) => [
          config.cropX + x * config.cropWidth,
          config.cropY + y * config.cropHeight,
        ]);
        if (tool !== "lasso" || points.length >= 3)
          setConfig({
            ...config,
            maskMode: config.maskMode === "none" ? "manual" : config.maskMode,
            maskStrokes: [
              ...config.maskStrokes,
              {
                tool: tool === "lasso" ? "lasso" : "brush",
                mode: tool === "erase" ? "subtract" : "add",
                radius,
                points,
              },
            ].slice(-100),
          });
        path.current = null;
        event.currentTarget
          .getContext("2d")
          .clearRect(
            0,
            0,
            event.currentTarget.width,
            event.currentTarget.height,
          );
        onFinish();
      }}
      onPointerCancel={() => {
        path.current = null;
        const c = canvasRef.current;
        c.getContext("2d").clearRect(0, 0, c.width, c.height);
      }}
    />
  );
}
