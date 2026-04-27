import { invoke, convertFileSrc } from "@tauri-apps/api/core";

/** 文件是否存在 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    return await invoke<boolean>("path_exists", { path });
  } catch {
    return false;
  }
}

/** 在默认程序中打开文件 / 目录 / URL（走 Rust ShellExecute，绕过 shell scope 限制） */
export async function openPath(path: string): Promise<void> {
  await invoke("open_path", { path });
}

/** 在资源管理器中显示 */
export async function showInExplorer(path: string): Promise<void> {
  await invoke("show_in_explorer", { path });
}

/** 保存图片字节到 APPDATA/pinboard/images/，返回绝对路径 */
export async function saveImage(bytes: Uint8Array, ext = "png"): Promise<string> {
  return await invoke<string>("save_image", {
    bytes: Array.from(bytes),
    ext,
  });
}

/** 把本地路径转为 webview 可访问的 URL */
export function toAssetUrl(path: string): string {
  return convertFileSrc(path);
}

/** 从完整路径提取文件名 */
export function basename(p: string): string {
  const m = p.replace(/\\/g, "/").split("/");
  return m[m.length - 1] || p;
}

/** 提取后缀 */
export function extname(p: string): string {
  const name = basename(p);
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
}

/** 判断是否图片扩展名 */
export function isImageExt(ext: string): boolean {
  return ["png", "jpg", "jpeg", "gif", "bmp", "webp", "ico", "svg"].includes(
    ext.toLowerCase(),
  );
}
