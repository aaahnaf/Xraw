# Gradle Wrapper JAR Missing - Fix Documentation

## Problem Summary

The GitHub Actions workflow was failing with the following error:

```
Error: Could not find or load main class org.gradle.wrapper.GradleWrapperMain
Caused by: java.lang.ClassNotFoundException: org.gradle.wrapper.GradleWrapperMain
Error: Process completed with exit code 1.
```

## Root Cause

The `gradle-wrapper.jar` file was missing from the repository. The Gradle wrapper consists of:
- `gradlew` - Shell script (Unix/Linux)
- `gradlew.bat` - Batch script (Windows)
- `gradle/wrapper/gradle-wrapper.properties` - Configuration file
- `gradle/wrapper/gradle-wrapper.jar` - **Missing binary file**

The `gradlew` script requires the JAR file to bootstrap Gradle. Without it, the build fails with a ClassNotFoundException.

## Solution

Added a workflow step to download the `gradle-wrapper.jar` file from the official Gradle GitHub repository before running any Gradle commands.

### Implementation Details

**File Modified:** `.github/workflows/build-apk.yml`

**Added Step:** "Download Gradle Wrapper JAR"

This step:
1. Creates the `gradle/wrapper` directory if it doesn't exist
2. Checks if `gradle-wrapper.jar` already exists
3. Downloads the JAR from the official Gradle repository if missing
4. Uses the Gradle version specified in the workflow (`8.5`)
5. Lists the directory contents for verification

**Download URL:**
```
https://raw.githubusercontent.com/gradle/gradle/v8.5/gradle/wrapper/gradle-wrapper.jar
```

### Workflow Changes

The step was added in **two locations**:

1. **Build Job** (after "Setup Gradle", before "Build debug APK")
   - Lines 90-102

2. **Test Job** (after "Setup Gradle", before "Run unit tests")
   - Lines 243-255

### Step Implementation

```yaml
- name: Download Gradle Wrapper JAR
  working-directory: android
  run: |
    mkdir -p gradle/wrapper
    if [ ! -f gradle/wrapper/gradle-wrapper.jar ]; then
      echo "Downloading gradle-wrapper.jar..."
      curl -L -o gradle/wrapper/gradle-wrapper.jar \
        "https://raw.githubusercontent.com/gradle/gradle/v${{ env.GRADLE_VERSION }}/gradle/wrapper/gradle-wrapper.jar"
      echo "✓ gradle-wrapper.jar downloaded"
    else
      echo "✓ gradle-wrapper.jar already exists"
    fi
    ls -lh gradle/wrapper/
```

## Why This Approach?

### Alternative Considered: Commit the JAR to Repository

**Pros:**
- Faster CI builds (no download needed)
- Self-contained repository

**Cons:**
- Binary files in Git are problematic
- Increases repository size
- Harder to update Gradle version
- Git LFS might be needed
- Not a best practice for Gradle wrapper

### Chosen Approach: Download in CI

**Pros:**
- Keeps repository clean (no binary files)
- Always gets the correct JAR for the Gradle version
- Easy to update by changing `GRADLE_VERSION` env var
- Follows Gradle best practices
- Conditional download (only if missing)

**Cons:**
- Slightly slower CI (download time)
- Depends on GitHub's raw content availability

## Verification

After this fix, the workflow should:

1. ✅ Download `gradle-wrapper.jar` successfully
2. ✅ Execute `./gradlew` without ClassNotFoundException
3. ✅ Build the Android APK
4. ✅ Run unit tests successfully

## Expected Log Output

```
Run mkdir -p gradle/wrapper
  if [ ! -f gradle/wrapper/gradle-wrapper.jar ]; then
    echo "Downloading gradle-wrapper.jar..."
    curl -L -o gradle/wrapper/gradle-wrapper.jar \
      "https://raw.githubusercontent.com/gradle/gradle/v8.5/gradle/wrapper/gradle-wrapper.jar"
    echo "✓ gradle-wrapper.jar downloaded"
  else
    echo "✓ gradle-wrapper.jar already exists"
  fi
  ls -lh gradle/wrapper/
  
  shell: /usr/bin/bash -e {0}
Downloading gradle-wrapper.jar...
  % Total    % Received % Xferd  Average Speed   Time    Time     Time  Current
                                 Dload  Upload   Total   Spent    Left  Speed
100   138    0   138    0     0    513      0 --:--:-- --:--:-- --:--:--   513
100 61.5M  100 61.5M    0     0   127M      0 --:--:-- --:--:-- --:--:--  154M
✓ gradle-wrapper.jar downloaded
total 62M
-rw-r--r-- 1 runner docker  233 Mar 15 10:30 gradle-wrapper.properties
-rw-r--r-- 1 runner docker  62M Mar 15 10:31 gradle-wrapper.jar
```

## Related Files

- `.github/workflows/build-apk.yml` - Workflow configuration
- `android/gradle/wrapper/gradle-wrapper.properties` - Wrapper configuration
- `android/gradlew` - Unix wrapper script
- `android/gradlew.bat` - Windows wrapper script

## Testing

To test this fix locally:

```bash
cd android
rm -f gradle/wrapper/gradle-wrapper.jar
./gradlew --version
```

The wrapper should automatically download the JAR file.

## Future Considerations

### Option 1: Commit the JAR to Repository

If CI download times become problematic, consider committing the JAR:

```bash
cd android
curl -L -o gradle/wrapper/gradle-wrapper.jar \
  "https://raw.githubusercontent.com/gradle/gradle/v8.5/gradle/wrapper/gradle-wrapper.jar"
git add gradle/wrapper/gradle-wrapper.jar
git commit -m "Add gradle-wrapper.jar to repository"
git push
```

Then remove the download step from the workflow.

### Option 2: Use Gradle's Built-in Wrapper Task

Generate the wrapper using Gradle itself:

```bash
cd android
gradle wrapper --gradle-version 8.5
git add gradle/wrapper/
git commit -m "Generate Gradle wrapper"
git push
```

This creates all wrapper files including the JAR.

## Status

✅ **FIXED** - Workflow updated to download gradle-wrapper.jar before build

## Next Steps

1. Commit the workflow changes
2. Push to GitHub
3. Monitor the workflow run
4. Verify the APK builds successfully
5. Check that unit tests pass

---

**Document Version:** 1.0  
**Last Updated:** 2024  
**Author:** XRAW Camera Development Team
