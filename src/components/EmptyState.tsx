import { Pin, FileText, ImageIcon, FolderOpen, Download } from "lucide-react";
import { useItemStore } from "../store/useItemStore";
import { useSettingsStore } from "../store/useSettingsStore";
import "./EmptyState.css";

export function EmptyState() {
  const filter = useItemStore((s) => s.filter);
  const downloadWatch = useSettingsStore((s) => s.downloadWatch);

  if (filter === "download") {
    return (
      <div className="empty">
        <div className="empty__icon-wrap empty__icon-wrap--green">
          <Download size={30} />
        </div>
        <div className="empty__title">还没有下载文件</div>
        <div className="empty__desc">
          {downloadWatch
            ? "从浏览器下载任意文件，完成后会自动出现在这里"
            : '请先在设置里开启 "自动捕获下载"'}
        </div>
      </div>
    );
  }

  return (
    <div className="empty">
      <div className="empty__icon-wrap">
        <Pin size={30} />
      </div>
      <div className="empty__title">还没有钉住任何东西</div>
      <div className="empty__desc">把常用的文件、文字或图片拖到这里</div>
      <div className="empty__hints">
        <div className="empty__hint">
          <FolderOpen size={14} /> 拖入文件
        </div>
        <div className="empty__hint">
          <FileText size={14} /> Ctrl+V 粘贴文字
        </div>
        <div className="empty__hint">
          <ImageIcon size={14} /> Ctrl+V 粘贴图片
        </div>
      </div>
    </div>
  );
}
