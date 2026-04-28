// 数据库服务层 v1.3 - 支持学生来源、学校存储、课程状态
import { 
  Student, Grade, Course, Schedule, Enrollment, Payment, Consumption, Institution, SchoolInfo, Teacher, Room,
  ScheduleStatus, PaymentType, BillingUnit, TeacherFeeMode, ServiceType, StudentSource,
  RevenueStats, StudentTuitionStats, StudentCoursePricing
} from '../types';
import { calculateGrade, calculateFees, calculateDurationHours, groupByMonth, calculatePercentage } from '../utils/helpers';

interface Database {
  students: Student[];
  grades: Grade[];
  courses: Course[];
  schedules: Schedule[];
  enrollments: Enrollment[];
  payments: Payment[];
  consumptions: Consumption[];
  institutions: Institution[];
  schools: SchoolInfo[];
  rooms: Room[];
  teachers: Teacher[];
}

class BrowserDatabaseService {
  private storageKey = 'scheduling_system_db_v3';
  private data: Database = {
    students: [],
    grades: [],
    courses: [],
    schedules: [],
    enrollments: [],
    payments: [],
    consumptions: [],
    institutions: [],
    schools: [],
    rooms: [],
    teachers: []
  };

  constructor() {
    this.loadData();
  }

  private loadData(): void {
    const stored = localStorage.getItem(this.storageKey);
    if (stored) {
      const loadedData = JSON.parse(stored);
      // 合并数据，确保所有数组字段都存在，旧版本数据缺失就用 []
      this.data = {
        students: [],
        grades: [],
        courses: [],
        schedules: [],
        enrollments: [],
        payments: [],
        consumptions: [],
        institutions: [],
        schools: [],
        rooms: [],
        teachers: [],
        ...loadedData
      };
    }
    // 自动更新学生年级
    this.data.students = (this.data.students || []).map(s => ({
      ...s,
      grade_current: calculateGrade(s.grade_year)
    }));
  }

