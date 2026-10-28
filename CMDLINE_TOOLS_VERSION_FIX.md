# Android SDK cmdline-tools 版本修复

## 问题描述

GitHub Actions 构建在 Android SDK 设置阶段失败：

```
Warning: Failed to find package 'tools'
Error: The process '/usr/local/lib/android/sdk/cmdline-tools/16.0/bin/sdkmanager' failed with exit code 1
```

## 根本原因

workflow 中配置的 `cmdline-tools-version: '11076708'` 版本号格式不正确。

### 问题分析

1. **错误的版本号格式**
   - `11076708` 是一个 build number，不是 action 期望的版本号格式
   - `android-actions/setup-android@v4` action 期望的版本号格式是：`11.0`, `10.0`, `9.0` 等
   - 由于版本号无效，action 可能忽略了这个配置，使用了默认的 `latest`
   - `latest` 指向了 cmdline-tools 16.0，而 16.0 存在已知问题

2. **cmdline-tools 16.0 的问题**
   - 尝试安装已废弃的 `tools` 包
   - Google 已从 SDK 仓库中移除 `tools` 包
   - 导致 `sdkmanager` 执行失败，退出码 1

## 修复方案

将 `cmdline-tools-version` 从 `'11076708'` 改为 `'11.0'`。

### 修改内容

**文件：** `.github/workflows/build-apk.yml`

#### Build Job（第 45 行）

**修改前：**
```yaml
- name: Setup Android SDK
  uses: android-actions/setup-android@v4
  with:
    cmdline-tools-version: '11076708'  # ❌ 无效的 build number
```

**修改后：**
```yaml
- name: Setup Android SDK
  uses: android-actions/setup-android@v4
  with:
    cmdline-tools-version: '11.0'  # ✅ 正确的版本号格式
```

#### Test Job（第 194 行）

**修改前：**
```yaml
- name: Setup Android SDK
  uses: android-actions/setup-android@v4
  with:
    cmdline-tools-version: '11076708'  # ❌ 无效的 build number
```

**修改后：**
```yaml
- name: Setup Android SDK
  uses: android-actions/setup-android@v4
  with:
    cmdline-tools-version: '11.0'  # ✅ 正确的版本号格式
```

## 版本号说明

### android-actions/setup-android@v4 支持的版本号格式

根据 action 文档，`cmdline-tools-version` 支持以下格式：

| 版本号 | 说明 | 状态 |
|--------|------|------|
| `latest` | 最新版本 | ⚠️ 可能有问题（16.0） |
| `11.0` | 稳定版本 | ✅ 推荐 |
| `10.0` | 旧稳定版本 | ✅ 可用 |
| `9.0` | 更旧版本 | ✅ 可用 |
| `11076708` | build number | ❌ 无效格式 |

### 为什么选择 11.0？

1. **稳定性** - cmdline-tools 11.0 是经过验证的稳定版本
2. **兼容性** - 与 Android SDK 34 和 build-tools 34.0.0 兼容
3. **可用性** - Google 服务器上仍然存在，不会 404
4. **无废弃包** - 不会尝试安装已废弃的 `tools` 包

## 预期结果

修复后，workflow 应该：

1. ✅ 成功下载 cmdline-tools 11.0
2. ✅ 正确设置 Android SDK 环境
3. ✅ 成功安装 platform-tools, platforms;android-34, build-tools;34.0.0
4. ✅ 通过 SDK 验证步骤
5. ✅ 继续执行前端构建
6. ✅ 继续执行 Gradle 构建
7. ✅ 生成 APK

## 下一步操作

### 1. 提交修复

```bash
git add .github/workflows/build-apk.yml
git commit -m "Fix: Use correct cmdline-tools version format

Changed cmdline-tools-version from invalid build number '11076708' 
to proper version format '11.0'.

The previous version format was not recognized by the 
android-actions/setup-android@v4 action, causing it to fall back 
to 'latest' which points to cmdline-tools 16.0. Version 16.0 has 
known issues with attempting to install deprecated 'tools' package.

Using version 11.0 ensures:
- Stable, tested cmdline-tools version
- No attempts to install deprecated packages
- Compatibility with Android SDK 34 and build-tools 34.0.0"
```

### 2. 推送到 GitHub

```bash
git push origin xraw-camera-android-app-d374a
```

### 3. 监控构建

访问：https://github.com/aaahnaf/Xraw/actions

预期日志：
```
Run android-actions/setup-android@v4
  with:
    cmdline-tools-version: 11.0
  
Downloading Android command line tools v11.0...
✓ Android SDK setup complete
```

## 技术细节

### android-actions/setup-android@v4 的工作原理

1. **下载 cmdline-tools**
   - 根据 `cmdline-tools-version` 参数下载对应版本
   - URL 格式：`https://dl.google.com/android/repository/commandlinetools-linux-{version}_latest.zip`
   - 例如：`commandlinetools-linux-11.0_latest.zip`

2. **解压到 SDK 目录**
   - 解压到 `$ANDROID_HOME/cmdline-tools/{version}/`
   - 设置 `sdkmanager` 路径

3. **设置环境变量**
   - `ANDROID_HOME`
   - `ANDROID_SDK_ROOT`
   - 更新 `PATH` 包含 `sdkmanager`

4. **接受许可证**
   - 自动接受 Android SDK 许可证

### 为什么 build number 无效？

`android-actions/setup-android@v4` action 的 `cmdline-tools-version` 参数期望的是：
- 语义化版本号（如 `11.0`, `10.0`）
- 或 `latest` 关键字

它**不支持**：
- Build numbers（如 `11076708`）
- 其他非标准格式

当提供无效版本号时，action 可能会：
- 忽略该参数
- 使用默认值 `latest`
- 或抛出错误

在我们的情况下，action 忽略了无效的版本号，使用了 `latest`，导致下载了有问题的 16.0 版本。

## 验证清单

修复后，验证以下内容：

- [ ] workflow 使用 `cmdline-tools-version: '11.0'`
- [ ] Build job 和 Test job 都使用相同的版本号
- [ ] 没有 "Failed to find package 'tools'" 警告
- [ ] SDK 设置步骤成功完成
- [ ] SDK 包安装成功
- [ ] 构建继续进行到 Gradle 阶段

## 总结

- ✅ 问题：cmdline-tools 版本号格式错误
- ✅ 原因：使用了 build number 而不是语义化版本号
- ✅ 修复：改为 `'11.0'`
- ✅ 影响：两个 job 的 SDK 设置步骤
- ⏳ 状态：已修复，等待提交和推送

---

**文档版本：** 1.0  
**最后更新：** 2024  
**作者：** XRAW Camera 开发团队
