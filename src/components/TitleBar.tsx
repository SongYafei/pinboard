import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  X,
  Settings as SettingsIcon,
  PanelRightClose,
} from "lucide-react";
import logoUrl from "../assets/logo.svg";
import "./TitleBar.css";

interface Props {
  onOpenSettings: () => void;
  /** 主动收起到屏幕边缘（peek 状态） */
  onSnapNow: () => void | Promise<void>;
}

export function TitleBar({ onOpenSettings, onSnapNow }: Props) {
  const win = getCurrentWindow();

  /**
   * 禁用"双击标题栏最大化/还原"：
   * Tauri 的 data-tauri-drag-region 默认双击会切换 maximize。
   * 我们在 pointerdown 时若检测到是 2 连击（detail >= 2），阻止默认行为 + 阻止冒泡，
   * Tauri native 拿不到这个事件就不会走最大化分支。
   * 再叠一层防御：若仍然被最大化，立刻 unmaximize 兜底。
   */
  const blockDblMaximize = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.detail >= 2) {
      e.preventDefault();
      e.stopPropagation();
    }
  };
  const onDbl = async (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (await win.isMaximized()) {
        await win.unmaximize();
      }
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="titlebar"
      data-tauri-drag-region
      onPointerDown={blockDblMaximize}
      onDoubleClick={onDbl}
    >
      <div
        className="titlebar__brand"
        data-tauri-drag-region
        onPointerDown={blockDblMaximize}
        onDoubleClick={onDbl}
      >
        <img src={logoUrl} className="titlebar__logo" alt="PinBoard" />
        <span className="titlebar__title">PinBoard</span>
      </div>
      <div className="titlebar__actions">
        <button
          className="titlebar__btn"
          onClick={() => onSnapNow()}
          title="收起到边缘"
          aria-label="收起到边缘"
        >
          <PanelRightClose size={14} />
        </button>
        <button
          className="titlebar__btn"
          onClick={onOpenSettings}
          title="设置"
          aria-label="设置"
        >
          <SettingsIcon size={14} />
        </button>
        <button
          className="titlebar__btn titlebar__btn--close"
          onClick={() => win.hide()}
          title="隐藏 (Ctrl+Shift+V 呼出)"
          aria-label="隐藏"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
