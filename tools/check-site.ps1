param(
  [string]$SourceRoot = (Resolve-Path "$PSScriptRoot\..").Path,
  [switch]$RequireMercuryConfig
)

$ErrorActionPreference = "Stop"

function Assert-File([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "Missing required file: $Path"
  }
}

$required = @(
  "index.html",
  "services\index.html",
  "software-ai-web\index.html",
  "managed-it-security-cloud\index.html",
  "repair-hourly-support\index.html",
  "contact\index.html",
  "assets\css\styles.css",
  "assets\js\site.js",
  "assets\js\motion.js",
  "assets\js\contact.js",
  "assets\js\contact-config.js",
  "assets\fonts\inter-latin.woff2",
  "assets\fonts\space-grotesk-latin.woff2",
  "assets\img\cinematic\home-960.avif",
  "assets\img\cinematic\home-1672.avif",
  "assets\img\cinematic\home-960.webp",
  "assets\img\cinematic\home-1672.webp",
  "favicon.ico",
  "site.webmanifest",
  "robots.txt",
  "sitemap.xml",
  "tools\nginx-security-headers.conf",
  "tools\nginx-site-redirects.conf"
)

foreach ($file in $required) { Assert-File (Join-Path $SourceRoot $file) }

Get-ChildItem -LiteralPath (Join-Path $SourceRoot "assets\js") -Filter "*.js" | ForEach-Object {
  node --check $_.FullName | Out-Host
  if ($LASTEXITCODE -ne 0) { throw "JavaScript syntax failed: $($_.FullName)" }
}

