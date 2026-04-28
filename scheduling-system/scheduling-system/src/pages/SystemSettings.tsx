import React, { useState, useEffect } from 'react';
import { Card, Button, message, Space, Divider } from 'antd';
import { ExportOutlined, ImportOutlined } from '@ant-design/icons';

const SystemSettings: React.FC = () => {
  const dbService = (window as any).dbService;

  const handleExport = () => {
    try {
      const data = dbService.exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('数据导出成功');
    } catch (error: any) {
      message.error('导出失败：' + error.message);
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event: any) => {
          try {
            const data = JSON.parse(event.target.result);
            dbService.importAllData(data);
            message.success('数据导入成功');
          } catch (error: any) {
            message.error('导入失败：' + error.message);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  return (
    <div>
      <Card title="数据管理" style={{ marginBottom: 16 }}>
        <Space size="large">
          <Button 
            type="primary" 
            icon={<ExportOutlined />} 
            size="large"
            onClick={handleExport}
          >
            导出全部数据
          </Button>
          <Button 
            icon={<ImportOutlined />} 
            size="large"
            onClick={handleImport}
          >
            导入数据
          </Button>
        </Space>
        <Divider />
        <div style={{ color: '#666', lineHeight: '1.8' }}>
          <p>• 导出功能将把所有学生、课程、排课、财务数据保存为 JSON 文件</p>
          <p>• 导入功能可从备份文件恢复数据（注意：会覆盖现有数据）</p>
          <p>• 建议定期导出备份，方便跨电脑转移</p>
        </div>
      </Card>

      <Card title="系统信息">
        <div style={{ color: '#666', lineHeight: '1.8' }}>
          <p>• 版本：v1.0.0</p>
          <p>• 数据库：SQLite (本地存储)</p>
          <p>• 数据位置：应用安装目录/scheduling.db</p>
        </div>
      </Card>
    </div>
  );
};

export default SystemSettings;
