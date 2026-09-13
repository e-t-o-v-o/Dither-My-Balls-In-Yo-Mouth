import { createExportTarget } from "./export-storage";

test("cancellation during disk setup closes the writable and never falls back to memory", async () => {
  const controller = new AbortController();
  const writable = { abort: vi.fn(async () => {}) };
  const directory = {
    values: async function* () {}, removeEntry: vi.fn(async () => {}),
    getFileHandle: async () => ({ createWritable: async () => { controller.abort(); return writable; } }),
  };
  vi.stubGlobal("navigator", { storage: { getDirectory: async () => directory } });
  const BufferTarget = vi.fn();
  await expect(createExportTarget({ BufferTarget }, { disk: true, estimatedBytes: 1024, extension: "mp4" }, controller.signal)).rejects.toHaveProperty("name", "AbortError");
  expect(writable.abort).toHaveBeenCalledOnce();
  expect(directory.removeEntry).toHaveBeenCalledOnce();
  expect(BufferTarget).not.toHaveBeenCalled();
});

afterEach(() => vi.unstubAllGlobals());
