import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { TitleBar } from "./components/TitleBar";
import { Toolbar } from "./components/Toolbar";
import { ItemCard } from "./components/ItemCard";
import { EmptyState } from "./components/EmptyState";
import { SettingsPanel } from "./components/SettingsPanel";
import { DropOverlay } from "./components/DropOverlay";
import { Toast } from "./components/Toast";
import { EdgeHandle, type PendingClip } from "./components/EdgeHandle";
import { useItemStore, useFilteredItems } from "./store/useItemStore";
import { useSettingsStore } from "./store/useSettingsStore";
import { useTheme } from "./hooks/useTheme";
import { useClipboardWatcher } from "./hooks/useClipboardWatcher";
import { useFileExistsCheck } from "./hooks/useFileExistsCheck";
import { useAutoStart } from "./hooks/useAutoStart";
import { useGlobalHotkey } from "./hooks/useGlobalHotkey";
import { useDownloadWatcher } from "./hooks/useDownloadWatcher";
import { useAutoHide } from "./hooks/useAutoHide";
import * as fs from "./services/fs";
import * as clipboard from "./services/clipboard";
import "./App.css";

interface ToastState {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
}

export default function App() {
  const loadItems = useItemStore((s) => s.load);
  const loadSettings = useSettingsStore((s) => s.load);
  const addItem = useItemStore((s) => s.addItem);
  const loaded = useItemStore((s) => s.loaded);
  const settingsLoaded = useSettingsStore((s) => s.loaded);
  const hideMissing = useSettingsStore((s) => s.hideMissing);
  const opacity = useSettingsStore((s) => s.opacity);

  const filtered = useFilteredItems();
  const displayItems = useMemo(
    () => (hideMissing ? filtered.filter((i) => !i.isMissing) : filtered),
    [filtered, hideMissing],
  );

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dropHover, setDropHover] = useState(false);
  const [toasts, setToasts] = useState<ToastState[]>([]);

  // ======== 边缘吸附态下的 peek 条数据 ========
  /** 当前是否处于吸附态（读自 body[data-snap-edge]，由 useAutoHide 设置） */
  const [isSnapped, setIsSnapped] = useState(false);
  /** 吸附态下 accumulator：新下载数（点击展开后清零） */
  const [pendingDownloadCount, setPendingDownloadCount] = useState(0);
  /** 吸附态下捕获的最新剪贴板内容，可在 peek 条快捷钉住 */
  const [pendingClip, setPendingClip] = useState<PendingClip | null>(null);
  const isSnappedRef = useRef(false);
  useEffect(() => {
    isSnappedRef.current = isSnapped;
  }, [isSnapped]);

  // 监听 body[data-snap-edge] 变化 → 同步 isSnapped，并在退出吸附时清空 pending
  useEffect(() => {
    const update = () => {
      const snapped = document.body.hasAttribute("data-snap-edge");
      setIsSnapped((prev) => {
        if (prev === snapped) return prev;
        // 由吸附 → 展开：清空 pending（用户已经能看到窗口了）
        if (prev && !snapped) {
          setPendingDownloadCount(0);
          setPendingClip(null);
        }
        return snapped;
      });
    };
    update();
    const mo = new MutationObserver(update);
    mo.observe(document.body, {
      attributes: true,
      attributeFilter: ["data-snap-edge"],
    });
    return () => mo.disconnect();
  }, []);

  // 自动隐藏暂停标记：设置页打开 / 拖入中 / 有 toast 未关闭 → 暂停
  const autoHidePaused = settingsOpen || dropHover || toasts.length > 0;
  const autoHidePausedRef = useRef(false);
  useEffect(() => {
    autoHidePausedRef.current = autoHidePaused;
  }, [autoHidePaused]);

  // 初始化
  useTheme();
  useFileExistsCheck();
  useAutoStart();
  useGlobalHotkey();
  const { snapNow } = useAutoHide({
    pausedRef: autoHidePausedRef,
    paused: autoHidePaused,
  });

  useEffect(() => {
    Promise.all([loadSettings(), loadItems()]);
  }, [loadItems, loadSettings]);

  // 初始化完成后显示窗口（tauri.conf.json 中 visible: false）
  useEffect(() => {
    if (settingsLoaded && loaded) {
      getCurrentWindow().then((win) => win.show()).catch(console.warn);
    }
  }, [settingsLoaded, loaded]);

  // 窗口透明度
  useEffect(() => {
    if (!settingsLoaded) return;
    document.documentElement.style.setProperty("--app-opacity", String(opacity));
    document.body.style.opacity = String(opacity);
  }, [opacity, settingsLoaded]);

  const pushToast = useCallback(
    (t: Omit<ToastState, "id">) =>
      setToasts((ts) => [...ts, { ...t, id: Date.now() + Math.random() }]),
    [],
  );
  const closeToast = useCallback(
    (id: number) => setToasts((ts) => ts.filter((t) => t.id !== id)),
    [],
  );

  // Tauri 文件拖入
  useEffect(() => {
    const webview = getCurrentWebview();
    let unlisten: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const fn = await webview.onDragDropEvent(async (event) => {
        const payload = event.payload;
        if (payload.type === "enter" || payload.type === "over") {
          setDropHover(true);
        } else if (payload.type === "leave") {
          setDropHover(false);
        } else if (payload.type === "drop") {
          setDropHover(false);
          const paths = payload.paths;
          for (const p of paths) {
            const name = fs.basename(p);
            const ext = fs.extname(p);
            if (fs.isImageExt(ext)) {
              // 图片文件：作为 image 卡
              await addItem({
                type: "image",
                content: name,
                filePath: p,
                thumbnail: fs.toAssetUrl(p),
              });
            } else {
              await addItem({ type: "file", content: name, filePath: p });
            }
          }
          await getCurrentWindow().setFocus();
        }
      });
      // 如果在 await 过程中已被 cleanup，立刻取消监听
      if (cancelled) fn();
      else unlisten = fn;
    })();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [addItem]);

  // 粘贴：文字 / 图片
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      if (settingsOpen) return;
      const target = e.target as HTMLElement | null;
      // 输入框内正常粘贴
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      const cd = e.clipboardData;
      if (!cd) return;

      // 图片
      for (const item of Array.from(cd.items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            const ext = file.type.split("/")[1] || "png";
            const ab = await file.arrayBuffer();
            const bytes = new Uint8Array(ab);
            const path = await fs.saveImage(bytes, ext);
            const dataUrl = await fileToDataUrl(file);
            await addItem({
              type: "image",
              content: file.name || "pasted.png",
              filePath: path,
              thumbnail: dataUrl,
            });
            return;
          }
        }
      }
      // 文字
      const text = cd.getData("text");
      if (text && text.trim()) {
        e.preventDefault();
        await addItem({ type: "text", content: text });
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addItem, settingsOpen]);

  // 剪贴板监听（可选）
  useClipboardWatcher({
    onText: (text) => {
      const trimmed = text.trim();
      if (!trimmed || trimmed.length > 5000) return;
      // 吸附态：写入 peek pending，走"快捷钉住"路径，避免 toast 干扰
      if (isSnappedRef.current) {
        setPendingClip({
          type: "text",
          preview: trimmed,
          at: Date.now(),
        });
        return;
      }
      pushToast({
        message: `检测到新复制：${trimmed.slice(0, 40)}${
          trimmed.length > 40 ? "…" : ""
        }`,
        actionLabel: "钉住",
        onAction: () => addItem({ type: "text", content: text }),
      });
    },
    onImage: async (_dataUrl, bytes) => {
      if (isSnappedRef.current) {
        setPendingClip({
          type: "image",
          preview: _dataUrl,
          bytes,
          at: Date.now(),
        });
        return;
      }
      const path = await fs.saveImage(bytes, "png");
      pushToast({
        message: "检测到新图片",
        actionLabel: "钉住",
        onAction: () =>
          addItem({
            type: "image",
            content: "pasted.png",
            filePath: path,
            thumbnail: _dataUrl,
          }),
      });
    },
  });

  // 下载监听：新下载完成的文件 → 自动 addItem + Toast 通知
  const trimDownloads = useItemStore((s) => s.trimDownloads);
  const downloadMaxKeep = useSettingsStore((s) => s.downloadMaxKeep);
  useDownloadWatcher({
    onDownloadReady: async (payload) => {
      const { path, name } = payload;
      const ext = fs.extname(name);
      const type = fs.isImageExt(ext) ? "image" : "file";
      const item = await addItem({
        type,
        source: "download",
        content: name,
        filePath: path,
        thumbnail: type === "image" ? fs.toAssetUrl(path) : undefined,
      });
      // 超过保留数量则自动裁剪（最旧的未 Pin 项）
      await trimDownloads(downloadMaxKeep);

      // 吸附态：累加 peek 条徽章（静默，不出 Toast）
      if (isSnappedRef.current) {
        setPendingDownloadCount((c) => c + 1);
        return;
      }

      pushToast({
        message: `下载完成：${name}`,
        actionLabel: "复制",
        onAction: () => {
          // 直接复制文件到剪贴板
          clipboard.copyFile(path).catch((e) => console.warn(e));
          // 使用次数 +1
          useItemStore.getState().incUseCount(item.id);
        },
        duration: 6000,
      });
    },
  });

  const ready = loaded && settingsLoaded;

  return (
    <div className="app">
      <TitleBar
        onOpenSettings={() => setSettingsOpen(true)}
        onSnapNow={snapNow}
      />

      <Toolbar />

      <div className="app__list">
        {!ready ? (
          <div className="app__loading">加载中…</div>
        ) : displayItems.length === 0 ? (
          <EmptyState />
        ) : (
          displayItems.map((it) => <ItemCard key={it.id} item={it} />)
        )}
      </div>

      <div className="app__footer">
        <span>{displayItems.length} 项</span>
        <span className="app__footer-hint">拖入文件 · Ctrl+V 粘贴</span>
      </div>

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}

      <DropOverlay visible={dropHover} />

      {toasts.map((t) => (
        <Toast
          key={t.id}
          message={t.message}
          actionLabel={t.actionLabel}
          onAction={t.onAction}
          duration={t.duration}
          onClose={() => closeToast(t.id)}
        />
      ))}

      {/* 吸附到边缘时的可视"把手"：总数 / 新下载徽章 / 剪贴板快捷钉住 */}
      <EdgeHandle
        totalCount={displayItems.length}
        pendingDownloadCount={pendingDownloadCount}
        pendingClip={pendingClip}
        onPinClip={async () => {
          const clip = pendingClip;
          if (!clip) return;
          setPendingClip(null);
          try {
            if (clip.type === "text") {
              await addItem({ type: "text", content: clip.preview });
            } else if (clip.bytes) {
              const path = await fs.saveImage(clip.bytes, "png");
              await addItem({
                type: "image",
                content: "pasted.png",
                filePath: path,
                thumbnail: clip.preview,
              });
            }
          } catch (err) {
            console.warn("[edgeHandle] pin clip failed:", err);
          }
        }}
        onExpand={async () => {
          // 通过 focus 触发 useAutoHide 的 show()
          try {
            await getCurrentWindow().setFocus();
          } catch (e) {
            console.warn("[edgeHandle] expand setFocus failed:", e);
          }
        }}
      />
    </div>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.readAsDataURL(file);
  });
}
