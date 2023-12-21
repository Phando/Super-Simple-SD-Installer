@echo off
if %errorlevel% == 0 (
    echo Node.js is installed.
) else (
    echo Node.js is required and not installed.
    echo Please install it from https://nodejs.org/en/download/current
    exit
)

echo Starting the installer...
@REM Check if there is an error and run npm install
node --max-old-space-size=81520 .\app.js

