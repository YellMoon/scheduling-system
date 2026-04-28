# 排课与学生管理系统

## 📚 项目简介

一个功能完整的培训机构排课与学生管理桌面应用，支持学生管理、课程管理、排课系统、财务管理等功能。

## ✨ 核心功能

- **学生管理**: 学生信息、成绩记录、账户余额（课时 + 金额）
- **课程管理**: 4 种课程类型（一对一/一对二/小组课/大班课），3 种课程来源（自有/机构/混合班）
- **排课系统**: 日历视图、冲突检测、周期性排课
- **财务管理**: 学费缴纳、课时消耗、收入统计
- **数据导出**: Excel/PDF/JSON 格式，支持跨电脑转移

## 🛠️ 技术栈

- **框架**: Electron + React + TypeScript
- **UI**: Ant Design
- **数据库**: SQLite (better-sqlite3)
- **导出**: xlsx (Excel), pdfmake (PDF)

## 🚀 快速开始

### 1. 环境要求

- Node.js v18+ (https://nodejs.org/)
- npm 或 yarn

### 2. 安装依赖

```bash
cd scheduling-system
npm install
```

### 3. 开发模式运行

```bash
npm run dev
```

这将同时启动 React 开发服务器和 Electron 应用。

### 4. 构建生产版本

```bash
npm run build
npm run dist
```

打包后的文件在 `dist/` 目录：
- Windows: `.exe` 安装包
- Mac: `.dmg` 安装包
- Linux: `.AppImage`

## 📁 项目结构

```
scheduling-system/
├── src/
│   ├── main/          # Electron 主进程
│   ├── db/            # 数据库 Schema
│   ├── services/      # 数据库服务层
│   ├── types/         # TypeScript 类型定义
│   ├── pages/         # React 页面组件
│   ├── components/    # 可复用组件
│   └── App.tsx        # 主应用入口
├── public/            # 静态资源
├── package.json
└── tsconfig.json
```

## 💾 数据存储

- 数据库文件：`scheduling.db` (SQLite)
- 位置：应用安装目录
- 备份方式：系统设置 → 导出全部数据 (JSON 格式)

## 📤 数据迁移

### 导出备份
1. 打开应用 → 系统设置
2. 点击「导出全部数据」
3. 保存 JSON 文件

### 导入恢复
1. 新电脑安装应用
2. 系统设置 → 导入数据
3. 选择之前导出的 JSON 文件

## 📝 使用说明

### 添加学生
1. 进入「学生管理」
2. 点击「添加学生」
3. 填写信息（姓名、电话、学校、年级等）
4. 可设置初始课时余额和账户余额

### 创建课程
1. 进入「课程管理」
2. 点击「添加课程」
3. 选择课程类型（一对一/一对二/小组课/大班课）
4. 选择课程来源（自有/机构/混合班）
5. 设置课时费和教室信息

### 排课
1. 进入「排课系统」
2. 点击「添加课程」
3. 选择课程、日期、时间
4. 系统自动检测时间冲突

### 记录缴费
1. 进入「财务管理」
2. 选择学生
3. 记录缴费金额和类型（学费/课时）

### 课时消耗
1. 课程完成后
2. 在排课系统中标记为「已完成」
3. 系统自动扣除学生课时和费用

## 🔧 开发说明

### IPC 通信

Electron 主进程与渲染进程通过 IPC 通信：

```typescript
// 渲染进程调用
const result = await ipcRenderer.invoke('student:getAll');

// 主进程处理
ipcMain.handle('student:getAll', () => {
  return { success: true, data: dbService.getAllStudents() };
});
```

### 数据库操作

所有数据库操作在 `src/services/database.ts` 中封装。

## 📄 许可证

MIT

## 👨‍💻 作者

小龙虾 · 严谨专业版

---

**版本**: v1.0.0  
**更新日期**: 2026-04-10
