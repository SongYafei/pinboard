Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

Add-Type @'
using System;
using System.Runtime.InteropServices;
public class Win2 {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint flags);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L,T,R,B; }
}
'@

$p = Get-Process pinboard -ErrorAction SilentlyContinue
if (-not $p) { Write-Host 'not running'; exit 1 }
$h = $p.MainWindowHandle

$r = New-Object Win2+RECT
[Win2]::GetWindowRect($h, [ref]$r) | Out-Null

# 整屏截图（避免透明窗口截图不稳）
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$out = 'C:\Users\yafeisong\pinboard\screen.png'
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()

# 只裁剪窗口区域
$w = $r.R - $r.L; $ht = $r.B - $r.T
if ($w -gt 0 -and $ht -gt 0 -and $r.L -ge 0 -and $r.T -ge 0 -and ($r.L+$w) -le $bounds.Width -and ($r.T+$ht) -le $bounds.Height) {
  $full = [System.Drawing.Image]::FromFile($out)
  $crop = New-Object System.Drawing.Bitmap $w, $ht
  $g2 = [System.Drawing.Graphics]::FromImage($crop)
  $g2.DrawImage($full, (New-Object System.Drawing.Rectangle 0, 0, $w, $ht), (New-Object System.Drawing.Rectangle $r.L, $r.T, $w, $ht), [System.Drawing.GraphicsUnit]::Pixel)
  $g2.Dispose()
  $full.Dispose()
  $cropOut = 'C:\Users\yafeisong\pinboard\window.png'
  $crop.Save($cropOut, [System.Drawing.Imaging.ImageFormat]::Png)
  $crop.Dispose()
  Write-Host "Window screenshot: $cropOut ($w x $ht)"
} else {
  Write-Host "Rect out of screen: L=$($r.L) T=$($r.T) R=$($r.R) B=$($r.B)"
}
Write-Host "Full screen: $out"