$manifest = Get-Content -Raw -LiteralPath (Join-Path $SourceRoot "site.webmanifest") | ConvertFrom-Json
if (-not $manifest.name -or -not $manifest.short_name -or -not $manifest.icons) {
  throw "site.webmanifest is missing required metadata."
}
foreach ($icon in $manifest.icons) {
  $iconPath = Join-Path $SourceRoot ($icon.src.TrimStart("/") -replace "/", "\")
  Assert-File $iconPath
}

try { [xml](Get-Content -Raw -LiteralPath (Join-Path $SourceRoot "sitemap.xml")) | Out-Null }
catch { throw "sitemap.xml is invalid XML: $($_.Exception.Message)" }

$broken = @()
$htmlFiles = Get-ChildItem -LiteralPath $SourceRoot -Filter "*.html" -File -Recurse
foreach ($htmlFile in $htmlFiles) {
  $html = Get-Content -Raw -LiteralPath $htmlFile.FullName
  if ($html -match '(?:href|src|srcset)=["'']/' -or $html -match 'srcset=["''][^"'']*,/') {
    throw "Root-relative HTML reference breaks direct-file preview: $($htmlFile.FullName)"
  }
  if ($html -match '\sstyle=["'']') {
    throw "Inline style attribute is incompatible with the site CSP: $($htmlFile.FullName)"
  }
  if ($html -notmatch '<link\s+rel="canonical"' -and $htmlFile.FullName -notlike "*\thank-you\*") {
    throw "Missing canonical URL: $($htmlFile.FullName)"
  }
  $matches = [regex]::Matches($html, '(?:href|src|srcset)=["'']([^"'']+)["'']')
  foreach ($match in $matches) {
    foreach ($reference in ($match.Groups[1].Value -split ',')) {
      $reference = ($reference.Trim() -split '\s+', 2)[0]
      if ([string]::IsNullOrWhiteSpace($reference) -or $reference.StartsWith("#") -or $reference -match '^(https?:|mailto:|tel:|data:)') { continue }
      $pathOnly = ($reference -split '[?#]', 2)[0]
      if ([string]::IsNullOrWhiteSpace($pathOnly) -or $pathOnly -eq "/") { continue }
      if ($pathOnly.StartsWith("/")) {
        $candidate = Join-Path $SourceRoot ($pathOnly.TrimStart("/") -replace "/", "\")
      } else {
        $candidate = Join-Path $htmlFile.DirectoryName ($pathOnly -replace "/", "\")
      }
      $exists = (Test-Path -LiteralPath $candidate -PathType Leaf) -or
        ((Test-Path -LiteralPath $candidate -PathType Container) -and (Test-Path -LiteralPath (Join-Path $candidate "index.html") -PathType Leaf))
      if (-not $exists) { $broken += "$($htmlFile.FullName): $reference" }
    }
  }
}
if ($broken.Count) { throw "Broken local references:`n$($broken -join "`n")" }

$styles = Get-Content -Raw -LiteralPath (Join-Path $SourceRoot "assets\css\styles.css")
if ($styles -match 'url\(["'']?/') { throw "Root-relative CSS URL breaks direct-file preview." }
$redirectScripts = @("assets\js\contact.js", "assets\js\thank-you.js")
foreach ($script in $redirectScripts) {
  $source = Get-Content -Raw -LiteralPath (Join-Path $SourceRoot $script)
  if ($source -match 'location\.href\s*=\s*[''"]/') {
    throw "Root-relative JavaScript redirect breaks direct-file preview: $script"
  }
}
$siteScript = Get-Content -Raw -LiteralPath (Join-Path $SourceRoot "assets\js\site.js")
if (-not $siteScript.Contains("window.location.protocol === 'file:'")) {
  throw "site.js is missing direct-file navigation support."
}
$primaryPages = @(
  "index.html",
  "services\index.html",
  "software-ai-web\index.html",
  "managed-it-security-cloud\index.html",
  "repair-hourly-support\index.html",
  "contact\index.html"
)
$securityHeaders = Get-Content -Raw -LiteralPath (Join-Path $SourceRoot "tools\nginx-security-headers.conf")
foreach ($page in $primaryPages) {
  $html = Get-Content -Raw -LiteralPath (Join-Path $SourceRoot $page)
  foreach ($requiredMeta in @(
    '<title>',
    '<meta name="description"',
    '<link rel="canonical"',
    '<meta property="og:title"',
    '<meta property="og:description"',
    '<meta property="og:url"',
    '<meta property="og:image"',
    '<meta name="twitter:title"',
    '<meta name="twitter:description"',
    '<meta name="twitter:image"'
  )) {
    if (-not $html.Contains($requiredMeta)) { throw "Missing $requiredMeta in $page" }
  }
  $jsonLd = [regex]::Match($html, '<script type="application/ld\+json">([\s\S]*?)</script>')
  if (-not $jsonLd.Success) { throw "Missing JSON-LD in $page" }
  $bytes = [Text.Encoding]::UTF8.GetBytes($jsonLd.Groups[1].Value)
  $sha256 = [Security.Cryptography.SHA256]::Create()
  try { $digest = $sha256.ComputeHash($bytes) }
  finally { $sha256.Dispose() }
  $hash = "sha256-" + [Convert]::ToBase64String($digest)
  if (-not $securityHeaders.Contains($hash)) { throw "CSP is missing the JSON-LD hash for $page" }
}

$contactHtml = Get-Content -Raw -LiteralPath (Join-Path $SourceRoot "contact\index.html")
$allowedServices = [regex]::Matches($contactHtml, '<option value="([^"]+)">') | ForEach-Object { $_.Groups[1].Value }
foreach ($htmlFile in $htmlFiles) {
  $html = Get-Content -Raw -LiteralPath $htmlFile.FullName
  foreach ($match in [regex]::Matches($html, '\?service=([^#"''&]+)')) {
    $decodedService = [Uri]::UnescapeDataString($match.Groups[1].Value.Replace("+", " "))
    if ($allowedServices -notcontains $decodedService) {
      throw "Contact CTA uses a service outside the selector allowlist: $decodedService in $($htmlFile.FullName)"
    }
  }
}

if ($RequireMercuryConfig) {
  $config = Get-Content -Raw -LiteralPath (Join-Path $SourceRoot "assets\js\contact-config.js")
  $contact = Get-Content -Raw -LiteralPath (Join-Path $SourceRoot "contact\index.html")
  if ($config -match "CONFIGURE_PUBLIC_IDENTIFIER" -or $contact -match "CONFIGURE_PUBLIC_IDENTIFIER") {
    throw "Mercury Public Website Intake is not configured."
  }
}

Write-Output "Site checks passed."
