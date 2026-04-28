-- 排课与学生管理系统数据库 Schema
-- SQLite 数据库

-- 学生表
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  school TEXT,
  grade TEXT,
  balance_hours REAL DEFAULT 0,
  balance_money REAL DEFAULT 0,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 成绩记录表
CREATE TABLE IF NOT EXISTS grades (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  score REAL NOT NULL,
  exam_date DATE,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- 课程表
CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type INTEGER NOT NULL,  -- 1:一对一，2:一对二，3:小组课，4:大班课
  source_type INTEGER NOT NULL,  -- 1:自有课程，2:机构排课，3:混合班
  price_per_hour REAL DEFAULT 0,  -- 基础课时费
  room TEXT,
  teacher_id TEXT,
  teacher_name TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 排课表
CREATE TABLE IF NOT EXISTS schedules (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  recurring_rule TEXT,  -- 周期性规则 JSON: {"type":"weekly","weekday":3,"time":"15:00"}
  status INTEGER DEFAULT 1,  -- 1:计划中，2:已完成，3:已取消
  room TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- 选课关联表（支持一个课程多个学生）
CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  custom_price REAL,  -- 该学生的实际课时费（覆盖课程默认价）
  hours_consumed REAL DEFAULT 0,  -- 本次课消耗课时数
  status INTEGER DEFAULT 1,  -- 1:正常，2:已请假，3:已旷课
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- 缴费记录表
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  amount REAL NOT NULL,
  payment_type INTEGER NOT NULL,  -- 1:学费充值，2:课时购买
  payment_date DATE NOT NULL,
  payment_method TEXT,  -- 微信/支付宝/现金/转账
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- 课时消耗记录表
CREATE TABLE IF NOT EXISTS consumptions (
  id TEXT PRIMARY KEY,
  schedule_id TEXT NOT NULL,
  student_id TEXT NOT NULL,
  hours REAL NOT NULL,
  amount REAL NOT NULL,
  consumption_date DATE NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_students_name ON students(name);
CREATE INDEX IF NOT EXISTS idx_grades_student ON grades(student_id);
CREATE INDEX IF NOT EXISTS idx_schedules_course ON schedules(course_id);
CREATE INDEX IF NOT EXISTS idx_schedules_time ON schedules(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_enrollments_schedule ON enrollments(schedule_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_consumptions_student ON consumptions(student_id);
