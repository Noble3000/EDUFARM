# Run EDUFARM API detached (local dev). Logs: logs/api.log
# Usage: powershell -ExecutionPolicy Bypass -File infra/run-api.ps1
$ErrorActionPreference = "Stop"
Set-ExecutionPolicy Bypass -Scope Process -Force
$env:Path += ";C:\Program Files\nodejs;$env:APPDATA\npm"
$env:DATABASE_URL = "postgresql://edufarm:edufarm-dev-local@localhost:5432/edufarm"
$env:API_PORT = "4000"
New-Item -ItemType Directory -Force -Path "logs" | Out-Null
Set-Location "$PSScriptRoot\..\apps\api"
pnpm dev *>> "..\..\logs\api.log"
