import React, { useState, useEffect } from 'react';
import { 
  Table, Button, Modal, Form, Input, InputNumber, Select, 
  Space, message, Popconfirm, Tag, Card, Row, Col, Alert, Divider
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, BankOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { Course, CourseType, CourseSourceType, Institution, BillingUnit, TeacherFeeMode, ServiceType } from '../types';
import { holidays2026 } from '../utils/helpers';

const { Option } = Select;

const courseTypeMap: Record<CourseType, string> = {
  [CourseType.ONE_ON_ONE]: '一对一',
  [CourseType.ONE_ON_TWO]: '一对二',
  [CourseType.GROUP]: '小组课',
  [CourseType.LARGE_CLASS]: '大班课',
};

const courseSourceTypeMap: Record<CourseSourceType, string> = {
  [CourseSourceType.SELF]: '自有课程',
  [CourseSourceType.INSTITUTION]: '机构排课',
  [CourseSourceType.MIXED]: '混合班',
};

const billingUnitMap: Record<BillingUnit, string> = {
  [BillingUnit.PER_HOUR]: '元/小时',
  [BillingUnit.PER_SESSION]: '元/次',
};

const teacherFeeModeMap: Record<TeacherFeeMode, string> = {
  [TeacherFeeMode.PER_SESSION]: '按一次课',
  [TeacherFeeMode.PER_STUDENT]: '按学生分摊',
};

const serviceTypeMap: Record<ServiceType, string> = {
  [ServiceType.IN_CENTER]: '中心内',
  [ServiceType.AT_HOME]: '上门',
};

const CourseList: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [form] = Form.useForm();
  const dbService = (window as any).dbService;

  const loadData = async () => {
    const coursesData = dbService.getAllCourses();
    const institutionsData = dbService.getAllInstitutions();
    setCourses(coursesData);
    setInstitutions(institutionsData);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAdd = () => {
    setEditingCourse(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (course: Course) => {
    setEditingCourse(course);
    form.setFieldsValue(course);
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    dbService.deleteCourse(id);
    message.success('删除成功');
    loadData();
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingCourse) {
        dbService.updateCourse(editingCourse.id, values);
        message.success('更新成功');
      } else {
        dbService.createCourse(values);
        message.success('添加成功');
      }
      setModalVisible(false);
      loadData();
    } catch (error: any) {
      console.error('验证失败:', error);
    }
  };

  const columns: ColumnsType<Course> = [
    { title: '课程名称', dataIndex: 'name', key: 'name', width: 180 },
    { 
      title: '课程类型', 
      dataIndex: 'type', 
      key: 'type',
      width: 90,
      render: (type: CourseType) => <Tag color="blue">{courseTypeMap[type]}</Tag>
    },
    { 
      title: '课程来源', 
      dataIndex: 'source_type', 
      key: 'source_type',
      width: 100,
      render: (sourceType: CourseSourceType) => (
        <Tag color={sourceType === CourseSourceType.SELF ? 'green' : 'orange'}>
          {courseSourceTypeMap[sourceType]}
        </Tag>
      )
    },
    { 
      title: '学费', 
      dataIndex: 'price_tuition', 
      key: 'price_tuition',
      width: 100,
      render: (price: number, record: Course) => {
        const unit = billingUnitMap[record.billing_unit];
        return `¥${price}${unit}`;
      }
    },
    { 
      title: '课时费', 
      dataIndex: 'price_teacher', 
      key: 'price_teacher',
      width: 100,
      render: (price: number, record: Course) => {
        const mode = teacherFeeModeMap[record.teacher_fee_mode];
        const unit = billingUnitMap[record.billing_unit];
        return `¥${price}${unit} (${mode})`;
      }
    },
    { 
      title: '服务类型',
      dataIndex: 'service_type',
      key: 'service_type',
      width: 80,
      render: (type?: ServiceType) => (
        <Tag color={type === ServiceType.AT_HOME ? 'purple' : 'green'}>
          {serviceTypeMap[type || ServiceType.IN_CENTER]}
        </Tag>
      )
    },
    { title: '教室', dataIndex: 'room', key: 'room', width: 100 },
    { title: '老师', dataIndex: 'teacher_name', key: 'teacher_name', width: 100 },
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
        icon={<BankOutlined />}
        style={{ marginBottom: 16 }}
      />

      <Card>
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>添加课程</Button>
            <Button icon={<BankOutlined />} onClick={() => window.location.hash = '#institutions'}>管理机构</Button>
          </Space>
        </div>
        
        <Table 
          columns={columns} 
          dataSource={courses} 
          rowKey="id"
          pagination={{ pageSize: 20 }}
          scroll={{ x: 1400 }}
        />
      </Card>

      <Modal
        title={editingCourse ? '编辑课程' : '添加课程'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={750}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="课程名称" rules={[{ required: true, message: '请输入课程名称' }]}>
            <Input placeholder="请输入课程名称" />
          </Form.Item>
          
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="type" label="课程类型" rules={[{ required: true, message: '请选择课程类型' }]}>
                <Select placeholder="请选择">
                  <Option value={CourseType.ONE_ON_ONE}>一对一</Option>
                  <Option value={CourseType.ONE_ON_TWO}>一对二</Option>
                  <Option value={CourseType.GROUP}>小组课</Option>
                  <Option value={CourseType.LARGE_CLASS}>大班课</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="source_type" label="课程来源" rules={[{ required: true, message: '请选择课程来源' }]}>
                <Select placeholder="请选择">
                  <Option value={CourseSourceType.SELF}>自有课程</Option>
                  <Option value={CourseSourceType.INSTITUTION}>机构排课</Option>
                  <Option value={CourseSourceType.MIXED}>混合班</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="service_type" label="服务类型" initialValue={ServiceType.IN_CENTER}>
                <Select placeholder="请选择">
                  <Option value={ServiceType.IN_CENTER}>中心内</Option>
                  <Option value={ServiceType.AT_HOME}>上门</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          {form.getFieldValue('source_type') === CourseSourceType.INSTITUTION && (
            <Form.Item name="institution_id" label="所属机构">
              <Select placeholder="请选择机构" allowClear>
                {institutions.map(inst => (
                  <Option key={inst.id} value={inst.id}>{inst.name}</Option>
                ))}
              </Select>
            </Form.Item>
          )}
          
          <Divider>费用设置</Divider>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="billing_unit" label="计费单位" initialValue={BillingUnit.PER_HOUR}>
                <Select placeholder="请选择">
                  <Option value={BillingUnit.PER_HOUR}>按小时计费</Option>
                  <Option value={BillingUnit.PER_SESSION}>按次课计费</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="teacher_fee_mode" label="课时费计算方式" initialValue={TeacherFeeMode.PER_SESSION}>
                <Select placeholder="请选择">
                  <Option value={TeacherFeeMode.PER_SESSION}>按一次课计算</Option>
                  <Option value={TeacherFeeMode.PER_STUDENT}>按学生分摊</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="price_tuition" label="学费（学生交费）" initialValue={0}>
                <InputNumber min={0} style={{ width: '100%' }} prefix="¥" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="price_teacher" label="课时费（老师到手）" initialValue={0}>
                <InputNumber min={0} style={{ width: '100%' }} prefix="¥" />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="room" label="默认上课地址">
                <Input placeholder="如：教室 A" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="teacher_name" label="老师姓名">
                <Input placeholder="老师姓名" />
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

export default CourseList;
