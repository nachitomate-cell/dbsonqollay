@echo off
rem Lanza el instalador grafico (ventana con logos). Sin consola visible.
rem Los archivos tecnicos viven en la subcarpeta "recursos" para no ensuciar la raiz.
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0recursos\install.ps1"
