// 自动更新服务 - 使用 GitHub Releases
import { autoUpdater } from 'electron-updater';

let updateCheckInterval: any = null;

export interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string;
}

export interface UpdateStatus {
  checking: boolean;
  available: boolean;
  downloading: boolean;
  downloaded: boolean;
  error?: string;
  info?: UpdateInfo;
}

class AutoUpdateService {
  private status: UpdateStatus = {
    checking: false,
    available: false,
    downloading: false,
    downloaded: false
  };

  private callbacks: {
    onChecking?: () => void;
    onAvailable?: (info: UpdateInfo) => void;
    onNotAvailable?: () => void;
    onDownloading?: () => void;
    onDownloaded?: () => void;
    onError?: (error: string) => void;
    onProgress?: (percent: number) => void;
  } = {};

  constructor() {
    this.setupAutoUpdater();
  }

  private setupAutoUpdater() {
    // 不自动下载更新
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    // 检查更新事件
    autoUpdater.on('checking-for-update', () => {
      this.status.checking = true;
      this.callbacks.onChecking?.();
      console.log('正在检查更新...');
    });

    // 有可用更新
    autoUpdater.on('update-available', (info) => {
      this.status.checking = false;
      this.status.available = true;
      this.callbacks.onAvailable?.({
        version: info.version,
        releaseDate: info.releaseDate,
        releaseNotes: info.releaseNotes
      });
      console.log('发现新版本:', info.version);
    });

    // 已是最新版本
    autoUpdater.on('update-not-available', () => {
      this.status.checking = false;
      this.status.available = false;
      this.callbacks.onNotAvailable?.();
      console.log('已是最新版本');
    });

    // 下载进度
    autoUpdater.on('download-progress', (progress) => {
      const percent = Math.round(progress.percent);
      this.callbacks.onProgress?.(percent);
      console.log(`下载进度：${percent}%`);
    });

    // 更新下载完成
    autoUpdater.on('update-downloaded', (info) => {
      this.status.downloading = false;
      this.status.downloaded = true;
      this.callbacks.onDownloaded?.();
      console.log('更新已下载，准备安装');
    });

    // 错误处理
    autoUpdater.on('error', (err) => {
      this.status.checking = false;
      this.status.available = false;
      this.callbacks.onError?.(err.message);
      console.error('更新错误:', err.message);
    });
  }

  // 检查更新
  checkForUpdates() {
    this.status.checking = true;
    this.status.available = false;
    this.status.downloading = false;
    this.status.downloaded = false;
    autoUpdater.checkForUpdates();
  }

  // 下载更新
  downloadUpdate() {
    if (this.status.available) {
      this.status.downloading = true;
      this.callbacks.onDownloading?.();
      autoUpdater.downloadUpdate();
    }
  }

  // 安装更新
  quitAndInstall() {
    autoUpdater.quitAndInstall();
  }

  // 设置回调
  onChecking(fn: () => void) {
    this.callbacks.onChecking = fn;
  }

  onAvailable(fn: (info: UpdateInfo) => void) {
    this.callbacks.onAvailable = fn;
  }

  onNotAvailable(fn: () => void) {
    this.callbacks.onNotAvailable = fn;
  }

  onDownloading(fn: () => void) {
    this.callbacks.onDownloading = fn;
  }

  onDownloaded(fn: () => void) {
    this.callbacks.onDownloaded = fn;
  }

  onError(fn: (error: string) => void) {
    this.callbacks.onError = fn;
  }

  onProgress(fn: (percent: number) => void) {
    this.callbacks.onProgress = fn;
  }

  // 获取状态
  getStatus(): UpdateStatus {
    return { ...this.status };
  }
}

export default new AutoUpdateService();
