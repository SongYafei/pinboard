/// 把文件路径列表写入剪贴板（CF_HDROP），让其他程序可粘贴文件
#[tauri::command]
pub fn copy_file_to_clipboard(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        super::win_clipboard::copy_files(&[path]).map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = path;
        Err("only windows supported".into())
    }
}

/// 把图片文件内容作为 CF_DIB 写入剪贴板
#[tauri::command]
pub fn copy_image_to_clipboard(path: String) -> Result<(), String> {
    let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
    let img = image::load_from_memory(&bytes).map_err(|e| e.to_string())?;
    let rgba = img.to_rgba8();
    let (w, h) = rgba.dimensions();

    #[cfg(target_os = "windows")]
    {
        super::win_clipboard::copy_rgba(w, h, rgba.into_raw()).map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (w, h);
        Err("only windows supported".into())
    }
}
