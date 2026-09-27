# Run a Next.js web app detached (local dev). Logs: logs/<app>.log
# Usage: powershell -ExecutionPolicy Bypass -File infra/run-web.ps1 -App web-student -Port 3001
param([string]$App = "web-student", [string]$Port = "3001")
$ErrorActionPreference = "Stop"
Set-ExecutionPolicy Bypass -Scope Process -Force
$env:Path += ";C:\Program Files\nodejs;$env:APPDATA\npm"
New-Item -ItemType Directory -Force -Path "logs" | Out-Null
Set-Location "$PSScriptRoot\..\apps\$App"
npx next dev -p $Port *>> "..\..\logs\$App.log"
