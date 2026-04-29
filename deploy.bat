@echo off
echo ========================================
echo   VirtualBox Web - GitHub Auto Deploy
echo ========================================
echo.
echo Adding changes...
git add .
echo.
echo Committing changes...
git commit -m "Auto-deploy: Fix paths and emulator class name"
echo.
echo Pushing to GitHub (https://github.com/haruto2016/11simu.git)...
git push origin main
echo.
echo ========================================
echo   Deployment Complete!
echo ========================================
pause
