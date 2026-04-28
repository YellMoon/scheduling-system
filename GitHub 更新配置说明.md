# GitHub Releases 自动更新配置指南

## 📦 配置步骤

### 第 1 步：创建 GitHub 仓库

1. 访问 https://github.com
2. 登录你的 GitHub 账号
3. 点击右上角 **+** → **New repository**
4. 填写：
   - Repository name: `scheduling-system`
   - 选择 **Public**
   - 点击 **Create repository**

---

### 第 2 步：修改 package.json

打开 `package.json`，找到 `build` → `publish` 部分，修改为你的 GitHub 信息：

```json
"publish": {
  "provider": "github",
  "owner": "你的 GitHub 用户名",
  "repo": "scheduling-system",
  "private": false
}
```

**例如**：
```json
"publish": {
  "provider": "github",
  "owner": "zhangsan",
  "repo": "scheduling-system",
  "private": false
}
```

---

### 第 3 步：生成 GitHub Token

1. 访问 https://github.com/settings/tokens
2. 点击 **Generate new token (classic)**
3. 填写：
   - Note: `scheduling-system-publish`
   - 勾选：**repo** (全部权限)
   - 点击 **Generate token**
4. **复制 Token**（只显示一次，保存好！）

---

### 第 4 步：设置环境变量

**Windows**：
1. 右键 **此电脑** → **属性**
2. **高级系统设置** → **环境变量**
3. **系统变量** → **新建**
   - 变量名：`GH_TOKEN`
   - 变量值：`你的 GitHub Token`
4. 确定保存

---

### 第 5 步：发布新版本

**打包并上传到 GitHub**：

```bash
# 在项目目录运行
.\build.bat
```

打包完成后，在 `dist` 目录会生成：
- `排课管理系统 Setup 1.3.0.exe` (安装包)
- `latest.yml` (更新信息)

**上传到 GitHub Releases**：

1. 访问 https://github.com/你的用户名/scheduling-system/releases
2. 点击 **Create a new release**
3. 填写：
   - Tag version: `v1.3.0`
   - Release title: `排课管理系统 v1.3.0`
   - 填写更新内容
4. 上传文件：
   - `排课管理系统 Setup 1.3.0.exe`
   - `latest.yml`
5. 点击 **Publish release**

---

### 第 6 步：用户自动更新

用户打开应用后：
1. 应用自动检查 GitHub Releases
2. 发现新版本 → 弹出更新提示
3. 点击"立即更新" → 自动下载
4. 下载完成 → 重启安装

---

## 🔧 本地测试

**在不发布的情况下测试**：

```bash
# 设置测试用的 GitHub Token
set GH_TOKEN=你的 Token

# 打包
npm run build
npm run dist
```

---

## ⚠️ 注意事项

1. **Token 安全**：不要公开你的 GitHub Token
2. **版本号**：每次发布前更新 `package.json` 中的 `version`
3. **更新文件**：必须上传 `latest.yml` 和 `.exe` 文件
4. **网络**：国内访问 GitHub 可能较慢，用户更新需要稳定网络

---

## 📝 快速发布脚本

创建 `publish.bat`：

```batch
@echo off
echo 正在发布新版本...

REM 更新版本号（手动修改 package.json）
REM npm version patch

REM 打包
call npm run build
call npm run dist

echo.
echo 打包完成！
echo 请手动上传到 GitHub Releases:
echo https://github.com/你的用户名/scheduling-system/releases
echo.

pause
```

---

## 🎯 完整流程

```
修改代码 → 更新版本号 → 打包 → 上传 GitHub Releases → 用户自动更新
```

**用户端**：
```
打开应用 → 自动检查更新 → 发现新版本 → 下载 → 重启安装
```

---

**版本**: v1.3  
**更新日期**: 2026-04-11
