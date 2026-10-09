$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskVersion = (Get-Content -LiteralPath (Join-Path $taskRoot 'package.json') -Raw | ConvertFrom-Json).version
$taskInstaller = Join-Path $taskRoot "release\千秋万待-安装程序-$taskVersion.exe"
$taskDir = [IO.Path]::GetFullPath((Join-Path $taskRoot '.qa\安装 验证'))
$taskQaRoot = Join-Path $taskRoot '.qa\installer-profile'
$taskQaBoundary = [IO.Path]::GetFullPath((Join-Path $taskRoot '.qa')) + [IO.Path]::DirectorySeparatorChar
if (-not $taskDir.StartsWith($taskQaBoundary) -or (Test-Path -LiteralPath $taskDir)) { throw 'Unsafe or existing installer test directory' }
if (-not (Test-Path -LiteralPath $taskInstaller)) { throw 'Build the installer first' }
if (Get-Process -Name '七海待办','千秋万待' -ErrorAction SilentlyContinue) { throw 'Close the app before testing installation' }

function Get-TaskRegistration {
    foreach ($taskHive in @('HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall','HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall')) {
        Get-ChildItem -LiteralPath $taskHive -ErrorAction SilentlyContinue | ForEach-Object {
            Get-ItemProperty -LiteralPath $_.PSPath -ErrorAction SilentlyContinue
        } | Where-Object { $_.DisplayName -in @('七海待办','千秋万待') }
    }
}
if (Get-TaskRegistration) { throw 'An installed copy already exists; leave it unchanged' }

