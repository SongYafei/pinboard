import {
  Search,
  X,
  File,
  FileText,
  Image as ImageIcon,
  Layers,
  Download,
} from "lucide-react";
import {
  useItemStore,
  useAllTags,
  useDownloadCount,
} from "../store/useItemStore";
import type { FilterKey } from "../types";
import "./Toolbar.css";

const TABS: { key: FilterKey; label: string; icon: JSX.Element }[] = [
  { key: "all", label: "全部", icon: <Layers size={13} /> },
  { key: "file", label: "文件", icon: <File size={13} /> },
  { key: "text", label: "文字", icon: <FileText size={13} /> },
  { key: "image", label: "图片", icon: <ImageIcon size={13} /> },
  { key: "download", label: "下载", icon: <Download size={13} /> },
];

export function Toolbar() {
  const { search, setSearch, filter, setFilter, activeTag, setActiveTag } =
    useItemStore();
  const tags = useAllTags();
  const dlCount = useDownloadCount();

  return (
    <div className="toolbar">
      <div className="toolbar__search">
        <Search size={14} className="toolbar__search-icon" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索内容 / 文件名 / 标签"
        />
        {search && (
          <button className="toolbar__search-clear" onClick={() => setSearch("")}>
            <X size={12} />
          </button>
        )}
      </div>

      <div className="toolbar__tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`toolbar__tab ${filter === t.key ? "is-active" : ""}`}
            onClick={() => setFilter(t.key)}
            title={t.label}
          >
            {t.icon}
            <span>{t.label}</span>
            {t.key === "download" && dlCount > 0 && (
              <span className="toolbar__tab-badge">{dlCount}</span>
            )}
          </button>
        ))}
      </div>

      {tags.length > 0 && (
        <div className="toolbar__tags">
          <button
            className={`toolbar__tag ${activeTag === null ? "is-active" : ""}`}
            onClick={() => setActiveTag(null)}
          >
            全部标签
          </button>
          {tags.map((t) => (
            <button
              key={t}
              className={`toolbar__tag ${activeTag === t ? "is-active" : ""}`}
              onClick={() => setActiveTag(activeTag === t ? null : t)}
            >
              #{t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
