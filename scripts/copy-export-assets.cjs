const fs = require("fs");
const path = require("path");
fs.copyFileSync(
  require.resolve("gif.js/dist/gif.worker.js"),
  path.join(__dirname, "../public/gif.worker.js"),
);
