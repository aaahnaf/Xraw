# Capacitor 5 Plugin Registration - Explanation and Fix

## What Went Wrong

The build failed with these errors:
```
e: MainActivity.kt:29:5 'registerPlugins' overrides nothing
e: MainActivity.kt:32:17 Unresolved reference: addPlugin
```

## Why It Was Wrong

I incorrectly tried to manually register the plugin by overriding a `registerPlugins()` method that doesn't exist in Capacitor 5's `BridgeActivity`. This was based on outdated information about how Capacitor plugins work.

### The Mistake
```kotlin
// ❌ WRONG - This method doesn't exist in Capacitor 5
override fun registerPlugins() {
    bridge?.addPlugin(XRawCameraPlugin::class.java)  // ❌ This method doesn't exist
}
```

## How Capacitor 5 Plugin Registration Actually Works

### Automatic Plugin Discovery

In Capacitor 5, plugins are **automatically registered** through the `@CapacitorPlugin` annotation. There is **no need** to manually register plugins in `MainActivity`.

### The Correct Approach

The plugin is already correctly annotated:
```kotlin
@CapacitorPlugin(
    name = "XRawCamera",
    permissions = [
        Permission(strings = [Manifest.permission.CAMERA], alias = "camera"),
        Permission(strings = [Manifest.permission.RECORD_AUDIO], alias = "microphone")
    ]
)
class XRawCameraPlugin : Plugin() {
    // Plugin methods...
}
```

Capacitor's build system automatically:
1. Scans for classes annotated with `@CapacitorPlugin`
2. Registers them with the bridge during app initialization
3. Makes them available at `window.Capacitor.Plugins.XRawCamera`

### MainActivity Should Be Simple

```kotlin
// ✅ CORRECT - No manual plugin registration needed
class MainActivity : BridgeActivity() {
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setupCameraPreview()
    }
    
    private fun setupCameraPreview() {
        // Just set up the camera preview view
        // Plugins are auto-registered by Capacitor
    }
}
```

## The Fix Applied

I've removed the invalid `registerPlugins()` override from `MainActivity.kt`. The file now correctly:

1. ✅ Extends `BridgeActivity`
2. ✅ Sets up the camera preview view
3. ✅ Does NOT try to manually register plugins
4. ✅ Relies on Capacitor's automatic plugin discovery

## Why the Plugin Might Not Be Available

If the plugin still shows "not available" after this fix, the issue is likely:

### 1. Plugin Not Being Discovered

Capacitor needs to discover the plugin at build time. This requires:

**Check: Plugin is in the correct package**
```kotlin
package com.xraw.camera  // ✅ Must match your app's package

@CapacitorPlugin(name = "XRawCamera")
class XRawCameraPlugin : Plugin()
```

**Check: Plugin class is public**
```kotlin
// ✅ Must be public (default in Kotlin)
class XRawCameraPlugin : Plugin()
```

**Check: Plugin has @CapacitorPlugin annotation**
```kotlin
@CapacitorPlugin(
    name = "XRawCamera",  // ✅ Must match what frontend expects
    permissions = [...]
)
class XRawCameraPlugin : Plugin()
```

### 2. Build Configuration Issues

**Check: Capacitor dependencies are correct**
```gradle
// android/app/build.gradle
dependencies {
    implementation 'com.capacitorjs:core:5.7.0'  // ✅ Must be Capacitor 5
}
```

**Check: Plugin is in the same module as the app**
The plugin must be in the same Gradle module as your app, or properly configured as a separate module.

### 3. Frontend Detection Issues

**Check: Frontend is checking for the correct plugin name**
```typescript
// src/utils/native-bridge.ts
if (!win.Capacitor.Plugins.XRawCamera) {  // ✅ Must match @CapacitorPlugin name
    throw new Error('XRawCamera native plugin not available');
}
```

## Debugging Steps

### Step 1: Check if Plugin is Compiled

```bash
# In your project directory
cd android
./gradlew assembleDebug --info | grep XRawCamera
```

Look for messages about plugin discovery and registration.

### Step 2: Check APK Contents

```bash
# Extract and check the APK
unzip -l app-debug.apk | grep XRawCamera
```

The plugin class should be in the APK.

### Step 3: Check Runtime Logs

```bash
# Connect device and check logs
adb logcat | grep -i capacitor
adb logcat | grep -i XRawCamera
```

Look for:
- ✅ "Registering plugin: XRawCamera"
- ❌ "Plugin not found: XRawCamera"

