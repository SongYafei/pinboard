import { useEffect, useMemo, useState } from "react";
import "./EdgeHandle.css";

export interface PendingClip {
  type: "text" | "image";
  /** 文字内容 或 图片 dataURL */
  preview: string;
  /** 图片原始数据（供钉住时落盘） */
  bytes?: Uint8Array;
  /** 进入 pending 的时间戳 */
  at: number;
}

interface Props {
  /** 总条目数 */
  totalCount: number;
  /** 吸附期间新下载未查看数 */
  pendingDownloadCount: number;
  /** 吸附期间捕获到的剪贴板待钉项（null 表示无） */
  pendingClip: PendingClip | null;
  /** 点击"快捷钉住"回调 */
  onPinClip: () => void;
  /** 点击整条（除交互按钮外的空白）展开窗口 */
  onExpand: () => void;
}

/**
 * 边缘吸附把手：信息指示 + 快捷交互。
 * 显隐由 body[data-snap-edge] 驱动（CSS 决定方向）。
 */
export function EdgeHandle({
  totalCount,
  pendingDownloadCount,
  pendingClip,
  onPinClip,
  onExpand,
}: Props) {
  const hasClip = !!pendingClip;
  const hasDownload = pendingDownloadCount > 0;
  const alertLevel = hasClip || hasDownload ? "alert" : "idle";

  // 剪贴板 pending 的"多久之前"提示
  const clipLabel = useClipLabel(pendingClip);

  return (
    <div
      className="edge-handle"
      data-alert={alertLevel}
      aria-hidden
      onClick={(e) => {
        // 只有点空白区才展开（避免误吞按钮点击）
        if ((e.target as HTMLElement).closest(".edge-btn")) return;
        onExpand();
      }}
    >
      {/* logo */}
      <div className="edge-seg edge-brand" title="PinBoard">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
          <path
            d="M6.5 1.5 L9.5 1.5 L9.5 6 L12 6 L8 11 L4 6 L6.5 6 Z M5 13 L11 13 L11 14.5 L5 14.5 Z"
            fill="currentColor"
          />
        </svg>
      </div>

      {/* 总数 */}
      <div className="edge-seg edge-count" title={`${totalCount} 项`}>
        <span className="edge-num">
          {totalCount > 99 ? "99+" : totalCount}
        </span>
      </div>

      {/* 新下载徽章 */}
      {hasDownload && (
        <button
          type="button"
          className="edge-seg edge-btn edge-download"
          title={`${pendingDownloadCount} 个新下载 · 点击展开查看`}
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
        >
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden>
            <path
              d="M8 1 L8 9 M4.5 6.5 L8 10 L11.5 6.5 M2.5 12.5 L13.5 12.5"
              stroke="currentColor"
              strokeWidth="1.6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="edge-badge">
            {pendingDownloadCount > 9 ? "9+" : pendingDownloadCount}
          </span>
        </button>
      )}

      {/* 新剪贴板捕获 → 快捷钉住 */}
      {hasClip && (
        <button
          type="button"
          className="edge-seg edge-btn edge-clip"
          title={`${clipLabel}\n点击快捷钉住`}
          onClick={(e) => {
            e.stopPropagation();
            onPinClip();
          }}
        >
          {pendingClip!.type === "image" ? (
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden>
              <path
                d="M2 3 L14 3 L14 13 L2 13 Z M5 8 L7 10 L10 6 L13 10"
                stroke="currentColor"
                strokeWidth="1.4"
                fill="none"
                strokeLinejoin="round"
              />
              <circle cx="5.5" cy="6" r="1" fill="currentColor" />
            </svg>
          ) : (
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden>
              <path
                d="M5 2.5 L11 2.5 L11 4 L13 4 L13 14 L3 14 L3 4 L5 4 Z M6 2 L10 2 L10 3.5 L6 3.5 Z"
                stroke="currentColor"
                strokeWidth="1.2"
                fill="none"
                strokeLinejoin="round"
              />
            </svg>
          )}
          <span className="edge-pulse-dot" />
        </button>
      )}

      {/* 无新事件时：品牌文字填充，保持美观 */}
      {!hasClip && !hasDownload && (
        <div className="edge-seg edge-label" aria-hidden>
          <span className="edge-label-text">PIN · BOARD</span>
        </div>
      )}
    </div>
  );
}

/** 生成"刚刚/3s前"一类的提示 */
function useClipLabel(clip: PendingClip | null): string {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!clip) return;
    const id = window.setInterval(() => tick((v) => v + 1), 5000);
    return () => window.clearInterval(id);
  }, [clip]);

  return useMemo(() => {
    if (!clip) return "";
    const delta = Date.now() - clip.at;
    const sec = Math.max(1, Math.floor(delta / 1000));
    const ago =
      sec < 60
        ? `${sec}s 前`
        : sec < 3600
          ? `${Math.floor(sec / 60)}min 前`
          : "更早";
    const kind = clip.type === "image" ? "新图片" : "新文本";
    const preview =
      clip.type === "text"
        ? clip.preview.slice(0, 40).replace(/\s+/g, " ")
        : "";
    return preview ? `${kind}（${ago}）：${preview}` : `${kind}（${ago}）`;
  }, [clip]);
}
