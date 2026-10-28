# Capacitor 5 权限 API 修复

## 问题

GitHub Actions 构建失败，错误信息：
```
e: file:///home/runner/work/Xraw/Xraw/android/app/src/main/java/com/xraw/camera/XRawCameraPlugin.kt:133:9 
Unresolved reference: requestPermissionForPlugin
```

## 根本原因

`requestPermissionForPlugin()` 方法在 Capacitor 5 中不存在。这是 Capacitor 3/4 的 API，在 Capacitor 5 中已被替换。

## Capacitor 5 权限 API 变化

### Capacitor 3/4 (旧 API)
```kotlin
requestPermissionForPlugin(
    permissions: Array<String>,
    call: PluginCall,
    requestCode: Int
)
```

### Capacitor 5 (新 API)
```kotlin
// 请求单个权限别名
requestPermissionForAlias(
    alias: String,
    call: PluginCall,
    requestCode: Int
)

// 请求多个权限别名
requestPermissionForAliases(
    aliases: Array<String>,
    call: PluginCall,
    requestCode: Int
)

// 请求所有权限
requestAllPermissions(
    call: PluginCall,
    requestCode: Int
)
```

## 修复方案

### 修改前
```kotlin
@PluginMethod
override fun requestPermissions(call: PluginCall) {
    val perms = mutableListOf(
        Manifest.permission.CAMERA,
        Manifest.permission.RECORD_AUDIO
    )
    if (Build.VERSION.SDK_INT < 33) {
        perms.add(Manifest.permission.WRITE_EXTERNAL_STORAGE)
    } else {
        perms.add(Manifest.permission.READ_MEDIA_IMAGES)
        perms.add(Manifest.permission.READ_MEDIA_VIDEO)
    }
    requestPermissionForPlugin(perms.toTypedArray(), call, 1001)  // ❌ 错误
}
```

### 修改后
```kotlin
@PluginMethod
override fun requestPermissions(call: PluginCall) {
    // In Capacitor 5, use requestAllPermissions to request all permissions
    // defined in the @CapacitorPlugin annotation
    requestAllPermissions(call, 1001)  // ✅ 正确
}
```

## 权限注解配置

确保 `@CapacitorPlugin` 注解中正确定义了权限：

```kotlin
@CapacitorPlugin(
    name = "XRawCamera",
    permissions = [
        Permission(strings = [Manifest.permission.CAMERA], alias = "camera"),
        Permission(strings = [Manifest.permission.RECORD_AUDIO], alias = "microphone")
    ]
)
class XRawCameraPlugin : Plugin() {
    // ...
}
```

## 注意事项

### 1. 存储权限处理

在 Capacitor 5 中，存储权限需要特殊处理：

- **Android 13+ (API 33+)**: 使用 `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO`
- **Android 12 及以下**: 使用 `WRITE_EXTERNAL_STORAGE`, `READ_EXTERNAL_STORAGE`

如果需要动态处理存储权限，可以：

```kotlin
@PluginMethod
override fun requestPermissions(call: PluginCall) {
    // 请求相机和麦克风权限
    requestPermissionForAliases(
        arrayOf("camera", "microphone"),
        call,
        1001
    )
    
    // 存储权限需要通过 Android 原生 API 单独处理
    // 或者在 AndroidManifest.xml 中声明
}
```

### 2. 权限回调

Capacitor 5 使用不同的权限回调机制：

```kotlin
override fun onRequestPermissionsResult(
    requestCode: Int,
    permissions: Array<out String>,
    grantResults: IntArray
) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    
    // 处理权限结果
    if (requestCode == 1001) {
        // 检查权限是否被授予
        val allGranted = grantResults.all { it == PackageManager.PERMISSION_GRANTED }
        // 通知前端
    }
}
```

### 3. 前端权限检查

前端需要相应地更新权限检查代码：

```typescript
// 检查权限
const result = await XRawCamera.checkPermissions();
console.log(result.camera); // 'granted' | 'prompt' | 'denied'
console.log(result.storage); // 'granted' | 'prompt' | 'denied'

// 请求权限
await XRawCamera.requestPermissions();
```

## 构建状态

### ✅ 已修复
- Capacitor 5 权限 API 兼容性
- `requestPermissionForPlugin` → `requestAllPermissions`
- 权限注解配置

### ⏳ 待验证
- Android 构建是否成功
- 权限请求是否正常工作
- 存储权限处理是否正确

## 下一步

1. **提交修复**
   ```bash
   git add android/app/src/main/java/com/xraw/camera/XRawCameraPlugin.kt
   git commit -m "Fix: Use Capacitor 5 permission API
   
   Replace deprecated requestPermissionForPlugin with requestAllPermissions
   for Capacitor 5 compatibility."
   git push origin xraw-camera-android-app-d374a
   ```

2. **监控构建**
   - 访问：https://github.com/aaahnaf/Xraw/actions
   - 验证 Kotlin 编译成功
   - 验证 APK 生成成功

3. **测试权限**
   - 在设备上安装 APK
   - 启动应用
   - 验证权限请求对话框出现
   - 验证权限授予后功能正常

## 相关文档

- [Capacitor 5 权限指南](https://capacitorjs.com/docs/guides/permissions)
- [Android 权限最佳实践](https://developer.android.com/training/permissions/requesting)
- [Capacitor Plugin 开发](https://capacitorjs.com/docs/plugins/creating-plugins)

---

**文档版本：** 1.0  
**最后更新：** 2024  
**作者：** XRAW Camera 开发团队  
**状态：** ✅ 已修复，待验证
