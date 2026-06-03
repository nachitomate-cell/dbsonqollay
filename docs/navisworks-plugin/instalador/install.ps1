# Instalador de Sonqollay Sync. Copia el plugin a la carpeta de plugins de la
# INSTALACIÓN de cada Navisworks (Manage/Simulate) detectado. Requiere admin
# (se auto-eleva). A prueba de discos.
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$dll  = Join-Path $here 'SonqollaySync.dll'
$cfg  = Join-Path $here 'SonqollaySync.config.json'

if (!(Test-Path $dll)) {
  Write-Host "ERROR: no encuentro SonqollaySync.dll junto a este instalador." -ForegroundColor Red
  Read-Host "Enter para salir"; exit 1
}

# Auto-elevar: instalar en Archivos de programa necesita administrador.
$prin = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $prin.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)) {
  Write-Host "Pidiendo permisos de administrador..." -ForegroundColor Yellow
  Start-Process powershell -Verb RunAs -ArgumentList `
    '-NoProfile','-ExecutionPolicy','Bypass','-File',"`"$PSCommandPath`""
  exit
}

# Detectar instalaciones de Navisworks (Manage/Simulate) en Archivos de programa.
$installs = @()
$pfs = @($env:ProgramFiles, ${env:ProgramFiles(x86)}, 'C:\Program Files') |
       Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique
foreach ($pf in $pfs) {
  $base = Join-Path $pf 'Autodesk'
  if (Test-Path $base) {
    Get-ChildItem $base -Directory -ErrorAction SilentlyContinue | ForEach-Object {
      if ($_.Name -match 'Navisworks (Manage|Simulate) \d{4}') { $installs += $_.FullName }
    }
  }
}
$installs = $installs | Select-Object -Unique

if ($installs.Count -eq 0) {
  Write-Host "No encontre ninguna instalacion de Navisworks Manage/Simulate." -ForegroundColor Red
  Write-Host "(El visor gratis 'Freedom' no sirve: no tiene API.)" -ForegroundColor Red
  Read-Host "Enter para salir"; exit 1
}

$ok = 0
foreach ($ins in $installs) {
  $dest = Join-Path $ins 'Plugins\SonqollaySync'
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  Copy-Item $dll, $cfg $dest -Force
  # Desbloquear (Mark of the Web): si no, Navisworks no carga el DLL bajado de internet.
  Get-ChildItem $dest | Unblock-File -ErrorAction SilentlyContinue
  Write-Host "Instalado en: $dest" -ForegroundColor Green
  $ok++
}

Write-Host ""
if ($ok -gt 0) {
  Write-Host "LISTO. Cerra y volve a abrir Navisworks." -ForegroundColor Cyan
  Write-Host "El boton 'Sonqollay Sync' aparece en la pestania 'Complementos de la herramienta'." -ForegroundColor Cyan
} else {
  Write-Host "No se pudo instalar." -ForegroundColor Red
}
Read-Host "Enter para salir"
