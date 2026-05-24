param(
  [string]$SourceRoot = (Resolve-Path "$PSScriptRoot\..").Path
)

$ErrorActionPreference = "Stop"

function Assert-File([string]$path) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "Missing required file: $path"
  }
}

function Assert-LocalReference([string]$reference, [string]$sourceRoot) {
  if ([string]::IsNullOrWhiteSpace($reference)) { return }
  if ($reference.StartsWith("#")) { return }
  if ($reference -match "^(https?:|mailto:|tel:|sms:|data:)") { return }

  $pathOnly = ($reference -split "[?#]", 2)[0]
  if ([string]::IsNullOrWhiteSpace($pathOnly)) { return }

  $candidate = Join-Path $sourceRoot ($pathOnly -replace "/", "\")
  if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
    throw "Broken local reference in index.html: $reference"
  }
}

$requiredSourceFiles = @(
  "index.html",
  "assets\css\styles.css",
  "assets\js\circuit-background.js",
  "assets\js\app.js",
  "favicon.ico",
  "favicon.svg",
  "assets\img\favicon-16x16.png",
  "assets\img\favicon-32x32.png",
  "assets\img\apple-touch-icon.png",
  "assets\img\logo.png",
  "assets\img\og-image.png",
  "CNAME",
  ".nojekyll",
  "robots.txt",
  "sitemap.xml",
  "site.webmanifest"
)

foreach ($file in $requiredSourceFiles) {
  Assert-File (Join-Path $SourceRoot $file)
}

node --check (Join-Path $SourceRoot "assets\js\circuit-background.js") | Out-Host
node --check (Join-Path $SourceRoot "assets\js\app.js") | Out-Host

$manifestPath = Join-Path $SourceRoot "site.webmanifest"
$manifest = Get-Content -Raw -Path $manifestPath | ConvertFrom-Json
if (-not $manifest.name -or -not $manifest.short_name -or -not $manifest.icons) {
  throw "site.webmanifest is missing required metadata."
}
foreach ($icon in $manifest.icons) {
  Assert-LocalReference $icon.src $SourceRoot
}

$html = Get-Content -Raw -Path (Join-Path $SourceRoot "index.html")
$matches = [regex]::Matches($html, '(?:href|src)=["'']([^"'']+)["'']')
foreach ($match in $matches) {
  Assert-LocalReference $match.Groups[1].Value $SourceRoot
}

if ($html -match '(?s)<a\b[^>]*>(?:(?!</a>).)*<button\b') {
  throw "Nested interactive control found: anchor contains a button."
}
if ($html -match '\s(?:onclick|onsubmit)=') {
  throw "Inline event handler found in index.html."
}

Write-Output "Site checks passed."