### Step 4: Check Web Console

Enable web debugging in `capacitor.config.ts`:
```typescript
android: {
    webContentsDebuggingEnabled: true
}
```

Then in Chrome DevTools:
```javascript
console.log(window.Capacitor.Plugins);
// Should show: {XRawCamera: {...}, ...}
```

## Common Issues and Solutions

### Issue 1: Plugin Not Discovered

**Symptom:** `window.Capacitor.Plugins.XRawCamera` is undefined

**Solution:**
1. Verify `@CapacitorPlugin` annotation is present
2. Verify plugin class is in the correct package
3. Clean and rebuild: `./gradlew clean assembleDebug`
4. Check that Capacitor version matches (5.7.0)

### Issue 2: Plugin Name Mismatch

**Symptom:** Plugin exists but with wrong name

**Solution:**
```kotlin
// In XRawCameraPlugin.kt
@CapacitorPlugin(name = "XRawCamera")  // ✅ Must match frontend

// In native-bridge.ts
win.Capacitor.Plugins.XRawCamera  // ✅ Must match annotation
```

### Issue 3: Permissions Not Granted

**Symptom:** Plugin exists but camera doesn't work

**Solution:**
1. Check AndroidManifest.xml has camera permissions
2. Request permissions at runtime
3. Check permission dialog appears

### Issue 4: Plugin Methods Not Found

**Symptom:** Plugin exists but methods throw errors

**Solution:**
```kotlin
// All plugin methods must have @PluginMethod annotation
@PluginMethod
fun enumerateCameras(call: PluginCall) {
    // Implementation
}
```

## Verification Checklist

After rebuilding, verify:

- [ ] Build succeeds without errors
- [ ] APK is generated successfully
- [ ] App launches without crashes
- [ ] No "plugin not available" message in logs
- [ ] `window.Capacitor.Plugins.XRawCamera` exists in web console
- [ ] Camera permission dialog appears
- [ ] Camera preview shows live video
- [ ] Diagnostics shows real camera info

## Next Steps

### 1. Commit and Push the Fix

```bash
git add android/app/src/main/java/com/xraw/camera/MainActivity.kt
git commit -m "Fix: Remove invalid registerPlugins override

Capacitor 5 automatically registers plugins via @CapacitorPlugin
annotation. Manual registration is not needed and causes compile
errors.

Removed invalid registerPlugins() override that was attempting
to use non-existent BridgeActivity methods."

git push origin xraw-camera-android-app-d374a
```

### 2. Rebuild APK

Wait for GitHub Actions to build the new APK (~5-10 minutes).

### 3. Test on Device

```bash
# Uninstall old version
adb uninstall com.xraw.camera.debug

# Install new version
adb install app-debug.apk

# Check logs
adb logcat | grep -i capacitor
adb logcat | grep -i XRawCamera
```

### 4. Verify Plugin Registration

In the app, check:
- ✅ No "plugin not available" error
- ✅ Camera preview works
- ✅ Diagnostics shows camera info

## If Plugin Still Not Available

If after this fix the plugin still shows "not available", we need to investigate further:

### Check 1: Plugin Discovery

```bash
# Search for plugin in build output
cd android
./gradlew assembleDebug --info 2>&1 | grep -i "XRawCamera"
```

### Check 2: APK Contents

```bash
# Verify plugin class is in APK
unzip -l app-debug.apk | grep XRawCameraPlugin
```

### Check 3: Runtime Registration

```bash
# Check if plugin is registered at runtime
adb logcat -s Capacitor/Plugin
```

Look for messages about plugin registration.

## Summary

**What was wrong:**
- Tried to manually register plugin using non-existent methods
- `registerPlugins()` doesn't exist in Capacitor 5's `BridgeActivity`
- `bridge.addPlugin()` doesn't exist

**What was fixed:**
- Removed invalid `registerPlugins()` override
- MainActivity now correctly relies on automatic plugin discovery

**How it should work:**
- `@CapacitorPlugin` annotation marks the plugin
- Capacitor automatically discovers and registers it
- Plugin available at `window.Capacitor.Plugins.XRawCamera`

**Next:**
- Commit and push the fix
- Rebuild APK
- Test on device
- If still not working, investigate plugin discovery

---

**Status:** ✅ Fixed - Invalid override removed  
**Build Status:** ✅ Ready for APK generation  
**Expected Result:** Plugin auto-registered by Capacitor
