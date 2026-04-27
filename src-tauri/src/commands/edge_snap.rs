//! 自动吸附边缘相关的原生支持：
//! - get_monitor_work_area: 返回窗口当前所在显示器的工作区（排除任务栏）
//! - get_cursor_pos: 实时鼠标坐标（物理像素），前端轮询判定是否靠近吸附条

use serde::Serialize;
use tauri::{Runtime, WebviewWindow};

#[derive(Serialize)]
pub struct WorkArea {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    /// 当前窗口缩放比（scale_factor），前端用来把物理像素换算成逻辑像素
    pub scale: f64,
}

#[tauri::command]
pub fn get_monitor_work_area<R: Runtime>(window: WebviewWindow<R>) -> Result<WorkArea, String> {
    let mon = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "no monitor".to_string())?;
    let pos = mon.position();
    let size = mon.size();
    let scale = mon.scale_factor();

    // 物理像素 -> 用 Windows API 获取工作区（排除任务栏）
    #[cfg(target_os = "windows")]
    {
        if let Some(wa) = windows_work_area(pos.x, pos.y, size.width, size.height) {
            return Ok(WorkArea {
                x: wa.0,
                y: wa.1,
                width: wa.2,
                height: wa.3,
                scale,
            });
        }
    }

    Ok(WorkArea {
        x: pos.x,
        y: pos.y,
        width: size.width,
        height: size.height,
        scale,
    })
}

#[cfg(target_os = "windows")]
fn windows_work_area(mx: i32, my: i32, mw: u32, mh: u32) -> Option<(i32, i32, u32, u32)> {
    use windows::Win32::Foundation::{POINT, RECT};
    use windows::Win32::Graphics::Gdi::{
        GetMonitorInfoW, MonitorFromPoint, MONITORINFO, MONITOR_DEFAULTTONEAREST,
    };
    unsafe {
        let cx = mx + (mw as i32) / 2;
        let cy = my + (mh as i32) / 2;
        let hmon = MonitorFromPoint(POINT { x: cx, y: cy }, MONITOR_DEFAULTTONEAREST);
        let mut mi = MONITORINFO {
            cbSize: std::mem::size_of::<MONITORINFO>() as u32,
            rcMonitor: RECT::default(),
            rcWork: RECT::default(),
            dwFlags: 0,
        };
        let ok: bool = GetMonitorInfoW(hmon, &mut mi as *mut _).into();
        if ok {
            let w = &mi.rcWork;
            return Some((
                w.left,
                w.top,
                (w.right - w.left) as u32,
                (w.bottom - w.top) as u32,
            ));
        }
    }
    None
}

#[derive(Serialize)]
pub struct CursorPos {
    pub x: i32,
    pub y: i32,
}

/// 返回鼠标全局位置（物理像素）
#[tauri::command]
pub fn get_cursor_pos() -> Result<CursorPos, String> {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::Foundation::POINT;
        use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;
        let mut p = POINT { x: 0, y: 0 };
        unsafe {
            GetCursorPos(&mut p).map_err(|e| e.to_string())?;
        }
        return Ok(CursorPos { x: p.x, y: p.y });
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("only windows supported".into())
    }
}

/// 直接用 Win32 MoveWindow 移动窗口（绕过 Tauri setPosition 在屏幕外坐标的限制）
#[tauri::command]
pub fn move_window_raw<R: Runtime>(
    window: WebviewWindow<R>,
    x: i32,
    y: i32,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::Foundation::HWND;
        use windows::Win32::UI::WindowsAndMessaging::{GetWindowRect, MoveWindow};
        let hwnd = window.hwnd().map_err(|e| e.to_string())?;
        let h = HWND(hwnd.0 as _);
        let mut rect = windows::Win32::Foundation::RECT::default();
        unsafe {
            GetWindowRect(h, &mut rect as *mut _).map_err(|e| e.to_string())?;
            let w = rect.right - rect.left;
            let ht = rect.bottom - rect.top;
            MoveWindow(h, x, y, w, ht, true).map_err(|e| e.to_string())?;
        }
        return Ok(());
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (x, y);
        Err("only windows supported".into())
    }
}

/// 读取真实窗口位置和尺寸（物理像素）。Tauri 的 outerPosition 在被 Win32 MoveWindow 移动后不同步，必须用这个
#[derive(Serialize)]
pub struct WindowRect {
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
}

#[tauri::command]
pub fn get_window_rect_raw<R: Runtime>(window: WebviewWindow<R>) -> Result<WindowRect, String> {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::Foundation::HWND;
        use windows::Win32::UI::WindowsAndMessaging::GetWindowRect;
        let hwnd = window.hwnd().map_err(|e| e.to_string())?;
        let h = HWND(hwnd.0 as _);
        let mut rect = windows::Win32::Foundation::RECT::default();
        unsafe {
            GetWindowRect(h, &mut rect as *mut _).map_err(|e| e.to_string())?;
        }
        return Ok(WindowRect {
            x: rect.left,
            y: rect.top,
            w: rect.right - rect.left,
            h: rect.bottom - rect.top,
        });
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("only windows supported".into())
    }
}
