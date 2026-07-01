# Kill stale dev ports, then start Vite (Windows-safe single entry point)
& "$PSScriptRoot\kill-dev-ports.ps1"
Set-Location (Join-Path $PSScriptRoot "..")
npm exec vite
