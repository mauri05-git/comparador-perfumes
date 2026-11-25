@echo off
chcp 65001 >nul
title PerfumeScan - Lanzador Instantaneo
cd /d "%~dp0"

echo ========================================================
echo   Iniciando PerfumeScan en http://localhost:5173 ...
echo ========================================================

REM Cerrar un backend anterior: si sigue ocupando el puerto 8000, el nuevo no arranca y queda el codigo viejo
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue } | Where-Object { $_.ProcessName -eq 'deno' } | Stop-Process -Force"

REM Si el usuario tiene Deno instalado, levantar tambien el Backend en segundo plano
where deno >nul 2>nul
if %errorlevel% equ 0 (
    start "PerfumeScan Backend" /min cmd /c "cd /d "%~dp0backend" && deno run --allow-net --allow-env --allow-read --allow-write --allow-run --env server.ts"
) else (
    if exist "%USERPROFILE%\.deno\bin\deno.exe" (
        start "PerfumeScan Backend" /min cmd /c "cd /d "%~dp0backend" && "%USERPROFILE%\.deno\bin\deno.exe" run --allow-net --allow-env --allow-read --allow-write --allow-run --env server.ts"
    )
)

REM Iniciar el servidor web nativo de Windows (sin requerir Node.js ni npm install) y abrir el navegador
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0servidor_instantaneo.ps1"
