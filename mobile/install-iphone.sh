#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

if [[ ! -f app.json ]]; then
  echo "Run this from the Fixyourhome mobile folder, not from another project." >&2
  exit 1
fi

npm install
CI=1 EXPO_NO_GIT_STATUS=1 npx expo prebuild --platform ios --clean

workspace="$(find ios -maxdepth 1 -name '*.xcworkspace' -print -quit)"
if [[ -z "${workspace}" ]]; then
  echo "Xcode project was not created in mobile/ios." >&2
  exit 1
fi

echo
echo "Xcode project: $(pwd)/${workspace}"
echo "1. Select the TidyNext target, then Signing & Capabilities, and choose your Apple ID as the Team."
echo "2. At the top, choose your iPhone. Bundle id: com.tidynext.home"
echo "3. Press the Run button. On the iPhone, trust the developer in Settings if iOS asks."
echo

if [[ "$(uname)" == "Darwin" ]]; then
  open "${workspace}"
else
  echo "Open ${workspace} in Xcode on your Mac."
fi
