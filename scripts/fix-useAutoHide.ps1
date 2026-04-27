$p = 'C:\Users\yafeisong\pinboard\src\hooks\useAutoHide.ts'
$lines = Get-Content $p

# 查找 "initial focused=" 那一行，往前一行（const focused = await win.isFocused();）插入 reset 代码
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match 'const focused = await win\.isFocused\(\);' -and $lines[$i+1] -match 'lastFocused = focused;') {
        # 在该行之前插入重置
        $head = $lines[0..($i-1)]
        $insert = @(
            '        // HMR / mount: 强制重置状态机，防止 stateRef 残留',
            '        stateRef.current = "idle";',
            '        animatingRef.current = false;',
            '        savedPosRef.current = null;',
            ''
        )
        $tail = $lines[$i..($lines.Count-1)]
        $out = $head + $insert + $tail
        Set-Content -Path $p -Value $out -Encoding UTF8
        Write-Host "Inserted at line $($i+1). Total lines now: $($out.Count)"
        exit 0
    }
}
Write-Host "Pattern not found"
exit 1
