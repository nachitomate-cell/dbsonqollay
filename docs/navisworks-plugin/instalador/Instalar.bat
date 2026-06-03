@echo off
chcp 65001 >nul
echo ============================================
echo   Instalando Sonqollay Sync para Navisworks
echo ============================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
echo.
pause
