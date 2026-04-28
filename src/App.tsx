import React, { useState, useEffect, useRef } from 'react';
import { Layout } from 'antd';
import {
  CalendarOutlined,
  UserOutlined,
  TeamOutlined,
  BookOutlined,
  DollarOutlined,
  BankOutlined,
  BarChartOutlined,
  SettingOutlined,
  BankOutlined as SchoolOutlined,
  EnvironmentOutlined
} from '@ant-design/icons';
import ScheduleCalendar from './pages/ScheduleCalendar';
import StudentList from './pages/StudentList';
import TeacherList from './pages/TeacherList';
import CourseList from './pages/CourseList';
import PaymentList from './pages/PaymentList';
import InstitutionManager from './pages/InstitutionManager';
import RevenueStatistics from './pages/RevenueStatistics';
import SystemSettings from './pages/SystemSettings';
import RoomManager from './pages/RoomManager';
import SchoolManager from './pages/SchoolManager';

const { Header, Content } = Layout;

type PageKey = 'schedules' | 'students' | 'teachers' | 'courses' | 'payments' | 'institutions' | 'rooms' | 'statistics' | 'settings' | 'schools';

const PAGE_META: Record<PageKey, { icon: React.ReactNode; label: string }> = {
  schedules: { icon: <CalendarOutlined />, label: '课程表' },
  students: { icon: <UserOutlined />, label: '学生管理' },
  teachers: { icon: <TeamOutlined />, label: '老师管理' },
  courses: { icon: <BookOutlined />, label: '课程管理' },
  payments: { icon: <DollarOutlined />, label: '缴费管理' },
  institutions: { icon: <BankOutlined />, label: '机构管理' },
  rooms: { icon: <EnvironmentOutlined />, label: '地址管理' },
  statistics: { icon: <BarChartOutlined />, label: '收入统计' },
  schools: { icon: <SchoolOutlined />, label: '学校管理' },
  settings: { icon: <SettingOutlined />, label: '系统设置' },
};

const DEFAULT_ORDER: PageKey[] = ['schedules', 'students', 'teachers', 'courses', 'payments', 'institutions', 'rooms', 'statistics', 'schools', 'settings'];

let dbService: any = null;

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<PageKey>('schedules');
  const [dbLoaded, setDbLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 全局错误捕获
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('Global error:', event.error);
      setError(event.error?.message || '未知错误');
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  useEffect(() => {
    const loadDb = async () => {
      try {
        if (!dbService) {
          const dbModule = await import('./services/browserDatabase');
          dbService = dbModule.default;
        }
        (window as any).dbService = dbService;
        console.log('Database service loaded successfully');
        setDbLoaded(true);
      } catch (error) {
        console.error('Failed to load database service:', error);
        // 即使失败也设置为已加载,避免卡住
        setDbLoaded(true);
      }
    };
    loadDb();
  }, []);

  // 1 从localStorage读取或使用默认菜单排序（自动合并新增菜单项）
  const [menuOrder, setMenuOrder] = useState<PageKey[]>(() => {
    try {
      const saved = localStorage.getItem('menuOrder');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // 合并新增的菜单项：保留用户排序的同时追加新功能入口
          const merged = [...parsed];
          DEFAULT_ORDER.forEach(key => {
            if (!merged.includes(key)) merged.push(key);
          });
          return merged;
        }
      }
    } catch {}
    return DEFAULT_ORDER;
  });
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const dragJustHappened = useRef(false);

  const renderPage = () => {
    // 显示错误信息
    if (error) {
      return (
        <div style={{ padding: 50, textAlign: 'center', fontSize: 16, color: 'red' }}>
          <h3>⚠️ 系统错误</h3>
          <p>{error}</p>
          <p style={{ fontSize: 12, color: '#666' }}>请刷新页面或重启应用</p>
        </div>
      );
    }

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
      case 'teachers':
        return <TeacherList />;
      case 'courses':
        return <CourseList />;
      case 'payments':
        return <PaymentList />;
      case 'institutions':
        return <InstitutionManager />;
      case 'rooms':
        return <RoomManager />;
      case 'statistics':
        return <RevenueStatistics />;
      case 'schools':
        return <SchoolManager />;
      case 'settings':
        return <SystemSettings />;
      default:
        return <ScheduleCalendar />;
    }
  };

  return (
    <Layout style={{ minHeight: '100vh', background: '#fff' }}>
      <Header style={{
        background: '#fff',
        padding: '0 24px',
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h2 style={{ margin: '0 24px 0 0', color: '#1890ff', fontSize: 18 }}>📚 教务管理系统</h2>
          <div style={{ display: 'flex', gap: 4, border: 'none', flex: 1 }}>
            {menuOrder.map((key, idx) => (
              <div
                key={key}
                draggable
                onDragStart={(e) => {
                  dragJustHappened.current = true;
                  e.dataTransfer.setData('text/plain', String(idx));
                  setDragIdx(idx);
                }}
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
                  if (!isNaN(fromIdx) && fromIdx !== idx) {
                    const newOrder = [...menuOrder];
                    const [moved] = newOrder.splice(fromIdx, 1);
                    newOrder.splice(idx, 0, moved);
                    setMenuOrder(newOrder);
                    localStorage.setItem('menuOrder', JSON.stringify(newOrder));
                  }
                  setDragIdx(null);
                }}
                onDragEnd={() => setDragIdx(null)}
                onClick={() => {
                  if (dragJustHappened.current) {
                    dragJustHappened.current = false;
                    return;
                  }
                  setCurrentPage(key);
                }}
                style={{
                  padding: '0 16px',
                  height: 46,
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'grab',
                  borderBottom: currentPage === key ? '2px solid #1890ff' : '2px solid transparent',
                  color: currentPage === key ? '#1890ff' : '#333',
                  fontWeight: currentPage === key ? 'bold' : 'normal',
                  opacity: dragIdx === idx ? 0.5 : 1,
                  userSelect: 'none',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap'
                }}
                title="拖拽可调整排序"
              >
                {PAGE_META[key].icon}
                <span style={{ marginLeft: 4 }}>{PAGE_META[key].label}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ color: '#999' }}>{new Date().toLocaleDateString('zh-CN')}</div>
      </Header>
      <Content style={{
        margin: '0 16px 24px 16px',
        padding: '64px 24px 24px 24px',
        background: '#fff',
        borderRadius: 8,
        minHeight: 600
      }}>
        {renderPage()}
      </Content>
    </Layout>
  );
};

export default App;
