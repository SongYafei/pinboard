import { useEffect } from "react";
import { useSettingsStore } from "../store/useSettingsStore";

/**
 * 明暗主题：根据 settings.themeMode 决定
 *   system: 跟随 prefers-color-scheme
 *   light/dark: 强制
 */
export function useTheme(): void {
  const themeMode = useSettingsStore((s) => s.themeMode);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");

    function apply() {
      let theme: "light" | "dark";
      if (themeMode === "system") {
        theme = mql.matches ? "dark" : "light";
      } else {
        theme = themeMode;
      }
      document.documentElement.setAttribute("data-theme", theme);
    }

    apply();
    if (themeMode === "system") {
      mql.addEventListener("change", apply);
      return () => mql.removeEventListener("change", apply);
    }
  }, [themeMode]);
}
