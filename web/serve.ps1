$ErrorActionPreference = "Stop"

if (Get-Command py -ErrorAction SilentlyContinue) {
    & py -m http.server 8080 --directory $PSScriptRoot
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    & python -m http.server 8080 --directory $PSScriptRoot
} else {
    throw "Python was not found. Install Python or serve the web directory with another static HTTP server."
}

