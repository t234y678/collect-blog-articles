@echo off
REM ニュースレター夜版配信スクリプト（過去12時間）
REM Windowsタスクスケジューラから実行されることを想定

cd /d %~dp0

echo ================================
echo ニュースレター夜版配信開始
echo 実行時刻: %date% %time%
echo ================================

REM 過去12時間の記事を取得
node src\batch-newsletter.js --hours 12 >> logs\batch-newsletter-output.log 2>&1
set "NL_EXIT=%ERRORLEVEL%"



echo.
echo ================================
echo 処理完了: %date% %time%
echo ================================

REM ログファイルに追記
if not "%NL_EXIT%"=="0" (
    echo [%date% %time%] Evening newsletter batch FAILED exit=%NL_EXIT% - see logs\batch-newsletter-output.log >> logs\batch-newsletter.log
    exit /b %NL_EXIT%
)
echo [%date% %time%] Evening newsletter batch completed >> logs\batch-newsletter.log
