import { useEffect, useState } from "react";
import { readStorage, writeStorage } from "./model";

export function useAppearance() {
  const [appearance, setAppearance] = useState(() => {
    const saved = readStorage("dither.theme.v2", "system");
    return ["system", "light", "dark"].includes(saved) ? saved : "system";
  });
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const apply = () => {
      const theme = appearance === "system"
        ? media?.matches ? "dark" : "light"
        : appearance;
      document.documentElement.dataset.theme = theme;
      document.querySelector('meta[name="theme-color"]')?.setAttribute(
        "content", theme === "dark" ? "#1d2026" : "#ffffff",
      );
    };
    apply();
    writeStorage("dither.theme.v2", appearance);
    media?.addEventListener("change", apply);
    return () => media?.removeEventListener("change", apply);
  }, [appearance]);
  return [appearance, setAppearance];
}
