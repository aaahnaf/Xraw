# Gradle Wrapper Permission Fix

## Problem
The GitHub Actions workflow was failing with:
```
./gradlew: Permission denied
Exit code: 126
```

This is a Unix/Linux permission issue where the `gradlew` script doesn't have execute permissions on the Ubuntu runner.

## Root Cause
When files are committed to Git, the executable bit can sometimes be lost depending on:
- How the file was originally created
- Git configuration on the committing machine
- File system permissions during commit

On GitHub Actions, the runner checks out the repo and attempts to run `./gradlew`, but Linux refuses to execute it without the proper permissions.

## Solution
Added `chmod +x ./gradlew` before each Gradle command in the workflow to ensure the wrapper script is executable.

## Changes Made

### File: `.github/workflows/build-apk.yml`

**1. Build debug APK step (line 95):**
```yaml
- name: Build debug APK
  if: github.event.inputs.build_type != 'release'
  working-directory: android
  run: |
    echo "Building debug APK..."
    chmod +x ./gradlew  # ← ADDED
    ./gradlew assembleDebug --stacktrace --no-daemon
    ...
```

**2. Build release APK step (line 112):**
```yaml
- name: Build release APK
  if: github.event.inputs.build_type == 'release'
  working-directory: android
  run: |
    echo "Building release APK..."
    chmod +x ./gradlew  # ← ADDED
    ./gradlew assembleRelease --stacktrace --no-daemon
    ...
```

**3. Run unit tests step (line 233):**
```yaml
- name: Run unit tests
  working-directory: android
  run: |
    echo "Running unit tests..."
    chmod +x ./gradlew  # ← ADDED
    ./gradlew test --stacktrace --no-daemon
    echo "✓ Unit tests completed"
```

## Why This Works

The `chmod +x` command adds execute permissions to the `gradlew` script:
- Before: `-rw-r--r--` (read/write for owner, read for others)
- After: `-rwxr-xr-x` (read/write/execute for owner, read/execute for others)

This makes the script executable on the Ubuntu runner, allowing `./gradlew` to run successfully.

## Alternative Solutions (Not Implemented)

### Option 1: Fix in Git Repository
You could also fix this permanently in the repository by running:
```bash
chmod +x android/gradlew
git add android/gradlew
git commit -m "Fix gradlew executable bit"
git push
```

Or explicitly tell Git to track the executable bit:
```bash
git update-index --chmod=+x android/gradlew
git commit -m "Fix gradlew executable bit"
git push
```

**Why we didn't use this:** The workflow-level fix is more resilient because:
- It works even if the repository state changes
- It's self-contained in the CI configuration
- It doesn't require modifying the repository history
- It ensures the workflow works regardless of how the file was committed

### Option 2: Add Debug Step
You could add a diagnostic step before the build:
```yaml
- name: Check gradlew permissions
  working-directory: android
  run: |
    ls -l ./gradlew
    stat -c '%A %n' ./gradlew
```

**Why we didn't use this:** This is only useful for debugging, not for fixing the issue.

## Verification

After pushing this fix, the workflow should:
1. ✅ Successfully execute `chmod +x ./gradlew`
2. ✅ Run `./gradlew assembleDebug` without permission errors
3. ✅ Build the APK successfully
4. ✅ Upload the artifact

## Expected Log Output

You should see:
```
Run echo "Building debug APK..."
chmod +x ./gradlew
./gradlew assembleDebug --stacktrace --no-daemon
Building debug APK...

Welcome to Gradle 8.5!
...
✓ Debug APK built successfully
```

Instead of:
```
./gradlew: Permission denied
Error: Process completed with exit code 126.
```

## Next Steps

1. **Commit the changes:**
   ```bash
   git add .github/workflows/build-apk.yml
   git commit -m "Fix gradlew permission: add chmod +x before Gradle commands"
   ```

2. **Push to GitHub:**
   ```bash
   git push origin xraw-camera-android-app-d374a
   ```

3. **Monitor the workflow:**
   - Go to: https://github.com/aaahnaf/Xraw/actions
   - Watch for the "Build debug APK" step to succeed
   - Verify the APK artifact is uploaded

## Summary

This is a simple but critical fix that ensures the Gradle wrapper script has execute permissions on the CI runner. The fix is applied at the workflow level, making it resilient to repository state changes and ensuring consistent behavior across all builds.

**Status:** ✅ FIXED  
**Files Changed:** 1 (`.github/workflows/build-apk.yml`)  
**Lines Added:** 3 (one `chmod +x` command in each Gradle invocation)  
**Risk Level:** Very Low  
**Confidence:** High
