mod commands;
mod download_watch;
mod tray;

use commands::{clipboard_cmd, drag_cmd, edge_snap, fs_cmd, log_cmd};
use download_watch::DownloadWatcher;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .manage(DownloadWatcher::new())
        .invoke_handler(tauri::generate_handler![
            fs_cmd::path_exists,
            fs_cmd::open_path,
            fs_cmd::show_in_explorer,
            fs_cmd::save_image,
            clipboard_cmd::copy_file_to_clipboard,
            clipboard_cmd::copy_image_to_clipboard,
            drag_cmd::start_file_drag,
            download_watch::start_download_watch,
            download_watch::stop_download_watch,
            download_watch::is_download_watching,
            download_watch::get_download_dir,
            edge_snap::get_monitor_work_area,
            edge_snap::get_cursor_pos,
            edge_snap::move_window_raw,
            edge_snap::get_window_rect_raw,
            log_cmd::append_log,
        ])
        .setup(|app| {
            tray::setup(app.handle())?;

            // ===== 禁用窗口最大化（运行时硬约束） =====
            // tauri.conf.json 里的 maximizable:false 在 native 装饰移除/无边框模式下
            // 不能完全阻止 data-tauri-drag-region 的"双击最大化"行为，
            // 这里再加一层运行时拦截：监听 Resized 事件，一旦发现窗口被最大化，立刻还原。
            if let Some(win) = app.get_webview_window("main") {
                // 双保险：再设置一次 maximizable=false
                let _ = win.set_maximizable(false);

                let win_clone = win.clone();
                win.on_window_event(move |event| {
                    if let tauri::WindowEvent::Resized(_) = event {
                        if let Ok(true) = win_clone.is_maximized() {
                            let _ = win_clone.unmaximize();
                        }
                    }
                });
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
