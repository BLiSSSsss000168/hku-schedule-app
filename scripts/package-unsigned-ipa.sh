#!/usr/bin/env bash
set -euo pipefail

PROJECT_PATH="ios/App/App.xcodeproj"
SCHEME="App"
DERIVED_DATA="build/unsigned-derived-data"
PACKAGE_DIR="build/unsigned-package"
PAYLOAD_DIR="${PACKAGE_DIR}/Payload"
ARTIFACT_DIR="artifacts"
IPA_PATH="${ARTIFACT_DIR}/HKU-Schedule-unsigned.ipa"

rm -rf "${DERIVED_DATA}" "${PACKAGE_DIR}" "${ARTIFACT_DIR}"
mkdir -p "${PAYLOAD_DIR}" "${ARTIFACT_DIR}"

xcodebuild \
  -project "${PROJECT_PATH}" \
  -scheme "${SCHEME}" \
  -configuration Release \
  -sdk iphoneos \
  -destination "generic/platform=iOS" \
  -derivedDataPath "${DERIVED_DATA}" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  DEVELOPMENT_TEAM="" \
  build

APP_PATH="$(find "${DERIVED_DATA}/Build/Products/Release-iphoneos" -maxdepth 1 -name '*.app' -print -quit)"

if [[ -z "${APP_PATH}" ]]; then
  echo "No .app bundle was produced." >&2
  exit 1
fi

/usr/bin/ditto "${APP_PATH}" "${PAYLOAD_DIR}/$(basename "${APP_PATH}")"

(
  cd "${PACKAGE_DIR}"
  /usr/bin/zip -qry "../HKU-Schedule-unsigned.ipa" Payload
)

mv "build/HKU-Schedule-unsigned.ipa" "${IPA_PATH}"
printf 'Created %s\n' "${IPA_PATH}"
