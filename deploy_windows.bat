@echo off
chcp 65001 >nul
echo ============================================
echo   一键部署科研助手悬浮窗 (DSH Web)
echo ============================================
echo.

where python >nul 2>nul
if %errorlevel%==0 (
    python deploy.py %*
) else (
    where py >nul 2>nul
    if %errorlevel%==0 (
        py deploy.py %*
    ) else (
        echo [错误] 未找到 Python，请先安装 Python 3.9+ 并加入 PATH
    )
)

echo.
pause
