#Requires -Version 5.1
<#
.SYNOPSIS
    Packages the Namoroka theme into a distributable zip inside dist/.

.DESCRIPTION
    Reads the version from Namoroka\install.rdf, copies the live theme from
    the userchrome-manager themes folder into a temp directory, strips all
    development-only files (*.scss, *.css.map, scss-src/, src/, compile.bat,
    watch.bat), then zips the result to dist\namoroka_VERSION-buildBUILD.zip.

    Source files in both repos are never modified.
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

$repoRoot   = $PSScriptRoot
$installRdf = Join-Path $repoRoot 'Namoroka\install.rdf'
$themeSource = "$(Split-Path $repoRoot -Parent)\userchrome-manager\Profile Folder\chrome\themes\namoroka"
$distDir    = Join-Path $repoRoot 'dist'

# ---------------------------------------------------------------------------
# Read version from install.rdf
# ---------------------------------------------------------------------------

if (-not (Test-Path $installRdf)) {
    Write-Error "install.rdf not found at: $installRdf"
    exit 1
}

[xml]$rdf = Get-Content $installRdf -Encoding UTF8

$ns = New-Object System.Xml.XmlNamespaceManager($rdf.NameTable)
$ns.AddNamespace('rdf', 'http://www.w3.org/1999/02/22-rdf-syntax-ns#')
$ns.AddNamespace('em',  'http://www.mozilla.org/2004/em-rdf#')

$version = $rdf.SelectSingleNode('//em:version', $ns).InnerText.Trim()
$build   = $rdf.SelectSingleNode('//em:build',   $ns).InnerText.Trim()

$zipName = "namoroka_$version-build$build.zip"
Write-Host "Packaging: $zipName"

# ---------------------------------------------------------------------------
# Validate source theme directory
# ---------------------------------------------------------------------------

if (-not (Test-Path $themeSource)) {
    Write-Error "Theme source not found at: $themeSource"
    exit 1
}

# ---------------------------------------------------------------------------
# Prepare output directory
# ---------------------------------------------------------------------------

if (-not (Test-Path $distDir)) {
    New-Item -ItemType Directory -Path $distDir | Out-Null
}

$zipPath = Join-Path $distDir $zipName

# ---------------------------------------------------------------------------
# Copy theme to a temp directory
# ---------------------------------------------------------------------------

$tempDir = Join-Path $env:TEMP "namoroka_build_$([System.IO.Path]::GetRandomFileName())"
Write-Host "Working in temp: $tempDir"

Copy-Item -Path $themeSource -Destination $tempDir -Recurse -Force

# ---------------------------------------------------------------------------
# Strip dev-only files from the temp copy
# ---------------------------------------------------------------------------

# Remove all *.scss files
Get-ChildItem -Path $tempDir -Recurse -Filter '*.scss' | Remove-Item -Force

# Remove all *.css.map files
Get-ChildItem -Path $tempDir -Recurse -Filter '*.css.map' | Remove-Item -Force

# Remove dirs: namoroka\scss-src, namoroka\src
$dirsToRemove = @(
    Join-Path $tempDir 'namoroka\scss-src'
    Join-Path $tempDir 'namoroka\src'
)
foreach ($dir in $dirsToRemove) {
    if (Test-Path $dir) {
        Remove-Item -Path $dir -Recurse -Force
    }
}

# Remove files: namoroka\compile.bat, namoroka\watch.bat
$filesToRemove = @(
    Join-Path $tempDir 'namoroka\compile.bat'
    Join-Path $tempDir 'namoroka\watch.bat'
    Join-Path $tempDir 'namoroka\_chrome_user.css'
)
foreach ($file in $filesToRemove) {
    if (Test-Path $file) {
        Remove-Item -Path $file -Force
    }
}

# ---------------------------------------------------------------------------
# Zip: pack contents so files land at the zip root (no outer wrapper folder)
# ---------------------------------------------------------------------------

if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

Compress-Archive -Path "$tempDir\*" -DestinationPath $zipPath

# ---------------------------------------------------------------------------
# Cleanup temp
# ---------------------------------------------------------------------------

Remove-Item -Path $tempDir -Recurse -Force

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------

$size = [math]::Round((Get-Item $zipPath).Length / 1KB, 1)
Write-Host ""
Write-Host "Done! -> $zipPath ($size KB)"
