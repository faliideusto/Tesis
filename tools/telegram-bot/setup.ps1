$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSHOME 'Modules/Microsoft.PowerShell.Security/Microsoft.PowerShell.Security.psd1') -ErrorAction Stop
$taskRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$taskData = Join-Path $taskRoot '.telegram-bot'
New-Item -ItemType Directory -Path $taskData -Force | Out-Null
$taskConfigPath = Join-Path $taskData 'config.json'
if (Test-Path -LiteralPath (Join-Path $taskData 'bot.lock')) {
    throw 'Cierra el bot antes de cambiar la configuracion.'
}
$taskExisting = $null
if (Test-Path -LiteralPath $taskConfigPath) {
    $taskExisting = Get-Content -LiteralPath $taskConfigPath -Raw | ConvertFrom-Json
}
Write-Host 'Configuracion local de Tesis Telegram. El token no se imprime ni se sube a Git.'
Write-Host 'Crea un bot en https://t.me/BotFather con /newbot y copia su token.'
$taskTokenPath = Join-Path $taskData 'token.dpapi'
if (-not (Test-Path -LiteralPath $taskTokenPath)) {
    $taskSecret = Read-Host 'Token de BotFather (entrada oculta)' -AsSecureString
    ConvertFrom-SecureString $taskSecret | Set-Content -LiteralPath $taskTokenPath -Encoding ASCII
} else {
    Write-Host 'Se conserva el token cifrado existente. Para sustituirlo, elimina solo .telegram-bot/token.dpapi y repite la configuracion.'
}
$taskRepository = 'https://github.com/faliideusto/Ciudadela-Academica.git'
if ($taskExisting) { $taskRepository = $taskExisting.repositoryUrl }
$taskIdsInput = Read-Host 'IDs de Telegram autorizados, separados por comas (vacio para obtenerlos primero)'
$taskIds = @()
if (-not [string]::IsNullOrWhiteSpace($taskIdsInput)) {
    foreach ($taskId in $taskIdsInput.Split(',')) {
        $taskNumber = [long]::Parse($taskId.Trim())
        if ($taskNumber -le 0 -or $taskNumber -gt 9007199254740991) { throw 'ID de Telegram invalido.' }
        $taskIds += $taskNumber
    }
}
$taskCodex = (Get-Command codex.ps1 -ErrorAction Stop).Source
$taskCodexEntry = Join-Path (Split-Path $taskCodex -Parent) 'node_modules/@openai/codex/bin/codex.js'
if (-not (Test-Path -LiteralPath $taskCodexEntry)) { throw 'No se encuentra bin/codex.js. Se requiere Codex CLI instalado mediante npm.' }
$taskSite = 'https://tesis-dm5l.onrender.com'
if ($taskExisting) { $taskSite = $taskExisting.siteUrl }
$taskConfig = [ordered]@{
    repositoryUrl = $taskRepository
    allowedUserIds = @($taskIds)
    siteUrl = $taskSite
    codexEntry = $taskCodexEntry
}
$taskJson = $taskConfig | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($taskConfigPath, $taskJson, (New-Object System.Text.UTF8Encoding($false)))
Write-Host 'Configuracion guardada. El token esta cifrado con DPAPI para tu usuario de Windows.'
if ($taskIds.Count -eq 0) {
    Write-Host 'Ejecuta: powershell -NoProfile -File tools/telegram-bot/start.ps1 -Identify'
    Write-Host 'Tu y Choquet abrid el bot y enviad /id. Luego cierra con Ctrl+C y repite setup.ps1 con vuestros IDs.'
} else {
    Write-Host 'Ejecuta: powershell -NoProfile -File tools/telegram-bot/start.ps1'
}
