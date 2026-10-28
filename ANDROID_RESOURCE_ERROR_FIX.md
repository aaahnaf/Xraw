# Android 资源链接错误修复

## 问题描述

GitHub Actions 构建在 Android 资源编译阶段失败：

```
error: style attribute 'android:attr/windowKeepScreenOn' not found.
error: failed linking references.
```

错误位置：`values/values.xml:1731`

## 根本原因

在 `android/app/src/main/res/values/themes.xml` 中使用了不存在的主题属性：

```xml
<item name="android:windowKeepScreenOn">false</item>
```

**问题：** `android:windowKeepScreenOn` 不是一个有效的 Android 主题属性。

### 正确的 keepScreenOn 使用方式

`keepScreenOn` 功能应该通过以下方式实现：

1. **在布局 XML 中的 View 上设置：**
   ```xml
   <View
       android:layout_width="match_parent"
       android:layout_height="match_parent"
       android:keepScreenOn="true" />
   ```

2. **在代码中设置 FLAG：**
   ```kotlin
   window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
   ```

3. **在 Activity 中使用：**
   ```kotlin
   override fun onCreate(savedInstanceState: Bundle?) {
       super.onCreate(savedInstanceState)
       window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
   }
   ```

**注意：** 这不是一个主题级别的属性，不能在 `<style>` 中使用。

## 修复方案

从 `themes.xml` 中移除无效的属性行。

### 修改前

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.XRAWCamera" parent="Theme.AppCompat.NoActionBar">
        <item name="android:windowBackground">@android:color/black</item>
        <item name="android:statusBarColor">@android:color/black</item>
        <item name="android:navigationBarColor">@android:color/black</item>
        <item name="android:windowFullscreen">true</item>
        <item name="android:windowKeepScreenOn">false</item>  <!-- ❌ 无效属性 -->
    </style>
</resources>
```

### 修改后

```xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.XRAWCamera" parent="Theme.AppCompat.NoActionBar">
        <item name="android:windowBackground">@android:color/black</item>
        <item name="android:statusBarColor">@android:color/black</item>
        <item name="android:navigationBarColor">@android:color/black</item>
        <item name="android:windowFullscreen">true</item>
        <!-- ✅ 已移除无效的 windowKeepScreenOn 属性 -->
    </style>
</resources>
```

## 修改的文件

- `android/app/src/main/res/values/themes.xml` - 移除第 8 行的无效属性

## CI 配置状态

### ✅ 已解决的问题

1. **Gradle Wrapper JAR 缺失** - 改用直接 `gradle` 命令
2. **gradlew 权限问题** - 不再使用 gradlew
3. **cmdline-tools 404 错误** - 使用固定版本 `11076708`
4. **分支触发器不匹配** - 已添加正确的分支
5. **环境变量缺失** - 已显式设置 ANDROID_HOME 等
6. **Android 资源链接错误** - 已移除无效的主题属性 ✅

### 📊 构建进度

```
✅ Checkout repository
✅ Set up JDK 17
✅ Setup Android SDK (cmdline-tools 11076708)
✅ Install SDK packages
✅ Verify SDK
✅ Set up Node.js 20
✅ Install frontend dependencies
✅ Run TypeScript type check
✅ Build frontend (Vite)
✅ Copy frontend to Android assets
✅ Setup Gradle 8.5
✅ Build debug APK (开始编译)
   ✅ Task :app:preBuild
   ✅ Task :app:preDebugBuild
   ✅ Task :app:generateDebugResValues
   ✅ Task :app:mergeDebugResources
   ❌ Task :app:processDebugResources FAILED (资源链接错误)
```

**好消息：** 构建已经成功进入到 Android 编译阶段！所有 CI 配置问题都已解决。

## 下一步操作

### 1. 提交修复

```bash
git add android/app/src/main/res/values/themes.xml
git commit -m "Fix: Remove invalid android:windowKeepScreenOn theme attribute

The android:windowKeepScreenOn attribute is not a valid theme attribute
in Android. This was causing resource linking failure during build.

Keep screen on functionality should be implemented at the View level
using android:keepScreenOn or programmatically with FLAG_KEEP_SCREEN_ON."
```

### 2. 推送到 GitHub

```bash
git push origin xraw-camera-android-app-d374a
```

### 3. 监控构建

访问：https://github.com/aaahnaf/Xraw/actions

预期结果：
- ✅ `processDebugResources` 任务成功
- ✅ 继续执行后续编译任务
- ✅ 生成 debug APK
- ✅ 上传 APK artifact

## 技术说明

### 为什么会出现这个错误？

这个错误可能是从其他项目复制主题配置时引入的。某些自定义 ROM 或第三方库可能定义了这个属性，但标准 Android SDK 中不存在。

### 如果需要保持屏幕常亮

如果应用确实需要保持屏幕常亮（例如相机应用），应该在 `MainActivity.kt` 中实现：

```kotlin
package com.xraw.camera

import android.os.Bundle
import android.view.WindowManager
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // 保持屏幕常亮
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }
}
```

或者在布局文件的根 View 上设置：

```xml
<FrameLayout
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:keepScreenOn="true">
    
    <!-- 其他内容 -->
    
</FrameLayout>
```

## 总结

- ✅ 所有 CI 配置问题已解决
- ✅ 构建成功进入 Android 编译阶段
- ✅ 资源链接错误已修复
- ⏳ 等待下一次构建验证

**状态：** 已修复，准备提交和推送

---

**文档版本：** 1.0  
**最后更新：** 2024  
**作者：** XRAW Camera 开发团队
