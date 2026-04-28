// 数据库服务层 - 使用 sql.js (纯 JavaScript SQLite 实现)
import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { 
  Student, Grade, Course, Schedule, Enrollment, Payment, Consumption,
  CourseType, CourseSourceType, ScheduleStatus, PaymentType 
} from '../types';

type Database = any;

class DatabaseService {
  private db: Database | null = null;
  private dbPath: string;
  private initialized: boolean = false;

  constructor() {
    const userDataPath = process.env.NODE_ENV === 'production' 
      ? process.resourcesPath 
      : __dirname;
    this.dbPath = path.join(userDataPath, 'scheduling.db');
  }

  // 初始化数据库
  async init() {
    if (this.initialized) return;

    const SQL = await initSqlJs();
    
    // 如果数据库文件存在，加载它
    if (fs.existsSync(this.dbPath)) {
      const fileBuffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(fileBuffer);
    } else {
      this.db = new SQL.Database();
    }

    // 读取并执行 schema
    const schemaPath = path.join(__dirname, 'db', 'schema.sql');
    let schemaContent: string;
    
    if (fs.existsSync(schemaPath)) {
      schemaContent = fs.readFileSync(schemaPath, 'utf-8');
    } else {
      const devSchemaPath = path.join(process.cwd(), 'src', 'db', 'schema.sql');
      schemaContent = fs.readFileSync(devSchemaPath, 'utf-8');
    }
    
    this.db.run(schemaContent);
    this.save();
    this.initialized = true;
    
    console.log('数据库初始化成功:', this.dbPath);
  }

  // 保存数据库到文件
  save() {
    if (!this.db) return;
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  // 获取数据库实例
  getDb(): Database {
    if (!this.db) {
      throw new Error('数据库未初始化');
    }
    return this.db;
  }

  // 执行查询
  query(sql: string, params: any[] = []): any[] {
    const db = this.getDb();
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results: any[] = [];
    
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }

  // 执行单个操作
  run(sql: string, params: any[] = []): void {
    const db = this.getDb();
    db.run(sql, params);
    this.save();
  }

  // ========== 学生管理 ==========
  
  getAllStudents(): Student[] {
    return this.query('SELECT * FROM students ORDER BY created_at DESC');
  }

  getStudentById(id: string): Student | undefined {
    const results = this.query('SELECT * FROM students WHERE id = ?', [id]);
    return results[0] as Student;
  }

  createStudent(student: Omit<Student, 'id' | 'created_at' | 'updated_at'>): Student {
    const id = uuidv4();
    this.run(`
      INSERT INTO students (id, name, phone, school, grade_year, balance_hours, balance_money, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, student.name, student.phone, student.school, student.grade_year, 
        student.balance_hours, student.balance_money, student.notes]);
    return this.getStudentById(id)!;
  }

  updateStudent(id: string, updates: Partial<Student>): Student | undefined {
    const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at');
    if (fields.length === 0) return this.getStudentById(id);
    
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => (updates as any)[f]);
    
    this.run(`UPDATE students SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [...values, id]);
    return this.getStudentById(id);
  }

  deleteStudent(id: string): boolean {
    this.run('DELETE FROM students WHERE id = ?', [id]);
    return true;
  }

  // ========== 成绩管理 ==========
  
  getGradesByStudent(studentId: string): Grade[] {
    return this.query('SELECT * FROM grades WHERE student_id = ? ORDER BY exam_date DESC', [studentId]);
  }

  createGrade(grade: Omit<Grade, 'id' | 'created_at'>): Grade {
    const id = uuidv4();
    this.run(`
      INSERT INTO grades (id, student_id, subject, score, exam_date, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [id, grade.student_id, grade.subject, grade.score, grade.exam_date, grade.notes]);
    const results = this.query('SELECT * FROM grades WHERE id = ?', [id]);
    return results[0] as Grade;
  }

  // ========== 课程管理 ==========
  
  getAllCourses(): Course[] {
    return this.query('SELECT * FROM courses ORDER BY created_at DESC');
  }

  getCourseById(id: string): Course | undefined {
    const results = this.query('SELECT * FROM courses WHERE id = ?', [id]);
    return results[0] as Course;
  }

  createCourse(course: Omit<Course, 'id' | 'created_at' | 'updated_at'>): Course {
    const id = uuidv4();
    this.run(`
      INSERT INTO courses (id, name, type, source_type, price_tuition, price_teacher, billing_unit, room, teacher_id, teacher_name, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, course.name, course.type, course.source_type, course.price_tuition, course.price_teacher, course.billing_unit,
        course.room, course.teacher_id, course.teacher_name, course.notes]);
    return this.getCourseById(id)!;
  }

  updateCourse(id: string, updates: Partial<Course>): Course | undefined {
    const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at');
    if (fields.length === 0) return this.getCourseById(id);
    
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => (updates as any)[f]);
    
    this.run(`UPDATE courses SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [...values, id]);
    return this.getCourseById(id);
  }

  deleteCourse(id: string): boolean {
    this.run('DELETE FROM courses WHERE id = ?', [id]);
    return true;
  }

  // ========== 排课管理 ==========
  
  getAllSchedules(): Schedule[] {
    return this.query('SELECT * FROM schedules ORDER BY start_time DESC');
  }

  getSchedulesByDateRange(start: string, end: string): Schedule[] {
    return this.query(`
      SELECT * FROM schedules 
      WHERE start_time >= ? AND end_time <= ?
      ORDER BY start_time
    `, [start, end]);
  }

  getScheduleById(id: string): Schedule | undefined {
    const results = this.query('SELECT * FROM schedules WHERE id = ?', [id]);
    return results[0] as Schedule;
  }

  createSchedule(schedule: Omit<Schedule, 'id' | 'created_at' | 'updated_at'>): Schedule {
    const id = uuidv4();
    this.run(`
      INSERT INTO schedules (id, course_id, start_time, end_time, recurring_rule, status, room, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, schedule.course_id, schedule.start_time, schedule.end_time,
        schedule.recurring_rule, schedule.status, schedule.room, schedule.notes]);
    return this.getScheduleById(id)!;
  }

