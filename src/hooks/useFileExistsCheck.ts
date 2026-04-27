import { useEffect } from "react";
import { useItemStore } from "../store/useItemStore";
import { fileExists } from "../services/fs";

/**
 * 启动时 + 每隔 30s 检查一次所有文件/图片卡片的存在性。
 */
export function useFileExistsCheck(): void {
  const loaded = useItemStore((s) => s.loaded);

  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;

    async function check() {
      const items = useItemStore.getState().items;
      const setMissing = useItemStore.getState().setMissing;
      for (const it of items) {
        if (cancelled) return;
        if ((it.type === "file" || it.type === "image") && it.filePath) {
          const exists = await fileExists(it.filePath);
          if (cancelled) return;
          if (!exists !== !!it.isMissing) {
            setMissing(it.id, !exists);
          }
        }
      }
    }

    check();
    const id = window.setInterval(check, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [loaded]);
}
