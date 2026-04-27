import { useEffect } from "react";
import { createPortal } from "react-dom";
import "./Toast.css";

export interface ToastProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
  duration?: number;
}

export function Toast({
  message,
  actionLabel,
  onAction,
  onClose,
  duration = 4000,
}: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [duration, onClose]);

  return createPortal(
    <div className="toast">
      <span className="toast__msg">{message}</span>
      {actionLabel && (
        <button
          className="toast__action"
          onClick={() => {
            onAction?.();
            onClose();
          }}
        >
          {actionLabel}
        </button>
      )}
      <button className="toast__close" onClick={onClose}>
        ×
      </button>
    </div>,
    document.body,
  );
}
