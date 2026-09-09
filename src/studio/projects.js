import { sanitizeConfig } from "./model";
import { effectSnapshot } from "./effect-registry";
import { videoPreferences } from "./workflow";
export function createProject({
  config,
  source,
  trim,
  time,
  effectSettings,
  fonts,
  video,
}) {
  const used = fonts[config.font];
  return {
    app: "dither-studio",
    version: 1,
    savedAt: new Date().toISOString(),
    config,
    trim,
    time,
    effectSettings,
    video: videoPreferences(video),
    media: {
      kind: source.kind === "camera" ? "demo" : source.kind,
      name: source.name,
      size: source.file?.size,
      width: source.width,
      height: source.height,
      duration: source.duration,
    },
    fonts: used?.data ? [{ name: config.font, data: used.data }] : [],
  };
}
export function parseProject(input) {
  if (
    input?.app !== "dither-studio" ||
    input.version !== 1 ||
    !input.config ||
    !["demo", "video", "image"].includes(input.media?.kind)
  )
    throw new Error("Choose a Dither Studio project file.");
  const duration = Math.max(0.05, Number(input.media.duration) || 8);
  const start = Math.max(
    0,
    Math.min(duration - 0.05, Number(input.trim?.[0]) || 0),
  );
  const end = Math.max(
    start + 0.05,
    Math.min(duration, Number(input.trim?.[1]) || duration),
  );
  const fonts = (Array.isArray(input.fonts) ? input.fonts : [])
    .slice(0, 1)
    .filter(
      (f) =>
        f &&
        typeof f.name === "string" &&
        /^[\w -]{1,64}$/.test(f.name) &&
        typeof f.data === "string" &&
        f.data.length < 8 * 1024 * 1024 &&
        /^data:[\w/+.-]+;base64,[A-Za-z0-9+/=]+$/.test(f.data),
    );
  return {
    ...input,
    config: sanitizeConfig(input.config),
    trim: [start, end],
    time: Math.max(start, Math.min(end, Number(input.time) || start)),
    fonts,
    video: videoPreferences(input.video),
    effectSettings: Object.fromEntries(
      Object.entries(input.effectSettings || {})
        .slice(0, 20)
        .filter(([key]) => /^[\w-]+$/.test(key))
        .map(([key, value]) => [
          key,
          effectSnapshot(sanitizeConfig({ ...value, effect: key })),
        ]),
    ),
  };
}
async function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("dither-studio", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("projects");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function autosaveProject(project) {
  const db = await database();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction("projects", "readwrite");
      tx.objectStore("projects").put(project, "last-session");
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function loadAutosave() {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db
        .transaction("projects")
        .objectStore("projects")
        .get("last-session");
      request.onsuccess = () =>
        resolve(request.result ? parseProject(request.result) : null);
      request.onerror = () => reject(request.error);
    });
  } finally {
    db.close();
  }
}
