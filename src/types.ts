export type ItemType = "file" | "text" | "image";
export type ItemSource = "manual" | "download";

export interface PinItem {
  id: string;
  type: ItemType;
  /** 来源：手动钉住 / 自动监听下载（默认 manual） */
  source: ItemSource;
  /** 文字内容 or 文件显示名 or 图片原始名 */
  content: string;
  /** 文件绝对路径 / 图片本地缓存路径 */
  filePath?: string;
  /** 图片缩略图 dataURL（仅 image 类型） */
  thumbnail?: string;
  /** 图片原始尺寸（可选） */
  width?: number;
  height?: number;
  /** 标签 */
  tags: string[];
  /** 是否置顶 */
  isPinned: boolean;
  /** 文件是否失效（运行时检测，不持久化） */
  isMissing?: boolean;
  createdAt: number;
  updatedAt: number;
  /** 使用次数 */
  useCount: number;
}

export interface AppSettings {
  /** 明暗主题：跟随系统 / 亮 / 暗 */
  themeMode: "system" | "light" | "dark";
  /** 窗口透明度（0.5 - 1.0） */
  opacity: number;
  /** 开机自启 */
  autoStart: boolean;
  /** 剪贴板监听 */
  clipboardWatch: boolean;
  /** 下载监听：自动捕获下载目录新文件 */
  downloadWatch: boolean;
  /** 自动下载项最多保留数量（超出按 未Pin+最旧 删除） */
  downloadMaxKeep: number;
  /** 全局快捷键 */
  hotkey: string;
  /** 窗口位置 */
  windowX?: number;
  windowY?: number;
  windowWidth?: number;
  windowHeight?: number;
  /** 是否隐藏失效文件 */
  hideMissing: boolean;
  /** 空闲自动吸附到屏幕边缘 */
  autoHideEnabled: boolean;
  /** 空闲时长（秒），范围 3~30 */
  autoHideDelay: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  themeMode: "system",
  opacity: 1,
  autoStart: false,
  clipboardWatch: false,
  downloadWatch: true,
  downloadMaxKeep: 20,
  hotkey: "CmdOrCtrl+Shift+V",
  hideMissing: false,
  autoHideEnabled: true,
  autoHideDelay: 10,
};

/** Tab 过滤：按内容类型或按来源 */
export type FilterKey = "all" | ItemType | "download";
