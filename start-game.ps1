$nodeRoot = "C:\Program Files\nodejs"

if (-not (Test-Path "$nodeRoot\\npm.cmd")) {
  Write-Error "Node.js was not found at $nodeRoot. Reinstall Node.js LTS and try again."
  exit 1
}

$env:Path = "$nodeRoot;$env:Path"

& "$nodeRoot\\npm.cmd" run start
