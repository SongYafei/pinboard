Add-Type @'
using System;
using System.Runtime.InteropServices;
public class Wfp {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
}
'@
$p = Get-Process pinboard -EA SilentlyContinue
if ($p) {
  [Wfp]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
  Write-Host "focused pinboard"
}
