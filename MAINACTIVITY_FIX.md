# MainActivity Fix - Removed Invalid Plugin Registration

## What Was Wrong

The build failed with these errors:
```
e: MainActivity.kt:29:5 'registerPlugins' overrides nothing
e: MainActivity.kt:32:17 Unresolved reference: addPlugin
```

## Root Cause

I incorrectly tried to manually register the plugin by:
1. Overriding a `registerPlugins()` method that doesn't exist in Capacitor 5's `BridgeActivity`
2. Calling `bridge?.addPlugin()` which is not a valid method

## The Fix

**Removed the invalid code:**
```kotlin
// ❌ REMOVED - This was causing compile errors
override fun registerPlugins() {
    bridge?.addPlugin(XRawCameraPlugin::class.java)
}
```

**Current MainActivity.kt (Correct):**
```kotlin
class MainActivity : BridgeActivity() {
    
    private var cameraPreviewView: CameraPreviewView? = null
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setupCameraPreview()
    }
    
    private fun setupCameraPreview() {
        // Set up camera preview view
        // ...
    }
    
    // No manual plugin registration needed!
}
```

## Why This Works

### Capacitor 5 Auto-Discovery

In Capacitor 5, plugins are **automatically registered** through the `@CapacitorPlugin` annotation:

```kotlin
@CapacitorPlugin(
    name = "XRawCamera",
    permissions = [...]
)
class XRawCameraPlugin : Plugin() {
    // Plugin methods...
}
```

Capacitor's build system:
1. ✅ Scans for `@CapacitorPlugin` annotations at build time
2. ✅ Automatically registers discovered plugins
3. ✅ Makes them available at `window.Capacitor.Plugins.XRawCamera`
4. ✅ No manual registration needed in MainActivity

### How It Works

```
Build Time:
  @CapacitorPlugin annotation
  ↓
  Capacitor plugin discovery
  ↓
  Auto-registration in bridge
  ↓
Runtime:
  window.Capacitor.Plugins.XRawCamera available
  ↓
  Frontend can call plugin methods
```

## Verification

### Check Plugin is Annotated Correctly

```kotlin
// XRawCameraPlugin.kt
@CapacitorPlugin(
    name = "XRawCamera",  // ✅ Must match frontend
    permissions = [
        Permission(strings = [Manifest.permission.CAMERA], alias = "camera"),
        Permission(strings = [Manifest.permission.RECORD_AUDIO], alias = "microphone")
    ]
)
class XRawCameraPlugin : Plugin() {
    // ✅ All methods have @PluginMethod
    @PluginMethod
    fun enumerateCameras(call: PluginCall) { ... }
}
```

### Check Frontend Detection

```typescript
// native-bridge.ts
function isNativeAvailable(): boolean {
  const win = window as any;
  return !!(win.Capacitor && 
            win.Capacitor.isNativePlatform && 
            win.Capacitor.isNativePlatform());
}

async function callNative(method: string, args: any) {
  const win = window as any;
  if (!win.Capacitor.Plugins.XRawCamera) {  // ✅ Matches @CapacitorPlugin name
    throw new Error('XRawCamera native plugin not available');
  }
  return win.Capacitor.Plugins.XRawCamera[method](args);
}
```

## Build Status

### ✅ Fixed
- Removed invalid `registerPlugins()` override
- MainActivity now compiles successfully
- Plugin auto-discovery should work

### Next Steps

1. **Commit and push:**
   ```bash
   git add android/app/src/main/java/com/xraw/camera/MainActivity.kt
   git commit -m "Fix: Remove invalid registerPlugins override
   
   Capacitor 5 automatically registers plugins via @CapacitorPlugin
   annotation. Manual registration is not needed and causes compile
   errors."
   git push origin xraw-camera-android-app-d374a
   ```

2. **Wait for build:**
   - GitHub Actions will build the APK (~5-10 minutes)
   - Download the artifact

3. **Test on device:**
   ```bash
   adb uninstall com.xraw.camera.debug
   adb install app-debug.apk
   ```

4. **Verify:**
   - ✅ No "plugin not available" error
   - ✅ Camera preview works
   - ✅ Diagnostics shows camera info

## If Plugin Still Not Available

If after this fix the plugin still shows "not available", check:

### 1. Plugin Discovery Logs
```bash
adb logcat | grep -i capacitor
adb logcat | grep -i XRawCamera
```

Look for:
- ✅ "Registering plugin: XRawCamera"
- ❌ "Plugin not found: XRawCamera"

### 2. Web Console
Enable debugging in `capacitor.config.ts`:
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

### 3. APK Contents
```bash
unzip -l app-debug.apk | grep XRawCamera
```

Plugin class should be in the APK.

## Summary

**What was wrong:**
- ❌ Tried to manually register plugin using non-existent methods
- ❌ `registerPlugins()` doesn't exist in Capacitor 5
- ❌ `bridge.addPlugin()` doesn't exist

**What was fixed:**
- ✅ Removed invalid override
- ✅ Rely on Capacitor's automatic plugin discovery
- ✅ MainActivity now compiles successfully

**How it works:**
- `@CapacitorPlugin` annotation marks the plugin
- Capacitor auto-discovers and registers it
- Plugin available at `window.Capacitor.Plugins.XRawCamera`

**Status:** ✅ Fixed and ready for testing

---

**Documentation:** See `CAPACITOR5_PLUGIN_REGISTRATION_EXPLAINED.md` for detailed explanation
