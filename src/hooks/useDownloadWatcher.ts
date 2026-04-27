import { useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useSettingsStore } from "../store/useSettingsStore";

interface DownloadReadyPayload {
  path: string;
  name: string;
}

interface Options {
  onDownloadReady: (payload: DownloadReadyPayload) => void;
}

/**
 * 根据设置 downloadWatch 启停 Rust 端的下载目录监听，
 * 并监听 `download-ready` 事件。
 */
export function useDownloadWatcher(opts: Options): void {
  const downloadWatch = useSettingsStore((s) => s.downloadWatch);
  const loaded = useSettingsStore((s) => s.loaded);

  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    let unlisten: UnlistenFn | undefined;

    (async () => {
      if (downloadWatch) {
        try {
          await invoke<string>("start_download_watch");
        } catch (e) {
          console.warn("start_download_watch failed:", e);
        }
        try {
          const fn = await listen<DownloadReadyPayload>(
            "download-ready",
            (ev) => {
              opts.onDownloadReady(ev.payload);
            },
          );
          if (cancelled) fn();
          else unlisten = fn;
        } catch (e) {
          console.warn("listen download-ready failed:", e);
        }
      } else {
        try {
          await invoke("stop_download_watch");
        } catch {}
      }
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
    // opts 引用每次变化不依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [downloadWatch, loaded]);
}
