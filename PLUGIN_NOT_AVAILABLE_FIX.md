# Native Plugin Not Available - Troubleshooting Guide

## Problem
After installing the APK on Xiaomi Redmi Note 12 Pro 5G, the app shows:
- "XRAW Camera native plugin not available"
- No camera identity
- Camera ID 0, hardware level unknown
- Capabilities: RAW supported no, manual controls no
- No video, only black screen

## Root Cause
The Capacitor plugin `XRawCameraPlugin` is not being properly registered with the Capacitor bridge, so the web frontend cannot access native camera functionality.

## Solution Applied

### 1. Fixed MainActivity Plugin Registration
**File:** `android/app/src/main/java/com/xraw/camera/MainActivity.kt`

**Changes:**
```kotlin
override fun registerPlugins() {
    // Explicitly register the XRawCamera plugin
    // This ensures the plugin is available to the web frontend
    bridge?.addPlugin(XRawCameraPlugin::class.java)
}
```

**Why This Works:**
- Capacitor 5 requires explicit plugin registration
- The `registerPlugins()` method is called during app initialization
- `bridge?.addPlugin()` makes the plugin available to `window.Capacitor.Plugins.XRawCamera`
- The web frontend can now detect and use the plugin

## How to Test the Fix

### Step 1: Rebuild the APK
```bash
# Commit the fix
git add android/app/src/main/java/com/xraw/camera/MainActivity.kt
git commit -m "Fix: Register XRawCamera plugin with Capacitor bridge

Override registerPlugins() to explicitly add XRawCameraPlugin
to the Capacitor bridge. This makes the plugin available to
window.Capacitor.Plugins.XRawCamera in the web frontend."

# Push to GitHub
git push origin xraw-camera-android-app-d374a
```

### Step 2: Download New APK
1. Go to: https://github.com/aaahnaf/Xraw/actions
2. Wait for "Build XRAW Camera APK" workflow to complete
3. Download the APK artifact: "XRAW-Camera-Debug-APK"

### Step 3: Install and Test
```bash
# Uninstall old version
adb uninstall com.xraw.camera.debug

# Install new version
adb install XRAW-Camera-Debug-APK/app-debug.apk
```

### Step 4: Verify Plugin Registration
Launch the app and check:
1. ✅ No "native plugin not available" message
2. ✅ Camera identity shows real device info
3. ✅ Camera ID shows actual camera (not "0")
4. ✅ Hardware level shows "level_3" or "full"
5. ✅ Capabilities show "RAW_SENSOR", "MANUAL_SENSOR"
6. ✅ Camera preview shows live video (not black screen)

## Debugging Steps

If the issue persists, use ADB logcat to debug:

```bash
# Connect device and start logcat
adb logcat -s XRawCamera Capacitor/Plugin

# Look for these messages:
# ✓ "Camera opened: 0" - Plugin is working
# ✗ "XRawCamera native plugin not available" - Plugin not registered
```

### Check Plugin Registration
```bash
# In Chrome DevTools (if debugging web content)
console.log(window.Capacitor.Plugins)
# Should show: {XRawCamera: {...}, ...}
```

### Check Camera Permissions
```bash
# Verify permissions are granted
adb shell pm list permissions | grep camera
adb shell dumpsys package com.xraw.camera.debug | grep permission
```

## Expected Behavior After Fix

### Diagnostics Screen Should Show:
```
CAMERA IDENTITY
Camera ID: 0 (or 1 for front camera)
Facing: back
Hardware Level: level_3 (or full)

CAPABILITIES
✓ RAW_SENSOR
✓ MANUAL_SENSOR
✓ MANUAL_POST_PROCESSING

RAW Supported: YES
Manual Controls: YES

SENSOR INFORMATION
Resolution: 4000 × 3000 (or device-specific)
Physical Size: 6.43 × 4.82 mm
Pixel Array: 4000 × 3000
CFA Pattern: RGGB
```

### Camera Screen Should Show:
- ✅ Live camera preview (not black)
- ✅ Real-time FPS display
- ✅ Working manual controls (ISO, shutter, WB, focus)
- ✅ Recording functionality

## Common Issues and Solutions

