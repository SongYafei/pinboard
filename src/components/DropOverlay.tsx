import { Pin } from "lucide-react";
import "./DropOverlay.css";

interface Props {
  visible: boolean;
}

export function DropOverlay({ visible }: Props) {
  if (!visible) return null;
  return (
    <div className="drop-overlay">
      <div className="drop-overlay__inner">
        <Pin size={32} />
        <div className="drop-overlay__title">松开以钉住</div>
      </div>
    </div>
  );
}
