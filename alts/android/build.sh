#!/bin/bash
# Builds ALTS.apk (ALTS for phone 2.0) with Google's Android build tools only (no Android Studio).
#   ANDROID_HOME=<sdk with build-tools;36.0.0 + platforms;android-34>  KEYSTORE=<.jks>  ./build.sh
# First run downloads into build-cache/ (kept between builds, never committed):
#   - androidx.webkit + what it needs (Google's Maven): separate logins per account (WebView profiles)
#   - the meme pack: imgflip's 100 most popular meme pictures, baked in so stickers work offline
# APP_ID (default com.alts.phone.two): ALTS 1.x's signing key is gone, so 2.x is its own app.
set -e
cd "$(dirname "$0")"
BT="$ANDROID_HOME/build-tools/36.0.0"; JAR="$ANDROID_HOME/platforms/android-34/android.jar"
APP_ID="${APP_ID:-com.alts.phone.two}"
CACHE=build-cache
rm -rf build && mkdir -p build/classes build/dex build/gen build/assets build/libs "$CACHE/maven" "$CACHE/stickers"

# ---- libraries (classes only: none of the code we call needs their resources)
G=https://dl.google.com/android/maven2
C=https://maven-central.storage-download.googleapis.com/maven2
for dep in "$G androidx/webkit/webkit 1.14.0 aar" "$G androidx/core/core 1.1.0 aar" "$G androidx/annotation/annotation 1.1.0 jar" \
           "$G androidx/annotation/annotation-experimental 1.4.1 aar" "$G androidx/collection/collection 1.0.0 jar" \
           "$G androidx/lifecycle/lifecycle-common 2.0.0 jar" "$G androidx/lifecycle/lifecycle-runtime 2.0.0 aar" \
           "$G androidx/arch/core/core-common 2.0.0 jar" "$G androidx/versionedparcelable/versionedparcelable 1.1.0 aar" \
           "$C org/jspecify/jspecify 1.0.0 jar"; do
  set -- $dep
  name=$(basename "$2"); file="$CACHE/maven/$name-$3.$4"
  [ -s "$file" ] || curl -fsS -m 120 -o "$file" "$1/$2/$3/$name-$3.$4"
  if [ "$4" = aar ]; then unzip -q -o -p "$file" classes.jar > "build/libs/$name.jar"; else cp "$file" "build/libs/$name.jar"; fi
done

# ---- the meme pack (refreshed every few days by the app itself; this is the offline start)
if [ ! -s "$CACHE/stickers/pack.json" ]; then
  python3 -I - "$CACHE/stickers" <<'PY'
import json, os, subprocess, sys
out = sys.argv[1]
raw = subprocess.run(['curl', '-fsS', '-m', '30', 'https://api.imgflip.com/get_memes'], capture_output=True, check=True).stdout
pack = []
try:
    from PIL import Image
except Exception:
    Image = None
for m in json.loads(raw)['data']['memes'][:100]:
    mid = ''.join(c for c in str(m.get('id', '')) if c.isalnum())[:20]
    url = str(m.get('url', ''))
    if not mid or not url.startswith('https://'):
        continue
    ext = '.png' if url.lower().endswith('.png') else '.jpg'
    f = os.path.join(out, mid + ext)
    if not os.path.exists(f) and subprocess.run(['curl', '-fsS', '-m', '30', '-o', f, url]).returncode != 0:
        continue
    if Image:  # 720 px is plenty for a sticker, and keeps the app small
        try:
            im = Image.open(f)
            if max(im.size) > 720 or ext == '.jpg':
                im.thumbnail((720, 720))
                if ext == '.jpg':
                    im.convert('RGB').save(f, 'JPEG', quality=84, optimize=True)
                else:
                    im.save(f, optimize=True)
        except Exception:
            pass
    pack.append({'id': 'meme-' + mid, 'name': str(m.get('name', 'meme')).strip(), 'file': mid + ext})
json.dump(pack, open(os.path.join(out, 'pack.json'), 'w'))
print('meme pack:', len(pack))
PY
fi

# ---- assets: the phone shell + the PC app's page code (same files, so the phone gets the same mods)
cp -r assets/. build/assets/
cp ../ui/page.js ../ui/extras.js build/assets/
mkdir -p build/assets/stickers && cp "$CACHE"/stickers/* build/assets/stickers/

"$BT/aapt2" compile --dir res -o build/res.zip
"$BT/aapt2" link -o build/base.apk -I "$JAR" --manifest AndroidManifest.xml -A build/assets --java build/gen \
  --custom-package com.alts.phone --rename-manifest-package "$APP_ID" \
  --min-sdk-version 29 --target-sdk-version 34 --version-code "${VERSION_CODE:-2}" --version-name "${VERSION_NAME:-2.0.0}" build/res.zip
javac -nowarn -Xlint:-options --release 8 -classpath "$JAR:$(ls build/libs/*.jar | tr '\n' ':')" \
  -d build/classes $(find build/gen src -name '*.java')
[ -f build/classes/com/alts/phone/MainActivity.class ] || { echo "javac failed"; exit 1; }
(cd build/classes && jar cf ../classes.jar .)
"$BT/d8" --lib "$JAR" --min-api 29 --output build/dex build/classes.jar build/libs/*.jar
cp build/base.apk build/unsigned.apk
(cd build/dex && zip -q ../unsigned.apk classes*.dex)
"$BT/zipalign" -f -p 4 build/unsigned.apk build/aligned.apk
"$BT/apksigner" sign --ks "$KEYSTORE" --ks-pass pass:"${KS_PASS:-altsphone}" --out ALTS.apk build/aligned.apk
"$BT/apksigner" verify ALTS.apk && echo "built ALTS.apk ($APP_ID)"
