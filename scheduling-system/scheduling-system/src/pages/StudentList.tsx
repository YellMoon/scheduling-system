import React, { useState, useEffect } from 'react';
import { 
  Table, Button, Modal, Form, Input, InputNumber, Select, 
  Space, message, Popconfirm, Tag, Card, Row, Col, Alert, Divider, Statistic
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, WarningOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { Student, StudentSource, Institution } from '../types';
import { holidays2026, calculateGrade } from '../utils/helpers';

const { Option } = Select;

const StudentList: React.FC = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [schools, setSchools] = useState<string[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [form] = Form.useForm();
  const dbService = (window as any).dbService;

  const loadData = async () => {
    const studentsData = dbService.getAllStudents();
    const institutionsData = dbService.getAllInstitutions();
    
    // 提取所有学校（去重）
    const schoolSet = new Set(studentsData.map((s: Student) => s.school).filter(Boolean));
    
    setStudents(studentsData);
    setInstitutions(institutionsData);
    setSchools(Array.from(schoolSet));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAdd = () => {
    setEditingStudent(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    form.setFieldsValue({
      ...student,
      grade_year: student.grade_year || new Date().getFullYear()
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    dbService.deleteStudent(id);
    message.success('删除成功');
    loadData();
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingStudent) {
        dbService.updateStudent(editingStudent.id, values);
        message.success('更新成功');
      } else {
        dbService.createStudent(values);
        message.success('添加成功');
      }
      setModalVisible(false);
      loadData();
    } catch (error: any) {
      console.error('验证失败:', error);
    }
  };

  const columns: ColumnsType<Student> = [
    { title: '姓名', dataIndex: 'name', key: 'name', width: 100 },
    { title: '联系电话', dataIndex: 'phone', key: 'phone', width: 130 },
    { title: '学校', dataIndex: 'school', key: 'school', width: 150 },
    { 
      title: '入学年份', 
      dataIndex: 'grade_year', 
      key: 'grade_year',
      width: 90,
      render: (year?: number) => year ? `${year}级` : '-'
    },
    { 
      title: '当前年级', 
      dataIndex: 'grade_current', 
      key: 'grade_current',
      width: 90,
      render: (grade?: string) => <Tag color="blue">{grade || '未设置'}</Tag>
    },
    { 
      title: '生源类型', 
      dataIndex: 'source_type', 
      key: 'source_type',
      width: 90,
      render: (type?: StudentSource) => (
        <Tag color={type === StudentSource.SELF ? 'green' : 'orange'}>
          {type === StudentSource.SELF ? '自有' : '机构'}
        </Tag>
      )
    },
    { 
      title: '剩余课时', 
      dataIndex: 'balance_hours', 
      key: 'balance_hours',
      width: 90,
      render: (hours: number) => (
        <Tag color={hours < 5 ? 'red' : 'green'}>{hours}课时</Tag>
      )
    },
    { 
      title: '账户余额', 
      dataIndex: 'balance_money', 
      key: 'balance_money',
      width: 100,
      render: (money: number) => `¥${money.toFixed(2)}`
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除吗？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const currentYear = new Date().getFullYear();
  const gradeYears = Array.from({ length: 6 }, (_, i) => currentYear - i);

  return (
    <div>
      <Alert
        message="📅 近期法定节假日提醒"
        description={
          <div style={{ lineHeight: '1.8' }}>
            {holidays2026.slice(0, 4).map((h, idx) => (
              <span key={h.name} style={{ marginRight: 16 }}>
                {h.name}：{h.start} ~ {h.end}
                {idx < 3 && ' | '}
              </span>
            ))}
          </div>
        }
        type="info"
        showIcon
        icon={<WarningOutlined />}
        style={{ marginBottom: 16 }}
      />

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Statistic title="学生总数" value={students.length} prefix="👨‍🎓" />
          </Col>
          <Col span={6}>
            <Statistic 
              title="总剩余课时" 
              value={students.reduce((sum, s) => sum + s.balance_hours, 0)} 
              suffix="课时"
            />
          </Col>
          <Col span={6}>
            <Statistic 
              title="总账户余额" 
              value={students.reduce((sum, s) => sum + s.balance_money, 0)} 
              prefix="¥"
            />
          </Col>
          <Col span={6}>
            <Statistic 
              title="已存储学校" 
              value={schools.length} 
              suffix="所"
            />
          </Col>
        </Row>
      </Card>

      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>添加学生</Button>
        </div>
        
        <Table 
          columns={columns} 
          dataSource={students} 
          rowKey="id"
          pagination={{ pageSize: 20 }}
          scroll={{ x: 1200 }}
        />
      </Card>

      <Modal
        title={editingStudent ? '编辑学生' : '添加学生'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={700}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
                <Input placeholder="请输入学生姓名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="phone" label="联系电话">
                <Input placeholder="请输入联系电话" />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="school" label="学校">
                <Select 
                  placeholder="请选择或输入学校"
                  showSearch
                  allowClear
                  mode="tags"
                  options={schools.map(s => ({ label: s, value: s }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="grade_year" label="入学年份" rules={[{ required: true, message: '请选择入学年份' }]}>
                <Select placeholder="请选择入学年份">
                  {gradeYears.map(year => (
                    <Option key={year} value={year}>{year}级</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Divider>生源信息</Divider>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="source_type" label="生源类型" initialValue={StudentSource.SELF}>
                <Select placeholder="请选择">
                  <Option value={StudentSource.SELF}>自有生源</Option>
                  <Option value={StudentSource.INSTITUTION}>机构生源</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="institution_id" label="所属机构">
                <Select placeholder="请选择机构" allowClear>
                  {institutions.map(inst => (
                    <Option key={inst.id} value={inst.id}>{inst.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="balance_hours" label="剩余课时" initialValue={0}>
                <InputNumber min={0} step={0.5} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="balance_money" label="账户余额" initialValue={0}>
                <InputNumber min={0} step={100} style={{ width: '100%' }} prefix="¥" />
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={3} placeholder="其他备注信息" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default StudentList;
