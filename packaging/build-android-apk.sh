#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
PROJECT="$ROOT/android-app"
OUT=${1:-"$ROOT/dist/android"}
VERSION=1.7.1
GRADLE_VERSION=8.13
GRADLE_SHA256=20f1b1176237254a6fc204d8434196fa11a4cfb387567519c61556e8710aed78
GRADLE_URL="https://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip"

[ -n "${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}" ] || { printf 'ANDROID_HOME or ANDROID_SDK_ROOT is required.\n' >&2; exit 2; }
SDK_ROOT=${ANDROID_HOME:-$ANDROID_SDK_ROOT}
command -v java >/dev/null 2>&1 || { printf 'JDK 17 is required.\n' >&2; exit 2; }
command -v curl >/dev/null 2>&1 || exit 2
command -v unzip >/dev/null 2>&1 || exit 2

rm -rf "$OUT"
mkdir -p "$OUT"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

if command -v sdkmanager >/dev/null 2>&1; then
  yes | sdkmanager --licenses >/dev/null 2>&1 || true
  sdkmanager 'platform-tools' 'platforms;android-36' 'build-tools;35.0.0'
fi

curl --fail --location --retry 5 --connect-timeout 20 "$GRADLE_URL" -o "$WORK/gradle.zip"
printf '%s  %s\n' "$GRADLE_SHA256" "$WORK/gradle.zip" | sha256sum --check --strict -
unzip -q "$WORK/gradle.zip" -d "$WORK"
GRADLE="$WORK/gradle-${GRADLE_VERSION}/bin/gradle"

(
  cd "$PROJECT"
  "$GRADLE" --no-daemon --stacktrace --warning-mode=all clean :app:lintDebug :app:assembleDebug :app:assembleRelease
)

DEBUG_APK="$OUT/YTConv-${VERSION}-debug.apk"
RELEASE_APK="$OUT/YTConv-${VERSION}-release-unsigned.apk"
cp "$PROJECT/app/build/outputs/apk/debug/app-debug.apk" "$DEBUG_APK"
cp "$PROJECT/app/build/outputs/apk/release/app-release-unsigned.apk" "$RELEASE_APK"

AAPT="$SDK_ROOT/build-tools/35.0.0/aapt"
APKSIGNER="$SDK_ROOT/build-tools/35.0.0/apksigner"
[ -x "$AAPT" ] || { printf 'aapt was not found.\n' >&2; exit 3; }
[ -x "$APKSIGNER" ] || { printf 'apksigner was not found.\n' >&2; exit 3; }
"$AAPT" dump badging "$DEBUG_APK" | grep -F "package: name='io.github.andhikamarcella.ytconv.debug' versionCode='10700' versionName='1.7.1-debug'"
"$AAPT" dump badging "$RELEASE_APK" | grep -F "package: name='io.github.andhikamarcella.ytconv' versionCode='10700' versionName='1.7.1'"
"$APKSIGNER" verify --verbose "$DEBUG_APK"

for abi in arm64-v8a armeabi-v7a x86_64 x86; do
  unzip -l "$DEBUG_APK" | grep -q "lib/$abi/" || { printf 'Missing Android ABI: %s\n' "$abi" >&2; exit 4; }
done

SOURCE_ARCHIVE="$OUT/YTConv-Android-${VERSION}-source.tar.gz"
tar -czf "$SOURCE_ARCHIVE" -C "$ROOT" android-app
sha256sum "$DEBUG_APK" "$RELEASE_APK" "$SOURCE_ARCHIVE" > "$OUT/SHA256SUMS-android.txt"
printf '%s\n%s\n' "$DEBUG_APK" "$RELEASE_APK"
