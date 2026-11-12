#!/bin/bash
# Builds AD ZAP.apk with Google's Android build tools only (no Android Studio, no libraries).
#   ANDROID_HOME=<sdk with build-tools 35 + platforms;android-34>  KEYSTORE=<.jks>  ./build.sh
set -e
cd "$(dirname "$0")"
BT=$(ls -d "$ANDROID_HOME"/build-tools/* | sort | tail -1); JAR="$ANDROID_HOME/platforms/android-34/android.jar"
rm -rf build && mkdir -p build/classes build/dex build/gen build/test

# the rules first: they decide what gets tapped
javac -nowarn -d build/test src/com/adzap/app/Rules.java src/com/adzap/app/XFinder.java test/RulesTest.java test/XFinderTest.java
java -cp build/test com.adzap.app.RulesTest
# X_TESTS="<png> <x> <y> | <png> none ..." = real screenshots to check the X finder on (kept out of this repo)
[ -z "$X_TESTS" ] || java -cp build/test com.adzap.app.XFinderTest $X_TESTS

"$BT/aapt2" compile --dir res -o build/res.zip
"$BT/aapt2" link -o build/base.apk -I "$JAR" --manifest AndroidManifest.xml --java build/gen \
  --min-sdk-version 26 --target-sdk-version 34 --version-code "${VERSION_CODE:-4}" --version-name "${VERSION_NAME:-1.3.0}" build/res.zip
javac -nowarn -Xlint:-options --release 8 -classpath "$JAR" -d build/classes $(find build/gen src -name '*.java')
(cd build/classes && jar cf ../classes.jar .)
"$BT/d8" --lib "$JAR" --min-api 26 --output build/dex build/classes.jar
cp build/base.apk build/unsigned.apk
(cd build/dex && zip -q -j ../unsigned.apk classes.dex)
"$BT/zipalign" -f -p 4 build/unsigned.apk build/aligned.apk
"$BT/apksigner" sign --ks "$KEYSTORE" --ks-pass pass:"${KS_PASS:-adzapkey}" --out "build/AD ZAP.apk" build/aligned.apk
"$BT/apksigner" verify "build/AD ZAP.apk"
echo "built: build/AD ZAP.apk"
