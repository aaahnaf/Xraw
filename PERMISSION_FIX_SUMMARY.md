# 权限 API 修复总结

## 问题
```
Unresolved reference: requestPermissionForPlugin
```

## 原因
`requestPermissionForPlugin()` 是 Capacitor 3/4 的 API，在 Capacitor 5 中已被移除。

## 解决方案
使用 Capacitor 5 的 `requestAllPermissions()` 方法替代。

## 修改内容

**文件：** `android/app/src/main/java/com/xraw/camera/XRawCameraPlugin.kt`

**修改位置：** 第 121-126 行

```kotlin
// 修改前
requestPermissionForPlugin(perms.toTypedArray(), call, 1001)

// 修改后
requestAllPermissions(call, 1001)
```

## 构建状态
✅ 已修复，等待 GitHub Actions 验证

## 下一步
提交并推送到 GitHub，监控构建结果。

---

**详细文档：** `CAPACITOR5_PERMISSION_FIX.md`
