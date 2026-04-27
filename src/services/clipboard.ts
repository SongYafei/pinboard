import { writeText, readText, readImage } from "@tauri-apps/plugin-clipboard-manager";
import { invoke } from "@tauri-apps/api/core";

/** 复制文本 */
export async function copyText(text: string): Promise<void> {
  await writeText(text);
}

/** 复制文件到剪贴板（CF_HDROP 格式，让其他程序可粘贴文件） */
export async function copyFile(path: string): Promise<void> {
  await invoke("copy_file_to_clipboard", { path });
}

/** 复制图片到剪贴板（传入本地绝对路径） */
export async function copyImage(path: string): Promise<void> {
  await invoke("copy_image_to_clipboard", { path });
}

/** 读取剪贴板文本（可能抛错） */
export async function tryReadText(): Promise<string | null> {
  try {
    return await readText();
  } catch {
    return null;
  }
}

/** 读取剪贴板图片，返回 base64 PNG，或 null */
export async function tryReadImage(): Promise<{ dataUrl: string; bytes: Uint8Array } | null> {
  try {
    const img = await readImage();
    const bytes = await img.rgba();
    const size = await img.size();
    // 把 rgba 转为 PNG base64（借助 canvas）
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d")!;
    const imgData = ctx.createImageData(size.width, size.height);
    imgData.data.set(new Uint8ClampedArray(bytes));
    ctx.putImageData(imgData, 0, 0);
    const dataUrl = canvas.toDataURL("image/png");
    // dataUrl -> bytes
    const binary = atob(dataUrl.split(",")[1]);
    const buf = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
    return { dataUrl, bytes: buf };
  } catch {
    return null;
  }
}
