import React, { useState, useEffect } from 'react';
import { Layout, Menu } from 'antd';
import { 
  CalendarOutlined, 
  UserOutlined, 
  BookOutlined,
  BankOutlined,
  BarChartOutlined,
  SettingOutlined
} from '@ant-design/icons';
import ScheduleCalendar from './pages/ScheduleCalendar';
import StudentList from './pages/StudentList';
import CourseList from './pages/CourseList';
import InstitutionManager from './pages/InstitutionManager';
import RevenueStatistics from './pages/RevenueStatistics';
import SystemSettings from './pages/SystemSettings';

const { Header, Content } = Layout;

type PageKey = 'schedules' | 'students' | 'courses' | 'institutions' | 'statistics' | 'settings';

let dbService: any = null;

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageKey>('schedules');
  const [dbLoaded, setDbLoaded] = useState(false);

  useEffect(() => {
    const loadDb = async () => {
      if (!dbService) {
        const dbModule = await import('./services/browserDatabase');
        dbService = dbModule.default;
      }
      (window as any).dbService = dbService;
      setDbLoaded(true);
    };
    loadDb();
  }, []);

  const menuItems = [
    { key: 'schedules', icon: <CalendarOutlined />, label: '课程表' },
    { key: 'students', icon: <UserOutlined />, label: '学生管理' },
    { key: 'courses', icon: <BookOutlined />, label: '课程管理' },
    { key: 'institutions', icon: <BankOutlined />, label: '机构管理' },
    { key: 'statistics', icon: <BarChartOutlined />, label: '收入统计' },
    { key: 'settings', icon: <SettingOutlined />, label: '系统设置' },
  ];

  const renderPage = () => {
    if (!dbLoaded) {
      return (
        <div style={{ padding: 50, textAlign: 'center', fontSize: 16 }}>
          系统加载中...
        </div>
      );
    }

    switch (currentPage) {
      case 'schedules':
        return <ScheduleCalendar />;
      case 'students':
        return <StudentList />;
      case 'courses':
        return <CourseList />;
      case 'institutions':
        return <InstitutionManager />;
      case 'statistics':
        return <RevenueStatistics />;
      case 'settings':
        return <SystemSettings />;
      default:
        return <ScheduleCalendar />;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ 
        background: '#fff',
        padding: '0 24px',
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h2 style={{ margin: '0 24px 0 0', color: '#1890ff', fontSize: 18 }}>📚 排课管理系统 v1.3</h2>
          <Menu
            mode="horizontal"
            selectedKeys={[currentPage]}
            items={menuItems}
            onClick={({ key }) => setCurrentPage(key as PageKey)}
            style={{ border: 'none', flex: 1 }}
          />
        </div>
        <div style={{ color: '#999' }}>{new Date().toLocaleDateString('zh-CN')}</div>
      </Header>
      <Content style={{ margin: '24px 16px', padding: 24, background: '#fff', borderRadius: 8, minHeight: 600 }}>
        {renderPage()}
      </Content>
    </Layout>
  );
};

export default App;
