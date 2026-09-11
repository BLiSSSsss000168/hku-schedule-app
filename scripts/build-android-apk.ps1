$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$androidRoot = Join-Path $projectRoot "android"
$sdkRoot = "D:\HKU Learning\AndroidSdk"
$jdkRoot = "D:\HKU Learning\Java\jdk21-extracted\jdk-21.0.12.1+1"
$androidUserHome = "D:\HKU Learning\.android"
$gradleUserHome = "D:\HKU Learning\.gradle"
$artifactDir = Join-Path $projectRoot "artifacts"
$localDownloadDir = Join-Path $projectRoot "www\downloads"

if (-not (Test-Path -LiteralPath $sdkRoot)) {
    throw "Android SDK not found: $sdkRoot"
}

if (-not (Test-Path -LiteralPath (Join-Path $jdkRoot "bin\javac.exe"))) {
    throw "JDK 21 not found: $jdkRoot"
}

$env:JAVA_HOME = $jdkRoot
$env:ANDROID_HOME = $sdkRoot
$env:ANDROID_SDK_ROOT = $sdkRoot
$env:ANDROID_USER_HOME = $androidUserHome
$env:GRADLE_USER_HOME = $gradleUserHome
Remove-Item Env:ANDROID_SDK_HOME -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $localDownloadDir -Recurse -Force -ErrorAction SilentlyContinue

Push-Location $projectRoot
try {
    & node --require=./scripts/cap-shim.cjs ./node_modules/@capacitor/cli/bin/capacitor sync android
    if ($LASTEXITCODE -ne 0) {
        throw "Capacitor sync failed with exit code $LASTEXITCODE"
    }
}
finally {
    Pop-Location
}

Push-Location $androidRoot
try {
    & ".\gradlew.bat" assembleDebug --no-daemon
    if ($LASTEXITCODE -ne 0) {
        throw "Gradle build failed with exit code $LASTEXITCODE"
    }
}
finally {
    Pop-Location
}

$apk = Join-Path $androidRoot "app\build\outputs\apk\debug\app-debug.apk"
if (-not (Test-Path -LiteralPath $apk)) {
    throw "APK was not produced: $apk"
}

New-Item -ItemType Directory -Path $artifactDir -Force | Out-Null
$output = Join-Path $artifactDir "HKU-Schedule-android-debug.apk"
Copy-Item -LiteralPath $apk -Destination $output -Force

Write-Host "APK created: $output"
