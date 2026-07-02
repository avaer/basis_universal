# Build + package basisu for Windows x86_64 using the installed Visual Studio
# toolchain (cmake auto-detects the newest VS generator).
#
# Produces:
#   bin/windows-x86_64/basisu_windows_x86_64.exe
#   bin/windows-x86_64/basisu_windows_x86_64.tar.xz   (single-file archive,
#     same layout as the darwin/linux packages consumed by basisu-bin)
#
# Requirements: cmake, a Visual Studio C++ toolchain, and the Windows 10+
# built-in bsdtar (tar.exe) for the .tar.xz packaging.

$ErrorActionPreference = "Stop"

$RootDir = Split-Path -Parent $PSScriptRoot
$BuildDir = Join-Path $RootDir "build-windows"
$OutDir = Join-Path $RootDir "bin/windows-x86_64"
$BinName = "basisu_windows_x86_64"

Write-Host "[info] Root: $RootDir"
Write-Host "[info] Build dir: $BuildDir"
Write-Host "[info] Output dir: $OutDir"

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

# 64-bit only. CMAKE_RUNTIME_OUTPUT_DIRECTORY points at the source bin/, so
# the exe lands at bin/basisu.exe.
cmake -S $RootDir -B $BuildDir -A x64 -DCMAKE_BUILD_TYPE=Release
if ($LASTEXITCODE -ne 0) { throw "cmake configure failed ($LASTEXITCODE)" }

cmake --build $BuildDir --config Release --parallel
if ($LASTEXITCODE -ne 0) { throw "cmake build failed ($LASTEXITCODE)" }

$BuiltExe = Join-Path $RootDir "bin/basisu.exe"
if (-not (Test-Path $BuiltExe)) { throw "expected build output missing: $BuiltExe" }

Copy-Item -Force $BuiltExe (Join-Path $OutDir "$BinName.exe")
Write-Host "[info] Wrote $OutDir/$BinName.exe"

# Package as a single-file tar.xz named after the binary, matching the
# darwin/linux archives (extractors return the first file inside). Maximum
# xz compression: level 9 is the highest bsdtar's xz writer exposes (it has
# no "extreme" passthrough).
$ArchivePath = Join-Path $OutDir "$BinName.tar.xz"
if (Test-Path $ArchivePath) { Remove-Item -Force $ArchivePath }
tar --options "xz:compression-level=9" -cJf $ArchivePath -C $OutDir "$BinName.exe"
if ($LASTEXITCODE -ne 0) { throw "tar packaging failed ($LASTEXITCODE)" }

Write-Host "[done] Windows x86_64 build complete. Package: $ArchivePath"
