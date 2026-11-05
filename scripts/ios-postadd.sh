#!/usr/bin/env bash
# Runs in CI right after `npx cap add ios`: adds the Info.plist purpose strings Apple requires
# for the Capacitor camera/photo plugins and raises the deployment target to iOS 15.
set -euo pipefail
PLIST=ios/App/App/Info.plist
PB=/usr/libexec/PlistBuddy
set_key() { $PB -c "Set :$1 '$2'" "$PLIST" 2>/dev/null || $PB -c "Add :$1 string '$2'" "$PLIST"; }
set_key NSCameraUsageDescription "This app uses the camera to add photos."
set_key NSPhotoLibraryUsageDescription "This app lets you pick photos from your library."
set_key NSPhotoLibraryAddUsageDescription "This app can save exports to your photo library."
$PB -c "Add :ITSAppUsesNonExemptEncryption bool false" "$PLIST" 2>/dev/null || $PB -c "Set :ITSAppUsesNonExemptEncryption false" "$PLIST"
# Deployment target 14.0 -> 15.0 (Xcode project + Podfile)
# Deployment target -> 15.5 everywhere (WidgetKit bridge / ML Kit pods require >= 15.5)
sed -i '' -E 's/IPHONEOS_DEPLOYMENT_TARGET = [0-9.]+;/IPHONEOS_DEPLOYMENT_TARGET = 15.5;/g' ios/App/App.xcodeproj/project.pbxproj
sed -i '' -E "s/platform :ios, '[0-9.]+'/platform :ios, '15.5'/" ios/App/Podfile
sed -i '' 's/  assertDeploymentTarget(installer)/  assertDeploymentTarget(installer)\
  installer.pods_project.targets.each { |t| t.build_configurations.each { |c| c.build_settings["IPHONEOS_DEPLOYMENT_TARGET"] = "15.5" if c.build_settings["IPHONEOS_DEPLOYMENT_TARGET"].to_f < 15.5 } }/' ios/App/Podfile
# iPhone only unless the app ships iPad screenshots
sed -i '' -E 's/TARGETED_DEVICE_FAMILY = "1,2";/TARGETED_DEVICE_FAMILY = "1";/g' ios/App/App.xcodeproj/project.pbxproj
echo "Info.plist and deployment target updated"
