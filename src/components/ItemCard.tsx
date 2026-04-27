import { useRef, useState } from "react";
import {
  File as FileIcon,
  FileText,
  Image as ImageIcon,
  Pin,
  PinOff,
  Trash2,
  FolderOpen,
  Copy,
  MoreHorizontal,
  CheckCheck,
  AlertCircle,
  Tag as TagIcon,
  Download,
} from "lucide-react";
import type { PinItem } from "../types";
import { useItemStore } from "../store/useItemStore";
import * as clipboard from "../services/clipboard";
import * as fs from "../services/fs";
import { startFileDrag } from "../services/dragdrop";
import { ContextMenu, type MenuItem } from "./ContextMenu";
import { HoverPreview, useHoverPreview } from "./HoverPreview";
import { timeAgo } from "../utils/time";
import { useNow } from "../hooks/useNow";
import "./ItemCard.css";

interface Props {
  item: PinItem;
}

export function ItemCard({ item }: Props) {
  const { removeItem, togglePin, incUseCount, updateItem } = useItemStore();
  const [copied, setCopied] = useState(false);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const now = useNow(30_000);
  const isDownload = item.source === "download";

  // Hover 预览（仅文字 / 图片类型）
  const needPreview = item.type === "text" || item.type === "image";
  const hover = useHoverPreview(450);

  const showCopied = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  const handleCopy = async () => {
    try {
      if (item.type === "text") {
        await clipboard.copyText(item.content);
      } else if (item.type === "file" && item.filePath) {
        if (item.isMissing) return;
        await clipboard.copyFile(item.filePath);
      } else if (item.type === "image" && item.filePath) {
        await clipboard.copyImage(item.filePath);
      }
      await incUseCount(item.id);
      showCopied();
    } catch (e) {
      console.error("copy failed:", e);
    }
  };

  const handleDoubleClick = async () => {
    if ((item.type === "file" || item.type === "image") && item.filePath && !item.isMissing) {
      try {
        await fs.openPath(item.filePath);
        await incUseCount(item.id);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleDragStart = async (e: React.DragEvent) => {
    if ((item.type === "file" || item.type === "image") && item.filePath && !item.isMissing) {
      e.preventDefault();
      try {
        await startFileDrag([item.filePath]);
      } catch (err) {
        console.error("drag failed:", err);
      }
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
  };

  const addTag = async () => {
    const t = window.prompt("添加标签：");
    if (t && t.trim()) {
      const nt = t.trim();
      if (!item.tags.includes(nt)) {
        await updateItem(item.id, { tags: [...item.tags, nt] });
      }
    }
  };

  const removeTag = async (tag: string) => {
    await updateItem(item.id, { tags: item.tags.filter((t) => t !== tag) });
  };

  const menuItems: MenuItem[] = [
    { label: "复制", icon: <Copy size={14} />, onClick: handleCopy },
    ...(item.type !== "text"
      ? [
          {
            label: "打开",
            icon: <FolderOpen size={14} />,
            onClick: handleDoubleClick,
            disabled: item.isMissing,
          },
          {
            label: "在资源管理器中显示",
            icon: <FolderOpen size={14} />,
            onClick: () => item.filePath && fs.showInExplorer(item.filePath),
            disabled: item.isMissing,
          },
          {
            label: "复制路径",
            icon: <Copy size={14} />,
            onClick: () => item.filePath && clipboard.copyText(item.filePath),
          },
        ]
      : []),
    { divider: true },
    {
      label: item.isPinned ? "取消置顶" : "置顶",
      icon: item.isPinned ? <PinOff size={14} /> : <Pin size={14} />,
      onClick: () => togglePin(item.id),
    },
    { label: "添加标签", icon: <TagIcon size={14} />, onClick: addTag },
    { divider: true },
    {
      label: "删除",
      icon: <Trash2 size={14} />,
      onClick: () => removeItem(item.id),
      danger: true,
    },
  ];

  return (
    <>
      <div
        ref={(el) => {
          (rootRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
          if (needPreview) {
            (hover.anchorRef as React.MutableRefObject<HTMLElement | null>).current = el;
          }
        }}
        className={`card card--${item.type} ${
          isDownload ? "card--download" : ""
        } ${item.isMissing ? "is-missing" : ""} ${
          item.isPinned ? "is-pinned" : ""
        }`}
        draggable={item.type !== "text" && !item.isMissing}
        onDragStart={handleDragStart}
        onClick={handleCopy}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={needPreview ? hover.bind.onMouseEnter : undefined}
        onMouseLeave={needPreview ? hover.bind.onMouseLeave : undefined}
        title={
          needPreview
            ? undefined
            : item.type === "text"
              ? "点击复制文字"
              : item.isMissing
                ? "文件已失效"
                : "点击复制 · 双击打开 · 可拖出"
        }
      >
        {/* 顶部 */}
        <div className="card__head">
          <div className="card__icon">
            {item.type === "file" && <FileIcon size={16} />}
            {item.type === "text" && <FileText size={16} />}
            {item.type === "image" && <ImageIcon size={16} />}
            {isDownload && (
              <span className="card__icon-badge" title="自动捕获的下载文件">
                <Download size={9} strokeWidth={3} />
              </span>
            )}
          </div>
          <div className="card__title">
            {item.type === "text" ? <TextPreview text={item.content} /> : item.content}
          </div>
          <div className="card__head-right">
            {isDownload && (
              <span className="card__time">{timeAgo(item.createdAt, now)}</span>
            )}
            {item.isPinned && <Pin size={12} className="card__pin-ind" />}
            {item.isMissing && (
              <AlertCircle size={14} className="card__missing-ind" />
            )}
            <button
              className="card__menu-btn"
              onClick={(e) => {
                e.stopPropagation();
                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                setMenuPos({ x: rect.right, y: rect.bottom });
              }}
              title="更多"
            >
              <MoreHorizontal size={14} />
            </button>
          </div>
        </div>

        {/* 副信息 */}
        {item.type === "file" && item.filePath && (
          <div className="card__sub">{item.filePath}</div>
        )}
        {item.type === "image" && item.thumbnail && (
          <div className="card__thumb">
            <img src={item.thumbnail} alt={item.content} />
          </div>
        )}

        {/* 标签 */}
        {item.tags.length > 0 && (
          <div className="card__tags">
            {item.tags.map((t) => (
              <span
                key={t}
                className="card__tag"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(t);
                }}
                title="点击移除"
              >
                #{t}
              </span>
            ))}
          </div>
        )}

        {/* 复制反馈 */}
        {copied && (
          <div className="card__copied">
            <CheckCheck size={14} />
            已复制
          </div>
        )}
      </div>

      {menuPos && (
        <ContextMenu
          x={menuPos.x}
          y={menuPos.y}
          items={menuItems}
          onClose={() => setMenuPos(null)}
        />
      )}

      {needPreview && hover.visible && hover.anchorRect && (
        <HoverPreview
          anchorRect={hover.anchorRect}
          maxWidth={item.type === "image" ? 420 : 360}
          interactive={item.type === "text"}
          onMouseEnter={hover.hoverBind.onMouseEnter}
          onMouseLeave={hover.hoverBind.onMouseLeave}
        >
          {item.type === "text" ? (
            <div className="hover-preview__text">{item.content}</div>
          ) : (
            <ImagePreviewBody item={item} />
          )}
        </HoverPreview>
      )}
    </>
  );
}

function ImagePreviewBody({ item }: { item: PinItem }) {
  const src =
    item.thumbnail ||
    (item.filePath ? fs.toAssetUrl(item.filePath) : undefined);
  if (!src) return null;
  return (
    <div className="hover-preview--image-wrap">
      <div className="hover-preview__image">
        <img src={src} alt={item.content} />
      </div>
      <div className="hover-preview__meta">{item.content}</div>
    </div>
  );
}

function TextPreview({ text }: { text: string }) {
  const first = text.split("\n")[0];
  return <span className="card__text-preview">{first}</span>;
}
