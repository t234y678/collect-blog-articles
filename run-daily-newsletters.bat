@echo off
REM ジャンル別ニュースレター定期配信スクリプト
REM Windowsタスクスケジューラから実行されることを想定

cd /d %~dp0

echo ================================
echo ニュースレター定期配信開始
echo 実行時刻: %date% %time%
echo ================================

REM Node.jsでバッチ処理を実行
node src\batch-newsletter.js >> logs\batch-newsletter-output.log 2>&1
set "NL_EXIT=%ERRORLEVEL%"


echo.
echo ================================
echo 処理完了: %date% %time%
echo ================================

REM ログファイルに追記（オプション）
if not "%NL_EXIT%"=="0" (
    echo [%date% %time%] Newsletter batch FAILED exit=%NL_EXIT% - see logs\batch-newsletter-output.log >> logs\batch-newsletter.log
    exit /b %NL_EXIT%
)
echo [%date% %time%] Newsletter batch completed >> logs\batch-newsletter.log
