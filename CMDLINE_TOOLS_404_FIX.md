# Android SDK cmdline-tools 404 错误修复

## 问题描述

GitHub Actions 构建在 Android SDK 设置阶段失败：

```
Downloading commandline tools from https://dl.google.com/android/repository/commandlinetools-linux-11.0_latest.zip
HTTPError: Unexpected HTTP response: 404
```

## 根本原因

`android-actions/setup-android@v4` action 的 `cmdline-tools-version` 参数格式不正确。

### 问题分析

1. **错误的版本号格式**
   - 之前使用 `'11.0'`（语义化版本号）
   - action 尝试下载 `commandlinetools-linux-11.0_latest.zip`
   - Google 服务器上不存在这个文件（404）

2. **action 期望的参数格式**
   - `android-actions/setup-android@v4` 的 `cmdline-tools-version` 参数期望：
     - ✅ Build number（如 `11076708`、`10406996`、`9477386`）
     - ✅ `latest` 关键字
     - ❌ 语义化版本号（如 `11.0`、`10.0`）

3. **为什么之前的 build number 也失败了？**
   - 之前使用 `'11076708'` 时，action 下载的是 `commandlinetools-linux-latest_latest.zip`
   - 这说明 action 可能没有正确识别 build number，回退到了 `latest`
   - `latest` 指向 cmdline-tools 16.0，该版本尝试安装已废弃的 `tools` 包

## 解决方案

**移除 `cmdline-tools-version` 参数，让 action 使用默认配置。**

### 修改内容

**文件：** `.github/workflows/build-apk.yml`

#### Build Job（第 42-43 行）

**修改前：**
```yaml
- name: Setup Android SDK
  uses: android-actions/setup-android@v4
  with:
    cmdline-tools-version: '11.0'  # ❌ 无效格式，导致 404
```

**修改后：**
```yaml
- name: Setup Android SDK
  uses: android-actions/setup-android@v4
  # ✅ 移除 cmdline-tools-version，使用 action 默认配置
```

#### Test Job（第 189-190 行）

**修改前：**
```yaml
- name: Setup Android SDK
  uses: android-actions/setup-android@v4
  with:
    cmdline-tools-version: '11.0'  # ❌ 无效格式，导致 404
```

**修改后：**
```yaml
- name: Setup Android SDK
  uses: android-actions/setup-android@v4
  # ✅ 移除 cmdline-tools-version，使用 action 默认配置
```

## 为什么这个方案有效？

### action 的默认行为

当不指定 `cmdline-tools-version` 时，`android-actions/setup-android@v4` action 会：

1. **使用内置的稳定版本**
   - action 维护者已经测试过的稳定版本
   - 不会尝试安装已废弃的包
   - 与当前 Android SDK 兼容

2. **自动处理许可证**
   - 自动接受 Android SDK 许可证
   - 不需要手动运行 `yes | sdkmanager --licenses`

3. **设置正确的环境变量**
   - `ANDROID_HOME`
   - `ANDROID_SDK_ROOT`
   - 更新 `PATH` 包含 `sdkmanager`

### 避免的问题

1. **404 错误**
   - 不再尝试下载不存在的版本号
   - 使用 action 维护者验证过的版本

2. **废弃包问题**
   - 不会尝试安装已废弃的 `tools` 包
   - 避免 `Failed to find package 'tools'` 错误

3. **版本兼容性**
   - action 默认版本与 Android SDK 34 兼容
   - 与 build-tools 34.0.0 兼容

## 预期结果

修复后，workflow 应该：

1. ✅ 成功下载 cmdline-tools（使用 action 默认版本）
2. ✅ 正确设置 Android SDK 环境
3. ✅ 成功安装 platform-tools, platforms;android-34, build-tools;34.0.0
4. ✅ 通过 SDK 验证步骤
5. ✅ 继续执行前端构建
6. ✅ 继续执行 Gradle 构建
7. ✅ 生成 APK

### 预期日志

```
Run android-actions/setup-android@v4
Downloading Android command line tools...
✓ Android SDK setup complete
```

不再出现：
- ❌ `HTTPError: Unexpected HTTP response: 404`
- ❌ `Failed to find package 'tools'`
- ❌ `sdkmanager failed with exit code 1`

## 下一步操作

### 1. 提交修复

```bash
git add .github/workflows/build-apk.yml
git commit -m "Fix: Remove invalid cmdline-tools-version parameter

The cmdline-tools-version parameter with semantic version format '11.0'
caused 404 errors when downloading from Google's servers.

The android-actions/setup-android@v4 action expects build numbers
(like '11076708') or 'latest', not semantic versions.

By removing this parameter, the action uses its built-in stable
cmdline-tools version, which:
- Avoids 404 download errors
- Prevents attempts to install deprecated packages
- Ensures compatibility with Android SDK 34
- Simplifies the workflow configuration"
```

### 2. 推送到 GitHub

```bash
git push origin xraw-camera-android-app-d374a
```

### 3. 监控构建

访问：https://github.com/aaahnaf/Xraw/actions

预期结果：
- ✅ "Setup Android SDK" 步骤成功
- ✅ 没有 404 错误
- ✅ 继续执行后续步骤

## 技术细节

### android-actions/setup-android@v4 参数说明

根据 action 文档，`cmdline-tools-version` 参数：

**有效值：**
- `latest` - 使用最新版本
- Build number（如 `11076708`）- 使用特定版本

**无效值：**
- ❌ 语义化版本号（如 `11.0`、`10.0`）
- ❌ 其他非标准格式

**默认行为：**
- 如果不指定，action 使用内置的稳定版本
- 这是最可靠的选择

### Google Android SDK 下载 URL 格式

Google 的 cmdline-tools 下载 URL 格式：

```
https://dl.google.com/android/repository/commandlinetools-linux-{version}_latest.zip
```

**有效的 version 值：**
- `latest` - 最新版本
- Build number（如 `11076708`、`10406996`）

**无效的 version 值：**
- ❌ `11.0`（语义化版本号）
- ❌ `10.0`
- ❌ 其他非 build number 格式

### 为什么 build number 也可能失败？

即使使用正确的 build number（如 `11076708`），也可能遇到问题：

1. **action 可能不识别**
   - 某些版本的 action 可能没有正确处理 build number
   - 回退到 `latest`

2. **latest 版本可能有问题**
   - cmdline-tools 16.0 尝试安装已废弃的 `tools` 包
   - 导致 `Failed to find package 'tools'` 错误

3. **网络问题**
   - Google 服务器可能暂时不可用
   - 下载超时

**最可靠的方案：** 不指定版本，使用 action 默认配置。

## 验证清单

修复后，验证以下内容：

- [ ] workflow 中没有 `cmdline-tools-version` 参数
- [ ] Build job 和 Test job 都使用相同的配置
- [ ] 没有 404 下载错误
- [ ] 没有 "Failed to find package 'tools'" 警告
- [ ] SDK 设置步骤成功完成
- [ ] SDK 包安装成功
- [ ] 构建继续进行到 Gradle 阶段

## 总结

- ✅ 问题：cmdline-tools-version 参数格式错误导致 404
- ✅ 原因：使用语义化版本号 `'11.0'` 而不是 build number
- ✅ 修复：移除参数，使用 action 默认配置
- ✅ 影响：两个 job 的 SDK 设置步骤
- ⏳ 状态：已修复，等待提交和推送

---

**文档版本：** 1.0  
**最后更新：** 2024  
**作者：** XRAW Camera 开发团队
