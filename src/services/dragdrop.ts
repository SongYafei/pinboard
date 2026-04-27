import { invoke } from "@tauri-apps/api/core";

/** 从应用内把文件拖拽出去到其他软件 */
export async function startFileDrag(paths: string[]): Promise<void> {
  await invoke("start_file_drag", { paths });
}
