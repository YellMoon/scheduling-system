import React, { useState, useEffect } from 'react';
import { 
  Card, DatePicker, Select, Button, Table, Statistic, Row, Col, 
  Divider, Typography, Tag, Empty, Space, Radio
} from 'antd';
import { BarChartOutlined, PieChartOutlined, LineChartOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { RevenueStats, StudentTuitionStats, CourseType, CourseSourceType, ServiceType } from '../types';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';

const { RangePicker } = DatePicker;
const { Title: TitleText } = Typography;

// 注册 Chart.js
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const RevenueStatistics: React.FC = () => {
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().startOf('year'),
    dayjs().endOf('year')
  ]);
  const [stats, setStats] = useState<RevenueStats | null>(null);
  const [studentStats, setStudentStats] = useState<StudentTuitionStats[]>([]);
  const [showChart, setShowChart] = useState<'bar' | 'pie' | 'line' | null>(null);
  const dbService = (window as any).dbService;

  const loadStats = async () => {
    const startDate = dateRange[0].format('YYYY-MM-DD');
    const endDate = dateRange[1].format('YYYY-MM-DD');
    
    const revenueStats = dbService.getRevenueStats(startDate, endDate);
    const studentTuitionStats = dbService.getStudentTuitionStats(startDate, endDate);
    
    setStats(revenueStats);
    setStudentStats(studentTuitionStats);
  };

  useEffect(() => {
    loadStats();
  }, [dateRange]);

  const courseTypeNames = { 1: '一对一', 2: '一对二', 3: '小组课', 4: '大班课' };
  const sourceTypeNames = { 1: '自有课程', 2: '机构排课', 3: '混合班' };
  const serviceTypeNames = { 1: '中心内', 2: '上门' };

  // 班型趋势图数据
  const courseTypeChartData = stats?.byCourseType ? {
    labels: stats.byCourseType.map(ct => ct.typeName),
    datasets: [{
      label: '收入（元）',
      data: stats.byCourseType.map(ct => ct.amount),
      backgroundColor: ['#1890ff', '#52c41a', '#faad14', '#f5222d'],
    }]
  } : null;

  // 课程来源占比图数据
  const sourceTypeChartData = stats?.bySourceType ? {
    labels: stats.bySourceType.map(st => st.sourceName),
    datasets: [{
      data: stats.bySourceType.map(st => st.percentage),
      backgroundColor: ['#1890ff', '#52c41a', '#faad14'],
    }]
  } : null;

  // 月度趋势图数据
  const monthTrendChartData = stats?.byMonth ? {
    labels: stats.byMonth.map(m => m.month),
    datasets: [{
      label: '月收入（元）',
      data: stats.byMonth.map(m => m.amount),
      borderColor: '#1890ff',
      backgroundColor: 'rgba(24, 144, 255, 0.2)',
      fill: true,
    }]
  } : null;

  // 学生学费统计表格
  const studentColumns = [
    { title: '学生姓名', dataIndex: 'studentName', key: 'studentName', width: 150 },
    { 
      title: '总学费', 
      dataIndex: 'total', 
      key: 'total',
      width: 120,
      render: (amount: number) => <Tag color="green">¥{amount.toFixed(2)}</Tag>
    },
    {
      title: '按班型分布',
      key: 'byCourseType',
      render: (_: any, record: StudentTuitionStats) => (
        <Space size="small">
          {record.byCourseType?.map(ct => (
            <Tag key={ct.type} color="blue">{ct.typeName}: ¥{ct.amount.toFixed(0)}</Tag>
          ))}
        </Space>
      )
    }
  ];

  return (
    <div>
      {/* 日期范围选择 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col>
            <Space>
              <span>统计范围：</span>
              <RangePicker 
                value={dateRange}
                onChange={(dates) => dates && setDateRange([dates[0] as dayjs.Dayjs, dates[1] as dayjs.Dayjs])}
              />
            </Space>
          </Col>
          <Col flex="auto" />
          <Col>
            <Space>
              <Button icon={<BarChartOutlined />} onClick={() => setShowChart('bar')}>班型收入图</Button>
              <Button icon={<PieChartOutlined />} onClick={() => setShowChart('pie')}>来源占比图</Button>
              <Button icon={<LineChartOutlined />} onClick={() => setShowChart('line')}>月度趋势图</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 总览统计 */}
      {stats && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Card>
              <Statistic 
                title="总收入" 
                value={stats.total} 
                precision={2}
                prefix="¥"
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic 
                title="完成课程数" 
                value={stats.byMonth?.reduce((sum, m) => sum + 1, 0) || 0}
                suffix="节"
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic 
                title="统计月份数" 
                value={stats.byMonth?.length || 0}
                suffix="个月"
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* 图表展示 */}
      {showChart && stats && (
        <Card 
          title={
            <Space>
              {showChart === 'bar' && <BarChartOutlined />}
              {showChart === 'pie' && <PieChartOutlined />}
              {showChart === 'line' && <LineChartOutlined />}
              {showChart === 'bar' && '班型收入分布'}
              {showChart === 'pie' && '课程来源占比'}
              {showChart === 'line' && '月度收入趋势'}
              <Button size="small" onClick={() => setShowChart(null)} style={{ marginLeft: 16 }}>关闭</Button>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          {showChart === 'bar' && courseTypeChartData && (
            <Bar data={courseTypeChartData} options={{ responsive: true, plugins: { legend: { display: false } } }} height={80} />
          )}
          {showChart === 'pie' && sourceTypeChartData && (
            <div style={{ maxWidth: 400, margin: '0 auto' }}>
              <Pie data={sourceTypeChartData} options={{ responsive: true, plugins: { legend: { position: 'bottom' } } }} />
            </div>
          )}
          {showChart === 'line' && monthTrendChartData && (
            <Line data={monthTrendChartData} options={{ responsive: true, plugins: { legend: { display: false } } }} height={80} />
          )}
        </Card>
      )}

      {/* 多维度统计表格 */}
      {stats && (
        <Row gutter={16}>
          <Col span={12}>
            <Card title="📊 按班型统计" size="small" style={{ marginBottom: 16 }}>
              <Table 
                columns={[
                  { title: '班型', dataIndex: 'typeName', key: 'typeName' },
                  { 
                    title: '收入', 
                    dataIndex: 'amount', 
                    key: 'amount',
                    render: (amount: number) => `¥${amount.toFixed(2)}`
                  },
                  { 
                    title: '占比', 
                    dataIndex: 'percentage', 
                    key: 'percentage',
                    render: (pct: number) => `${pct}%`
                  }
                ]}
                dataSource={stats.byCourseType}
                rowKey="typeName"
                pagination={false}
                size="small"
              />
            </Card>
          </Col>
          
          <Col span={12}>
            <Card title="🏢 按课程来源统计" size="small" style={{ marginBottom: 16 }}>
              <Table 
                columns={[
                  { title: '来源', dataIndex: 'sourceName', key: 'sourceName' },
                  { 
                    title: '收入', 
                    dataIndex: 'amount', 
                    key: 'amount',
                    render: (amount: number) => `¥${amount.toFixed(2)}`
                  },
                  { 
                    title: '占比', 
                    dataIndex: 'percentage', 
                    key: 'percentage',
                    render: (pct: number) => `${pct}%`
                  }
                ]}
                dataSource={stats.bySourceType}
                rowKey="sourceName"
                pagination={false}
                size="small"
              />
            </Card>
          </Col>
        </Row>
      )}

      {stats && stats.byServiceType && stats.byServiceType.length > 0 && (
        <Row gutter={16}>
          <Col span={12}>
            <Card title="🚗 按是否上门统计" size="small" style={{ marginBottom: 16 }}>
              <Table 
                columns={[
                  { title: '类型', dataIndex: 'serviceName', key: 'serviceName' },
                  { 
                    title: '收入', 
                    dataIndex: 'amount', 
                    key: 'amount',
                    render: (amount: number) => `¥${amount.toFixed(2)}`
                  },
                  { 
                    title: '占比', 
                    dataIndex: 'percentage', 
                    key: 'percentage',
                    render: (pct: number) => `${pct}%`
                  }
                ]}
                dataSource={stats.byServiceType}
                rowKey="serviceName"
                pagination={false}
                size="small"
              />
            </Card>
          </Col>
          
          {stats.byInstitution && stats.byInstitution.length > 0 && (
            <Col span={12}>
              <Card title="🏛️ 按机构统计" size="small" style={{ marginBottom: 16 }}>
                <Table 
                  columns={[
                    { title: '机构', dataIndex: 'institutionName', key: 'institutionName' },
                    { 
                      title: '收入', 
                      dataIndex: 'amount', 
                      key: 'amount',
                      render: (amount: number) => `¥${amount.toFixed(2)}`
                    },
                    { 
                      title: '占比', 
                      dataIndex: 'percentage', 
                      key: 'percentage',
                      render: (pct: number) => `${pct}%`
                    }
                  ]}
                  dataSource={stats.byInstitution}
                  rowKey="institutionName"
                  pagination={false}
                  size="small"
                />
              </Card>
            </Col>
          )}
        </Row>
      )}

      {/* 学生学费统计 */}
      <Card title="👨‍🎓 学生学费统计（按班型）" size="small">
        {studentStats.length > 0 ? (
          <Table 
            columns={studentColumns}
            dataSource={studentStats}
            rowKey="studentId"
            pagination={{ pageSize: 10 }}
            size="small"
          />
        ) : (
          <Empty description="暂无数据" />
        )}
      </Card>
    </div>
  );
};

export default RevenueStatistics;
