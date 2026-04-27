@echo off
cd /d %~dp0
set PATH=C:\Users\yafeisong\.rustup\toolchains\stable-x86_64-pc-windows-msvc\bin;%PATH%
node "node_modules\@tauri-apps\cli\tauri.js" dev
