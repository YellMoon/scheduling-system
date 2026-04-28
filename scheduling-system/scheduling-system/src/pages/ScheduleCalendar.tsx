import React, { useState, useEffect } from 'react';
import { 
  Modal, Form, Input, Select, DatePicker, TimePicker, 
  Button, message, Card, Space, Radio, Divider, InputNumber, Row, Col, Tag, Popconfirm
} from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { CourseType, ScheduleStatus, Course, Student, Institution, ServiceType } from '../types';
import { commonDurations, calculateEndTime, getHolidayMark, checkIsHoliday, calculateDurationHours, calculateFees } from '../utils/helpers';
import weekOfYear from 'dayjs/plugin/weekOfYear';

dayjs.extend(weekOfYear);

const { Option } = Select;

interface ScheduleEvent {
  id: string;
  course_id: string;
  course_name: string;
  course_type: CourseType;
  start_time: string;
  end_time: string;
  status: ScheduleStatus;
  room?: string;
  student_ids?: string[];
  calculated_tuition?: number;
  calculated_teacher_fee?: number;
}

// 周视图组件 - 显示当周和下周
const WeekView: React.FC<{ schedules: ScheduleEvent[] }> = ({ schedules }) => {
  // 获取当周和下周
  const currentMonday = dayjs().startOf('week').add(1, 'day');
  const nextMonday = currentMonday.add(7, 'day');
  
  const weekDays: any[] = [];
  for (let i = 0; i < 7; i++) {
    weekDays.push(currentMonday.add(i, 'day'));
  }
  for (let i = 0; i < 7; i++) {
    weekDays.push(nextMonday.add(i, 'day'));
  }

  // 按天分组课程
  const schedulesByDay = weekDays.map(day => {
    const dateStr = day.format('YYYY-MM-DD');
    return schedules.filter(s => 
      s.start_time.startsWith(dateStr)
    );
  });

  // 显示 5 行课程（可滚动）
  const displayRows = 5;
  const weekDayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

  // 获取状态对应的样式
  const getStatusStyle = (status: ScheduleStatus) => {
    switch (status) {
      case ScheduleStatus.COMPLETED:
        return { background: '#f6ffed', border: '2px solid #52c41a' };
      case ScheduleStatus.LEAVE:
        return { background: '#fff7e6', border: '2px solid #faad14' };
      case ScheduleStatus.CANCELLED:
        return { background: '#fff1f0', border: '2px solid #f5222d' };
      default:
        return { background: '#e6f7ff', border: '2px solid #1890ff' };
    }
  };

  // 获取状态文字
  const getStatusText = (status: ScheduleStatus) => {
    switch (status) {
      case ScheduleStatus.COMPLETED:
        return '已结束';
      case ScheduleStatus.LEAVE:
        return '请假';
      case ScheduleStatus.CANCELLED:
        return '取消';
      default:
        return '';
    }
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      {/* 当周 */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 12, color: '#1890ff' }}>📅 本周课程（{currentMonday.format('MM 月 DD 日')} - {currentMonday.add(6, 'day').format('MM 月 DD 日')}）</h3>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: `repeat(7, 1fr)`,
          gap: '1px',
          background: '#d9d9d9',
          border: '2px solid #d9d9d9',
          borderRadius: 8
        }}>
          {/* 表头 */}
          {weekDays.slice(0, 7).map((day, idx) => {
            const { isHoliday, holidayName } = checkIsHoliday(day.format('YYYY-MM-DD'));
            return (
              <div key={idx} style={{ 
                padding: '12px 8px', 
                background: isHoliday ? '#fff1f0' : '#1890ff',
                color: isHoliday ? '#f5222d' : 'white',
                textAlign: 'center',
                fontWeight: 'bold',
                fontSize: 16
              }}>
                <div>{weekDayNames[idx]}</div>
                <div style={{ fontSize: 14, fontWeight: 'normal', marginTop: 4 }}>
                  {day.format('MM 月 DD 日')}
                </div>
                {isHoliday && (
                  <div style={{ fontSize: 12, marginTop: 4 }}>🏠 {holidayName}</div>
                )}
              </div>
            );
          })}

          {/* 课程网格 - 5 行 */}
          {Array.from({ length: displayRows }).map((_, rowIdx) => (
            <React.Fragment key={rowIdx}>
              {weekDays.slice(0, 7).map((day, dayIdx) => {
                const dateStr = day.format('YYYY-MM-DD');
                const daySchedules = schedules.filter(s => 
                  s.start_time.startsWith(dateStr) && s.status !== ScheduleStatus.CANCELLED
                );
                const schedule = daySchedules[rowIdx];

                return (
                  <div key={dayIdx} style={{ 
                    minHeight: 80,
                    padding: '6px',
                    background: rowIdx % 2 === 0 ? '#fafafa' : 'white',
                    border: '1px solid #f0f0f0'
                  }}>
                    {schedule && (
                      <div style={{
                        ...getStatusStyle(schedule.status),
                        borderRadius: 6,
                        padding: '8px',
                        textAlign: 'center',
                        position: 'relative'
                      }}>
                        <div style={{ 
                          fontSize: 14, 
                          fontWeight: 'bold',
                          color: '#1890ff',
                          marginBottom: 4
                        }}>
                          {schedule.course_name}
                        </div>
                        {schedule.room && (
                          <div style={{ 
                            fontSize: 12, 
                            color: '#52c41a',
                            marginBottom: 2
                          }}>
                            📍 {schedule.room}
                          </div>
                        )}
                        <div style={{ 
                          fontSize: 12, 
                          color: '#666',
                          borderTop: '1px dashed #1890ff',
                          paddingTop: 4
                        }}>
                          {schedule.start_time.split(' ')[1].substr(0,5)} - {schedule.end_time.split(' ')[1].substr(0,5)}
                        </div>
                        {getStatusText(schedule.status) && (
                          <Tag color={schedule.status === ScheduleStatus.COMPLETED ? 'green' : schedule.status === ScheduleStatus.LEAVE ? 'orange' : 'red'} 
                               style={{ position: 'absolute', top: 2, right: 2, fontSize: 10 }}>
                            {getStatusText(schedule.status)}
                          </Tag>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* 下周 */}
      <div>
        <h3 style={{ marginBottom: 12, color: '#52c41a' }}>📅 下周课程（{nextMonday.format('MM 月 DD 日')} - {nextMonday.add(6, 'day').format('MM 月 DD 日')}）</h3>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: `repeat(7, 1fr)`,
          gap: '1px',
          background: '#d9d9d9',
          border: '2px solid #d9d9d9',
          borderRadius: 8
        }}>
          {/* 表头 */}
          {weekDays.slice(7, 14).map((day, idx) => {
            const { isHoliday, holidayName } = checkIsHoliday(day.format('YYYY-MM-DD'));
            return (
              <div key={idx} style={{ 
                padding: '12px 8px', 
                background: isHoliday ? '#fff1f0' : '#52c41a',
                color: isHoliday ? '#f5222d' : 'white',
                textAlign: 'center',
                fontWeight: 'bold',
                fontSize: 16
              }}>
                <div>{weekDayNames[idx]}</div>
                <div style={{ fontSize: 14, fontWeight: 'normal', marginTop: 4 }}>
                  {day.format('MM 月 DD 日')}
                </div>
                {isHoliday && (
                  <div style={{ fontSize: 12, marginTop: 4 }}>🏠 {holidayName}</div>
                )}
              </div>
            );
          })}

          {/* 课程网格 - 5 行 */}
          {Array.from({ length: displayRows }).map((_, rowIdx) => (
            <React.Fragment key={rowIdx}>
              {weekDays.slice(7, 14).map((day, dayIdx) => {
                const dateStr = day.format('YYYY-MM-DD');
                const daySchedules = schedules.filter(s => 
                  s.start_time.startsWith(dateStr) && s.status !== ScheduleStatus.CANCELLED
                );
                const schedule = daySchedules[rowIdx];

                return (
                  <div key={dayIdx} style={{ 
                    minHeight: 80,
                    padding: '6px',
                    background: rowIdx % 2 === 0 ? '#fafafa' : 'white',
                    border: '1px solid #f0f0f0'
                  }}>
                    {schedule && (
                      <div style={{
                        ...getStatusStyle(schedule.status),
                        borderRadius: 6,
                        padding: '8px',
                        textAlign: 'center',
                        position: 'relative'
                      }}>
                        <div style={{ 
                          fontSize: 14, 
                          fontWeight: 'bold',
                          color: '#1890ff',
                          marginBottom: 4
                        }}>
                          {schedule.course_name}
                        </div>
                        {schedule.room && (
                          <div style={{ 
                            fontSize: 12, 
                            color: '#52c41a',
                            marginBottom: 2
                          }}>
                            📍 {schedule.room}
                          </div>
                        )}
                        <div style={{ 
                          fontSize: 12, 
                          color: '#666',
                          borderTop: '1px dashed #1890ff',
                          paddingTop: 4
                        }}>
                          {schedule.start_time.split(' ')[1].substr(0,5)} - {schedule.end_time.split(' ')[1].substr(0,5)}
                        </div>
                        {getStatusText(schedule.status) && (
                          <Tag color={schedule.status === ScheduleStatus.COMPLETED ? 'green' : schedule.status === ScheduleStatus.LEAVE ? 'orange' : 'red'} 
                               style={{ position: 'absolute', top: 2, right: 2, fontSize: 10 }}>
                            {getStatusText(schedule.status)}
                          </Tag>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

const ScheduleCalendar: React.FC = () => {
  const [schedules, setSchedules] = useState<ScheduleEvent[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [form] = Form.useForm();
  const dbService = (window as any).dbService;

  const loadData = async () => {
    const schedulesData = dbService.getAllSchedules();
    const coursesData = dbService.getAllCourses();
    const studentsData = dbService.getAllStudents();
    const institutionsData = dbService.getAllInstitutions();
    
    const schedulesWithCourse = schedulesData.map((s: ScheduleEvent) => {
      const course = coursesData.find((c: Course) => c.id === s.course_id);
      return {
        ...s,
        course_name: course?.name || '未知课程',
        course_type: course?.type || CourseType.ONE_ON_ONE
      };
    });
    
    setSchedules(schedulesWithCourse);
    setCourses(coursesData);
    setStudents(studentsData);
    setInstitutions(institutionsData);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddSchedule = () => {
    form.resetFields();
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const { date, start_time, end_time, course_id, room, student_ids, notes } = values;
      
      const course = courses.find(c => c.id === course_id);
      const durationHours = calculateDurationHours(
        start_time.format('HH:mm'),
        end_time.format('HH:mm')
      );
      
      let calculated_tuition = 0;
      let calculated_teacher_fee = 0;
      
      if (course) {
        const fees = calculateFees(
          course.price_tuition,
          course.price_teacher,
          course.billing_unit,
          durationHours,
          course.teacher_fee_mode,
          student_ids?.length || 1
        );
        calculated_tuition = fees.tuition;
        calculated_teacher_fee = fees.teacherFee;
      }
      
      const schedule = {
        course_id,
        start_time: date.format('YYYY-MM-DD') + ' ' + start_time.format('HH:mm:ss'),
        end_time: date.format('YYYY-MM-DD') + ' ' + end_time.format('HH:mm:ss'),
        status: ScheduleStatus.PLANNED,
        room,
        student_ids,
        calculated_tuition,
        calculated_teacher_fee,
        notes
      };
      
      const conflicts = dbService.checkTimeConflict(schedule.start_time, schedule.end_time);
      if (conflicts.length > 0) {
        message.warning('时间冲突！该时段已有其他课程安排');
        return;
      }
      
      dbService.createSchedule(schedule);
      message.success('排课成功');
      setModalVisible(false);
      loadData();
    } catch (error: any) {
      console.error('验证失败:', error);
    }
  };

  const handleUpdateStatus = async (id: string, status: ScheduleStatus) => {
    dbService.updateSchedule(id, { status });
    message.success('状态已更新');
    loadData();
  };

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space size="large">
            <span>📅 课程总数：<strong>{schedules.length}</strong></span>
            <span>✅ 已完成：<strong>{schedules.filter(s => s.status === ScheduleStatus.COMPLETED).length}</strong></span>
            <span>📋 计划中：<strong>{schedules.filter(s => s.status === ScheduleStatus.PLANNED).length}</strong></span>
            <span>🏠 请假：<strong>{schedules.filter(s => s.status === ScheduleStatus.LEAVE).length}</strong></span>
          </Space>
          <Button type="primary" onClick={handleAddSchedule}>+ 添加课程</Button>
        </div>
      </Card>

      <Card>
        <WeekView schedules={schedules} />
      </Card>

      <Modal
        title="添加课程安排"
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={700}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="course_id" label="选择课程" rules={[{ required: true, message: '请选择课程' }]}>
            <Select placeholder="请选择课程" showSearch optionFilterProp="children">
              {courses.map(course => (
                <Option key={course.id} value={course.id}>
                  {course.name} - {courseTypeMap[course.type]}
                  {course.room && ` (${course.room})`}
                </Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item name="date" label="上课日期" rules={[{ required: true, message: '请选择日期' }]}>
            <DatePicker 
              style={{ width: '100%' }} 
              disabledDate={(d) => d.isBefore(dayjs(), 'day')}
              onChange={(date) => {
                if (date) {
                  const holidayMark = getHolidayMark(date.format('YYYY-MM-DD'));
                  if (holidayMark) {
                    message.warning(holidayMark + '，请确认是否安排课程');
                  }
                }
              }}
            />
          </Form.Item>
          
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="start_time" label="开始时间" rules={[{ required: true, message: '请选择开始时间' }]}>
                <TimePicker 
                  style={{ width: '100%' }} 
                  format="HH:mm" 
                  onChange={(time) => {
                    if (time) {
                      const duration = form.getFieldValue('duration');
                      if (duration) {
                        const endTime = calculateEndTime(time.format('HH:mm'), duration);
                        form.setFieldValue('end_time', dayjs(endTime, 'HH:mm'));
                      }
                    }
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="duration" label="课程时长">
                <Select 
                  placeholder="选择时长"
                  onChange={(value) => {
                    const startTime = form.getFieldValue('start_time');
                    if (startTime) {
                      const endTime = calculateEndTime(startTime.format('HH:mm'), value);
                      form.setFieldValue('end_time', dayjs(endTime, 'HH:mm'));
                    }
                  }}
                >
                  {commonDurations.map(d => (
                    <Option key={d.value} value={d.value}>{d.label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="end_time" label="结束时间" rules={[{ required: true, message: '请选择结束时间' }]}>
                <TimePicker style={{ width: '100%' }} format="HH:mm" />
              </Form.Item>
            </Col>
          </Row>
          
          <Divider>费用信息（自动计算）</Divider>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="calculated_tuition" label="本次学费">
                <InputNumber disabled style={{ width: '100%' }} prefix="¥" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="calculated_teacher_fee" label="本次课时费">
                <InputNumber disabled style={{ width: '100%' }} prefix="¥" />
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item name="room" label="上课地址">
            <Select 
              placeholder="选择或输入地址"
              showSearch
              allowClear
              mode="tags"
              style={{ width: '100%' }}
            >
              <Option value="线上">线上</Option>
              <Option value="教室 A">教室 A</Option>
              <Option value="教室 B">教室 B</Option>
            </Select>
          </Form.Item>
          
          <Form.Item name="student_ids" label="上课学生">
            <Select 
              placeholder="选择学生（可多选）"
              mode="multiple"
              showSearch
              optionFilterProp="children"
              style={{ width: '100%' }}
            >
              {students.map(student => (
                <Option key={student.id} value={student.id}>
                  {student.name} ({student.grade_current})
                </Option>
              ))}
            </Select>
          </Form.Item>
          
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={2} placeholder="其他备注信息" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

const courseTypeMap: Record<CourseType, string> = {
  [CourseType.ONE_ON_ONE]: '一对一',
  [CourseType.ONE_ON_TWO]: '一对二',
  [CourseType.GROUP]: '小组课',
  [CourseType.LARGE_CLASS]: '大班课',
};

export default ScheduleCalendar;
