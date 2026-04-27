Remove-Item 'C:\Users\yafeisong\pinboard\tauri-dev.log' -ErrorAction SilentlyContinue
Remove-Item 'C:\Users\yafeisong\pinboard\tauri-dev.err.log' -ErrorAction SilentlyContinue

$proc = Start-Process `
  -FilePath 'C:\Users\yafeisong\pinboard\run-dev.bat' `
  -WorkingDirectory 'C:\Users\yafeisong\pinboard' `
  -WindowStyle Minimized `
  -RedirectStandardOutput 'C:\Users\yafeisong\pinboard\tauri-dev.log' `
  -RedirectStandardError  'C:\Users\yafeisong\pinboard\tauri-dev.err.log' `
  -PassThru

Write-Host "PID=$($proc.Id)"
