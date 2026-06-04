# Empaqueta el ZIP que se entrega a los clientes:
#   SonqollaySync.dll (compilado) + config + instalador 1-clic.
#
# Uso (una vez compilado en Visual Studio, en modo Release):
#   - Editá instalador\SonqollaySync.config.json con el token real (una sola vez).
#   - Click derecho en este archivo -> "Ejecutar con PowerShell"
#     (o:  powershell -ExecutionPolicy Bypass -File Empaquetar.ps1)
#   - Se genera  SonqollaySync-instalador.zip  para enviar a los clientes.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$dll = Get-ChildItem $root -Recurse -Filter SonqollaySync.dll -ErrorAction SilentlyContinue |
       Where-Object { $_.FullName -match '\\bin\\' } |
       Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (!$dll) {
  Write-Host "No encontre el DLL compilado. Compila primero en Visual Studio (Release)." -ForegroundColor Red
  exit 1
}

$dist  = Join-Path $root 'instalador'
$cfg   = Join-Path $dist 'SonqollaySync.config.json'
# El config real (con token) es local y esta gitignored. Si no existe, lo creamos
# desde el .example para que el ZIP no quede sin config.
if (!(Test-Path $cfg)) {
  Copy-Item (Join-Path $dist 'SonqollaySync.config.example.json') $cfg
}
if ((Get-Content $cfg -Raw) -match 'PEGAR_AQUI_EL_TOKEN') {
  Write-Host "ADVERTENCIA: instalador\SonqollaySync.config.json todavia tiene el token de ejemplo." -ForegroundColor Yellow
  Write-Host "Edita ese archivo con el token real antes de entregar el ZIP." -ForegroundColor Yellow
}

$stage = Join-Path $env:TEMP 'SonqollaySync-pkg'
Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $stage | Out-Null

Copy-Item $dll.FullName $stage
foreach ($f in 'SonqollaySync.config.json','Instalar.bat','install.ps1','LEEME.txt') {
  Copy-Item (Join-Path $dist $f) $stage
}
# Logos para el instalador grafico.
Copy-Item (Join-Path $root 'assets\sonqollay.png') $stage
Copy-Item (Join-Path $root 'assets\synaptech.png') $stage

$out = Join-Path $root 'SonqollaySync-instalador.zip'
Remove-Item $out -Force -ErrorAction SilentlyContinue
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $out -Force

Write-Host ""
Write-Host "ZIP listo para entregar:" -ForegroundColor Green
Write-Host "   $out" -ForegroundColor Green
Write-Host "Contenido: SonqollaySync.dll + config + Instalar.bat + install.ps1 + LEEME.txt"
