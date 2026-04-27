import { useEffect, useRef } from "react";
import * as clipboard from "../services/clipboard";
import { useSettingsStore } from "../store/useSettingsStore";

interface Options {
  onText: (text: string) => void;
  onImage: (dataUrl: string, bytes: Uint8Array) => void;
}

/**
 * 轮询剪贴板（间隔 1500ms）。仅在 clipboardWatch = true 时工作。
 * 内部做内容去重，避免重复回调。
 */
export function useClipboardWatcher(opts: Options): void {
  const enabled = useSettingsStore((s) => s.clipboardWatch);
  const lastText = useRef<string | null>(null);
  const lastImage = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;

    async function tick() {
      if (!alive) return;
      // 先读文本
      const text = await clipboard.tryReadText();
      if (text && text !== lastText.current) {
        lastText.current = text;
        opts.onText(text);
      } else {
        // 没有文本则尝试图片
        const img = await clipboard.tryReadImage();
        if (img && img.dataUrl !== lastImage.current) {
          lastImage.current = img.dataUrl;
          opts.onImage(img.dataUrl, img.bytes);
        }
      }
    }

    const id = window.setInterval(tick, 1500);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
    // opts 函数每渲染变一次没关系，不需要依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
