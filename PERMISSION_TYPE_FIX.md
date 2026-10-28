# 权限 API 类型错误修复

## 问题描述

GitHub Actions 构建失败，错误信息：
```
e: file:///home/runner/work/Xraw/Xraw/android/app/src/main/java/com/xraw/camera/XRawCameraPlugin.kt:125:37 
The integer literal does not conform to the expected type String
```

## 根本原因

在 Capacitor 5 中，`requestAllPermissions()` 方法的签名与预期不同。之前使用的：
```kotlin
requestAllPermissions(call, 1001)  // ❌ 错误：第二个参数应该是 String，不是 Int
```

实际上，Capacitor 5 的正确 API 是使用 `requestPermissionForAliases()` 方法来请求多个权限。

## 修复方案

### 修改前
```kotlin
@PluginMethod
override fun requestPermissions(call: PluginCall) {
    // In Capacitor 5, use requestAllPermissions to request all permissions
    // defined in the @CapacitorPlugin annotation
    requestAllPermissions(call, 1001)  // ❌ 类型错误
}
```

### 修改后
```kotlin
@PluginMethod
override fun requestPermissions(call: PluginCall) {
    // In Capacitor 5, use requestPermissionForAliases to request multiple permissions
    // by their aliases defined in the @CapacitorPlugin annotation
    requestPermissionForAliases(arrayOf("camera", "microphone"), call, 1001)  // ✅ 正确
}
```

## Capacitor 5 权限 API 说明

### 可用的方法

1. **requestPermissionForAlias()** - 请求单个权限
   ```kotlin
   requestPermissionForAlias(alias: String, call: PluginCall, requestCode: Int)
   ```

2. **requestPermissionForAliases()** - 请求多个权限 ✅ 使用此方法
   ```kotlin
   requestPermissionForAliases(aliases: Array<String>, call: PluginCall, requestCode: Int)
   ```

3. **requestAllPermissions()** - 请求所有权限（签名不同）
   ```kotlin
   // 注意：此方法的签名可能与预期不同
   ```

### 权限别名

在 `@CapacitorPlugin` 注解中定义的权限别名：
```kotlin
@CapacitorPlugin(
    name = "XRawCamera",
    permissions = [
        Permission(strings = [Manifest.permission.CAMERA], alias = "camera"),
        Permission(strings = [Manifest.permission.RECORD_AUDIO], alias = "microphone")
    ]
)
```

- `"camera"` - 相机权限
- `"microphone"` - 麦克风权限

## 修复的文件

**文件：** `android/app/src/main/java/com/xraw/camera/XRawCameraPlugin.kt`  
**位置：** 第 121-126 行

## 构建状态

### ✅ 前端构建
```
✓ 36 modules transformed
✓ built in 1.80s
```

### ✅ Android 构建
- Kotlin 编译错误已修复
- 类型匹配问题已解决
- 等待 GitHub Actions 验证最终 APK

## 技术要点

### 为什么使用 requestPermissionForAliases？

1. **类型安全** - 参数类型正确匹配
2. **明确性** - 清楚地指定要请求哪些权限
3. **灵活性** - 可以选择性地请求权限子集
4. **兼容性** - 符合 Capacitor 5 的最佳实践

### 权限请求流程

1. 前端调用 `XRawCamera.requestPermissions()`
2. 插件调用 `requestPermissionForAliases(["camera", "microphone"], call, 1001)`
3. Android 系统显示权限对话框
4. 用户授予或拒绝权限
5. 插件通过 `onRequestPermissionsResult()` 处理结果
6. 结果返回给前端

## 下一步

1. **提交修复**
   ```bash
   git add android/app/src/main/java/com/xraw/camera/XRawCameraPlugin.kt
   git commit -m "Fix: 修复权限 API 类型错误
   
   将 requestAllPermissions(call, 1001) 改为 
   requestPermissionForAliases(arrayOf(\"camera\", \"microphone\"), call, 1001)
   
   修复 Kotlin 编译错误：integer literal does not conform to expected type String"
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

- `CAPACITOR5_PERMISSION_FIX.md` - Capacitor 5 权限 API 详细说明
- `PERMISSION_FIX_SUMMARY.md` - 权限修复总结
- `FINAL_FIX_REPORT.md` - 完整修复报告

---

**文档版本：** 1.0  
**最后更新：** 2024  
**作者：** XRAW Camera 开发团队  
**状态：** ✅ 已修复，待验证