  updateSchedule(id: string, updates: Partial<Schedule>): Schedule | undefined {
    const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at');
    if (fields.length === 0) return this.getScheduleById(id);
    
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => (updates as any)[f]);
    
    this.run(`UPDATE schedules SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [...values, id]);
    return this.getScheduleById(id);
  }

  deleteSchedule(id: string): boolean {
    this.run('DELETE FROM schedules WHERE id = ?', [id]);
    return true;
  }

  // 检测时间冲突
  checkTimeConflict(startTime: string, endTime: string, excludeScheduleId?: string): Schedule[] {
    let sql = `
      SELECT * FROM schedules 
      WHERE status != ? 
      AND NOT (end_time <= ? OR start_time >= ?)
    `;
    const params: any[] = [ScheduleStatus.CANCELLED, startTime, endTime];
    
    if (excludeScheduleId) {
      sql += ' AND id != ?';
      params.push(excludeScheduleId);
    }
    
    return this.query(sql, params);
  }

  // ========== 选课关联 ==========
  
  getEnrollmentsBySchedule(scheduleId: string): Enrollment[] {
    return this.query('SELECT * FROM enrollments WHERE schedule_id = ?', [scheduleId]);
  }

  getEnrollmentsByStudent(studentId: string): Enrollment[] {
    return this.query('SELECT * FROM enrollments WHERE student_id = ?', [studentId]);
  }

  addEnrollment(enrollment: Omit<Enrollment, 'id' | 'created_at'>): Enrollment {
    const id = uuidv4();
    this.run(`
      INSERT INTO enrollments (id, schedule_id, student_id, custom_price, hours_consumed, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, enrollment.schedule_id, enrollment.student_id, enrollment.custom_price,
        enrollment.hours_consumed, enrollment.status, enrollment.notes]);
    const results = this.query('SELECT * FROM enrollments WHERE id = ?', [id]);
    return results[0] as Enrollment;
  }

  updateEnrollment(id: string, updates: Partial<Enrollment>): Enrollment | undefined {
    const fields = Object.keys(updates).filter(k => k !== 'id' && k !== 'created_at');
    if (fields.length === 0) {
      const results = this.query('SELECT * FROM enrollments WHERE id = ?', [id]);
      return results[0] as Enrollment;
    }
    
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => (updates as any)[f]);
    
    this.run(`UPDATE enrollments SET ${setClause} WHERE id = ?`, [...values, id]);
    const results = this.query('SELECT * FROM enrollments WHERE id = ?', [id]);
    return results[0] as Enrollment;
  }

  removeEnrollment(id: string): boolean {
    this.run('DELETE FROM enrollments WHERE id = ?', [id]);
    return true;
  }

  // ========== 财务管理 ==========
  
  getPaymentsByStudent(studentId: string): Payment[] {
    return this.query('SELECT * FROM payments WHERE student_id = ? ORDER BY payment_date DESC', [studentId]);
  }

  getAllPayments(): Payment[] {
    return this.query('SELECT * FROM payments ORDER BY payment_date DESC');
  }

  createPayment(payment: Omit<Payment, 'id' | 'created_at'>): Payment {
    const id = uuidv4();
    this.run(`
      INSERT INTO payments (id, student_id, amount, payment_type, payment_date, payment_method, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, payment.student_id, payment.amount, payment.payment_type,
        payment.payment_date, payment.payment_method, payment.notes]);
    
    // 更新学生余额
    if (payment.payment_type === PaymentType.TUITION) {
      const student = this.getStudentById(payment.student_id);
      if (student) {
        this.updateStudent(payment.student_id, { 
          balance_money: student.balance_money + payment.amount 
        });
      }
    } else if (payment.payment_type === PaymentType.HOURS) {
      const student = this.getStudentById(payment.student_id);
      if (student) {
        this.updateStudent(payment.student_id, { 
          balance_hours: student.balance_hours + payment.amount 
        });
      }
    }
    
    const results = this.query('SELECT * FROM payments WHERE id = ?', [id]);
    return results[0] as Payment;
  }

  // ========== 课时消耗 ==========
  
  getConsumptionsByStudent(studentId: string): Consumption[] {
    return this.query('SELECT * FROM consumptions WHERE student_id = ? ORDER BY consumption_date DESC', [studentId]);
  }

  getAllConsumptions(): Consumption[] {
    return this.query('SELECT * FROM consumptions ORDER BY consumption_date DESC');
  }

  createConsumption(consumption: Omit<Consumption, 'id' | 'created_at'>): Consumption {
    const id = uuidv4();
    this.run(`
      INSERT INTO consumptions (id, schedule_id, student_id, hours, amount, consumption_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, consumption.schedule_id, consumption.student_id, consumption.hours,
        consumption.amount, consumption.consumption_date, consumption.notes]);
    
    // 更新学生余额
    const student = this.getStudentById(consumption.student_id);
    if (student) {
      this.updateStudent(consumption.student_id, {
        balance_hours: student.balance_hours - consumption.hours,
        balance_money: student.balance_money - consumption.amount
      });
    }
    
    const results = this.query('SELECT * FROM consumptions WHERE id = ?', [id]);
    return results[0] as Consumption;
  }

  // ========== 数据统计 ==========
  
  getRevenueStats(startDate: string, endDate: string) {
    const results = this.query(`
      SELECT 
        SUM(amount) as total_revenue,
        COUNT(*) as payment_count
      FROM payments
      WHERE payment_date BETWEEN ? AND ?
    `, [startDate, endDate]);
    return results[0] || { total_revenue: 0, payment_count: 0 };
  }

  getConsumptionStats(startDate: string, endDate: string) {
    const results = this.query(`
      SELECT 
        SUM(hours) as total_hours,
        SUM(amount) as total_amount,
        COUNT(*) as consumption_count
      FROM consumptions
      WHERE consumption_date BETWEEN ? AND ?
    `, [startDate, endDate]);
    return results[0] || { total_hours: 0, total_amount: 0, consumption_count: 0 };
  }

  // ========== 数据导出/导入 ==========
  
  exportAllData() {
    return {
      students: this.getAllStudents(),
      grades: this.query('SELECT * FROM grades'),
      courses: this.getAllCourses(),
      schedules: this.getAllSchedules(),
      enrollments: this.query('SELECT * FROM enrollments'),
      payments: this.getAllPayments(),
      consumptions: this.getAllConsumptions(),
      exported_at: new Date().toISOString()
    };
  }

  importAllData(data: any) {
    // 导入学生
    if (data.students) {
      for (const s of data.students) {
        this.run(`
          INSERT OR REPLACE INTO students 
          (id, name, phone, school, grade, balance_hours, balance_money, notes, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [s.id, s.name, s.phone, s.school, s.grade, s.balance_hours, s.balance_money, s.notes, s.created_at, s.updated_at]);
      }
    }
    
    // 导入课程
    if (data.courses) {
      for (const c of data.courses) {
        this.run(`
          INSERT OR REPLACE INTO courses 
          (id, name, type, source_type, price_per_hour, room, teacher_id, teacher_name, notes, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [c.id, c.name, c.type, c.source_type, c.price_per_hour, c.room, c.teacher_id, c.teacher_name, c.notes, c.created_at, c.updated_at]);
      }
    }
    
    this.save();
  }

  // 关闭数据库
  close() {
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
      this.initialized = false;
    }
  }
}

export default new DatabaseService();
