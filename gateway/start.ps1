$ErrorActionPreference = "Stop"

$gatewayDirectory = $PSScriptRoot
$binary = Join-Path $gatewayDirectory "mediamtx.exe"
$configuration = Join-Path $gatewayDirectory "mediamtx.yml"

if (-not (Test-Path -LiteralPath $binary)) {
    throw @"
gateway\mediamtx.exe was not found.
Download the Windows amd64 standalone archive from:
https://github.com/bluenviron/mediamtx/releases
Then copy mediamtx.exe into: $gatewayDirectory
"@
}

& $binary $configuration

