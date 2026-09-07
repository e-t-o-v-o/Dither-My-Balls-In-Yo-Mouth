import { readFileSync } from "node:fs";
import fixDuration from "fix-webm-duration";
test("real WebM output receives readable duration metadata", async () => {
  const bytes = readFileSync(
    "src/studio/fixtures/durationless.webm",
  );
  const repaired = await fixDuration(
    new Blob([bytes], { type: "video/webm" }),
    300,
    { logger: false },
  );
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(Buffer.from(reader.result));
    reader.onerror = reject;
    reader.readAsArrayBuffer(repaired);
  });
  const at = data.indexOf(Buffer.from([0x44, 0x89, 0x88]));
  expect(at).toBeGreaterThan(0);
  expect(data.readDoubleBE(at + 3)).toBe(300);
});
