Add-Type -AssemblyName System.Drawing

$iconDir = Join-Path $PSScriptRoot '..\src-tauri\icons'
New-Item -ItemType Directory -Force -Path $iconDir | Out-Null

function Make-Png([int]$size, [string]$path) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g   = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAlias

  # 背景 — 圆角蓝底
  $bg = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(0,120,212))
  $radius = [int]($size * 0.22)
  $path1 = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path1.AddArc(0, 0, $radius*2, $radius*2, 180, 90)
  $path1.AddArc($size-$radius*2-1, 0, $radius*2, $radius*2, 270, 90)
  $path1.AddArc($size-$radius*2-1, $size-$radius*2-1, $radius*2, $radius*2, 0, 90)
  $path1.AddArc(0, $size-$radius*2-1, $radius*2, $radius*2, 90, 90)
  $path1.CloseFigure()
  $g.FillPath($bg, $path1)

  # 白色 P
  $fg = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
  $fs = [int]($size * 0.58)
  $font = New-Object System.Drawing.Font 'Segoe UI', $fs, ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $sf = New-Object System.Drawing.StringFormat
  $sf.Alignment = [System.Drawing.StringAlignment]::Center
  $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
  $r = New-Object System.Drawing.RectangleF 0, (-$size * 0.02), $size, $size
  $g.DrawString('P', $font, $fg, $r, $sf)

  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Host "Generated: $path"
}

Make-Png 32  (Join-Path $iconDir '32x32.png')
Make-Png 128 (Join-Path $iconDir '128x128.png')
Make-Png 256 (Join-Path $iconDir '128x128@2x.png')
Make-Png 512 (Join-Path $iconDir 'icon.png')

# 生成 ICO (使用 128px 的 bitmap)
$bmp = [System.Drawing.Image]::FromFile((Join-Path $iconDir '128x128.png'))
$icon = [System.Drawing.Icon]::FromHandle(([System.Drawing.Bitmap]$bmp).GetHicon())
$fs = [System.IO.File]::Create((Join-Path $iconDir 'icon.ico'))
$icon.Save($fs)
$fs.Close()
$bmp.Dispose()
Write-Host "Generated: icon.ico"

# macOS icns 用一个 png 充数
Copy-Item (Join-Path $iconDir 'icon.png') (Join-Path $iconDir 'icon.icns') -Force
Write-Host "All icons generated."
