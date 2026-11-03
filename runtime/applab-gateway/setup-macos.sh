#!/usr/bin/env bash
# APP LAB — prepara SDK Android, emulatore e AVD su macOS, fuori dal repo.
# Uso: APPLAB_ROOT="/Volumes/HIKSEMI 1/File Temp/Server LaTaverna" ./setup-macos.sh
set -euo pipefail

ROOT="${APPLAB_ROOT:-/Volumes/HIKSEMI 1/File Temp/Server LaTaverna}"
SDK="${ANDROID_HOME:-$ROOT/android-sdk}"
export ANDROID_HOME="$SDK"
export ANDROID_SDK_ROOT="$SDK"
export ANDROID_USER_HOME="${ANDROID_USER_HOME:-$ROOT/android-home}"
export ANDROID_AVD_HOME="$ANDROID_USER_HOME/avd"
export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17}"

CMDLINE=/opt/homebrew/share/android-commandlinetools/cmdline-tools/latest/bin
IMAGE="system-images;android-34;google_apis;arm64-v8a"

mkdir -p "$ANDROID_AVD_HOME"

echo "→ SDK in $SDK"
yes | "$CMDLINE/sdkmanager" --sdk_root="$SDK" --licenses > /dev/null
"$CMDLINE/sdkmanager" --sdk_root="$SDK" "platform-tools" "emulator" "platforms;android-34" "$IMAGE"

if ! "$CMDLINE/avdmanager" list avd -c | grep -qx applab; then
    echo "→ creo l'AVD applab"
    echo no | "$CMDLINE/avdmanager" create avd -n applab -k "$IMAGE" -d pixel_6 --force
else
    echo "→ AVD applab già presente"
fi

cat <<EOF

Setup completato.

Variabili per il gateway (in .env.local, non committare):
  APP_LAB_RUNTIME_URL=http://127.0.0.1:8790
  APP_LAB_RUNTIME_TOKEN=<token casuale>

Avvio (tre processi):
  mediamtx runtime/applab-gateway/mediamtx.yml
  ANDROID_HOME="$SDK" ANDROID_AVD_HOME="$ANDROID_AVD_HOME" \\
    "$SDK/emulator/emulator" -avd applab -no-window -no-audio -gpu swiftshader_indirect
  APP_LAB_RUNTIME_TOKEN=<token> node runtime/applab-gateway/server.js
EOF
