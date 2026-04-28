const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, '../public/icon.png')
  });

  // 开发环境加载本地服务器，生产环境加载构建文件
  const isDev = process.env.NODE_ENV !== 'production';
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ========== IPC 处理 - 数据库操作 ==========
// 注意：数据库实际在渲染进程中初始化，这里只转发请求

// 初始化数据库（在渲染进程中执行）
ipcMain.handle('db:init', async () => {
  try {
    return { success: true };
  } catch (error) {
    console.error('数据库初始化失败:', error);
    return { success: false, error: error.message };
  }
});

// 学生管理
ipcMain.handle('student:getAll', async (event) => {
  try {
    return { success: true, data: [] };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('student:create', async (event, student) => {
  try {
    return { success: true, data: { ...student, id: Date.now().toString() } };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('student:update', async (event, id, updates) => {
  try {
    return { success: true, data: { id, ...updates } };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('student:delete', async (event, id) => {
  try {
    return { success: true, data: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 课程管理
ipcMain.handle('course:getAll', async (event) => {
  try {
    return { success: true, data: [] };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('course:create', async (event, course) => {
  try {
    return { success: true, data: { ...course, id: Date.now().toString() } };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('course:update', async (event, id, updates) => {
  try {
    return { success: true, data: { id, ...updates } };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('course:delete', async (event, id) => {
  try {
    return { success: true, data: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 排课管理
ipcMain.handle('schedule:getAll', async (event) => {
  try {
    return { success: true, data: [] };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('schedule:create', async (event, schedule) => {
  try {
    return { success: true, data: { ...schedule, id: Date.now().toString() } };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('schedule:update', async (event, id, updates) => {
  try {
    return { success: true, data: { id, ...updates } };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('schedule:delete', async (event, id) => {
  try {
    return { success: true, data: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 财务管理
ipcMain.handle('payment:create', async (event, payment) => {
  try {
    return { success: true, data: { ...payment, id: Date.now().toString() } };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('consumption:create', async (event, consumption) => {
  try {
    return { success: true, data: { ...consumption, id: Date.now().toString() } };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 数据统计
ipcMain.handle('data:getRevenueStats', async (event, startDate, endDate) => {
  try {
    return { success: true, data: { total_revenue: 0, payment_count: 0 } };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('data:getConsumptionStats', async (event, startDate, endDate) => {
  try {
    return { success: true, data: { total_hours: 0, total_amount: 0, consumption_count: 0 } };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 数据导出
ipcMain.handle('data:export', async (event) => {
  try {
    return { success: true, data: {} };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 数据导入
ipcMain.handle('data:import', async (event, data) => {
  try {
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
