# XRAW Camera - Honest Status Report

**Date:** 2024  
**Status:** ⚠️ FUNDAMENTALLY NON-FUNCTIONAL

---

## Executive Summary

This app has a polished UI but **cannot perform its core function**. The native camera layer is largely a stub. It cannot record video, the preview would not display even if wired up, and the file-format code has multiple bugs.

**What Works:**
- ✅ Frontend UI renders correctly
- ✅ TypeScript compiles
- ✅ Build configuration is valid

**What Doesn't Work:**
- ❌ Camera preview (sends to ImageReader, not TextureView)
- ❌ All recording (methods are stubs that return "not implemented")
- ❌ Log profiles (shaders defined but never applied)
- ❌ XRAWLC compression (doesn't actually compress)
- ❌ MLV format (block tags are byte-reversed)
- ❌ Permissions (no result handling)

---

## Critical Issues

### 1. Recording is Not Implemented ❌

**Location:** `XRawCameraPlugin.kt`

All recording methods are stubs:
```kotlin
@PluginMethod
fun captureRawStill(call: PluginCall) {
    call.reject("RAW still capture not yet implemented in simplified plugin")
}

@PluginMethod
fun startRecording(call: PluginCall) {
    call.reject("Recording not yet implemented in simplified plugin")
}

@PluginMethod
fun startMlvRecording(call: PluginCall) {
    call.reject("MLV recording not yet implemented in simplified plugin")
}

@PluginMethod
fun startLogVideoRecording(call: PluginCall) {
    call.reject("Log video recording not yet implemented in simplified plugin")
}
```

**Impact:** The app cannot record anything. The UI shows recording controls but they do nothing.

**Fix Required:** Implement actual camera-to-writer pipeline with frame acquisition loop.

---

### 2. Preview Won't Display ❌

**Location:** `XRawCameraPlugin.kt:403-460`

**Problem:** `startPreview()` sends camera frames to a YUV ImageReader, not to the `CameraPreviewView` TextureView that MainActivity creates.

```kotlin
// WRONG: Sends to ImageReader
previewImageReader = ImageReader.newInstance(...)
val surfaces = listOf<Surface>(previewImageReader!!.surface)
```

**Additional Issues:**
- ImageReader has no `OnImageAvailableListener`
- Never acquires images
- Buffers fill up and stream stalls
- UI paints opaque black over the native view

**Fix Required:**
1. Get Surface from CameraPreviewView TextureView
2. Send camera frames to that Surface
3. Remove opaque black backgrounds from UI

---

### 3. Permissions Are Broken ❌

**Location:** `XRawCameraPlugin.kt:122-137`

**Problem:** `requestPermissions()` calls `activity.requestPermissions()` and resolves immediately without handling the result.

```kotlin
activity.requestPermissions(perms.toTypedArray(), 1001)
call.resolve()  // ❌ Resolves before user responds!
```

**Impact:**
- App auto-opens camera before permission granted
- `openCamera()` fails with SecurityException
- No retry mechanism

**Fix Required:** Implement `onRequestPermissionsResult()` to handle permission result.

---

### 4. Build Will Fail ❌

**Location:** `android/app/build.gradle:55`

**Problem:** Declares wrong Capacitor dependency:
```gradle
implementation 'com.capacitorjs:core:5.7.0'  // ❌ Wrong artifact
```

**Should be:**
```gradle
implementation project(':capacitor-android')
```

**Additional Issue:** `settings.gradle` doesn't include `:capacitor-android` module.

**Fix Required:**
1. Fix dependency in `build.gradle`
2. Add `include ':capacitor-android'` to `settings.gradle`
3. Run `npx cap sync`

---

### 5. XRAWLC "Compression" Doesn't Compress ❌

**Location:** `XRawWriter.kt:454-471` and `xraw-format.ts`

**Problem:** `packResiduals()` writes every residual as a 4-byte Int:
```kotlin
for (r in residuals) {
    output.putInt(r)  // ❌ 4 bytes per residual
}
```

**Impact:** For 16-bit input, output is ~2x larger than raw data. Not compression at all.

**Spec Says:** Residuals should be 16-bit (2 bytes each).

**Fix Required:**
1. Write residuals as 16-bit values
2. Implement actual entropy coding if compression is desired
3. Update spec to match implementation

---

### 6. Predictor is Not Median-Edge ❌

**Location:** `XRawWriter.kt:440-452`

**Problem:** Both branches return the same value:
```kotlin
private fun medianPredict(a: Int, b: Int, c: Int): Int {
    return if (a > b) {
        c + (a - b)  // ❌ Same as else branch
    } else {
        c - (b - a)  // ❌ Same as if branch (mathematically)
    }
}
```

**Should be (JPEG-LOCO):**
```kotlin
private fun medianPredict(a: Int, b: Int, c: Int): Int {
    return if (a > b) {
        c + (a - b)
    } else if (a < b) {
        c - (b - a)
    } else {
        c  // a == b
    }
}
```

**Impact:** Predictor doesn't work as intended. Tests pass because they only check exact reconstruction, not compression ratio.

---

### 7. XRAW Index Only Keeps Last Interval ❌

**Location:** `XRawWriter.kt:220-249`

**Problem:** `writeIndex()` clears `indexEntries` after each checkpoint:
```kotlin
// Clear entries after writing checkpoint (keep list bounded)
indexEntries.clear()
```

**Impact:** Final file only indexes the last interval. Recovery can't find earlier frames.

**Fix Required:** Keep all index entries or write multiple index blocks.

---

### 8. MLV Block Tags Are Byte-Reversed ❌

**Location:** `MlvWriter.kt`

**Problem:** Block types written with `putInt` in little-endian:
```kotlin
buffer.putInt(BLOCK_MLVI)  // ❌ Writes as IVLM on disk
```

**MLV Spec:** Tags should be ASCII strings (e.g., "MLVI" not "IVLM").

**Fix Required:** Write tags as byte arrays in correct order.

---

### 9. Log Profiles Are Falsely Advertised ❌

**Location:** `log-profiles.ts` and `LogVideoEncoder.kt`

**Problem:**
- All profiles marked `implemented: true`
- Shaders defined but never used
- Formulas don't match published specs
- Several shaders call `log()` on negative inputs → NaN

**Impact:** UI claims log profiles work but output is standard Rec.709.

**Fix Required:**
1. Mark all profiles as `implemented: false`
2. Remove from UI until actually implemented
3. Verify formulas against official specs

---

### 10. White Balance Breaks Camera Updates ❌

**Location:** `XRawCameraPlugin.kt:656-670`

**Problem:** `kelvinToTransform()` passes 9 ints to `ColorSpaceTransform`:
```kotlin
ColorSpaceTransform(
    intArrayOf(
        (r * 10000).toInt(), 0, 0,  // ❌ Only 9 values
        0, 10000, 0,
        0, 0, (b * 10000).toInt()
    )
)
```

**Should be:** 18 integers (9 rational pairs: numerator/denominator).

**Impact:** Constructor throws exception, `applyCurrentSettings()` catches it and drops the update. Repeating request never refreshed.

**Fix Required:** Pass 18 integers in correct format.

---

### 11. Settings That Do Nothing ❌

**Multiple locations:**

- `frameRate` never applied (AE FPS range hardcoded to 15-30)
- `resolution` only affects recording (which doesn't exist)
- Preview LUT toggle has no effect
- `setPreviewFrameRate()` reports success without changing anything

**Impact:** User changes settings but nothing happens.

**Fix Required:** Either implement the settings or remove them from UI.

---

### 12. Stale Closure in closeCamera ❌

**Location:** `useCamera.ts`

**Problem:** `closeCamera` dependency list omits `stopRecording`:
```typescript
const closeCamera = useCallback(async () => {
  if (recording.isRecording) {
    await stopRecording();  // ❌ May be stale
  }
  // ...
}, [recording.isRecording, nativeAvailable, addError]);  // ❌ Missing stopRecording
```

**Impact:** May call old version of `stopRecording` with outdated mode.

**Fix Required:** Add `stopRecording` to dependency array.

---

### 13. Listener Cleanup Throws ❌

**Location:** `native-bridge.ts:36-44`

**Problem:** `addNativeListener` returns Capacitor's `addListener(...)` which is a Promise, not `() => void`:
```typescript
function addNativeListener(event: string, callback: (data: any) => void): () => void {
  // ...
  return win.Capacitor.Plugins.XRawCamera.addListener(event, callback);  // ❌ Returns Promise
}
```

**Impact:** Cleanup `fn()` in `useCamera` throws TypeError on unmount.

**Fix Required:** Await the promise and return a proper cleanup function.

---

### 14. Diagnostics Shows Hardcoded Claims ❌

**Location:** `DiagnosticsScreen.tsx`

**False Claims:**
- "XRAW Codec: Lossless verified" ❌ (doesn't compress)
- "MLV Writer: Format implemented" ❌ (tags reversed)
- "1080p @ 24fps supported" ❌ (recording not implemented)
- White balance range "2000K – 8000K" ❌ (hardcoded, not from sensor)

**Impact:** Misleads users about actual capabilities.

**Fix Required:** Remove false "verified" claims, show actual status.

---

### 15. Settings Shows Hardcoded Status ❌

**Location:** `SettingsScreen.tsx`

**Hardcoded Values:**
- "Recovery Interval 48 frames" (not read from device)
- "Frame Queue 4 frames" (not read from device)
- "Thermal Monitoring Active" (not verified)
- "Auto-finalize Enabled" (not verified)
- "Output Directory /XRAW/" (actually uses `getExternalFilesDir`)

**Impact:** Shows fake configuration that doesn't match reality.

**Fix Required:** Read actual values from native code or remove display.

---

### 16. Layout Collision ❌

**Location:** `CameraScreen.tsx`

**Problem:** Top-right toggle button (`top-3 right-3`) sits in same corner as Settings gear in top bar.

**Impact:** Buttons overlap, one may be unclickable.

**Fix Required:** Reposition one of the buttons.

---

### 17. Error Handling Issues ❌

**Location:** Multiple

**Problems:**
- Informational messages (e.g., `CAPTURE_OK`) stored in error list
- Errors never auto-dismiss
- Toast only shows last three errors

**Impact:** Confusing UX, error list grows indefinitely.

**Fix Required:** Separate info/warning/error, auto-dismiss info messages.

---

### 18. Manifest Issues ❌

**Location:** `AndroidManifest.xml`

**Problems:**
- Requests `RECORD_AUDIO` but never uses it
- Missing `POST_NOTIFICATIONS` for Android 13+

**Impact:** Unnecessary permissions, notification won't show on Android 13+.

**Fix Required:** Remove unused permissions, add `POST_NOTIFICATIONS`.

---

### 19. Accessibility Issue ❌

**Location:** `index.html`

**Problem:** Disables pinch zoom:
```html
<meta name="viewport" content="... user-scalable=no" />
```

**Impact:** Accessibility violation, users can't zoom if needed.

**Fix Required:** Remove `user-scalable=no`.

---

### 20. Tests Miss Real Bugs ❌

**Location:** `XRawFormatTest.kt`

**Problems:**
- Round-trip tests pass despite broken predictor
- `testWriterCannotWriteAfterFinalize` passes for wrong reason (checks "not initialized" not "finalized")
- No tests for MLV, plugin, bridge, or TypeScript

**Impact:** False confidence in code quality.

**Fix Required:** Add tests that check compression ratio, predictor output, MLV format, etc.

---

## Documentation Contradictions

Multiple status files claim "ALL TESTS PASSING" while `HONEST_ENGINEERING_STATUS.md` admits log video is non-functional.

**Fix Required:** Consolidate into single honest status document.

---

## Repo Hygiene Issues

- 40+ overlapping `*_FIX` and `*_REPORT` markdown files
- `dist/` committed despite `.gitignore` excluding it
- `@capacitor/cli` in runtime dependencies (should be dev)
- `.gitignore` missing Android build outputs and `local.properties`

**Fix Required:** Clean up documentation, fix `.gitignore`, move dependencies.

---

## Recommended Fix Order

### Phase 1: Make It Build
1. ✅ Fix Capacitor dependencies in `build.gradle`
2. ✅ Add `:capacitor-android` to `settings.gradle`
3. ⏳ Run `npm install` and `npx cap sync`

### Phase 2: Fix Permissions
1. ⏳ Implement `onRequestPermissionsResult()`
2. ⏳ Don't auto-open camera before permission granted
3. ⏳ Add retry mechanism
4. ⏳ Add `POST_NOTIFICATIONS` to manifest

### Phase 3: Fix Preview
1. ⏳ Send camera to TextureView surface
2. ⏳ Remove black backgrounds from web layer
3. ⏳ Make WebView transparent
4. ⏳ Fix surface lifecycle (no double-release)

### Phase 4: Implement Recording
1. ⏳ Implement `captureRawStill()` with actual ImageReader
2. ⏳ Implement `startRecording()` with frame pipeline
3. ⏳ Connect camera frames to writers
4. ⏳ Implement proper frame queue with backpressure

### Phase 5: Fix File Formats
1. ⏳ Fix XRAWLC to actually compress (16-bit residuals)
2. ⏳ Fix predictor (real median-edge)
3. ⏳ Fix XRAW index (keep all entries)
4. ⏳ Fix MLV tags (write as ASCII)
5. ⏳ Verify against spec

### Phase 6: Remove False Claims
1. ⏳ Mark log profiles as not implemented
2. ⏳ Remove "verified" claims from diagnostics
3. ⏳ Remove hardcoded status from settings
4. ⏳ Update documentation

### Phase 7: Fix App Logic
1. ⏳ Fix white balance ColorSpaceTransform (18 ints)
2. ⏳ Fix stale closures
3. ⏳ Fix listener cleanup
4. ⏳ Implement settings that actually work
5. ⏳ Fix layout collision
6. ⏳ Improve error handling

### Phase 8: Add Tests
1. ⏳ Test compression ratio
2. ⏳ Test predictor output
3. ⏳ Test MLV format
4. ⏳ Test plugin methods
5. ⏳ Test bridge contract

---

## Current Status

**Build:** ⚠️ Configuration fixed but not tested  
**Preview:** ❌ Won't display  
**Recording:** ❌ Not implemented  
**File Formats:** ❌ Multiple bugs  
**Log Profiles:** ❌ Not implemented  
**Permissions:** ❌ Broken  
**Tests:** ⚠️ Pass but miss real bugs  
**Documentation:** ❌ Contradictory and misleading  

**Overall:** The app cannot perform its core function. It needs significant implementation work before it's usable.

---

## Next Steps for Developer

1. **Build the app** to verify configuration fixes work
2. **Fix permissions** so camera can open
3. **Fix preview** so user can see camera
4. **Implement recording** (this is the core feature)
5. **Fix file formats** so recordings are valid
6. **Remove false claims** from UI
7. **Add real tests** to prevent regressions

**Estimated effort:** 40-80 hours of focused development work.

---

**Report Generated:** 2024  
**Honesty Level:** Maximum - no false claims  
**Functionality Level:** Minimal - core features not working  
**Recommendation:** Do not release until recording is implemented
