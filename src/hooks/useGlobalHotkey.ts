import { useEffect } from "react";
import {
  register,
  unregister,
  isRegistered,
} from "@tauri-apps/plugin-global-shortcut";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useSettingsStore } from "../store/useSettingsStore";

/** 注册/取消注册全局快捷键，按下时切换窗口显隐 */
export function useGlobalHotkey(): void {
  const hotkey = useSettingsStore((s) => s.hotkey);
  const loaded = useSettingsStore((s) => s.loaded);

  useEffect(() => {
    if (!loaded || !hotkey) return;
    let currentKey = hotkey;

    (async () => {
      try {
        if (await isRegistered(currentKey)) await unregister(currentKey);
        await register(currentKey, async (ev) => {
          if (ev.state !== "Pressed") return;
          const win = getCurrentWindow();
          const visible = await win.isVisible();
          const focused = await win.isFocused();
          if (visible && focused) {
            await win.hide();
          } else {
            await win.show();
            await win.setFocus();
          }
        });
      } catch (e) {
        console.warn("register hotkey failed:", e);
      }
    })();

    return () => {
      (async () => {
        try {
          if (await isRegistered(currentKey)) await unregister(currentKey);
        } catch {}
      })();
    };
  }, [hotkey, loaded]);
}
