import React from "react";

export function Icon({ name, ...props }) {
  const paths = {
    play: "M8 5l11 7-11 7V5Z",
    pause: "M8 5v14M16 5v14",
    upload: "M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5",
    download: "M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4",
    camera:
      "M4 7h4l2-3h4l2 3h4v13H4V7Zm8 3a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z",
    undo: "M8 4 3 9l5 5M3 9h10a7 7 0 0 1 7 7v3",
    redo: "M16 4l5 5-5 5m5-5h-10a7 7 0 0 0-7 7v3",
    close: "m6 6 12 12M18 6 6 18",
    sound: "m4 9 4 0 5-4v14l-5-4H4V9Zm13-2a7 7 0 0 1 0 10",
    mute: "m4 9 4 0 5-4v14l-5-4H4V9Zm13 0 5 6m0-6-5 6",
    help: "M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 3v1M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z",
    back: "M6 5v14M19 5 8 12l11 7V5Z",
    spark: "m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z",
    chevron: "m8 10 4 4 4-4",
    layers: "m3 8 9-5 9 5-9 5-9-5Zm0 5 9 5 9-5M3 18l9 5 9-5",
    trash: "M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7",
    gallery: "M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5",
    expand: "m8 9 4-4 4 4m-8 6 4-4 4 4",
    collapse: "m8 8 4 4 4-4m-8 7 4 4 4-4",
    more: "M5 12h.1M12 12h.1M19 12h.1",
    document: "M6 3h8l4 4v14H6V3Zm8 0v5h4",
    looks: "M3 4h8v8H3zM15 4h6v5h-6zM3 16h8v5H3zM15 13h6v8h-6z",
    effect: "M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6",
    color: "M12 3a9 9 0 1 0 0 18h2a2 2 0 0 0 0-4c-1 0-1-2 1-2h3a3 3 0 0 0 3-3 9 9 0 0 0-9-9ZM7 9h.1M11 6h.1M16 8h.1",
    select: "M8 3H4v5M16 3h4v5M20 16v5h-4M8 21H4v-5M8 12l3 3 5-6",
    frame: "M6 3v15h15M3 6h15v15",
    compare: "M12 3v18M9 4H4v16h5M15 4h5v16h-5",
    loop: "m17 3 4 4-4 4M21 7H7a4 4 0 0 0-4 4m4 10-4-4 4-4m-4 4h14a4 4 0 0 0 4-4",
    next: "M18 5v14M5 5l11 7-11 7V5Z",
    panel: "M3 4h18v16H3V4Zm12 0v16",
    search: "M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Zm5.5 13 5 5",
    moon: "M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z",
    system: "M3 4h18v13H3V4Zm5 17h8m-4-4v4",
    sun: "M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1 1m12 12 1 1M5 19l1-1M18 6l1-1M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z",
  };
  return (
    <svg
      {...props}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.spark} />
    </svg>
  );
}
