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
          // 贴边态：调用 autohide 的 show 把窗口完整展开（视为用户主动唤起）
          const isSnapped = document.body.hasAttribute("data-snap-edge");
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const snapShow: undefined | (() => Promise<void>) = (window as any)
            .__pinboardSnapShow;
          if (isSnapped && snapShow) {
            await win.show();
            await win.setFocus();
            await snapShow();
            return;
          }
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
