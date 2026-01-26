@echo off
REM ニュースレター夜版配信スクリプト（過去12時間）
REM Windowsタスクスケジューラから実行されることを想定

cd /d %~dp0

echo ================================
echo ニュースレター夜版配信開始
echo 実行時刻: %date% %time%
echo ================================

REM 過去12時間の記事を取得
node src\batch-newsletter.js --hours 12



echo.
echo ================================
echo 処理完了: %date% %time%
echo ================================

REM ログファイルに追記
echo [%date% %time%] Evening newsletter batch completed >> logs\batch-newsletter.log
