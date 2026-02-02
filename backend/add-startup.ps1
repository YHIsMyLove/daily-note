$ErrorActionPreference = "Stop"

$WshShell = New-Object -ComObject WScript.Shell
$StartupFolder = [Environment]::GetFolderPath("Startup")
$ShortcutPath = Join-Path $StartupFolder "Daily-Note-Backend.lnk"

$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "C:\Users\soeaz\Documents\Work\0-make-money\daily-note\backend\start.bat"
$Shortcut.WorkingDirectory = "C:\Users\soeaz\Documents\Work\0-make-money\daily-note\backend"
$Shortcut.Description = "Daily Note Backend Service"
$Shortcut.Save()

Write-Host "========================================" -ForegroundColor Green
Write-Host "  开机启动项已成功添加！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "快捷方式位置: $ShortcutPath"
Write-Host ""
Write-Host "如需移除开机启动，请删除该快捷方式文件"
Write-Host ""
