Add-Type @'
using System;
using System.Runtime.InteropServices;
public class Win {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int w, int ht, uint flags);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L,T,R,B; }
}
'@

$p = Get-Process pinboard -ErrorAction SilentlyContinue
if (-not $p) { Write-Host 'pinboard not running'; exit 1 }

$h = $p.MainWindowHandle
$r = New-Object Win+RECT
[Win]::GetWindowRect($h, [ref]$r) | Out-Null
$vis = [Win]::IsWindowVisible($h)
$ico = [Win]::IsIconic($h)
Write-Host "Handle=$h Visible=$vis Minimized=$ico"
Write-Host "Rect: L=$($r.L) T=$($r.T) R=$($r.R) B=$($r.B)  Size=$($r.R-$r.L)x$($r.B-$r.T)"

# 恢复并置于可见区域
[Win]::ShowWindow($h, 9) | Out-Null       # SW_RESTORE
[Win]::SetWindowPos($h, [IntPtr]-1, 200, 150, 360, 560, 0x0040) | Out-Null   # HWND_TOPMOST, SWP_SHOWWINDOW
[Win]::SetForegroundWindow($h) | Out-Null
Write-Host 'Moved to (200,150) and focused.'
