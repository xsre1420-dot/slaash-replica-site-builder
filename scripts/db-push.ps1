# Apply all pending Supabase migrations to your linked project.
# Run from repo root in PowerShell.

$ErrorActionPreference = "Stop"

Write-Host "=== Slaash Platform — Database Deploy ===" -ForegroundColor Cyan

if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
  Write-Host "Supabase CLI not found. Install: https://supabase.com/docs/guides/cli" -ForegroundColor Red
  exit 1
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$linkFile = Join-Path $repoRoot "supabase\.temp\project-ref"
if (-not (Test-Path $linkFile)) {
  Write-Host ""
  Write-Host "Project not linked. Run first:" -ForegroundColor Yellow
  Write-Host "  supabase login" -ForegroundColor White
  Write-Host "  supabase link --project-ref YOUR_PROJECT_REF" -ForegroundColor White
  Write-Host ""
  Write-Host "Or paste migrations manually in Supabase Dashboard > SQL Editor:" -ForegroundColor Yellow
  Get-ChildItem (Join-Path $repoRoot "supabase\migrations\20260616*.sql") | ForEach-Object {
    Write-Host "  - $($_.Name)" -ForegroundColor Gray
  }
  exit 1
}

Push-Location $repoRoot
try {
  Write-Host "Pushing migrations..." -ForegroundColor Green
  supabase db push --yes
  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "Push failed. If objects already exist on remote, try baseline then redeploy:" -ForegroundColor Yellow
    Write-Host "  npm run db:baseline -- -UpTo 20250823232602" -ForegroundColor White
    Write-Host "  npm run db:deploy" -ForegroundColor White
    Write-Host ""
    Write-Host "Or use idempotent reconcile migration 20250628180100 (included in repo)." -ForegroundColor Yellow
    exit $LASTEXITCODE
  }

  Write-Host ""
  Write-Host "Regenerating TypeScript types..." -ForegroundColor Green
  supabase gen types typescript --linked | Out-File -Encoding utf8 "src/integrations/supabase/types.generated.ts"
  Write-Host "Types written to src/integrations/supabase/types.generated.ts" -ForegroundColor Green
  Write-Host "Review and merge into types.ts if needed." -ForegroundColor Yellow
  Write-Host ""
  Write-Host "Done. Verify checkout + product create in the app." -ForegroundColor Cyan
} finally {
  Pop-Location
}
