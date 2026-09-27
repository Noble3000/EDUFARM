# EDUFARM nightly Postgres backup → Cloudflare R2 (local-first).
# Schedule: Task Scheduler → nightly → powershell -File infra/backup.ps1
# Requires: pg_dump in PATH, R2 creds in .env, rclone or aws-cli with R2 endpoint.

$ErrorActionPreference = "Stop"
$date = Get-Date -Format "yyyy-MM-dd"
$dump = "backups/edufarm-$date.dump"
New-Item -ItemType Directory -Force -Path "backups" | Out-Null
pg_dump $env:DATABASE_URL -Fc -f $dump
Write-Output "Dumped $dump — upload to R2 bucket edufarm-backups/ (rclone/aws-cli step goes here)."
# Example (after configuring R2 remote):
# rclone copy $dump r2remote:edufarm-backups/ --progress
