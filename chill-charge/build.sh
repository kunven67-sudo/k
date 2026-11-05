#!/usr/bin/env bash
# Builds ChillCharge.apk without Gradle.
# Needs: JDK 17+, Android build-tools 35 + platform android-34 (build-tools 34 d8 crashes on JDK 21 class files).
# First time on a fresh box:
#   mkdir -p ~/sdk && cd ~/sdk
#   curl -LO https://dl.google.com/android/repository/build-tools_r35_linux.zip && unzip build-tools_r35_linux.zip -d bt35
#   curl -LO https://dl.google.com/android/repository/platform-34-ext7_r02.zip && unzip platform-34-ext7_r02.zip
#   (gives ~/sdk/bt35/android-15 = build-tools and ~/sdk/android-34 = platform)
set -euo pipefail
cd "$(dirname "$0")"
SDK="${SDK:-$HOME/sdk}"
BT="${BT:-$SDK/bt35/android-15}"
JAR="${JAR:-$SDK/android-34/android.jar}"
KEY="${KEY:-$HOME/.chillcharge.jks}"
OUT=build
rm -rf "$OUT" && mkdir -p "$OUT/classes" "$OUT/dex"

"$BT/aapt2" compile --dir res -o "$OUT/res.zip"
"$BT/aapt2" link -I "$JAR" --manifest AndroidManifest.xml -A assets -o "$OUT/base.apk" \
  --java "$OUT/gen" --min-sdk-version 26 --target-sdk-version 34 -0 ogg -0 ttf "$OUT/res.zip"

javac --release 8 -g -nowarn -classpath "$JAR" -d "$OUT/classes" \
  $(find src "$OUT/gen" -name '*.java') 2>&1 | grep -v "bootstrap classpath" || true
(cd "$OUT/classes" && jar cf ../classes.jar .)
"$BT/d8" --release --min-api 26 --lib "$JAR" --output "$OUT/dex" "$OUT/classes.jar"

cp "$OUT/base.apk" "$OUT/unsigned.apk"
(cd "$OUT/dex" && zip -q -j ../unsigned.apk classes.dex)
"$BT/zipalign" -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

if [ ! -f "$KEY" ]; then
  keytool -genkeypair -keystore "$KEY" -alias cc -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass chillcharge -keypass chillcharge -dname "CN=Chill Charge" >/dev/null 2>&1
fi
"$BT/apksigner" sign --ks "$KEY" --ks-pass pass:chillcharge --key-pass pass:chillcharge \
  --out ChillCharge.apk "$OUT/aligned.apk"
"$BT/apksigner" verify ChillCharge.apk && ls -la ChillCharge.apk
