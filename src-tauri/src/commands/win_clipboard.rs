//! Windows 原生剪贴板工具（CF_HDROP / CF_DIB）
#![cfg(target_os = "windows")]

use std::ffi::OsStr;
use std::os::windows::ffi::OsStrExt;
use windows::Win32::Foundation::{HANDLE, HWND, POINT};
use windows::Win32::System::DataExchange::{
    CloseClipboard, EmptyClipboard, OpenClipboard, SetClipboardData,
};
use windows::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE};
use windows::Win32::System::Ole::CF_HDROP;
use windows::Win32::UI::Shell::DROPFILES;

const CF_DIB: u32 = 8;

/// CF_HDROP：把一组文件路径写入剪贴板
pub fn copy_files(paths: &[String]) -> anyhow::Result<()> {
    // 构建宽字符双零终止串
    let mut wide: Vec<u16> = Vec::new();
    for p in paths {
        wide.extend(OsStr::new(p).encode_wide());
        wide.push(0);
    }
    wide.push(0);

    let dropfiles_size = std::mem::size_of::<DROPFILES>();
    let total = dropfiles_size + wide.len() * 2;

    unsafe {
        let hglobal = GlobalAlloc(GMEM_MOVEABLE, total)?;
        let ptr = GlobalLock(hglobal);
        if ptr.is_null() {
            return Err(anyhow::anyhow!("GlobalLock failed"));
        }

        let df = DROPFILES {
            pFiles: dropfiles_size as u32,
            pt: POINT { x: 0, y: 0 },
            fNC: false.into(),
            fWide: true.into(),
        };
        std::ptr::copy_nonoverlapping(
            &df as *const _ as *const u8,
            ptr as *mut u8,
            dropfiles_size,
        );

        let wide_ptr = (ptr as *mut u8).add(dropfiles_size) as *mut u16;
        std::ptr::copy_nonoverlapping(wide.as_ptr(), wide_ptr, wide.len());

        let _ = GlobalUnlock(hglobal);

        OpenClipboard(HWND::default())?;
        EmptyClipboard()?;
        SetClipboardData(CF_HDROP.0.into(), HANDLE(hglobal.0 as _))?;
        CloseClipboard()?;
    }
    Ok(())
}

/// CF_DIB：把 RGBA 像素写入剪贴板（top-down DIB）
pub fn copy_rgba(width: u32, height: u32, rgba: Vec<u8>) -> anyhow::Result<()> {
    #[repr(C)]
    struct Bmih {
        bi_size: u32,
        bi_width: i32,
        bi_height: i32,
        bi_planes: u16,
        bi_bit_count: u16,
        bi_compression: u32,
        bi_size_image: u32,
        bi_x_pels_per_meter: i32,
        bi_y_pels_per_meter: i32,
        bi_clr_used: u32,
        bi_clr_important: u32,
    }
    let bmih_size = std::mem::size_of::<Bmih>();
    let pixels_size = (width * height * 4) as usize;
    let total = bmih_size + pixels_size;

    // RGBA -> BGRA
    let mut pixels = vec![0u8; pixels_size];
    for (src, dst) in rgba.chunks_exact(4).zip(pixels.chunks_exact_mut(4)) {
        dst[0] = src[2];
        dst[1] = src[1];
        dst[2] = src[0];
        dst[3] = src[3];
    }

    let bmih = Bmih {
        bi_size: bmih_size as u32,
        bi_width: width as i32,
        bi_height: -(height as i32), // top-down
        bi_planes: 1,
        bi_bit_count: 32,
        bi_compression: 0,
        bi_size_image: pixels_size as u32,
        bi_x_pels_per_meter: 0,
        bi_y_pels_per_meter: 0,
        bi_clr_used: 0,
        bi_clr_important: 0,
    };

    unsafe {
        let hglobal = GlobalAlloc(GMEM_MOVEABLE, total)?;
        let ptr = GlobalLock(hglobal);
        if ptr.is_null() {
            return Err(anyhow::anyhow!("GlobalLock failed"));
        }
        std::ptr::copy_nonoverlapping(&bmih as *const _ as *const u8, ptr as *mut u8, bmih_size);
        std::ptr::copy_nonoverlapping(
            pixels.as_ptr(),
            (ptr as *mut u8).add(bmih_size),
            pixels_size,
        );
        let _ = GlobalUnlock(hglobal);

        OpenClipboard(HWND::default())?;
        EmptyClipboard()?;
        SetClipboardData(CF_DIB, HANDLE(hglobal.0 as _))?;
        CloseClipboard()?;
    }
    Ok(())
}
