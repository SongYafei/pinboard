/// 把文件拖出到其他程序。
/// MVP 阶段：降级方案，把文件路径以 CF_HDROP 形式写到剪贴板，用户在目标处 Ctrl+V 粘贴。
/// 后续可接入原生 DoDragDrop 实现真正的拖出。
#[tauri::command]
pub fn start_file_drag(paths: Vec<String>) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        super::win_clipboard::copy_files(&paths).map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = paths;
        Err("only windows supported".into())
    }
}