### Issue 1: Still Shows "Plugin Not Available"
**Cause:** Old APK version or cache  
**Solution:**
```bash
# Clear app data
adb shell pm clear com.xraw.camera.debug

# Reinstall
adb uninstall com.xraw.camera.debug
adb install app-debug.apk
```

### Issue 2: Black Screen (No Preview)
**Cause:** Camera permission not granted or preview not started  
**Solution:**
1. Grant camera permission when prompted
2. Check logcat for camera errors:
   ```bash
   adb logcat | grep -i camera
   ```
3. Verify CameraPreviewView is being created

### Issue 3: Camera ID Shows "0" But No Camera
**Cause:** Camera enumeration failed  
**Solution:**
1. Check if device has camera:
   ```bash
   adb shell pm list features | grep camera
   ```
2. Check logcat for Camera2 errors:
   ```bash
   adb logcat | grep CameraManager
   ```

### Issue 4: Capabilities Show "No"
**Cause:** Plugin not fully initialized  
**Solution:**
1. Wait for app to fully load
2. Restart the app
3. Check logcat for plugin initialization:
   ```bash
   adb logcat | grep XRawCamera
   ```

## Verification Checklist

After installing the new APK, verify:

- [ ] App launches without errors
- [ ] No "native plugin not available" message
- [ ] Camera permission dialog appears
- [ ] Camera preview shows live video
- [ ] Diagnostics shows real camera info
- [ ] Manual controls work (ISO, shutter, WB, focus)
- [ ] Recording button works
- [ ] Files are created in /XRAW/ directory

## Technical Details

### How Capacitor Plugin Registration Works

1. **App Launch:**
   - `MainActivity.onCreate()` is called
   - `BridgeActivity` initializes Capacitor bridge
   - `registerPlugins()` is called

2. **Plugin Registration:**
   - `bridge?.addPlugin(XRawCameraPlugin::class.java)` registers the plugin
   - Plugin instance is created
   - Plugin methods are exposed to JavaScript

3. **Web Frontend Access:**
   - `window.Capacitor.Plugins.XRawCamera` becomes available
   - Frontend calls plugin methods: `XRawCamera.enumerateCameras()`
   - Plugin executes native Camera2 API calls
   - Results are returned to frontend

### Plugin Annotation

```kotlin
@CapacitorPlugin(
    name = "XRawCamera",
    permissions = [
        Permission(strings = [Manifest.permission.CAMERA], alias = "camera"),
        Permission(strings = [Manifest.permission.RECORD_AUDIO], alias = "microphone")
    ]
)
class XRawCameraPlugin : Plugin() {
    // Plugin methods annotated with @PluginMethod
    @PluginMethod
    fun enumerateCameras(call: PluginCall) { ... }
}
```

### Frontend Detection

```typescript
function isNativeAvailable(): boolean {
  const win = window as any;
  return !!(win.Capacitor && 
            win.Capacitor.isNativePlatform && 
            win.Capacitor.isNativePlatform());
}

async function callNative(method: string, args: any) {
  const win = window as any;
  if (!win.Capacitor.Plugins.XRawCamera) {
    throw new Error('XRawCamera native plugin not available');
  }
  return win.Capacitor.Plugins.XRawCamera[method](args);
}
```

## Next Steps

1. ✅ Commit the MainActivity fix
2. ✅ Push to GitHub
3. ⏳ Wait for GitHub Actions to build new APK
4. ⏳ Download and install new APK
5. ⏳ Test camera functionality
6. ⏳ Report results

## Support

If issues persist after applying the fix:

1. **Check ADB logcat:**
   ```bash
   adb logcat -s XRawCamera Capacitor
   ```

2. **Verify plugin registration:**
   - Open Chrome DevTools
   - Connect to device
   - Run: `console.log(window.Capacitor.Plugins)`
   - Should show: `{XRawCamera: {...}}`

3. **Check camera permissions:**
   ```bash
   adb shell dumpsys package com.xraw.camera.debug | grep permission
   ```

4. **Review GitHub Actions logs:**
   - Check build succeeded
   - Verify APK was generated
   - Confirm web assets were copied

---

**Status:** ✅ Fix applied, ready for testing  
**Next Action:** Rebuild APK and test on device  
**Expected Result:** Plugin registered, camera working
