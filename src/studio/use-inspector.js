import { useLayoutEffect, useRef, useState } from "react";

export const isBrowsing = tab => ["presets", "artistic"].includes(tab);
const activity = tab => isBrowsing(tab) ? "browse" : "adjust";

// View preferences stay out of project data and undo history.
export function useInspector({ tray, setTray, layerKey, lookSection }) {
  const [tab, setTab] = useState("effects");
  const remembered = useRef({
    browse: { tab: "artistic", tray: "detail" },
    adjust: { tab: "effects", tray: "edit" },
  });
  const scrollRef = useRef();
  const offsets = useRef(new Map());
  const focusOnReturn = useRef(false);
  const panelKey = ["effects", "color", "motion"].includes(tab)
    ? `${tab}:${layerKey}` : tab === "presets" ? `${tab}:${lookSection}` : tab;
  useLayoutEffect(() => {
    if (tray === "canvas") return;
    remembered.current[activity(tab)] = { tab, tray };
    if (scrollRef.current) scrollRef.current.scrollTop = offsets.current.get(panelKey) || 0;
    if (focusOnReturn.current) {
      document.getElementById(`tab-${tab}`)?.focus({ preventScroll: true });
      focusOnReturn.current = false;
    }
  }, [tab, tray, panelKey]);
  const onScroll = () => {
    const element = scrollRef.current;
    if (!element || tray === "canvas" || element.querySelector("dialog[open]")) return;
    offsets.current.delete(panelKey);
    offsets.current.set(panelKey, element.scrollTop);
    // Removed layers need no permanent view history.
    if (offsets.current.size > 64) offsets.current.delete(offsets.current.keys().next().value);
  };
  const restoreControls = (focus = false) => {
    focusOnReturn.current = focus;
    setTray(remembered.current[activity(tab)].tray);
  };
  return {
    tab, scrollRef, onScroll,
    selectTab(next, focus = false) {
      focusOnReturn.current = focus;
      setTab(next);
      if (tray === "canvas" || activity(next) !== activity(tab)) setTray(remembered.current[activity(next)].tray);
    },
    openActivity(kind) {
      const destination = remembered.current[kind];
      setTab(destination.tab);
      setTray(destination.tray);
    },
    toggleCanvas() { if (tray === "canvas") restoreControls(); else setTray("canvas"); },
    restoreControls,
  };
}
