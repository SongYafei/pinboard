param([int]$x = 200, [int]$y = 150)

Add-Type @'
using System;
using System.Runtime.InteropServices;
public class W3 {
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int ht, bool repaint);
}
'@
$p = Get-Process pinboard -ErrorAction SilentlyContinue
if (-not $p) { Write-Host "no pinboard"; exit 1 }
$h = $p.MainWindowHandle
[W3]::MoveWindow($h, $x, $y, 360, 560, $true) | Out-Null
Write-Host "moved to ($x, $y)"
