@echo off
rem Lanza el instalador grafico (ventana con logos). Sin consola visible.
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0install.ps1"
