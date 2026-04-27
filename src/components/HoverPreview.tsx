import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./HoverPreview.css";

interface Props {
  /** 锚元素的 DOMRect */
  anchorRect: DOMRect;
  /** 渲染的内容 */
  children: React.ReactNode;
  /** 自定义最大宽度（逻辑像素） */
  maxWidth?: number;
  /** 自定义最大高度 */
  maxHeight?: number;
  /** 是否允许鼠标交互（默认 false 穿透）。文字预览需要可滚动/选中时设 true */
  interactive?: boolean;
  /** 鼠标进入 tooltip */
  onMouseEnter?: () => void;
  /** 鼠标离开 tooltip */
  onMouseLeave?: () => void;
}

/** 根据锚点位置智能选择放置位置（右 > 左 > 下） */
export function HoverPreview({
  anchorRect,
  children,
  maxWidth = 340,
  maxHeight,
  interactive = false,
  onMouseEnter,
  onMouseLeave,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number; placement: string }>({
    x: -9999,
    y: -9999,
    placement: "right",
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 8;
    const margin = 6;

    // 默认：贴右侧，纵向与卡片对齐顶部
    let placement: "right" | "left" | "bottom" | "top" = "right";
    let x = anchorRect.right + gap;
    let y = anchorRect.top;

    if (x + rect.width > vw - margin) {
      // 右侧放不下 → 尝试左侧
      placement = "left";
      x = anchorRect.left - gap - rect.width;
      if (x < margin) {
        // 左侧也放不下 → 放在下方
        placement = "bottom";
        x = Math.min(
          Math.max(margin, anchorRect.left),
          vw - rect.width - margin,
        );
        y = anchorRect.bottom + gap;
        if (y + rect.height > vh - margin) {
          // 下方也放不下 → 放在上方
          placement = "top";
          y = anchorRect.top - gap - rect.height;
        }
      }
    }

    // 纵向限制
    if (placement === "right" || placement === "left") {
      if (y + rect.height > vh - margin) {
        y = vh - margin - rect.height;
      }
      if (y < margin) y = margin;
    }
    // 横向限制
    if (x + rect.width > vw - margin) x = vw - margin - rect.width;
    if (x < margin) x = margin;

    setPos({ x, y, placement });
  }, [anchorRect]);

  return createPortal(
    <div
      ref={ref}
      className={`hover-preview hover-preview--${pos.placement} ${
        interactive ? "hover-preview--interactive" : ""
      }`}
      style={{
        left: pos.x,
        top: pos.y,
        maxWidth,
        maxHeight,
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>,
    document.body,
  );
}

interface UseHoverPreviewResult {
  /** 绑定到锚元素的 ref */
  anchorRef: React.RefObject<HTMLElement>;
  /** 绑定到锚元素的事件 */
  bind: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  };
  /** 绑定到 tooltip 的事件（interactive 时） */
  hoverBind: {
    onMouseEnter: () => void;
    onMouseLeave: () => void;
  };
  /** 当前是否展示 */
  visible: boolean;
  /** 锚点 rect（可能 null） */
  anchorRect: DOMRect | null;
}

/**
 * hover 一段延迟后触发预览；移出立即关闭。
 * 如果 tooltip 是可交互的，可以把 hoverBind 绑到 tooltip 上，鼠标从卡片到 tooltip 中间的空白不会立即关闭。
 */
export function useHoverPreview(delayMs = 450): UseHoverPreviewResult {
  const anchorRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const clearOpen = () => {
    if (openTimerRef.current !== null) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  };
  const clearClose = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  useEffect(
    () => () => {
      clearOpen();
      clearClose();
    },
    [],
  );

  const open = () => {
    clearClose();
    clearOpen();
    openTimerRef.current = window.setTimeout(() => {
      const el = anchorRef.current;
      if (el) {
        setAnchorRect(el.getBoundingClientRect());
        setVisible(true);
      }
    }, delayMs);
  };

  const scheduleClose = (immediate = false) => {
    clearOpen();
    if (immediate) {
      setVisible(false);
      return;
    }
    clearClose();
    closeTimerRef.current = window.setTimeout(() => {
      setVisible(false);
    }, 120);
  };

  // 滚动时立即关闭（避免 tooltip 悬停在错位位置）
  useEffect(() => {
    if (!visible) return;
    const onScroll = () => {
      clearOpen();
      clearClose();
      setVisible(false);
    };
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [visible]);

  return {
    anchorRef,
    anchorRect,
    visible,
    bind: {
      onMouseEnter: open,
      onMouseLeave: () => scheduleClose(),
    },
    hoverBind: {
      onMouseEnter: () => clearClose(),
      onMouseLeave: () => scheduleClose(true),
    },
  };
}
