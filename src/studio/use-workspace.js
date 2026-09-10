import { useEffect, useState } from "react";
import { readStorage, writeStorage } from "./model";

const layoutQuery = "(max-width: 1049px) and (min-height: 601px), (max-width: 699px) and (min-height: 501px), (max-width: 599px)";
const boundWidth = value => Math.max(300, Math.min(420, Number(value) || 340));
export function useWorkspace() {
  const [tray, setTray] = useState("edit");
  const [compact, setCompact] = useState(() => window.matchMedia?.(layoutQuery).matches ?? false);
  const [panelWidth, setPanelWidth] = useState(() => boundWidth(readStorage("dither.panel-width.v1", 340)));
  useEffect(() => {
    const query = window.matchMedia?.(layoutQuery);
    const update = () => setCompact(query?.matches ?? false);
    query?.addEventListener("change", update);
    const viewport = window.visualViewport;
    const resize = () => {
      if (!viewport || viewport.scale === 1)
        document.documentElement.style.setProperty("--app-height", `${viewport?.height || window.innerHeight}px`);
    };
    resize();
    viewport?.addEventListener("resize", resize);
    window.addEventListener("resize", resize);
    return () => {
      query?.removeEventListener("change", update);
      viewport?.removeEventListener("resize", resize);
      window.removeEventListener("resize", resize);
      document.documentElement.style.removeProperty("--app-height");
    };
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => writeStorage("dither.panel-width.v1", panelWidth), 180);
    return () => clearTimeout(timer);
  }, [panelWidth]);
  const resizePanel = {
    onPointerDown: event => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); },
    onPointerMove: event => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) setPanelWidth(boundWidth(window.innerWidth - event.clientX));
    },
    onKeyDown: event => {
      if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        setPanelWidth(event.key === "Home" ? 300 : event.key === "End" ? 420 : boundWidth(panelWidth + (event.key === "ArrowLeft" ? 10 : -10)));
      }
    },
    onDoubleClick: () => setPanelWidth(340),
  };
  return { tray, setTray, compact, panelWidth, resizePanel };
}
