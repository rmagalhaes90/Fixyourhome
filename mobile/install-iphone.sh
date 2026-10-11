#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

if [[ ! -f app.json ]]; then
  echo "This script has to run from the Fixyourhome mobile folder." >&2
  exit 1
fi

npm install
CI=1 EXPO_NO_GIT_STATUS=1 npx expo prebuild --platform ios --clean
npx expo run:ios --device
