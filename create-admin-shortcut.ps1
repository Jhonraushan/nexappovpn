# PowerShell script to create a shortcut with admin privileges

$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\Nexapp EDGE VPN (Admin).lnk")
$Shortcut.TargetPath = "$env:COMSPEC"
$Shortcut.Arguments = "/c start ""Nexapp EDGE VPN"" /b powershell -Command ""Start-Process -FilePath '$PWD\node_modules\.bin\electron.cmd' -ArgumentList '$PWD' -Verb RunAs"""
$Shortcut.WorkingDirectory = "$PWD"
$Shortcut.IconLocation = "$PWD\app\icon.png"
$Shortcut.Description = "Run Nexapp EDGE VPN with administrator privileges"
$Shortcut.Save()

# Set the shortcut to run as administrator
$bytes = [System.IO.File]::ReadAllBytes("$env:USERPROFILE\Desktop\Nexapp EDGE VPN (Admin).lnk")
$bytes[0x15] = $bytes[0x15] -bor 0x20 # Set the 'Run as administrator' flag
[System.IO.File]::WriteAllBytes("$env:USERPROFILE\Desktop\Nexapp EDGE VPN (Admin).lnk", $bytes)

Write-Host "Shortcut created on your desktop. You can now run Nexapp EDGE VPN with administrator privileges by double-clicking the shortcut."