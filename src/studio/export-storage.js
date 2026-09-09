import { checkAbort } from "./media";
// Disk-backed output keeps encoded media out of a single giant JS buffer.
// Files remain until their download URL is released by the workspace.
export async function createExportTarget(m, plan, signal) {
  if (plan.disk) {
    let directory, name;
    try {
      directory = await navigator.storage.getDirectory();
      // Remove abandoned exports after a day; recent jobs may belong to another tab.
      for await (const entry of directory.values()) {
        const match = /^dither-export-(\d+)-[\w-]+\.(mp4|webm)$/.exec(
          entry.name,
        );
        if (match && Date.now() - Number(match[1]) > 86400000)
          await directory.removeEntry(entry.name).catch(() => {});
      }
      name = `dither-export-${Date.now()}-${crypto.randomUUID()}.${plan.extension}`;
      const handle = await directory.getFileHandle(name, { create: true });
      const writable = await handle.createWritable();
      const target = new m.StreamTarget(writable, {
        chunked: true,
        chunkSize: 2 * 1024 * 1024,
      });
      target.on("write", () => checkAbort(signal));
      return {
        target,
        disk: true,
        blob: () => handle.getFile(),
        cleanup: () => directory.removeEntry(name).catch(() => {}),
      };
    } catch (error) {
      if (directory && name) await directory.removeEntry(name).catch(() => {});
      if (plan.estimatedBytes > 450 * 1024 * 1024)
        throw new Error(
          "Disk-backed export is unavailable here. Shorten the selection or lower the resolution.",
        );
    }
  }
  const target = new m.BufferTarget();
  target.on("write", ({ end }) => {
    checkAbort(signal);
    if (end > 512 * 1024 * 1024)
      throw new Error(
        "Export reached the memory budget. Shorten the selection.",
      );
  });
  return {
    target,
    disk: false,
    blob: async () =>
      new Blob([target.buffer], { type: `video/${plan.extension}` }),
    cleanup: async () => {},
  };
}
