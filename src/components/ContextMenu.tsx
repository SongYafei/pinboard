import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./ContextMenu.css";

export interface MenuItemSep {
  divider: true;
}
export interface MenuItemAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}
export type MenuItem = MenuItemSep | MenuItemAction;

interface Props {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let nx = x;
    let ny = y;
    if (x + rect.width > vw) nx = vw - rect.width - 4;
    if (y + rect.height > vh) ny = vh - rect.height - 4;
    setPos({ x: Math.max(4, nx), y: Math.max(4, ny) });
  }, [x, y]);

  useEffect(() => {
    const close = () => onClose();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("mousedown", close);
    window.addEventListener("blur", close);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("blur", close);
      window.removeEventListener("keydown", esc);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      className="ctx-menu"
      style={{ left: pos.x, top: pos.y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {items.map((it, i) =>
        "divider" in it ? (
          <div key={`sep-${i}`} className="ctx-menu__divider" />
        ) : (
          <button
            key={`item-${i}`}
            className={`ctx-menu__item ${it.danger ? "is-danger" : ""}`}
            disabled={it.disabled}
            onClick={() => {
              if (it.disabled) return;
              it.onClick();
              onClose();
            }}
          >
            <span className="ctx-menu__icon">{it.icon}</span>
            <span className="ctx-menu__label">{it.label}</span>
          </button>
        ),
      )}
    </div>,
    document.body,
  );
}
