use std::fs::OpenOptions;
use std::io::Write;

/// 把一段文字 append 到指定路径（若不存在则创建）
#[tauri::command]
pub fn append_log(path: String, chunk: String) -> Result<(), String> {
    if let Some(parent) = std::path::Path::new(&path).parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let mut f = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| e.to_string())?;
    f.write_all(chunk.as_bytes()).map_err(|e| e.to_string())?;
    Ok(())
}
