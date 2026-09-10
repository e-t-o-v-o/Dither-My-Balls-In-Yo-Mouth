import { useLayoutEffect, useRef } from "react";

// View navigation only: zoom and pan never invalidate the media renderer.
export function useCanvasGestures({ zoom, setZoom, previewWidth, selectionTool }) {
  const viewerRef = useRef();
  const navigation = useRef({ active: false, cancelSelection: null });
  const pointers = useRef(new Map());
  const gesture = useRef(null), anchor = useRef(null);
  const rememberAnchor = (x, y) => {
    const viewer = viewerRef.current, image = viewer?.querySelector(".canvas-wrap");
    if (!image) return;
    const bounds = image.getBoundingClientRect(), viewport = viewer.getBoundingClientRect();
    anchor.current = { x: (x - bounds.left) / bounds.width, y: (y - bounds.top) / bounds.height, screenX: x - viewport.left, screenY: y - viewport.top };
  };
  useLayoutEffect(() => {
    const point = anchor.current, viewer = viewerRef.current;
    if (!point || !viewer || zoom === "fit") return;
    const image = viewer.querySelector(".canvas-wrap"), padding = parseFloat(getComputedStyle(viewer).paddingLeft) || 0;
    viewer.scrollLeft = padding + point.x * image.offsetWidth - point.screenX;
    viewer.scrollTop = padding + point.y * image.offsetHeight - point.screenY;
    anchor.current = null;
  }, [zoom, previewWidth]);
  const changeZoom = value => {
    const viewer = viewerRef.current;
    if (viewer) {
      const bounds = viewer.getBoundingClientRect();
      rememberAnchor(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
    }
    setZoom(value);
  };
  const end = event => {
    pointers.current.delete(event.pointerId);
    if (!pointers.current.size) { navigation.current.active = false; gesture.current = null; }
  };
  const events = {
    onPointerDownCapture: event => {
      if (event.button !== 0 || event.target.closest("button,select,input")) return;
      const viewer = viewerRef.current;
      viewer.setPointerCapture(event.pointerId);
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        navigation.current.active = true;
        navigation.current.cancelSelection?.();
        const image = viewer.querySelector(".canvas-wrap");
        gesture.current = { distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), centerX: (a.x + b.x) / 2, centerY: (a.y + b.y) / 2, zoom: image.getBoundingClientRect().width / previewWidth * 100 };
        viewer.setPointerCapture(event.pointerId);
      } else if (selectionTool === "none" && zoom !== "fit") {
        gesture.current = { x: event.clientX, y: event.clientY, left: viewer.scrollLeft, top: viewer.scrollTop };
        viewer.setPointerCapture(event.pointerId);
      }
    },
    onPointerMoveCapture: event => {
      if (!pointers.current.has(event.pointerId)) return;
      pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const viewer = viewerRef.current, start = gesture.current;
      if (!start) return;
      if (pointers.current.size >= 2 && start.distance) {
        const [a, b] = [...pointers.current.values()];
        rememberAnchor((a.x + b.x) / 2, (a.y + b.y) / 2);
        const next = Math.max(5, Math.min(400, start.zoom * Math.hypot(a.x - b.x, a.y - b.y) / start.distance));
        if (Math.round(next) === Number(zoom)) {
          viewer.scrollLeft -= (a.x + b.x) / 2 - start.centerX;
          viewer.scrollTop -= (a.y + b.y) / 2 - start.centerY;
          anchor.current = null;
        } else setZoom(String(Math.round(next)));
        start.centerX = (a.x + b.x) / 2;
        start.centerY = (a.y + b.y) / 2;
      } else if (!navigation.current.active && selectionTool === "none" && start.x !== undefined) {
        viewer.scrollLeft = start.left - (event.clientX - start.x);
        viewer.scrollTop = start.top - (event.clientY - start.y);
      }
    },
    onPointerUp: end,
    onPointerCancel: end,
  };
  return { viewerRef, navigation, events, changeZoom };
}
