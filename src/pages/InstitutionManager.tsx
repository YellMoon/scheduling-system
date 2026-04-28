import React, { useState, useEffect } from 'react';
import { 
  Table, Button, Modal, Form, Input, InputNumber,
  Space, message, Popconfirm, Card, Row, Col, Statistic, Divider
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { Institution } from '../types';

const InstitutionManager: React.FC = () => {
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingInst, setEditingInst] = useState<Institution | null>(null);
  const [form] = Form.useForm();
  const dbService = (window as any).dbService;

  const loadInstitutions = async () => {
    if (!dbService) {
      console.warn('dbService not available yet');
      return;
    }
    const data = dbService.getAllInstitutions();
    const studentsData = dbService.getAllStudents();
    const coursesData = dbService.getAllCourses();
    setInstitutions(data);
    setStudents(studentsData);
    setCourses(coursesData);
  };

  useEffect(() => {
    loadInstitutions();
  }, []);

  const handleAdd = () => {
    setEditingInst(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (inst: Institution) => {
    setEditingInst(inst);
    form.setFieldsValue(inst);
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    dbService.deleteInstitution(id);
    message.success('删除成功');
    loadInstitutions();
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingInst) {
        dbService.updateInstitution(editingInst.id, values);
        message.success('更新成功');
      } else {
        dbService.createInstitution(values);
        message.success('添加成功');
      }
      setModalVisible(false);
      loadInstitutions();
    } catch (error: any) {
      console.error('验证失败:', error);
    }
  };

  const columns: ColumnsType<Institution> = [
    { title: '机构名称', dataIndex: 'name', key: 'name', width: 200 },
    { title: '联系人', dataIndex: 'contact_person', key: 'contact_person', width: 100 },
    { title: '联系电话', dataIndex: 'contact_phone', key: 'contact_phone', width: 130 },
    { 
      title: '分成比例', 
      dataIndex: 'revenue_share', 
      key: 'revenue_share',
      width: 100,
      render: (share?: number) => share ? `${share}%` : '-'
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

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={8}>
            <Statistic 
              title="机构总数" 
              value={institutions.length} 
              prefix="🏢"
            />
          </Col>
          <Col span={8}>
            <Statistic 
              title="机构关联学生数" 
              value={students.filter((s: any) => s.institution_id).length} 
              prefix="👨‍🎓"
            />
          </Col>
          <Col span={8}>
            <Statistic 
              title="机构关联课程数" 
              value={courses.filter((c: any) => c.institution_id).length} 
              prefix="📚"
            />
          </Col>
        </Row>
      </Card>
      
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>添加机构</Button>
        </div>
        
        <Table 
          columns={columns} 
          dataSource={institutions} 
          rowKey="id"
          pagination={{ pageSize: 20 }}
        />
      </Card>

      <Modal
        title={editingInst ? '编辑机构' : '添加机构'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="机构名称" rules={[{ required: true, message: '请输入机构名称' }]}>
            <Input placeholder="请输入机构名称" />
          </Form.Item>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="contact_person" label="联系人">
                <Input placeholder="联系人姓名" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="contact_phone" label="联系电话">
                <Input placeholder="联系电话" />
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item name="revenue_share" label="分成比例（%）" initialValue={30}>
            <InputNumber min={0} max={100} style={{ width: '100%' }} suffix="%" />
          </Form.Item>
          
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={3} placeholder="其他备注信息" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default InstitutionManager;
