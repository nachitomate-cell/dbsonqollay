# Instalador de Sonqollay Sync. Copia el plugin a la carpeta de plugins de cada
# Navisworks (Manage/Simulate 2024-2027) detectado, por usuario (sin admin).
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$dll  = Join-Path $here 'SonqollaySync.dll'
$cfg  = Join-Path $here 'SonqollaySync.config.json'

if (!(Test-Path $dll)) {
  Write-Host "ERROR: no encuentro SonqollaySync.dll junto a este instalador." -ForegroundColor Red
  exit 1
}

# Detectar versiones de Navisworks instaladas (cualquier disco).
$found = @()
$pfs = @($env:ProgramFiles, ${env:ProgramFiles(x86)}, 'C:\Program Files', 'D:\Program Files') |
       Where-Object { $_ } | Select-Object -Unique
foreach ($pf in $pfs) {
  $base = Join-Path $pf 'Autodesk'
  if (Test-Path $base) {
    Get-ChildItem $base -Directory -ErrorAction SilentlyContinue | ForEach-Object {
      if ($_.Name -match 'Navisworks (Manage|Simulate) (\d{4})') {
        $found += "Autodesk Navisworks $($matches[1]) $($matches[2])"
      }
    }
  }
}
$found = $found | Select-Object -Unique

# Si no detecta instalación, usa Manage 2026 como objetivo por defecto.
if ($found.Count -eq 0) { $found = @('Autodesk Navisworks Manage 2026') }

$ok = 0
foreach ($name in $found) {
  $dest = Join-Path $env:APPDATA (Join-Path $name 'Plugins\SonqollaySync')
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  Copy-Item $dll $dest -Force
  if (Test-Path $cfg) { Copy-Item $cfg $dest -Force }
  Write-Host "Instalado en: $dest" -ForegroundColor Green
  $ok++
}

Write-Host ""
if ($ok -gt 0) {
  Write-Host "LISTO. Cerra y volve a abrir Navisworks." -ForegroundColor Cyan
  Write-Host "El boton 'Sonqollay Sync' aparece en la pestania Add-ins (Complementos)." -ForegroundColor Cyan
} else {
  Write-Host "No se pudo instalar." -ForegroundColor Red
}
