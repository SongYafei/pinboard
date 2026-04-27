Add-Type @'
using System;
using System.Runtime.InteropServices;
public class W2 {
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int ht, bool repaint);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L,T,R,B; }
}
'@
$p = Get-Process pinboard -ErrorAction SilentlyContinue
if (-not $p) { Write-Host "no pinboard"; exit 1 }
$h = $p.MainWindowHandle
[W2]::MoveWindow($h, -352, 150, 360, 560, $true) | Out-Null
Start-Sleep -Milliseconds 300
$r = New-Object W2+RECT
[W2]::GetWindowRect($h, [ref]$r) | Out-Null
Write-Host "After MoveWindow(-352,150,360,560): actual=L$($r.L) T$($r.T) R$($r.R) B$($r.B)"

# 还原
[W2]::MoveWindow($h, 200, 150, 360, 560, $true) | Out-Null
