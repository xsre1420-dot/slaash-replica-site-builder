# Mark local migrations as already applied on the linked remote (baseline / repair).
# Use when the remote DB already has legacy schema and db push fails with already exists.
# Does NOT delete data - only updates supabase_migrations.schema_migrations.
#
# Usage:
#   npm run db:baseline -- -UpTo 20260521105441
#   npm run db:baseline -- -From 20250909212106 -UpTo 20260521105441
#   npm run db:baseline -- -UpTo 20260521105441 -DryRun
#   npm run db:baseline -- -All

param(
  [string]$UpTo = "",
  [string]$From = "",
  [switch]$All,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

Write-Host "=== Slaash Platform - Migration Baseline ===" -ForegroundColor Cyan

if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
  Write-Host "Supabase CLI not found." -ForegroundColor Red
  exit 1
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$linkFile = Join-Path $repoRoot "supabase\.temp\project-ref"
if (-not (Test-Path $linkFile)) {
  Write-Host "Project not linked. Run: supabase link --project-ref YOUR_PROJECT_REF" -ForegroundColor Yellow
  exit 1
}

function Get-MigrationVersion([string]$FileName) {
  if ($FileName -match '^(\d{14})') { return $Matches[1] }
  return $null
}

$migrationsDir = Join-Path $repoRoot "supabase\migrations"
$files = Get-ChildItem $migrationsDir -Filter "*.sql" | Sort-Object Name

if ($files.Count -eq 0) {
  Write-Host "No migration files found." -ForegroundColor Red
  exit 1
}

if (-not $All -and [string]::IsNullOrWhiteSpace($UpTo)) {
  Write-Host ""
  Write-Host "Mark migrations as applied WITHOUT re-running them (safe for existing data)." -ForegroundColor Yellow
  Write-Host ""
  Write-Host "Examples:" -ForegroundColor White
  Write-Host "  npm run db:baseline -- -UpTo 20260521105441" -ForegroundColor Gray
  Write-Host "  npm run db:baseline -- -From 20250909212106 -UpTo 20260521105441" -ForegroundColor Gray
  Write-Host "  npm run db:baseline -- -All" -ForegroundColor Gray
  Write-Host "  npm run db:baseline -- -UpTo 20260521105441 -DryRun" -ForegroundColor Gray
  Write-Host ""
  Write-Host "Then run: npm run db:deploy" -ForegroundColor Green
  exit 0
}

Push-Location $repoRoot
try {
  $marked = 0
  foreach ($file in $files) {
    $version = Get-MigrationVersion $file.Name
    if (-not $version) {
      Write-Host ("Skip invalid name: " + $file.Name) -ForegroundColor DarkGray
      continue
    }

    if (-not $All -and -not [string]::IsNullOrWhiteSpace($From)) {
      if ([string]$version -lt [string]$From) {
        continue
      }
    }

    if (-not $All -and -not [string]::IsNullOrWhiteSpace($UpTo)) {
      if ([string]$version -gt [string]$UpTo) {
        Write-Host ("Stop at " + $UpTo + " (next pending: " + $version + ")") -ForegroundColor DarkGray
        break
      }
    }

    if ($DryRun) {
      Write-Host ("[dry-run] would mark applied: " + $version + " (" + $file.Name + ")") -ForegroundColor Gray
    } else {
      Write-Host ("Marking applied: " + $version + " (" + $file.Name + ")") -ForegroundColor Green
      supabase migration repair --status applied $version
      if ($LASTEXITCODE -ne 0) {
        Write-Host ("Repair failed for " + $version) -ForegroundColor Red
        exit $LASTEXITCODE
      }
    }
    $marked++
  }

  Write-Host ""
  if ($DryRun) {
    Write-Host ("Dry run complete (" + $marked + " migrations).") -ForegroundColor Cyan
  } else {
    Write-Host ("Baseline complete (" + $marked + " migrations marked applied).") -ForegroundColor Cyan
    Write-Host "Next: npm run db:deploy" -ForegroundColor Green
  }
} finally {
  Pop-Location
}
