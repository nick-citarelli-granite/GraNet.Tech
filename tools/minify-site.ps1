param(
  [string]$SourceRoot = (Resolve-Path "$PSScriptRoot\..").Path,
  [string]$OutputRoot = (Join-Path (Resolve-Path "$PSScriptRoot\..").Path "dist")
)

$ErrorActionPreference = "Stop"

if (Test-Path -LiteralPath $OutputRoot) {
  Remove-Item -LiteralPath $OutputRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $OutputRoot | Out-Null
New-Item -ItemType Directory -Path (Join-Path $OutputRoot "assets\css") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $OutputRoot "assets\js") -Force | Out-Null

function Minify-Html([string]$content) {
  $content = [regex]::Replace($content, ">\s+<", "><")
  $content = [regex]::Replace($content, "\s{2,}", " ")
  return $content.Trim()
}

function Minify-Css([string]$content) {
  $content = [regex]::Replace($content, "/\*[\s\S]*?\*/", "")
  $content = [regex]::Replace($content, "\s+", " ")
  $content = [regex]::Replace($content, "\s*([{}:;,>])\s*", '$1')
  $content = $content.Replace(";}", "}")
  return $content.Trim()
}

function Minify-Js([string]$content) {
  $content = [regex]::Replace($content, "^\s*//.*$", "", "Multiline")
  $content = [regex]::Replace($content, "\s+", " ")
  $content = [regex]::Replace($content, "\s*([{}();,:=<>+\-*/])\s*", '$1')
  return $content.Trim()
}

$html = Get-Content -Raw -Path (Join-Path $SourceRoot "index.html")
$css = Get-Content -Raw -Path (Join-Path $SourceRoot "assets\css\styles.css")
$js = Get-Content -Raw -Path (Join-Path $SourceRoot "assets\js\app.js")

Set-Content -NoNewline -Path (Join-Path $OutputRoot "index.html") -Value (Minify-Html $html)
Set-Content -NoNewline -Path (Join-Path $OutputRoot "assets\css\styles.css") -Value (Minify-Css $css)
Set-Content -NoNewline -Path (Join-Path $OutputRoot "assets\js\app.js") -Value (Minify-Js $js)

$copyFiles = @(
  "CNAME",
  "favicon.ico",
  "favicon.svg",
  "favicon-16x16.png",
  "favicon-32x32.png",
  "apple-touch-icon.png",
  "logo.svg",
  "og-image.png"
)

foreach ($file in $copyFiles) {
  $source = Join-Path $SourceRoot $file
  if (Test-Path -LiteralPath $source) {
    Copy-Item -LiteralPath $source -Destination (Join-Path $OutputRoot $file)
  }
}

Write-Output "Minified site written to $OutputRoot"
