// Animate continuous controls only: changing seeds, grid topology, or crop size
// between frames would create jumps or change the encoder's frame dimensions.
export const motionControls = {
  reliefDepth: ["Relief height", 0, 4, .01, ["relief"]],
  reliefSlant: ["Relief slant", -1, 1, .01, ["relief"]],
  reliefShade: ["Relief shading", 0, 1, .01, ["relief"]],
  harmonicWarp: ["Harmonic flow", 0, 1, .01, ["harmonics"]],
  harmonicWeight: ["Harmonic ink weight", .3, 1.5, .01, ["harmonics"]],
  harmonicPhase: ["Harmonic phase", 0, 1, .01, ["harmonics"]],
  harmonicAccent: ["Harmonic second ink", 0, 1, .01, ["harmonics"]],
  tileDetail: ["Tile detail", 0, 1, .01, ["adaptive-tiles"]],
  tileGap: ["Tile spacing", 0, .3, .01, ["adaptive-tiles"]],
  effectMix: ["Effect blend", 0, 1, 0.01],
  brightness: ["Brightness", -100, 100, 1],
  contrast: ["Contrast", 0.2, 3, 0.01],
  saturation: ["Saturation", 0, 2, 0.01],
  grain: ["Grain", 0, 0.3, 0.01],
  signalWarp: ["Trail sweep", 0, 1, .01, ["signal-paths"]],
  signalAngle: ["Trail angle", -60, 60, 1, ["signal-paths"]],
  schematicWeight: ["Drafting weight", .4, 2, .01, ["schematic"]],
  opticalInterference: ["Second ink", 0, 1, .01, ["optical-press"]],
  opticalWeight: ["Optical ink weight", .1, 1, .01, ["optical-press"]],
  opticalBend: ["Optical ripple", 0, 1, .01, ["optical-press"]],
  opticalCenterX: ["Optical center X", 0, 1, .01, ["optical-press"]],
  opticalCenterY: ["Optical center Y", 0, 1, .01, ["optical-press"]],
  opticalPhase: ["Optical phase", 0, 1, .01, ["optical-press"]],
  marbleSwirl: ["Ink swirl", 0, 1, 0.01, ["marbling"]],
  marbleWeight: ["Ink weight", 0.1, 1, 0.01, ["marbling"]],
  topoContour: ["Contour weight", 0.04, 0.6, 0.01, ["topography"]],
  stitchLength: ["Stitch length", 0.3, 1, 0.01, ["threadwork"]],
  stitchWidth: ["Thread weight", 0.15, 1, 0.01, ["threadwork"]],
  stitchFollow: ["Follow edges", 0, 1, 0.01, ["threadwork"]],
  engraveWarp: ["Wave flow", 0, 1, 0.01, ["guilloche"]],
  engraveWeight: ["Line weight", 0.1, 1, 0.01, ["guilloche"]],
  paperFill: ["Paper coverage", 0.35, 1, 0.01, ["cut-paper"]],
  glassGap: ["Glass seams", 0, 0.2, 0.01, ["glass"]],
  arcWeight: ["Ribbon weight", 0.1, 1, 0.01, ["arc-tiles"]],
  weaveWidth: ["Band width", 0.2, 0.8, 0.01, ["interlace"]],
  inkSpread: ["Ink spread", 0.5, 1.5, 0.01, ["screenprint"]],
  registration: ["Registration", 0, 12, 0.1, ["screenprint"]],
  dotScale: ["Dot size", 0.25, 1, 0.01, ["halftone", "mosaic"]],
  beadSize: ["Bead size", 0.25, 1.5, 0.01, ["beads"]],
  fontScale: ["Letter size", 0.4, 2, 0.01, ["ascii", "dither-ascii", "contour-type"]],
  accentAmount: ["Accent amount", 0, 1, 0.01, ["symbols"]],
};
export const availableMotionControls = (effect, config = {}) => Object.entries(motionControls)
  .filter(([key, spec]) => (!spec[4] || spec[4].includes(effect))
    && !(effect === "relief" && config.reliefStyle === "wire" && key === "reliefShade")
    && !(effect === "optical-press" && config.opticalPattern === "waves" && ["opticalCenterX", "opticalCenterY"].includes(key)));
export function sanitizeMotion(input) {
  const tracks = {};
  for (const [key, spec] of Object.entries(motionControls)) {
    const pair = input?.tracks?.[key];
    if (Array.isArray(pair) && pair.length === 2 && pair.every(Number.isFinite))
      tracks[key] = pair.map(v => Math.max(spec[1], Math.min(spec[2], v)));
  }
  return { enabled: input?.enabled === true,
    easing: ["linear", "smooth", "in", "out"].includes(input?.easing) ? input.easing : "smooth",
    playback: input?.playback === "return" ? "return" : "once", tracks };
}
export function motionProgress(time, range, motion) {
  if (!range || !range.every(Number.isFinite) || range[1] <= range[0] || !Number.isFinite(time)) return 0;
  let p = Math.max(0, Math.min(1, (time - range[0]) / (range[1] - range[0])));
  if (motion.playback === "return") p = 1 - Math.abs(2 * p - 1);
  if (motion.easing === "smooth") return p * p * (3 - 2 * p);
  if (motion.easing === "in") return p * p;
  if (motion.easing === "out") return 1 - (1 - p) ** 2;
  return p;
}
export function configAtTime(config, time, range) {
  if (!range || (!config.motion?.enabled && !config.stack?.some(layer => layer.settings?.motion?.enabled))) return config;
  const next = { ...config };
  if (config.motion?.enabled) {
    const p = motionProgress(time, range, config.motion);
    for (const [key] of availableMotionControls(config.effect, config)) {
      const pair = config.motion.tracks[key];
      if (pair) next[key] = pair[0] + (pair[1] - pair[0]) * p;
    }
  }
  if (config.stack?.length) next.stack = config.stack.map(layer => layer.settings
    ? { ...layer, settings: configAtTime(layer.settings, time, range) } : layer);
  return next;
}
