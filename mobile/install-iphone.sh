#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

if [[ ! -f app.json ]]; then
  echo "Run this from the Fixyourhome mobile folder, not from another project." >&2
  exit 1
fi

npm install
CI=1 EXPO_NO_GIT_STATUS=1 npx expo prebuild --platform ios --clean

plist="$(find ios -name Info.plist -path '*TidyNext/Info.plist' -print -quit)"
if [[ -z "${plist}" ]] || ! grep -q 'EXExpoAppSceneDelegate' "${plist}"; then
  echo "This Xcode project cannot launch. It is missing the iOS scene lifecycle." >&2
  exit 1
fi

scheme="$(find ios -name '*.xcscheme' -path '*xcshareddata*' -print -quit)"
python3 - "${scheme}" <<'PY'
import pathlib, sys
path = pathlib.Path(sys.argv[1])
text = path.read_text()
old = '<LaunchAction\n      buildConfiguration = "Debug"'
new = '<LaunchAction\n      buildConfiguration = "Release"'
if old not in text:
    raise SystemExit("Could not set the Xcode Run action to Release.")
path.write_text(text.replace(old, new, 1))
PY

node_bin="$(command -v node)"
printf 'export NODE_BINARY=%q\n' "${node_bin}" > ios/.xcode.env.local

workspace="$(find ios -maxdepth 1 -name '*.xcworkspace' -print -quit)"
echo
echo "The iPhone project now uses the scene lifecycle, so iOS can launch it."
echo "Xcode will install a Release build. The app includes its own screen and does not need a dev server."
echo "Project: $(pwd)/${workspace}"
echo "1. Signing & Capabilities: set Team to your Apple ID. Bundle id com.tidynext.home"
echo "2. Choose your iPhone at the top."
echo "3. Press Run."
echo

if [[ "$(uname)" == "Darwin" ]]; then
  open "${workspace}"
fi
