use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn path_exists(path: String) -> bool {
    Path::new(&path).exists()
}

/// 用系统默认程序打开文件 / 目录 / URL。
/// 自实现而不用 shell:open，是为了绕过 Tauri shell scope 的正则白名单限制。
#[tauri::command]
pub fn open_path(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        // 用 cmd /c start "" "<path>" 触发 Win32 ShellExecute，
        // 第一个空字符串是 start 命令的窗口标题占位，必须保留，否则带空格/引号的路径会被解析错。
        // CREATE_NO_WINDOW (0x08000000) 防止 cmd 闪现黑色控制台窗口。
        use std::os::windows::process::CommandExt;
        use std::process::Command;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        Command::new("cmd")
            .args(["/C", "start", "", &path])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[cfg(not(target_os = "windows"))]
    {
        open::that(&path).map_err(|e| e.to_string())
    }
}

/// 在资源管理器中定位文件（Windows: explorer /select,）
#[tauri::command]
pub fn show_in_explorer(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        use std::process::Command;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        Command::new("explorer")
            .args(["/select,", &path])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[cfg(not(target_os = "windows"))]
    {
        let parent = Path::new(&path).parent().ok_or("no parent")?;
        open::that(parent).map_err(|e| e.to_string())
    }
}

/// 把图片字节保存到 AppData/pinboard/images/<uuid>.<ext>，返回绝对路径
#[tauri::command]
pub fn save_image(app: AppHandle, bytes: Vec<u8>, ext: String) -> Result<String, String> {
    let base: PathBuf = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("images");
    std::fs::create_dir_all(&base).map_err(|e| e.to_string())?;

    let ext = if ext.is_empty() { "png".to_string() } else { ext };
    let name = format!("{}.{}", uuid::Uuid::new_v4(), ext);
    let path = base.join(name);
    std::fs::write(&path, &bytes).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}
