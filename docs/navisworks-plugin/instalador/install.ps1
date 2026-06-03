# Instalador de Sonqollay Sync. Copia el plugin a la carpeta de plugins por-usuario
# de cada Navisworks (Manage/Simulate) detectado. Sin admin. A prueba de discos.
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$dll  = Join-Path $here 'SonqollaySync.dll'
$cfg  = Join-Path $here 'SonqollaySync.config.json'

if (!(Test-Path $dll)) {
  Write-Host "ERROR: no encuentro SonqollaySync.dll junto a este instalador." -ForegroundColor Red
  exit 1
}

# Conjunto de nombres "Autodesk Navisworks <Producto> <Año>" a instalar.
$names = New-Object System.Collections.Generic.HashSet[string]

# 1) Por las carpetas de usuario ya existentes (existen al haber abierto Navisworks).
Get-ChildItem $env:APPDATA -Directory -Filter 'Autodesk Navisworks *' -ErrorAction SilentlyContinue |
  ForEach-Object { if ($_.Name -match 'Navisworks (Manage|Simulate) \d{4}') { [void]$names.Add($_.Name) } }

# 2) Por la instalación en Archivos de programa (filtrando discos que NO existen).
$pfs = @($env:ProgramFiles, ${env:ProgramFiles(x86)}, 'C:\Program Files', 'D:\Program Files') |
       Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique
foreach ($pf in $pfs) {
  $base = Join-Path $pf 'Autodesk'
  if (Test-Path $base) {
    Get-ChildItem $base -Directory -ErrorAction SilentlyContinue | ForEach-Object {
      if ($_.Name -match 'Navisworks (Manage|Simulate) (\d{4})') {
        [void]$names.Add("Autodesk Navisworks $($matches[1]) $($matches[2])")
      }
    }
  }
}

# 3) Si no se detectó nada, usar los objetivos estándar más probables.
if ($names.Count -eq 0) {
  [void]$names.Add('Autodesk Navisworks Manage 2026')
  [void]$names.Add('Autodesk Navisworks Simulate 2026')
}

$ok = 0
foreach ($name in $names) {
  $dest = Join-Path (Join-Path $env:APPDATA $name) 'Plugins\SonqollaySync'
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  Copy-Item $dll $dest -Force
  if (Test-Path $cfg) { Copy-Item $cfg $dest -Force }
  # Desbloquear (Mark of the Web): si no, Navisworks no carga el DLL bajado de internet.
  Get-ChildItem $dest | Unblock-File -ErrorAction SilentlyContinue
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
