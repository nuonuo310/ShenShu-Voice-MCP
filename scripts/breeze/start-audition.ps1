$ErrorActionPreference = 'Stop'
$BreezeAuditionNode = Get-Command node -ErrorAction Stop
$BreezeAuditionNodeVersion = & $BreezeAuditionNode.Source --version
if ($BreezeAuditionNodeVersion -notmatch '^v24\.') { throw '请使用已安装的 Node 24。' }
$BreezeAuditionScript = Join-Path $PSScriptRoot 'audition.mjs'
if (-not (Test-Path -LiteralPath $BreezeAuditionScript)) { throw '试听文件不完整。' }
try {
    $BreezeAuditionProbe = Invoke-WebRequest -Uri 'http://127.0.0.1:8080/' -UseBasicParsing -TimeoutSec 5
} catch { throw '请先打开现有 Breeze 模型窗口，等到 listening on http://127.0.0.1:8080，再启动试听。' }
Write-Output '试听窗口启动后，请打开 http://127.0.0.1:8082/'
Write-Output '保留此窗口。试听时先不要同时发送新的聊天语音；不需要改 Render 或关闭原桥接器。'
& $BreezeAuditionNode.Source $BreezeAuditionScript
