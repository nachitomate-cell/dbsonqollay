# Empaqueta el ZIP que se entrega a los clientes:
#   AuraBIM.dll (compilado) + config + instalador 1-clic.
#
# Uso (una vez compilado en Visual Studio, en modo Release):
#   - Edita instalador\AuraBIM.config.json con el token real (una sola vez).
#   - Click derecho en este archivo -> "Ejecutar con PowerShell"
#     (o:  powershell -ExecutionPolicy Bypass -File Empaquetar.ps1)
#   - Se genera  AuraBIM-instalador.zip  para enviar a los clientes.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$dll = Get-ChildItem $root -Recurse -Filter AuraBIM.dll -ErrorAction SilentlyContinue |
       Where-Object { $_.FullName -match '\\bin\\' } |
       Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (!$dll) {
  Write-Host "No encontre el DLL compilado. Compila primero en Visual Studio (Release)." -ForegroundColor Red
  exit 1
}

$dist  = Join-Path $root 'instalador'
$cfg   = Join-Path $dist 'AuraBIM.config.json'
# El config real (con token) es local y esta gitignored. Si no existe, lo creamos
# desde el .example para que el ZIP no quede sin config.
if (!(Test-Path $cfg)) {
  Copy-Item (Join-Path $dist 'AuraBIM.config.example.json') $cfg
}
if ((Get-Content $cfg -Raw) -match 'PEGAR_AQUI_EL_TOKEN') {
  Write-Host "ADVERTENCIA: instalador\AuraBIM.config.json todavia tiene el token de ejemplo." -ForegroundColor Yellow
  Write-Host "Edita ese archivo con el token real antes de entregar el ZIP." -ForegroundColor Yellow
}

$stage = Join-Path $env:TEMP 'AuraBIM-pkg'
Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
$bundle = Join-Path $stage 'AuraBIM.bundle'
New-Item -ItemType Directory -Force (Join-Path $bundle 'Contents\en-US') | Out-Null

# Valida el ribbon ANTES de empaquetar: debe ser XML bien formado y NO traer
# atributos que Navisworks rechaza al cargar (p.ej. SmallImage en NWRibbonButton,
# que hace "Fail to load AIRLook Ribbon file ... The file is corrupt"). Asi no
# entregamos un ZIP cuyo ribbon revienta recien al abrir Navisworks.
function Test-RibbonXaml([string]$path) {
  if (!(Test-Path $path)) { throw "No encuentro el ribbon: $path" }
  try { [xml](Get-Content $path -Raw) | Out-Null }
  catch { throw "El ribbon $path no es XML valido: $($_.Exception.Message)" }
  $bad = Select-String -Path $path -Pattern 'SmallImage' -AllMatches
  if ($bad) {
    throw ("El ribbon $path trae 'SmallImage', que Navisworks NO acepta en " +
           "NWRibbonButton (rompe el ribbon). Quitalo antes de empaquetar.")
  }
}
Test-RibbonXaml (Join-Path $root 'bundle\Contents\en-US\AuraBIM.xaml')

# Estructura del bundle: PackageContents + ribbon (pestana "Aura BIM").
Copy-Item (Join-Path $root 'bundle\PackageContents.xml') $bundle
Copy-Item (Join-Path $root 'bundle\Contents\en-US\*') (Join-Path $bundle 'Contents\en-US')
# DLL compilado + config (junto al DLL, en Contents).
Copy-Item $dll.FullName (Join-Path $bundle 'Contents')
Copy-Item $cfg (Join-Path $bundle 'Contents\AuraBIM.config.json')
# Instalador grafico en la raiz del zip (copia el bundle a ApplicationPlugins).
foreach ($f in 'Instalar.bat','install.ps1','LEEME.txt') {
  Copy-Item (Join-Path $dist $f) $stage
}
Copy-Item (Join-Path $root 'assets\aurabim.png') $stage

$out = Join-Path $root 'AuraBIM-instalador.zip'
Remove-Item $out -Force -ErrorAction SilentlyContinue
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $out -Force

Write-Host ""
Write-Host "ZIP listo para entregar:" -ForegroundColor Green
Write-Host "   $out" -ForegroundColor Green
Write-Host "Contenido: AuraBIM.dll + config + Instalar.bat + install.ps1 + LEEME.txt"
