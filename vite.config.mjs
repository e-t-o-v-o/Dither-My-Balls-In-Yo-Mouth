import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  base: "./",
  server: { host: "0.0.0.0", allowedHosts: ["terminal.local"] },
  plugins: [react()],
  build: { outDir: "build" },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/setupTests.js"],
    restoreMocks: true,
  },
});
