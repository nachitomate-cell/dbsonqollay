# Instalador GRÁFICO de Sonqollay Sync (ventana con logos + tutorial + boton).
# Copia el plugin a la carpeta de plugins de la INSTALACIÓN de cada Navisworks
# (Manage/Simulate) detectado. Requiere admin: se auto-eleva. A prueba de discos.
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

# --- Auto-elevar (escribir en Archivos de programa necesita administrador) ----
$prin = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $prin.IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)) {
  Start-Process powershell -Verb RunAs -WindowStyle Hidden -ArgumentList `
    '-NoProfile','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File',"`"$PSCommandPath`""
  return
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

function Load-Img([string]$path) {
  if (Test-Path $path) {
    $bytes = [IO.File]::ReadAllBytes($path)
    $ms = New-Object IO.MemoryStream(,$bytes)
    return [System.Drawing.Image]::FromStream($ms)
  }
  return $null
}
$imgSqy = Load-Img (Join-Path $here 'sonqollay.png')
$imgSyn = Load-Img (Join-Path $here 'synaptech.png')

$gray = [System.Drawing.Color]::FromArgb(80, 90, 100)
$soft = [System.Drawing.Color]::FromArgb(150, 155, 160)

$form = New-Object System.Windows.Forms.Form
$form.Text = 'Instalar Sonqollay Sync'
$form.ClientSize = New-Object System.Drawing.Size(460, 470)
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedDialog'
$form.MaximizeBox = $false; $form.MinimizeBox = $false
$form.BackColor = [System.Drawing.Color]::White

# --- Logo Sonqollay (protagonista, arriba) ------------------------------------
if ($imgSqy) {
  $pb = New-Object System.Windows.Forms.PictureBox
  $pb.Image = $imgSqy; $pb.SizeMode = 'AutoSize'; $pb.Top = 16
  $pb.Left = [int](($form.ClientSize.Width - $imgSqy.Width) / 2)
  $form.Controls.Add($pb)
}

$title = New-Object System.Windows.Forms.Label
$title.Text = 'Plugin para Autodesk Navisworks'
$title.AutoSize = $false; $title.TextAlign = 'MiddleCenter'
$title.Left = 20; $title.Top = 132; $title.Width = 420; $title.Height = 22
$title.ForeColor = $gray
$title.Font = New-Object System.Drawing.Font($form.Font.FontFamily, 10, [System.Drawing.FontStyle]::Bold)
$form.Controls.Add($title)

# --- Mini tutorial ------------------------------------------------------------
$tut = New-Object System.Windows.Forms.Label
$tut.Text = @"
Como usar (despues de instalar):

  1.  Abri Navisworks y tu modelo.
  2.  Pestana "Aura BIM" -> boton "Asignar Propiedades".
  3.  Marca las planillas a sincronizar -> Sincronizar.
  4.  Guarda el modelo (.nwf / .nwd) para conservar los datos.
"@
$tut.AutoSize = $false; $tut.Left = 34; $tut.Top = 166; $tut.Width = 392; $tut.Height = 130
$tut.ForeColor = $gray
$form.Controls.Add($tut)

# --- Estado + botones ---------------------------------------------------------
$status = New-Object System.Windows.Forms.Label
$status.Text = 'Listo para instalar. (Cerra Navisworks antes de instalar.)'
$status.AutoSize = $false; $status.TextAlign = 'MiddleCenter'
$status.Left = 20; $status.Top = 304; $status.Width = 420; $status.Height = 34
$status.ForeColor = $soft
$form.Controls.Add($status)

$btnInstall = New-Object System.Windows.Forms.Button
$btnInstall.Text = 'Instalar'; $btnInstall.Width = 120; $btnInstall.Height = 32
$btnInstall.Top = 344; $btnInstall.Left = 96
$btnInstall.BackColor = [System.Drawing.Color]::FromArgb(235, 110, 40)
$btnInstall.ForeColor = [System.Drawing.Color]::White
$btnInstall.FlatStyle = 'Flat'; $btnInstall.FlatAppearance.BorderSize = 0
$form.Controls.Add($btnInstall)

$btnClose = New-Object System.Windows.Forms.Button
$btnClose.Text = 'Cerrar'; $btnClose.Width = 120; $btnClose.Height = 32
$btnClose.Top = 344; $btnClose.Left = 244
$btnClose.Add_Click({ $form.Close() })
$form.Controls.Add($btnClose)

# --- Credito SynapTech (abajo) ------------------------------------------------
$by = New-Object System.Windows.Forms.Label
$by.Text = 'Desarrollado por'
$by.AutoSize = $false; $by.TextAlign = 'MiddleCenter'
$by.Left = 20; $by.Top = 392; $by.Width = 420; $by.Height = 16
$by.ForeColor = $soft
$by.Font = New-Object System.Drawing.Font($form.Font.FontFamily, 7.5)
$form.Controls.Add($by)

if ($imgSyn) {
  $pb2 = New-Object System.Windows.Forms.PictureBox
  $pb2.Image = $imgSyn; $pb2.SizeMode = 'AutoSize'; $pb2.Top = 410
  $pb2.Left = [int](($form.ClientSize.Width - $imgSyn.Width) / 2)
  $form.Controls.Add($pb2)
}

# --- Logica de instalacion ----------------------------------------------------
$btnInstall.Add_Click({
  $status.ForeColor = $gray; $status.Text = 'Instalando...'; $form.Refresh()

  $bundleSrc = Join-Path $here 'SonqollaySync.bundle'
  if (-not (Test-Path $bundleSrc)) {
    $status.ForeColor = [System.Drawing.Color]::Red
    $status.Text = 'No encuentro SonqollaySync.bundle junto al instalador.'; return
  }

  try {
    # 1) Instalar el bundle en ApplicationPlugins (sirve para todas las versiones
    #    de Navisworks; ahi vive tambien AuraBIM). Da la pestana propia "Aura BIM".
    $appPlugins = Join-Path $env:ProgramData 'Autodesk\ApplicationPlugins'
    New-Item -ItemType Directory -Force -Path $appPlugins | Out-Null
    $dest = Join-Path $appPlugins 'SonqollaySync.bundle'
    if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
    Copy-Item $bundleSrc $dest -Recurse -Force
    Get-ChildItem $dest -Recurse -File | Unblock-File -ErrorAction SilentlyContinue

    # 2) Limpiar la version vieja (cuando el plugin se instalaba como DLL suelta en
    #    Plugins\SonqollaySync de cada Navisworks) para no tener boton duplicado.
    $pfs = @($env:ProgramFiles, ${env:ProgramFiles(x86)}, 'C:\Program Files') |
           Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique
    foreach ($pf in $pfs) {
      $base = Join-Path $pf 'Autodesk'
      if (Test-Path $base) {
        Get-ChildItem $base -Directory -ErrorAction SilentlyContinue | ForEach-Object {
          if ($_.Name -match 'Navisworks (Manage|Simulate) \d{4}') {
            $old = Join-Path $_.FullName 'Plugins\SonqollaySync'
            if (Test-Path $old) { Remove-Item $old -Recurse -Force -ErrorAction SilentlyContinue }
          }
        }
      }
    }

    $status.ForeColor = [System.Drawing.Color]::FromArgb(30, 150, 70)
    $status.Text = 'Instalado OK. Abri (o reinicia) Navisworks -> pestana "Aura BIM".'
    $btnInstall.Enabled = $false
  } catch {
    $status.ForeColor = [System.Drawing.Color]::Red
    $status.Text = 'No se pudo instalar. Cerra Navisworks y reintenta.  ' + $_.Exception.Message
  }
})

[void]$form.ShowDialog()