  private saveData(): void {
    localStorage.setItem(this.storageKey, JSON.stringify(this.data));
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // ========== 学校信息管理 ==========
  
  getAllSchools(): SchoolInfo[] {
    return this.data.schools;
  }

  // ========== 教室/地址管理 ==========
  
  getAllRooms(): Room[] {
    return this.data.rooms;
  }

  addOrUpdateRoom(roomName: string, address?: string): void {
    const existing = this.data.rooms.find(s => s.name === roomName);
    if (existing) {
      existing.count++;
      existing.updated_at = new Date().toISOString();
      if (address) existing.address = address;
    } else {
      this.data.rooms.push({
        id: this.generateId(),
        name: roomName,
        address: address || '',
        count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
    this.saveData();
  }

  // ========== 学校信息管理 ==========

  getSchoolNames(): string[] {
    return this.data.schools.map(s => s.name).sort();
  }

  addOrUpdateSchool(schoolName: string): void {
    const existing = this.data.schools.find(s => s.name === schoolName);
    if (existing) {
      existing.count++;
      existing.updated_at = new Date().toISOString();
    } else {
      this.data.schools.push({
        id: this.generateId(),
        name: schoolName,
        count: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    }
    this.saveData();
  }

  // ========== 机构管理 ==========
  
  getAllInstitutions(): Institution[] {
    return this.data.institutions;
  }

  createInstitution(institution: Omit<Institution, 'id' | 'created_at'>): Institution {
    const now = new Date().toISOString();
    const newInstitution: Institution = {
      ...institution,
      id: this.generateId(),
      created_at: now
    };
    this.data.institutions.push(newInstitution);
    this.saveData();
    return newInstitution;
  }

  updateInstitution(id: string, updates: Partial<Institution>): Institution | undefined {
    const index = this.data.institutions.findIndex(i => i.id === id);
    if (index === -1) return undefined;
    this.data.institutions[index] = { ...this.data.institutions[index], ...updates };
    this.saveData();
    return this.data.institutions[index];
  }

  deleteInstitution(id: string): boolean {
    const index = this.data.institutions.findIndex(i => i.id === id);
    if (index === -1) return false;
    this.data.institutions.splice(index, 1);
    this.saveData();
    return true;
  }

  // ========== 学生管理 ==========
  
  getAllStudents(): Student[] {
    return this.data.students;
  }

  getStudentById(id: string): Student | undefined {
    return this.data.students.find(s => s.id === id);
  }

  createStudent(student: Omit<Student, 'id' | 'created_at' | 'updated_at'>): Student {
    const now = new Date().toISOString();
    const newStudent: Student = {
      ...student,
      id: this.generateId(),
      grade_current: calculateGrade(student.grade_year),
      created_at: now,
      updated_at: now
    };
    
    // 如果提供了学校，添加到学校库
    if (student.school) {
      this.addOrUpdateSchool(student.school);
    }
    
    this.data.students.push(newStudent);
    this.saveData();
    return newStudent;
  }

  updateStudent(id: string, updates: Partial<Student>): Student | undefined {
    const index = this.data.students.findIndex(s => s.id === id);
    if (index === -1) return undefined;
    
    const updated = {
      ...this.data.students[index],
      ...updates,
      updated_at: new Date().toISOString()
    };
    
    // 如果更新了入学年份，重新计算年级
    if (updates.grade_year) {
      updated.grade_current = calculateGrade(updates.grade_year);
    }
    
    // 如果提供了新学校，添加到学校库
    if (updates.school && updates.school !== this.data.students[index].school) {
      this.addOrUpdateSchool(updates.school);
    }
    
    this.data.students[index] = updated;
    this.saveData();
    return updated;
  }

  deleteStudent(id: string): boolean {
    const index = this.data.students.findIndex(s => s.id === id);
    if (index === -1) return false;
    this.data.students.splice(index, 1);
    this.saveData();
    return true;
  }

  // ========== 课程管理 ==========
  
  getAllCourses(): Course[] {
    return this.data.courses;
  }

  getCourseById(id: string): Course | undefined {
    return this.data.courses.find(c => c.id === id);
  }

  createCourse(course: Omit<Course, 'id' | 'created_at' | 'updated_at'>): Course {
    const now = new Date().toISOString();
    const newCourse: Course = {
      ...course,
      id: this.generateId(),
      created_at: now,
      updated_at: now
    };
    // 如果提供了新教室名称，自动添加到教室库
    if (newCourse.room_name && !this.data.rooms.find(r => r.name === newCourse.room_name)) {
      this.addOrUpdateRoom(newCourse.room_name);
    }
    this.data.courses.push(newCourse);
    this.saveData();
    return newCourse;
  }

  updateCourse(id: string, updates: Partial<Course>): Course | undefined {
    const index = this.data.courses.findIndex(c => c.id === id);
    if (index === -1) return undefined;
    
    this.data.courses[index] = {
      ...this.data.courses[index],
      ...updates,
      updated_at: new Date().toISOString()
    };
    // 如果更新了新教室名称，自动添加到教室库
    if (updates.room_name && !this.data.rooms.find(r => r.name === updates.room_name)) {
      this.addOrUpdateRoom(updates.room_name);
    }
    this.saveData();
    return this.data.courses[index];
  }

  deleteCourse(id: string): boolean {
    const index = this.data.courses.findIndex(c => c.id === id);
    if (index === -1) return false;
    this.data.courses.splice(index, 1);
    this.saveData();
    return true;
  }

  // ========== 排课管理 ==========
  
  getAllSchedules(): Schedule[] {
    return this.data.schedules;
  }

  getScheduleById(id: string): Schedule | undefined {
    return this.data.schedules.find(s => s.id === id);
  }

  createSchedule(schedule: Omit<Schedule, 'id' | 'created_at' | 'updated_at'>): Schedule {
    const now = new Date().toISOString();
    const newSchedule: Schedule = {
      ...schedule,
      id: this.generateId(),
      created_at: now,
      updated_at: now
    };
    this.data.schedules.push(newSchedule);
    this.saveData();
    return newSchedule;
  }

  updateSchedule(id: string, updates: Partial<Schedule>): Schedule | undefined {
    const index = this.data.schedules.findIndex(s => s.id === id);
    if (index === -1) return undefined;
    
    this.data.schedules[index] = {
      ...this.data.schedules[index],
      ...updates,
      updated_at: new Date().toISOString()
    };
    this.saveData();
    return this.data.schedules[index];
  }

  deleteSchedule(id: string): boolean {
    const index = this.data.schedules.findIndex(s => s.id === id);
    if (index === -1) return false;
    this.data.schedules.splice(index, 1);
    this.saveData();
    return true;
  }

  checkTimeConflict(startTime: string, endTime: string, excludeScheduleId?: string): Schedule[] {
    return this.data.schedules.filter(s => {
      if (s.status === ScheduleStatus.CANCELLED || s.status === ScheduleStatus.LEAVE) return false;
      if (s.id === excludeScheduleId) return false;
      return !(s.end_time <= startTime || s.start_time >= endTime);
    });
  }

  // ========== 统计数据 ==========
  
  getRevenueStats(startDate: string, endDate: string): RevenueStats {
    const schedules = this.data.schedules.filter(s => 
      s.status === ScheduleStatus.COMPLETED &&
      s.start_time >= startDate && s.start_time <= endDate
    );

    let total = 0;
    const byCourseType = new Map();
    const bySourceType = new Map();
    const byServiceType = new Map(); // 保留 map 不影响，只是不统计数据
    const byInstitution = new Map();
    const byMonth = new Map();

    schedules.forEach(schedule => {
      const tuition = schedule.calculated_tuition || 0;
      total += tuition;

      const course = this.data.courses.find(c => c.id === schedule.course_id);
      if (course) {
        byCourseType.set(course.type, (byCourseType.get(course.type) || 0) + tuition);
        bySourceType.set(course.source_type, (bySourceType.get(course.source_type) || 0) + tuition);
        // 删除服务类型统计，需求要求删除服务类型
        if (course.institution_id) {
          byInstitution.set(course.institution_id, (byInstitution.get(course.institution_id) || 0) + tuition);
        }
      }

      const month = schedule.start_time.substring(0, 7);
      byMonth.set(month, (byMonth.get(month) || 0) + tuition);
    });

    const courseTypeNames = { 1: '一对一', 2: '一对二', 3: '小组课', 4: '大班课' };
    const sourceTypeNames = { 1: '自有课程', 2: '机构排课', 3: '混合班' };
    const serviceTypeNames = { 1: '中心内', 2: '上门' };

    return {
      total,
      byCourseType: Array.from(byCourseType.entries()).map(([type, amount]) => ({
        type: type as any,
        typeName: courseTypeNames[type as keyof typeof courseTypeNames] || '未知',
        amount,
        percentage: calculatePercentage(amount, total)
      })),
      bySourceType: Array.from(bySourceType.entries()).map(([sourceType, amount]) => ({
        sourceType: sourceType as any,
        sourceName: sourceTypeNames[sourceType as keyof typeof sourceTypeNames] || '未知',
        amount,
        percentage: calculatePercentage(amount, total)
      })),
      byServiceType: Array.from(byServiceType.entries()).map(([serviceType, amount]) => ({
        serviceType: serviceType as any,
        serviceName: serviceTypeNames[serviceType as keyof typeof serviceTypeNames] || '未知',
        amount,
        percentage: calculatePercentage(amount, total)
      })),
      byInstitution: Array.from(byInstitution.entries()).map(([instId, amount]) => {
        const inst = this.data.institutions.find(i => i.id === instId);
        return {
          institutionId: instId,
          institutionName: inst?.name || '未知机构',
          amount,
          percentage: calculatePercentage(amount, total)
        };
      }),
      byMonth: Array.from(byMonth.entries()).map(([month, amount]) => ({
        month,
        amount
      }))
    };
  }

  getStudentTuitionStats(startDate: string, endDate: string): StudentTuitionStats[] {
    const schedules = this.data.schedules.filter(s => 
      s.status === ScheduleStatus.COMPLETED &&
      s.start_time >= startDate && s.start_time <= endDate
    );

    const studentStats = new Map();

    schedules.forEach(schedule => {
      const studentIds = schedule.student_ids || [];
      const tuition = schedule.calculated_tuition || 0;
      const perStudentTuition = studentIds.length > 0 ? tuition / studentIds.length : tuition;

      studentIds.forEach(studentId => {
        if (!studentStats.has(studentId)) {
          studentStats.set(studentId, { total: 0, byCourseType: new Map() });
        }
        
        const stats = studentStats.get(studentId)!;
        stats.total += perStudentTuition;

        const course = this.data.courses.find(c => c.id === schedule.course_id);
        if (course) {
          stats.byCourseType.set(course.type, (stats.byCourseType.get(course.type) || 0) + perStudentTuition);
        }
      });
    });

    const courseTypeNames = { 1: '一对一', 2: '一对二', 3: '小组课', 4: '大班课' };

    // @ts-ignore - 原项目类型错误，保持原样
    return Array.from(studentStats.entries()).map(([studentId, stats]) => {
      const student = this.data.students.find(s => s.id === studentId);
      return {
        studentId,
        studentName: student?.name || '未知学生',
        total: stats.total,
        // @ts-ignore - 原项目类型错误，保持原样
      byCourseType: Array.from(stats.byCourseType.entries()).map(([type, amount]) => ({
          type: type as any,
          typeName: courseTypeNames[type as keyof typeof courseTypeNames] || '未知',
          amount
        }))
      };
    // @ts-ignore - 原项目类型错误，保持原样
    }).sort((a, b) => b.total - a.total);
  }

  // ========== 老师管理 ==========
  
  getAllTeachers(): Teacher[] {
    return this.data.teachers;
  }

  getTeacherById(id: string): Teacher | undefined {
    return this.data.teachers.find(t => t.id === id);
  }

  createTeacher(teacher: Omit<Teacher, 'id' | 'created_at' | 'updated_at'>): Teacher {
    const now = new Date().toISOString();
    const newTeacher: Teacher = {
      ...teacher,
      id: this.generateId(),
      created_at: now,
      updated_at: now
    };
    this.data.teachers.push(newTeacher);
    this.saveData();
    return newTeacher;
  }

  updateTeacher(id: string, updates: Partial<Omit<Teacher, 'id' | 'created_at' | 'updated_at'>>): Teacher | undefined {
    const index = this.data.teachers.findIndex(t => t.id === id);
    if (index !== -1) {
      this.data.teachers[index] = {
        ...this.data.teachers[index],
        ...updates,
        updated_at: new Date().toISOString()
      };
      this.saveData();
      return this.data.teachers[index];
    }
    return undefined;
  }

  deleteTeacher(id: string): void {
    this.data.teachers = this.data.teachers.filter(t => t.id !== id);
    this.saveData();
  }

  // ========== 缴费记录管理 ==========
  
  getAllPayments(): Payment[] {
    return this.data.payments;
  }

  getPaymentById(id: string): Payment | undefined {
    return this.data.payments.find(p => p.id === id);
  }

  getPaymentsByStudentId(studentId: string): Payment[] {
    return this.data.payments.filter(p => p.student_id === studentId);
  }

  createPayment(payment: Omit<Payment, 'id' | 'created_at'>): Payment {
    const now = new Date().toISOString();
    const newPayment: Payment = {
      ...payment,
      id: this.generateId(),
      created_at: now
    };
    this.data.payments.push(newPayment);
    this.saveData();
    return newPayment;
  }

  updatePayment(id: string, updates: Partial<Omit<Payment, 'id' | 'created_at'>>): Payment | undefined {
    const index = this.data.payments.findIndex(p => p.id === id);
    if (index !== -1) {
      this.data.payments[index] = {
        ...this.data.payments[index],
        ...updates
      };
      this.saveData();
      return this.data.payments[index];
    }
    return undefined;
  }

  deletePayment(id: string): void {
    this.data.payments = this.data.payments.filter(p => p.id !== id);
    this.saveData();
  }

  // ========== 课时消耗记录管理 ==========
  
  getAllConsumptions(): Consumption[] {
    return this.data.consumptions;
  }

  getConsumptionById(id: string): Consumption | undefined {
    return this.data.consumptions.find(c => c.id === id);
  }

  getConsumptionsByStudentId(studentId: string): Consumption[] {
    return this.data.consumptions.filter(c => c.student_id === studentId);
  }

  createConsumption(consumption: Omit<Consumption, 'id' | 'created_at'>): Consumption {
    const now = new Date().toISOString();
    const newConsumption: Consumption = {
      ...consumption,
      id: this.generateId(),
      created_at: now
    };
    this.data.consumptions.push(newConsumption);
    this.saveData();
    return newConsumption;
  }

  updateConsumption(id: string, updates: Partial<Omit<Consumption, 'id' | 'created_at'>>): Consumption | undefined {
    const index = this.data.consumptions.findIndex(c => c.id === id);
    if (index !== -1) {
      this.data.consumptions[index] = {
        ...this.data.consumptions[index],
        ...updates
      };
      this.saveData();
      return this.data.consumptions[index];
    }
    return undefined;
  }

  deleteConsumption(id: string): void {
    this.data.consumptions = this.data.consumptions.filter(c => c.id !== id);
    this.saveData();
  }

  // ========== 数据导出/导入 ==========
  
  exportAllData(): Database & { exported_at: string } {
    return {
      ...this.data,
      exported_at: new Date().toISOString()
    };
  }

  importAllData(data: any): void {
    this.data = {
      students: data.students || [],
      grades: data.grades || [],
      courses: data.courses || [],
      schedules: data.schedules || [],
      enrollments: data.enrollments || [],
      payments: data.payments || [],
      consumptions: data.consumptions || [],
      institutions: data.institutions || [],
      schools: data.schools || [],
      rooms: data.rooms || [],
      teachers: data.teachers || []
    };
    this.saveData();
  }
}

export default new BrowserDatabaseService();
