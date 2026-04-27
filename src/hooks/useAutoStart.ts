import { useEffect } from "react";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import { useSettingsStore } from "../store/useSettingsStore";

/** 把设置里的 autoStart 和系统状态同步 */
export function useAutoStart(): void {
  const autoStart = useSettingsStore((s) => s.autoStart);
  const loaded = useSettingsStore((s) => s.loaded);

  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        const sys = await isEnabled();
        if (autoStart && !sys) await enable();
        if (!autoStart && sys) await disable();
      } catch (e) {
        console.warn("autostart sync failed:", e);
      }
    })();
  }, [autoStart, loaded]);
}
