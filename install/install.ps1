# Installs Vibe Code Viewer on Windows:
#   irm https://raw.githubusercontent.com/eli-gerhard/vibe-code-viewer/main/install/install.ps1 | iex
#
# Optional environment variables:
#   VCV_VERSION    Release tag to install, e.g. v0.1.0 (default: latest)
#   VCV_NO_LAUNCH  Set to 1 to skip opening the app when the install finishes
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue' # The progress bar makes Invoke-WebRequest much slower.

$Repo = 'eli-gerhard/vibe-code-viewer'
$AppName = 'Vibe Code Viewer'
$BinDir = Join-Path $env:LOCALAPPDATA 'vibe-code-viewer\bin'
$Exe = Join-Path $BinDir 'vibe-code-viewer.exe'

# Only an x64 build is published; Windows on ARM runs it through emulation.
$Asset = 'vibe-code-viewer-windows-x64.exe'
$Url = if ($env:VCV_VERSION) {
  "https://github.com/$Repo/releases/download/$($env:VCV_VERSION)/$Asset"
} else {
  "https://github.com/$Repo/releases/latest/download/$Asset"
}

Write-Host "Downloading $AppName..."
New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
Invoke-WebRequest -Uri $Url -OutFile "$Exe.download" -UseBasicParsing
# Windows can't replace a running program, so stop a running copy first.
Get-Process -Name 'vibe-code-viewer' -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Milliseconds 500
Move-Item -Force "$Exe.download" $Exe

# Make `vibe-code-viewer` available as a terminal command in new windows.
$UserPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$PathEntries = if ($UserPath) { $UserPath -split ';' } else { @() }
if ($PathEntries -notcontains $BinDir) {
  [Environment]::SetEnvironmentVariable('Path', (($PathEntries + $BinDir) -join ';'), 'User')
}

# Start menu shortcut. The viewer runs in a minimized window; closing that window stops it.
$Shortcut = Join-Path ([Environment]::GetFolderPath('Programs')) "$AppName.lnk"
$Link = (New-Object -ComObject WScript.Shell).CreateShortcut($Shortcut)
$Link.TargetPath = $Exe
$Link.WindowStyle = 7
$Link.Save()

Write-Host ''
Write-Host "$AppName is installed."

if (-not (Get-Command claude -ErrorAction SilentlyContinue) -and -not (Get-Command codex -ErrorAction SilentlyContinue)) {
  Write-Host ''
  Write-Host 'Vibe Code Viewer uses Claude Code or Codex to map your projects, and neither was found.'
  Write-Host 'Install one and sign in once:'
  Write-Host '  Claude Code: https://code.claude.com/docs/en/setup'
  Write-Host '  Codex:       https://developers.openai.com/codex/cli'
}

Write-Host ''
Write-Host "Open `"$AppName`" from the Start menu, or run: vibe-code-viewer"

if ($env:VCV_NO_LAUNCH -ne '1') {
  Start-Process $Shortcut
}