$taskLinks = @(
    (Join-Path ([Environment]::GetFolderPath('Desktop')) '千秋万待.lnk'),
    (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\千秋万待.lnk')
)
$taskLinkBackups = @{}
foreach ($taskLink in $taskLinks) { if (Test-Path -LiteralPath $taskLink) { $taskLinkBackups[$taskLink] = [IO.File]::ReadAllBytes($taskLink) } }
$taskCache = Join-Path $env:LOCALAPPDATA 'qianqiu-wandai-updater\installer.exe'
$taskCacheBackup = Join-Path $taskRoot '.qa\installer-cache-backup.exe'
$taskHadCache = Test-Path -LiteralPath $taskCache
if ($taskHadCache) { Copy-Item -LiteralPath $taskCache -Destination $taskCacheBackup -Force }
$taskDataFile = Join-Path $env:APPDATA 'ChiakiTodo\tasks.json'
$taskDataHash = if (Test-Path -LiteralPath $taskDataFile) { (Get-FileHash -LiteralPath $taskDataFile).Hash } else { $null }
$taskPreviousQa = $env:CHIAKI_QA_ROOT
$taskInstalled = $false
$taskChecks = [Collections.Generic.List[string]]::new()

try {
    $taskProcess = Start-Process -FilePath $taskInstaller -ArgumentList '/S','/currentuser','--no-desktop-shortcut',"/D=$taskDir" -WindowStyle Hidden -PassThru
    if (-not $taskProcess.WaitForExit(120000)) { throw 'Installer did not finish within 120 seconds' }
    if ($taskProcess.ExitCode -ne 0) { throw "Installer exited $($taskProcess.ExitCode)" }
    $taskInstalled = $true
    $taskExe = Join-Path $taskDir '千秋万待.exe'
    $taskAsar = Join-Path $taskDir 'resources\app.asar'
    if (-not (Test-Path -LiteralPath $taskExe)) { throw 'Selected destination has no application' }
    $taskSourceAsar = Join-Path $taskRoot '.qa\package\千秋万待-win32-x64\resources\app.asar'
    if ((Get-FileHash -LiteralPath $taskAsar).Hash -ne (Get-FileHash -LiteralPath $taskSourceAsar).Hash) { throw 'Installed application differs from packaged source' }
    $taskChecks.Add('Installs complete app into selected folder containing Chinese characters and spaces')
    $taskRegistration = @(Get-TaskRegistration)
    if ($taskRegistration.Count -ne 1 -or -not ([string]$taskRegistration[0].UninstallString).Contains($taskDir+'\Uninstall 千秋万待.exe') -or $taskRegistration[0].DisplayVersion -ne $taskVersion) { throw 'Uninstall entry does not match selected folder and version' }
    $taskChecks.Add('Registers correct Windows uninstall entry')
    $taskShell = New-Object -ComObject WScript.Shell
    if ($taskShell.CreateShortcut($taskLinks[1]).TargetPath -ne $taskExe) { throw 'Start menu shortcut does not point to installed app' }
    $taskChecks.Add('Start menu shortcut points to installed application')
    $env:CHIAKI_QA_ROOT = $taskQaRoot
    $taskProbe = Start-Process -FilePath $taskExe -ArgumentList '--probe-data' -WindowStyle Hidden -PassThru
    if (-not $taskProbe.WaitForExit(60000) -or $taskProbe.ExitCode -ne 0) { throw 'Installed app failed to launch' }
    $taskProbeData = Get-Content -LiteralPath (Join-Path $taskQaRoot 'probe.json') -Raw | ConvertFrom-Json
    if ($taskProbeData.tasks -ne 0 -or $taskProbeData.warning) { throw 'Installed app could not load isolated profile' }
    $taskChecks.Add('Installed executable launches and loads isolated local profile')
}
finally {
    $env:CHIAKI_QA_ROOT = $taskPreviousQa
    $taskCleanupError = $null
    try {
    if ($taskInstalled) {
        $taskUninstaller = Join-Path $taskDir 'Uninstall 千秋万待.exe'
        if (-not (Test-Path -LiteralPath $taskUninstaller)) { throw 'Missing uninstaller' }
        $taskUninstallProcess = Start-Process -FilePath $taskUninstaller -ArgumentList '/S','/currentuser' -WindowStyle Hidden -PassThru
        if (-not $taskUninstallProcess.WaitForExit(120000)) { throw 'Uninstaller did not finish within 120 seconds' }
        $taskDeadline = [DateTime]::UtcNow.AddSeconds(30)
        while (((Test-Path -LiteralPath (Join-Path $taskDir '千秋万待.exe')) -or (Get-TaskRegistration)) -and [DateTime]::UtcNow -lt $taskDeadline) { Start-Sleep -Milliseconds 200 }
        if ((Test-Path -LiteralPath (Join-Path $taskDir '千秋万待.exe')) -or (Get-TaskRegistration)) { throw 'Uninstall left the app or its registry entry behind' }
        $taskChecks.Add('Uninstall removes application and its Windows entry')
    }
    } catch { $taskCleanupError = $_ }
    foreach ($taskLink in $taskLinks) {
        if ($taskLinkBackups.ContainsKey($taskLink)) { [IO.File]::WriteAllBytes($taskLink,$taskLinkBackups[$taskLink]) }
        elseif (Test-Path -LiteralPath $taskLink) { Remove-Item -LiteralPath $taskLink -Force }
    }
    if ($taskHadCache) { Copy-Item -LiteralPath $taskCacheBackup -Destination $taskCache -Force; Remove-Item -LiteralPath $taskCacheBackup -Force }
    elseif (Test-Path -LiteralPath $taskCache) { Remove-Item -LiteralPath $taskCache -Force }
    if ($taskCleanupError) { throw $taskCleanupError }
}
$taskAfterHash = if (Test-Path -LiteralPath $taskDataFile) { (Get-FileHash -LiteralPath $taskDataFile).Hash } else { $null }
if ($taskAfterHash -ne $taskDataHash) { throw 'Real task data changed during installation check' }
$taskChecks.Add('Existing real task data remains unchanged')
foreach ($taskCheck in $taskChecks) { Write-Output "PASS $taskCheck" }
@{passed=$taskChecks.Count;checks=$taskChecks} | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $taskRoot '.qa\installer-results.json') -Encoding UTF8
