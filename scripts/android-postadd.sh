#!/usr/bin/env bash
# Runs in CI right after `npx cap add android`: release signing from android/key.properties,
# versionCode/versionName from Gradle properties (-PversionCode=… -PversionName=…), and the
# Play-required flags. Idempotent — safe to run on an already patched project.
set -euo pipefail
G=android/app/build.gradle
NAME=$(node -p "require('./app.config.json').appName")
VERSION=$(node -p "require('./package.json').version")

if ! grep -q "key.properties" "$G"; then
python3 - "$G" "$VERSION" <<'PY'
import sys, re
path, version = sys.argv[1], sys.argv[2]
s = open(path).read()
head = """def keyProps = new Properties()
def keyFile = rootProject.file('key.properties')
if (keyFile.exists()) { keyFile.withInputStream { keyProps.load(it) } }
def propVersionCode = (project.hasProperty('versionCode') ? project.property('versionCode') : '1').toInteger()
def propVersionName = project.hasProperty('versionName') ? project.property('versionName') : '%s'

""" % version
s = s.replace("apply plugin: 'com.android.application'\n", "apply plugin: 'com.android.application'\n" + head, 1)
s = re.sub(r"versionCode 1\n", "versionCode propVersionCode\n", s, count=1)
s = re.sub(r'versionName "1.0"\n', 'versionName propVersionName\n', s, count=1)
signing = """    signingConfigs {
        release {
            if (keyProps['storeFile']) {
                storeFile file(keyProps['storeFile'])
                storePassword keyProps['storePassword']
                keyAlias keyProps['keyAlias']
                keyPassword keyProps['keyPassword']
            }
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
"""
s = s.replace("    buildTypes {\n        release {\n            minifyEnabled false\n", signing, 1)
open(path, "w").write(s)
PY
fi

# App name, manifest flags and backup rules — done in Python: BSD sed (macOS builders) has no
# GNU-compatible `sed -i` and no `\n` in replacements, which left `strings.xml-E` junk files behind.
python3 - "$NAME" <<'PY'
import os, re, sys
name = sys.argv[1]
S = "android/app/src/main/res/values/strings.xml"
s = open(S).read()
s = re.sub(r'<string name="app_name">[^<]*</string>', f'<string name="app_name">{name}</string>', s)
s = re.sub(r'<string name="title_activity_main">[^<]*</string>', f'<string name="title_activity_main">{name}</string>', s)
open(S, "w").write(s)

# Play policy: no backup of the local database to Google (the app is local-first by promise)
M = "android/app/src/main/AndroidManifest.xml"
m = open(M).read()
m = m.replace('android:allowBackup="true"', 'android:allowBackup="false"')
if 'android:allowBackup' not in m:
    m = m.replace('<application', '<application\n        android:allowBackup="false"', 1)
if 'dataExtractionRules' not in m:
    m = m.replace('android:allowBackup="false"', 'android:allowBackup="false"\n        android:dataExtractionRules="@xml/data_extraction_rules"', 1)
# Billing permission is added by the RevenueCat plugin; notifications must be declared for Android 13+
if 'POST_NOTIFICATIONS' not in m:
    m = m.replace('</manifest>', '    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />\n</manifest>')
open(M, "w").write(m)

os.makedirs("android/app/src/main/res/xml", exist_ok=True)
X = "android/app/src/main/res/xml/data_extraction_rules.xml"
if not os.path.exists(X):
    open(X, "w").write("""<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
  <cloud-backup><exclude domain="root" /><exclude domain="database" /><exclude domain="sharedpref" /><exclude domain="file" /></cloud-backup>
  <device-transfer><exclude domain="root" /><exclude domain="database" /><exclude domain="sharedpref" /><exclude domain="file" /></device-transfer>
</data-extraction-rules>
""")
PY

# SDK levels: Play automatic protection needs minSdk >= 24 (Capacitor default 23); Play requires targetSdk 36
V=android/variables.gradle
[ -f "$V" ] && python3 - "$V" <<'PY'
import re, sys
p = sys.argv[1]; s = open(p).read()
s = re.sub(r"minSdkVersion\s*=\s*2[0-3]", "minSdkVersion = 24", s)
# Google Play requires targetSdk 36 (Android 16) since 31 Aug 2026; Capacitor 7 ships 35
s = re.sub(r"compileSdkVersion\s*=\s*3[0-5]", "compileSdkVersion = 36", s)
s = re.sub(r"targetSdkVersion\s*=\s*3[0-5]", "targetSdkVersion = 36", s)
open(p, "w").write(s)
PY

grep -n "propVersionCode\|signingConfig signingConfigs.release\|key.properties" "$G" | head -5
echo "android project patched: name=$NAME version=$VERSION"
