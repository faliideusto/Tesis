param([switch]$Identify)
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSHOME 'Modules/Microsoft.PowerShell.Security/Microsoft.PowerShell.Security.psd1') -ErrorAction Stop
$taskRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$taskTokenPath = Join-Path $taskRoot '.telegram-bot/token.dpapi'
if (-not (Test-Path -LiteralPath $taskTokenPath)) {
    throw 'Primero ejecuta tools/telegram-bot/setup.ps1 para configurar el bot.'
}
Get-Command node.exe, git.exe, mvn.cmd, codex.ps1 -ErrorAction Stop | Out-Null
$taskSecure = (Get-Content -LiteralPath $taskTokenPath -Raw).Trim() | ConvertTo-SecureString
$taskPointer = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($taskSecure)
try {
    $env:TESIS_TELEGRAM_TOKEN = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($taskPointer)
    if ($Identify) {
        & node.exe (Join-Path $PSScriptRoot 'bot.mjs') --identify
    } else {
        & node.exe (Join-Path $PSScriptRoot 'bot.mjs')
    }
    $taskExitCode = $LASTEXITCODE
} finally {
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($taskPointer)
    Remove-Item Env:TESIS_TELEGRAM_TOKEN -ErrorAction SilentlyContinue
}
exit $taskExitCode
