@echo off
echo Starting VirtualBox Web Standalone Server...
echo.
echo Browser security prevents some features (WASM/Storage) from working 
echo directly from file://. We are starting a tiny local server to fix this.
echo.
start "" "http://localhost:8000"
python -m http.server 8000
pause
