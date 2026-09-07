// Exercise the real shipped GIF encoder without requiring a browser.
const fs = require("fs"),
  vm = require("vm"),
  assert = require("node:assert/strict");
let result;
const context = {
  self: {
    postMessage(frame) {
      result = frame;
    },
  },
  Uint8Array,
  Int32Array,
  Float64Array,
  Math,
  console,
};
vm.createContext(context);
vm.runInContext(fs.readFileSync("public/gif.worker.js", "utf8"), context);
const data = new Uint8ClampedArray(32 * 24 * 4);
for (let i = 0; i < data.length; i += 4) {
  data[i] = 255;
  data[i + 3] = 255;
}
context.self.onmessage({
  data: {
    index: 0,
    last: true,
    width: 32,
    height: 24,
    data,
    delay: 100,
    repeat: 0,
    quality: 10,
    dither: false,
    transparent: null,
    globalPalette: false,
    canTransfer: false,
  },
});
assert.ok(result);
const chunks = result.data.map((p, i) =>
  Buffer.from(p).subarray(
    0,
    i === result.data.length - 1 ? result.cursor : result.pageSize,
  ),
);
const gif = Buffer.concat(chunks);
assert.equal(gif.subarray(0, 6).toString(), "GIF89a");
assert.equal(gif.readUInt16LE(6), 32);
assert.equal(gif.readUInt16LE(8), 24);
assert.equal(gif.at(-1), 0x3b);
console.log(
  `GIF worker verified: ${gif.length} bytes, 32 × 24, valid header and trailer.`,
);
