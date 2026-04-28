import React, { useState, useEffect } from 'react';
import { Modal, Button, Progress, message } from 'antd';
import { CloudDownloadOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import autoUpdateService from '../services/autoUpdate';

const UpdateChecker: React.FC = () => {
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [updateInfo, setUpdateInfo] = useState<{ version: string; releaseNotes?: string } | null>(null);

  useEffect(() => {
    // 设置自动更新回调
    autoUpdateService.onChecking(() => {
      setChecking(true);
    });

    autoUpdateService.onAvailable((info) => {
      setChecking(false);
      setUpdateInfo(info);
      setUpdateModalVisible(true);
    });

    autoUpdateService.onNotAvailable(() => {
      setChecking(false);
      message.success('已是最新版本');
    });

    autoUpdateService.onDownloading(() => {
      setDownloading(true);
    });

    autoUpdateService.onDownloaded(() => {
      setDownloading(false);
      setDownloaded(true);
      message.success('更新已下载，重启应用后安装');
    });

    autoUpdateService.onError((error) => {
      setChecking(false);
      message.error('检查更新失败：' + error);
    });

    autoUpdateService.onProgress((percent) => {
      setProgress(percent);
    });

    // 应用启动时自动检查更新（延迟 5 秒）
    const timer = setTimeout(() => {
      autoUpdateService.checkForUpdates();
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  const handleCheckUpdate = () => {
    setUpdateModalVisible(false);
    autoUpdateService.checkForUpdates();
  };

  const handleDownload = () => {
    autoUpdateService.downloadUpdate();
  };

  const handleInstall = () => {
    autoUpdateService.quitAndInstall();
  };

  return (
    <>
      {/* 检查更新按钮 - 可以放在系统设置页面 */}
      <Button 
        icon={<CloudDownloadOutlined />} 
        onClick={handleCheckUpdate}
        loading={checking}
      >
        检查更新
      </Button>

      {/* 更新提示弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {downloaded ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : 
             checking ? <CloudDownloadOutlined spin /> : 
             <ExclamationCircleOutlined style={{ color: '#1890ff' }} />}
            {downloaded ? '更新已就绪' : checking ? '正在检查更新' : '发现新版本'}
          </div>
        }
        open={updateModalVisible}
        onCancel={() => !checking && !downloading && setUpdateModalVisible(false)}
        footer={[
          !downloaded && !checking && (
            <Button key="cancel" onClick={() => setUpdateModalVisible(false)}>
              稍后再说
            </Button>
          ),
          !downloaded && !checking && (
            <Button key="download" type="primary" onClick={handleDownload}>
              立即更新
            </Button>
          ),
          downloaded && (
            <Button key="install" type="primary" onClick={handleInstall}>
              重启并安装
            </Button>
          )
        ]}
        width={450}
      >
        {checking && (
          <div style={{ padding: '20px 0', textAlign: 'center' }}>
            <p>正在检查新版本...</p>
          </div>
        )}

        {!checking && updateInfo && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <p><strong>当前版本：</strong>v{window.require('electron').remote?.app.getVersion() || '未知'}</p>
              <p><strong>最新版本：</strong>v{updateInfo.version}</p>
              <p><strong>发布日期：</strong>{updateInfo.releaseDate ? new Date(updateInfo.releaseDate).toLocaleDateString('zh-CN') : '未知'}</p>
            </div>
            
            {updateInfo.releaseNotes && (
              <div style={{ 
                background: '#f5f5f5', 
                padding: 12, 
                borderRadius: 4,
                maxHeight: 200,
                overflow: 'auto'
              }}>
                <strong>更新内容：</strong>
                <div style={{ 
                  whiteSpace: 'pre-wrap',
                  fontSize: 13,
                  lineHeight: 1.6
                }}>
                  {updateInfo.releaseNotes}
                </div>
              </div>
            )}

            {downloading && (
              <div style={{ marginTop: 16 }}>
                <p>正在下载更新...</p>
                <Progress percent={progress} />
              </div>
            )}

            {downloaded && (
              <div style={{ marginTop: 16, padding: '12px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 4 }}>
                <p style={{ margin: 0, color: '#52c41a' }}>
                  ✅ 更新已下载完成，点击"重启并安装"按钮立即更新
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
};

export default UpdateChecker;
