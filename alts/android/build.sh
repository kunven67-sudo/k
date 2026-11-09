#!/bin/bash
# Builds ALTS.apk (ALTS for phone) with Google's Android build tools only (no Android Studio).
#   ANDROID_HOME=<sdk with build-tools;36.0.0 + platforms;android-34>  KEYSTORE=<.jks>  ./build.sh
set -e
cd "$(dirname "$0")"
BT="$ANDROID_HOME/build-tools/36.0.0"; JAR="$ANDROID_HOME/platforms/android-34/android.jar"
rm -rf build && mkdir -p build/classes build/dex build/gen
cp ../ui/page.js assets/page.js
"$BT/aapt2" compile --dir res -o build/res.zip
"$BT/aapt2" link -o build/base.apk -I "$JAR" --manifest AndroidManifest.xml -A assets --java build/gen \
  --min-sdk-version 29 --target-sdk-version 34 --version-code "${VERSION_CODE:-1}" --version-name "${VERSION_NAME:-1.0.0}" build/res.zip
javac -nowarn -Xlint:-options -source 8 -target 8 -bootclasspath "$JAR" -classpath "$JAR" -d build/classes $(find build/gen src -name '*.java')
[ -f build/classes/com/alts/phone/MainActivity.class ] || { echo "javac failed"; exit 1; }
(cd build/classes && jar cf ../classes.jar .)
"$BT/d8" --lib "$JAR" --min-api 29 --output build/dex build/classes.jar
cp build/base.apk build/unsigned.apk
(cd build/dex && zip -q ../unsigned.apk classes.dex)
"$BT/zipalign" -f -p 4 build/unsigned.apk build/aligned.apk
"$BT/apksigner" sign --ks "$KEYSTORE" --ks-pass pass:"${KS_PASS:-altsphone}" --out ALTS.apk build/aligned.apk
"$BT/apksigner" verify ALTS.apk && echo "built ALTS.apk"
