#!/usr/bin/env bash
# Runs in CI right after `npx cap add ios`: adds the Info.plist purpose strings Apple requires
# for the Capacitor camera/photo plugins and raises the deployment target to iOS 15.
set -euo pipefail
PLIST=ios/App/App/Info.plist
PB=/usr/libexec/PlistBuddy
set_key() { $PB -c "Set :$1 '$2'" "$PLIST" 2>/dev/null || $PB -c "Add :$1 string '$2'" "$PLIST"; }
set_key NSCameraUsageDescription "Kameraet bruges til at tage billeder og video til holdets mapper."
set_key NSPhotoLibraryUsageDescription "Vælg billeder og video fra dit bibliotek til holdets mapper og opslag."
set_key NSPhotoLibraryAddUsageDescription "Gem billeder fra holdets mapper i dit bibliotek."
$PB -c "Add :ITSAppUsesNonExemptEncryption bool false" "$PLIST" 2>/dev/null || $PB -c "Set :ITSAppUsesNonExemptEncryption false" "$PLIST"
# Deployment target 14.0 -> 15.0 (Xcode project + Podfile)
# Deployment target -> 15.5 everywhere (WidgetKit bridge / ML Kit pods require >= 15.5)
sed -i '' -E 's/IPHONEOS_DEPLOYMENT_TARGET = [0-9.]+;/IPHONEOS_DEPLOYMENT_TARGET = 15.5;/g' ios/App/App.xcodeproj/project.pbxproj
sed -i '' -E "s/platform :ios, '[0-9.]+'/platform :ios, '15.5'/" ios/App/Podfile
sed -i '' 's/  assertDeploymentTarget(installer)/  assertDeploymentTarget(installer)\
  installer.pods_project.targets.each { |t| t.build_configurations.each { |c| c.build_settings["IPHONEOS_DEPLOYMENT_TARGET"] = "15.5" if c.build_settings["IPHONEOS_DEPLOYMENT_TARGET"].to_f < 15.5 } }/' ios/App/Podfile
# LLDS ships on iPad too (parents/Line) – keep TARGETED_DEVICE_FAMILY = "1,2"
# Push notifications: entitlement + background mode
$PB -c "Add :UIBackgroundModes array" "$PLIST" 2>/dev/null || true
$PB -c "Add :UIBackgroundModes:0 string remote-notification" "$PLIST" 2>/dev/null || true
ENT=ios/App/App/App.entitlements
if [ ! -f "$ENT" ]; then printf '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>aps-environment</key><string>production</string></dict></plist>\n' > "$ENT"; fi
grep -q "CODE_SIGN_ENTITLEMENTS" ios/App/App.xcodeproj/project.pbxproj || sed -i '' -E 's/(PRODUCT_BUNDLE_IDENTIFIER = [^;]+;)/\1 CODE_SIGN_ENTITLEMENTS = App\/App.entitlements;/g' ios/App/App.xcodeproj/project.pbxproj
echo "Info.plist and deployment target updated"
