# Stop stale Vite/Node listeners on dev ports (8080-8090)
$ports = 8080..8090
foreach ($port in $ports) {
  $lines = netstat -ano | Select-String "LISTENING" | Select-String ":$port "
  foreach ($line in $lines) {
    $parts = ($line.ToString().Trim() -split '\s+')
    $processId = $parts[-1]
    if ($processId -match '^\d+$' -and [int]$processId -gt 0) {
      try {
        Stop-Process -Id ([int]$processId) -Force -ErrorAction SilentlyContinue
        Write-Host "Stopped PID $processId on port $port"
      } catch {
        # ignore
      }
    }
  }
}
