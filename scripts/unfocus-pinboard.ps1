Add-Type @'
using System;
using System.Runtime.InteropServices;
public class W {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr FindWindow(string c, string n);
}
'@
$h = [W]::FindWindow('Shell_TrayWnd', $null)
[W]::SetForegroundWindow($h) | Out-Null
Write-Host "focus moved to taskbar"
