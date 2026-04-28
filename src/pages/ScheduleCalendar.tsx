import React, { useState, useRef, useCallback } from 'react';
import {
  Modal, Form, Input, InputNumber, Select, DatePicker, TimePicker, Calendar, Divider, Card, Row, Col, Button, message, Space, Dropdown, Alert
} from 'antd';
import type { MenuProps } from 'antd';
import dayjs, { Dayjs } from 'dayjs';
import { CourseType, ScheduleStatus, Course, Teacher, Student } from '../types';
import { v4 as uuidv4 } from 'uuid';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import isoWeek from 'dayjs/plugin/isoWeek';
import { holidays2026, getUpcomingHolidays } from '../utils/helpers';

dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);

const { Option } = Select;

const MIN_START_HOUR = 8;
const MAX_END_HOUR = 23;
const SLOT_DURATION = 5; // ③ 最小5分钟调整
const SLOT_HEIGHT = 2.5; // 每5分钟2.5px高，保持原总高度不变
const COLUMN_WIDTH = 140;
const SIDEBAR_WIDTH = 220;
const DEFAULT_DURATION_HOURS = 2;

function calculateTotalSlots() {
  return ((MAX_END_HOUR - MIN_START_HOUR) * 60) / SLOT_DURATION;
}

function timeToSlot(hour: number, minute: number) {
  const totalMins = (hour - MIN_START_HOUR) * 60 + minute;
  return Math.floor(totalMins / SLOT_DURATION);
}

function slotToTime(slot: number) {
  const totalMins = slot * SLOT_DURATION;
  const hour = MIN_START_HOUR + Math.floor(totalMins / 60);
  const minute = totalMins % 60;
  return { hour, minute };
}

function formatTime(hour: number, minute: number) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export interface ScheduleEvent {
  id: string;
  course_id: string;
  course_name: string;
  course_type: CourseType;
  start_time: string;
  end_time: string;
  status: ScheduleStatus;
  room?: string;
  notes?: string;
}

interface DailyViewProps {
  day: Dayjs;
  dayIndex: number;
  schedules: ScheduleEvent[];
  minHour?: number;
  maxHour?: number;
  onDoubleClickDate: (day: Dayjs) => void;
  onDoubleClickSchedule: (schedule: ScheduleEvent) => void;
  onScheduleStatusChange: (id: string, status: ScheduleStatus) => void;
  onDropCourse: (course: Course, day: Dayjs, slot: number) => void;
  onDragSchedule?: (schedule: ScheduleEvent, newDay: Dayjs, newSlot: number, ctrlKey: boolean) => void;
  onResizeSchedule?: (schedule: ScheduleEvent, newStartSlot: number | null, newEndSlot: number | null) => void;
  onDeleteSchedule?: (id: string) => void;
  onOpenStudentEdit?: (schedule: ScheduleEvent) => void;
}

const DailyView: React.FC<DailyViewProps> = ({
  day,
  dayIndex,
  schedules,
  minHour = 8,
  maxHour = 23,
  onDoubleClickDate,
  onDoubleClickSchedule,
  onScheduleStatusChange,
  onDropCourse,
  onDragSchedule,
  onResizeSchedule,
  onDeleteSchedule,
  onOpenStudentEdit
}) => {
  const dateStr = day.format('YYYY-MM-DD');
  const daySchedules = schedules.filter(s => s.start_time.startsWith(dateStr));
  const todayStr = dayjs().format('YYYY-MM-DD');
  const isToday = dateStr === todayStr;

  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);
  const [dragState, setDragState] = useState<{
    type: 'move' | 'resize-top' | 'resize-bottom';
    schedule: ScheduleEvent;
    startSlot: number;
    endSlot: number;
    startY: number;
    currentY: number;
    currentX: number;
    ctrlKey: boolean;
    ghostVisible: boolean;
  } | null>(null);
  const dayBodyRef = useRef<HTMLDivElement>(null);
  const dragStartPosRef = useRef<{ x: number, y: number } | null>(null);
  const hasDraggedRef = useRef(false);

  const holiday = holidays2026.find(h => 
    dateStr >= h.start && dateStr <= h.end
  );
  const isHoliday = !!holiday;
  const holidayName = holiday?.name || '';

  // ⑤ 动态计算总slot数（基于课程实际时间范围）
  const effectiveMaxEndSlot = ((maxHour - MIN_START_HOUR) * 60) / SLOT_DURATION;
  // ④ 早于8点的课程需要向下整体位移
  const earlyOffset = minHour < MIN_START_HOUR ? ((MIN_START_HOUR - minHour) * 60 / SLOT_DURATION * SLOT_HEIGHT) : 0;
  let maxEndSlot = effectiveMaxEndSlot;
  daySchedules.forEach(s => {
    const [, timeStr] = s.end_time.split(' ');
    const [endH, endM] = timeStr.split(':').map(Number);
    const endSlot = timeToSlot(endH, endM) + 1;
    if (endSlot > maxEndSlot) maxEndSlot = endSlot;
  });

  function getStatusStyle(status: ScheduleStatus) {
    switch (status) {
      case ScheduleStatus.PLANNED:
        return { background: '#e6f7ff', border: '2px solid #1890ff', opacity: 1 };
      case ScheduleStatus.COMPLETED:
        return { background: '#f6ffed', border: '2px solid #52c41a', opacity: 0.8 };
      case ScheduleStatus.LEAVE:
        return { background: '#fff7e6', border: '2px solid #faad14', opacity: 1 };
      case ScheduleStatus.CANCELLED:
        return { background: '#fff1f0', border: '2px solid #f5222d', opacity: 0.6 };
      default:
        return { background: '#e6f7ff', border: '2px solid #1890ff', opacity: 1 };
    }
  }

  function getCoursePosition(schedule: ScheduleEvent) {
    const [, startTime] = schedule.start_time.split(' ');
    const [, endTime] = schedule.end_time.split(' ');
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startSlot = timeToSlot(startH, startM);
    const endSlot = timeToSlot(endH, endM);
    return { top: startSlot * SLOT_HEIGHT, height: (endSlot - startSlot) * SLOT_HEIGHT, startSlot, endSlot };
  }

  function getCurrentDragPosition(schedule: ScheduleEvent) {
    const [, startTime] = schedule.start_time.split(' ');
    const [, endTime] = schedule.end_time.split(' ');
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    let startSlot = timeToSlot(startH, startM);
    let endSlot = timeToSlot(endH, endM);
    
    if (dragState && dragState.schedule.id === schedule.id) {
      // ② Ctrl+拖拽（复制）：原课程框位置固定不动，只有虚影跟随鼠标
      if (dragState.type === 'move' && dragState.ctrlKey) {
        return { top: startSlot * SLOT_HEIGHT, height: (endSlot - startSlot) * SLOT_HEIGHT, startSlot, endSlot };
      }
      // ④ 统一：虚影上边沿对应slot = (mouseY - ghostHeight/2 - bodyRect.top) / SLOT_HEIGHT
      if (dragState.type === 'move' && dayBodyRef.current) {
        const durationSlots = endSlot - startSlot;
        const dragGhostHeight = Math.max(24, durationSlots * SLOT_HEIGHT);
        const bodyRect = dayBodyRef.current.getBoundingClientRect();
        const ghostTopY = dragState.currentY - dragGhostHeight / 2;
        startSlot = Math.max(0, Math.round((ghostTopY - bodyRect.top) / SLOT_HEIGHT));
        endSlot = startSlot + durationSlots;
        return { top: startSlot * SLOT_HEIGHT, height: (endSlot - startSlot) * SLOT_HEIGHT, startSlot, endSlot };
      }
      // resize：使用原有偏移计算
      const slotDiff = Math.round((dragState.currentY - dragState.startY) / SLOT_HEIGHT);
        
      if (dragState.type === 'move') {
        startSlot += slotDiff;
        endSlot += slotDiff;
      } else if (dragState.type === 'resize-top') {
        startSlot += slotDiff;
      } else if (dragState.type === 'resize-bottom') {
        endSlot += slotDiff;
      }
      
      startSlot = Math.max(0, startSlot);
      endSlot = Math.max(startSlot + 1, endSlot);
    }
    
    return { top: startSlot * SLOT_HEIGHT, height: (endSlot - startSlot) * SLOT_HEIGHT, startSlot, endSlot };
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOverSlot(null);
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const slot = Math.floor(y / SLOT_HEIGHT);
    const course = (window as any).courseDragData;
    if (course) {
      onDropCourse(course, day, slot);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const slot = Math.floor(y / SLOT_HEIGHT);
    setDragOverSlot(slot);
  }

  function handleDragLeave() {
    setDragOverSlot(null);
  }

  const handleScheduleMouseDown = useCallback((e: React.MouseEvent, schedule: ScheduleEvent, hitZone: 'body' | 'top' | 'bottom') => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    
    const rect = e.currentTarget.getBoundingClientRect();
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    hasDraggedRef.current = false;
    
    const [, startTime] = schedule.start_time.split(' ');
    const [, endTime] = schedule.end_time.split(' ');
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const startSlot = timeToSlot(startH, startM);
    const endSlot = timeToSlot(endH, endM);
    
    // ⑤ 单击时不显示虚影，ghostVisible=false，等鼠标移动超过阈值才显示
    if (hitZone === 'top') {
      setDragState({ type: 'resize-top', schedule, startSlot, endSlot, startY: e.clientY, currentY: e.clientY, currentX: e.clientX, ctrlKey: e.ctrlKey, ghostVisible: false });
    } else if (hitZone === 'bottom') {
      setDragState({ type: 'resize-bottom', schedule, startSlot: endSlot, endSlot, startY: e.clientY, currentY: e.clientY, currentX: e.clientX, ctrlKey: e.ctrlKey, ghostVisible: false });
    } else {
      setDragState({ type: 'move', schedule, startSlot, endSlot, startY: e.clientY, currentY: e.clientY, currentX: e.clientX, ctrlKey: e.ctrlKey, ghostVisible: false });
    }
  }, []);

  React.useEffect(() => {
    if (!dragState) return;
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (dragStartPosRef.current && !hasDraggedRef.current) {
        const dx = Math.abs(moveEvent.clientX - dragStartPosRef.current.x);
        const dy = Math.abs(moveEvent.clientY - dragStartPosRef.current.y);
        if (dx > 3 || dy > 3) {
          hasDraggedRef.current = true;
        }
      }
      
      setDragState(prev => {
        if (!prev) return null;
        return { ...prev, currentY: moveEvent.clientY, currentX: moveEvent.clientX, ctrlKey: moveEvent.ctrlKey, ghostVisible: prev.ghostVisible || hasDraggedRef.current };
      });
    };
    
    const handleMouseUp = (upEvent: MouseEvent) => {
      if (hasDraggedRef.current && dragState && dayBodyRef.current) {
        
        // ① 检测鼠标所在日期列（支持跨日期、跨周拖拽）
        let targetDay = day;
        const elem = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
        let targetDayCol: HTMLElement | null = null;
        if (elem) {
          targetDayCol = elem.closest('[data-date]') as HTMLElement;
          if (targetDayCol && targetDayCol.dataset.date) {
            const foundDate = dayjs(targetDayCol.dataset.date);
            if (foundDate.isValid()) {
              targetDay = foundDate;
            }
          }
        }
        
        // ④ 统一slot计算：虚影上边沿对应时间 = (mouseY - ghostHeight/2 - bodyRect.top) / SLOT_HEIGHT
        const durationSlots = dragState.endSlot - dragState.startSlot;
        const dragGhostHeight = Math.max(24, durationSlots * SLOT_HEIGHT);
        let targetSlot = 0;
        if (dragState.type === 'move' && targetDayCol) {
          const targetBody = targetDayCol.querySelector('[data-day-body="true"]') as HTMLElement;
          if (targetBody) {
            const bodyRect = targetBody.getBoundingClientRect();
            const ghostTopY = upEvent.clientY - dragGhostHeight / 2;
            targetSlot = Math.max(0, Math.round((ghostTopY - bodyRect.top) / SLOT_HEIGHT));
          }
        } else {
          // resize: 使用原有偏移计算
          const slotDiff = Math.round((upEvent.clientY - dragState.startY) / SLOT_HEIGHT);
          targetSlot = dragState.startSlot + slotDiff;
        }
        
        // ③ 放宽slot边界检查，用全局范围
        const globalMaxSlot = ((24 - MIN_START_HOUR) * 60) / SLOT_DURATION;
        
        if (dragState.type === 'move') {
          if (targetSlot >= 0 && targetSlot < globalMaxSlot) {
            onDragSchedule?.(dragState.schedule, targetDay, targetSlot, upEvent.ctrlKey);
          }
        } else if (dragState.type === 'resize-top') {
          if (targetSlot >= 0 && targetSlot < maxEndSlot) {
            onResizeSchedule?.(dragState.schedule, targetSlot, null);
          }
        } else if (dragState.type === 'resize-bottom') {
          if (targetSlot >= 0 && targetSlot < maxEndSlot) {
            onResizeSchedule?.(dragState.schedule, null, targetSlot);
          }
        }
      }
      
      setDragState(null);
      dragStartPosRef.current = null;
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, day, maxEndSlot, onDragSchedule, onResizeSchedule]);

  const handleScheduleClick = useCallback((e: React.MouseEvent, schedule: ScheduleEvent) => {
    if (hasDraggedRef.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, []);

  const handleScheduleDoubleClick = useCallback((e: React.MouseEvent, schedule: ScheduleEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!hasDraggedRef.current) {
      onDoubleClickSchedule(schedule);
    }
  }, [onDoubleClickSchedule]);

  const getContextMenuItems = (schedule: ScheduleEvent): MenuProps['items'] => [
    {
      key: 'delete',
      label: '🗑️ 删除课程',
      danger: true,
      onClick: () => {
        onDeleteSchedule?.(schedule.id);
      }
    },
    { type: 'divider' },
    {
      key: 'normal',
      label: '✅ 设为正常',
      disabled: schedule.status === ScheduleStatus.PLANNED,
      onClick: () => onScheduleStatusChange(schedule.id, ScheduleStatus.PLANNED)
    },
    {
      key: 'leave',
      label: '🏠 设为请假',
      disabled: schedule.status === ScheduleStatus.LEAVE,
      onClick: () => onScheduleStatusChange(schedule.id, ScheduleStatus.LEAVE)
    },
    {
      key: 'cancelled',
      label: '❌ 设为取消',
      disabled: schedule.status === ScheduleStatus.CANCELLED,
      onClick: () => onScheduleStatusChange(schedule.id, ScheduleStatus.CANCELLED)
    },
    { type: 'divider' },
    {
      key: 'student-edit',
      label: '👥 学生出勤和费用',
      onClick: () => onOpenStudentEdit?.(schedule)
    }
  ];

  const weekDays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

  return (
    <div style={{
      width: COLUMN_WIDTH,
      border: '2px solid #d9d9d9',
      borderRadius: 8,
      overflow: 'hidden',
      background: isToday ? '#e6f7ff' : (isHoliday ? '#fff1f0' : 'white'),
      borderColor: isToday ? '#1890ff' : '#d9d9d9'
    }} data-date={dateStr}>
      <div
        onDoubleClick={() => onDoubleClickDate(day)}
        style={{
          padding: '8px 4px',
          background: isHoliday ? '#f5222d' : '#1890ff',
          color: 'white',
          textAlign: 'center',
          fontWeight: 'bold',
          cursor: 'pointer',
          userSelect: 'none'
        }}
      >
        <div>{weekDays[dayIndex]}{isHoliday ? `（${holidayName}）` : ''}{isToday && ' 今天'}</div>
        <div style={{ fontSize: 12, fontWeight: 'normal', marginTop: 2 }}>
          {day.format('M月D日')}
        </div>
      </div>

      <div
        ref={dayBodyRef}
        data-day-body="true"
        style={{ position: 'relative', height: maxEndSlot * SLOT_HEIGHT, background: 'white', paddingTop: earlyOffset }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {/* 时间格子线条 - 60分钟间隔，半透明 */}
        {Array.from({ length: Math.floor(maxEndSlot / 12) }).map((_, slotIdx) => (
          <div
            key={slotIdx}
            style={{
              position: 'absolute',
              top: slotIdx * 12 * SLOT_HEIGHT,
              left: 0,
              right: 0,
              height: 1,
              borderBottom: '1px solid rgba(0,0,0,0.08)'
            }}
          />
        ))}

        {/* ② 拖入课程虚影时间提示 + ④ 课程框拖拽/边沿拖动时间提示 */}
        {dragOverSlot !== null && (() => {
          const { hour, minute } = slotToTime(dragOverSlot);
          return (
            <div style={{
              position: 'absolute',
              top: dragOverSlot * SLOT_HEIGHT,
              left: 0,
              right: 0,
              height: SLOT_HEIGHT * 2,
              background: 'rgba(24,144,255,0.15)',
              border: '1px dashed #1890ff',
              borderRadius: 4,
              zIndex: 5,
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span style={{ fontSize: 10, color: '#1890ff', fontWeight: 'bold' }}>
                {formatTime(hour, minute)}开始
              </span>
            </div>
          );
        })()}

        {daySchedules.map(schedule => {
          const pos = dragState && dragState.schedule.id === schedule.id 
            ? getCurrentDragPosition(schedule) 
            : getCoursePosition(schedule);
          const isDragging = dragState && dragState.schedule.id === schedule.id;

          return (
            <React.Fragment key={schedule.id}>
              <Dropdown
                menu={{ items: getContextMenuItems(schedule) }}
                trigger={['contextMenu']}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: pos.top,
                    left: 4,
                    right: 4,
                    height: pos.height,
                    minHeight: 24,
                    borderRadius: 6,
                    padding: '2px 4px',
                    cursor: isDragging ? 'grabbing' : 'move',
                    ...getStatusStyle(schedule.status),
                    zIndex: isDragging ? 100 : 10,
                    opacity: isDragging && dragState.ghostVisible && dragState.type === 'move' && !dragState.ctrlKey ? 0 : 1,
                    boxShadow: isDragging && dragState.ghostVisible && dragState.type === 'move' && !dragState.ctrlKey ? 'none' : (isDragging && dragState.ghostVisible ? '0 4px 16px rgba(24,144,255,0.4)' : 'none'),
                    transition: (isDragging && dragState.ghostVisible) ? 'none' : 'all 0.1s',
                    // ② Ctrl+拖拽时原框保持完整不透明，仅绿色虚线边框高亮
                    border: isDragging && dragState.ghostVisible && dragState.ctrlKey ? '3px dashed #52c41a' : undefined
                  }}
                  onClick={(e) => handleScheduleClick(e, schedule)}
                  onDoubleClick={(e) => handleScheduleDoubleClick(e, schedule)}
                  onMouseDown={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const relY = e.clientY - rect.top;
                    if (relY <= 6) {
                      handleScheduleMouseDown(e, schedule, 'top');
                    } else if (relY >= rect.height - 6) {
                      handleScheduleMouseDown(e, schedule, 'bottom');
                    } else {
                      handleScheduleMouseDown(e, schedule, 'body');
                    }
                  }}
                >
                  {/* 课程框内容自适应居中 */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    overflow: 'hidden',
                    justifyContent: 'center',
                    alignItems: 'center'
                  }}>
                    <div style={{
                      fontSize: 12,
                      fontWeight: 'bold',
                      color: '#1890ff',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      lineHeight: 1.2,
                      textAlign: 'center',
                      maxWidth: '100%',
                      flexShrink: 0
                    }}>
                      {schedule.course_name}
                    </div>
                    <div style={{
                      fontSize: 10,
                      color: '#666',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      lineHeight: 1.2,
                      textAlign: 'center',
                      maxWidth: '100%',
                      flexShrink: 0,
                      marginTop: 2
                    }}>
                      {schedule.room && `${schedule.room} `}
                      {isDragging ? (() => {
                        const cs = pos.startSlot;
                        const ce = pos.endSlot;
                        const sh = Math.floor(cs / 12) + 8;
                        const sm = (cs % 12) * 5;
                        const eh = Math.floor(ce / 12) + 8;
                        const em = (ce % 12) * 5;
                        const st = `${String(sh).padStart(2,'0')}:${String(sm).padStart(2,'0')}`;
                        const et = `${String(eh).padStart(2,'0')}:${String(em).padStart(2,'0')}`;
                        // ② Ctrl+拖拽时原框时间不高亮，仅在普通拖拽/resize时高亮
                        const isCtrlDrag = dragState.ctrlKey;
                        const highlightStart = (dragState.type === 'move' && !isCtrlDrag) || dragState.type === 'resize-top';
                        const highlightEnd = (dragState.type === 'move' && !isCtrlDrag) || dragState.type === 'resize-bottom';
                        return <>
                          <span style={{ color: highlightStart ? '#ff4d4f' : '#666', fontWeight: highlightStart ? 'bold' : 'normal', background: highlightStart ? 'rgba(255,77,79,0.15)' : 'none', padding: '0 2px', borderRadius: 2 }}>{st}</span>
                          <span style={{ color: '#666' }}>-</span>
                          <span style={{ color: highlightEnd ? '#ff4d4f' : '#666', fontWeight: highlightEnd ? 'bold' : 'normal', background: highlightEnd ? 'rgba(255,77,79,0.15)' : 'none', padding: '0 2px', borderRadius: 2 }}>{et}</span>
                        </>;
                      })() : (
                        <>
                          {schedule.start_time.split(' ')[1].substr(0, 5)}-{schedule.end_time.split(' ')[1].substr(0, 5)}
                        </>
                      )}
                    </div>
                  </div>
                  {/* 边沿resize区域 */}
                  <div style={{
                    position: 'absolute',
                    top: -2,
                    left: 0,
                    right: 0,
                    height: 6,
                    cursor: 'n-resize',
                    zIndex: 20
                  }} />
                  <div style={{
                    position: 'absolute',
                    bottom: -2,
                    left: 0,
                    right: 0,
                    height: 6,
                    cursor: 's-resize',
                    zIndex: 20
                  }} />
                </div>
              </Dropdown>
            </React.Fragment>
          );
        })}
      </div>
      {/* ①② 跨日期/跨周拖拽浮动虚影 - 尺寸与真实课程框一致，⑤仅移动超过阈值显示 */}
      {dragState && dragState.type === 'move' && dragState.ghostVisible && (() => {
        const durationSlots = dragState.endSlot - dragState.startSlot;
        const ghostHeight = Math.max(24, durationSlots * SLOT_HEIGHT);
        const ghostWidth = COLUMN_WIDTH - 8;
        
        // ④ 虚影时间基于上边沿(ghostY=currentY-ghostHeight/2)计算，而非鼠标中心
        let ghostStartSlot = 0;
        if (dayBodyRef.current) {
          const bodyRect = dayBodyRef.current.getBoundingClientRect();
          const ghostTopY = dragState.currentY - ghostHeight / 2;
          ghostStartSlot = Math.max(0, Math.round((ghostTopY - bodyRect.top) / SLOT_HEIGHT));
        }
        // ② 检测是否跨日/跨周，用目标day body重算
        try {
          const elem = document.elementFromPoint(dragState.currentX, dragState.currentY);
          if (elem) {
            const dayCol = elem.closest('[data-date]') as HTMLElement;
            if (dayCol && dayCol.dataset.date && dayCol.dataset.date !== dateStr) {
              const targetBody = dayCol.querySelector('[data-day-body="true"]') as HTMLElement;
              if (targetBody) {
                const bodyRect = targetBody.getBoundingClientRect();
                const ghostTopY = dragState.currentY - ghostHeight / 2;
                ghostStartSlot = Math.max(0, Math.round((ghostTopY - bodyRect.top) / SLOT_HEIGHT));
              }
            }
          }
        } catch(e) {}
        
        const ghostEndSlot = ghostStartSlot + durationSlots;
        const sh = Math.floor(ghostStartSlot / 12) + 8;
        const sm = (ghostStartSlot % 12) * 5;
        const eh = Math.floor(ghostEndSlot / 12) + 8;
        const em = (ghostEndSlot % 12) * 5;
        const startTimeStr = String(sh).padStart(2,'0') + ':' + String(sm).padStart(2,'0');
        const endTimeStr = String(eh).padStart(2,'0') + ':' + String(em).padStart(2,'0');
        let ghostX = (dragState.currentX || 0) - ghostWidth / 2;
        let ghostY = (dragState.currentY || 0) - ghostHeight / 2;
        const isCopy = dragState.ctrlKey;
        return (
        <div style={{
          position: 'fixed',
          left: ghostX,
          top: ghostY,
          width: ghostWidth,
          height: ghostHeight,
          borderRadius: 6,
          background: isCopy ? 'rgba(82,196,26,0.25)' : 'rgba(24,144,255,0.25)',
          border: isCopy ? '2px dashed #52c41a' : '2px dashed #1890ff',
          zIndex: 9999,
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          boxShadow: isCopy ? '0 4px 20px rgba(82,196,26,0.3)' : '0 4px 20px rgba(24,144,255,0.3)'
        }}>
          {/* ③ 两行布局，和真实课程框完全一致：课程名 + 教室&起止时间 */}
          <div style={{ fontSize: 12, fontWeight: 'bold', color: isCopy ? '#52c41a' : '#1890ff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2, textAlign: 'center', maxWidth: ghostWidth - 8, flexShrink: 0 }}>
            {isCopy ? '📋 ' : ''}{dragState.schedule.course_name}
          </div>
          <div style={{ fontSize: 10, color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2, textAlign: 'center', maxWidth: ghostWidth - 8, flexShrink: 0, marginTop: 2 }}>
            {dragState.schedule.room && `${dragState.schedule.room} `}
            <span style={{ color: '#ff4d4f', fontWeight: 'bold', background: 'rgba(255,77,79,0.15)', padding: '0 2px', borderRadius: 2 }}>{startTimeStr}</span>
            <span style={{ color: '#666' }}>-</span>
            <span style={{ color: '#ff4d4f', fontWeight: 'bold', background: 'rgba(255,77,79,0.15)', padding: '0 2px', borderRadius: 2 }}>{endTimeStr}</span>
          </div>
        </div>
        );
      })()}
    </div>
  );
};

interface TwoWeeksViewProps {
  schedules: ScheduleEvent[];
  currentMonday: Dayjs;
  selectedTeacherId: string | undefined;
  courses: Course[];
  onDoubleClickDate: (day: Dayjs) => void;
  onDoubleClickSchedule: (schedule: ScheduleEvent) => void;
  onScheduleStatusChange: (id: string, status: ScheduleStatus) => void;
  onDropCourse: (course: Course, day: Dayjs, slot: number) => void;
  onDragSchedule?: (schedule: ScheduleEvent, newDay: Dayjs, newSlot: number, ctrlKey: boolean) => void;
  onResizeSchedule?: (schedule: ScheduleEvent, newStartSlot: number | null, newEndSlot: number | null) => void;
  onDeleteSchedule?: (id: string) => void;
  onOpenStudentEdit?: (schedule: ScheduleEvent) => void;
}

const OneWeekRow: React.FC<{
  startMonday: Dayjs;
  weekLabel: string;
  schedules: ScheduleEvent[];
  onDoubleClickDate: (day: Dayjs) => void;
  onDoubleClickSchedule: (schedule: ScheduleEvent) => void;
  onScheduleStatusChange: (id: string, status: ScheduleStatus) => void;
  onDropCourse: (course: Course, day: Dayjs, slot: number) => void;
  onDragSchedule?: (schedule: ScheduleEvent, newDay: Dayjs, newSlot: number, ctrlKey: boolean) => void;
  onResizeSchedule?: (schedule: ScheduleEvent, newStartSlot: number | null, newEndSlot: number | null) => void;
  onDeleteSchedule?: (id: string) => void;
  onOpenStudentEdit?: (schedule: ScheduleEvent) => void;
}> = ({
  startMonday,
  weekLabel,
  schedules,
  onDoubleClickDate,
  onDoubleClickSchedule,
  onScheduleStatusChange,
  onDropCourse,
  onDragSchedule,
  onResizeSchedule,
  onDeleteSchedule,
  onOpenStudentEdit
}) => {
  const weekDays: Dayjs[] = [];
  for (let i = 0; i < 7; i++) {
    weekDays.push(startMonday.add(i, 'day'));
  }

  // ⑤ 计算本周的动态时间范围
  const weekDateStr = startMonday.format('YYYY-MM-DD');
  const nextMondayStr = startMonday.add(7, 'day').format('YYYY-MM-DD');
  const visibleSchedules = schedules.filter(s => {
    if (s.status === ScheduleStatus.CANCELLED || s.status === ScheduleStatus.LEAVE) return false;
    const sDate = s.start_time.substring(0, 10);
    return sDate >= weekDateStr && sDate < nextMondayStr;
  });
  
  let dynMinHour = 8, dynMaxHour = 23;
  visibleSchedules.forEach(s => {
    const [, startT] = s.start_time.split(' ');
    const [, endT] = s.end_time.split(' ');
    const [sh, sm] = startT.split(':').map(Number);
    const [eh, em] = endT.split(':').map(Number);
    const startHour = sh + sm / 60;
    const endHour = eh + em / 60;
    if (startHour < dynMinHour) dynMinHour = Math.floor(startHour);
    if (endHour > dynMaxHour) dynMaxHour = Math.ceil(endHour);
  });

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 'bold', marginBottom: 8, color: '#666' }}>
        {weekLabel}: {startMonday.format('M月D日')} ~ {startMonday.add(6, 'day').format('M月D日')}
      </div>
      <div style={{ overflowX: 'auto', display: 'flex', gap: 8 }}>
        {weekDays.map((day, idx) => (
          <DailyView
            key={idx}
            day={day}
            dayIndex={idx}
            schedules={schedules}
            minHour={dynMinHour}
            maxHour={dynMaxHour}
            onDoubleClickDate={onDoubleClickDate}
            onDoubleClickSchedule={onDoubleClickSchedule}
            onScheduleStatusChange={onScheduleStatusChange}
            onDropCourse={onDropCourse}
            onDragSchedule={onDragSchedule}
            onResizeSchedule={onResizeSchedule}
            onDeleteSchedule={onDeleteSchedule}
            onOpenStudentEdit={onOpenStudentEdit}
          />
        ))}
      </div>
    </div>
  );
};

const TwoWeeksView: React.FC<TwoWeeksViewProps> = ({
  schedules,
  currentMonday,
  selectedTeacherId,
  courses,
  onDoubleClickDate,
  onDoubleClickSchedule,
  onScheduleStatusChange,
  onDropCourse,
  onDragSchedule,
  onResizeSchedule,
  onDeleteSchedule,
  onOpenStudentEdit
}) => {
  const filteredSchedules = schedules.filter(schedule => {
    if (!selectedTeacherId) return false; // ⑥ 没有选中老师时不显示任何课程
    const course = courses.find(c => c.id === schedule.course_id);
    return !course || course.teacher_id === selectedTeacherId;
  });

  return (
    <div style={{ overflowY: 'auto', flex: 1, paddingRight: 8 }}>
      <OneWeekRow
        startMonday={currentMonday}
        weekLabel="本周"
        schedules={filteredSchedules}
        onDoubleClickDate={onDoubleClickDate}
        onDoubleClickSchedule={onDoubleClickSchedule}
        onScheduleStatusChange={onScheduleStatusChange}
        onDropCourse={onDropCourse}
        onDragSchedule={onDragSchedule}
        onResizeSchedule={onResizeSchedule}
        onDeleteSchedule={onDeleteSchedule}
        onOpenStudentEdit={onOpenStudentEdit}
      />
      <OneWeekRow
        startMonday={currentMonday.add(1, 'week')}
        weekLabel="下周"
        schedules={filteredSchedules}
        onDoubleClickDate={onDoubleClickDate}
        onDoubleClickSchedule={onDoubleClickSchedule}
        onScheduleStatusChange={onScheduleStatusChange}
        onDropCourse={onDropCourse}
        onDragSchedule={onDragSchedule}
        onResizeSchedule={onResizeSchedule}
        onDeleteSchedule={onDeleteSchedule}
        onOpenStudentEdit={onOpenStudentEdit}
      />
    </div>
  );
};

interface SidebarProps {
  teachers: Teacher[];
  selectedTeacherId: string | undefined;
  courses: Course[];
  onTeacherChange: (teacherId: string | undefined) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  teachers,
  selectedTeacherId,
  courses,
  onTeacherChange
}) => {
  const filteredCourses = (courses || []).filter(c =>
    c.active === true && (!selectedTeacherId || c.teacher_id === selectedTeacherId)
  );

  function handleDragStart(e: React.DragEvent, course: Course) {
    e.dataTransfer.setData('courseId', course.id);
    (window as any).courseDragData = course;
    e.dataTransfer.effectAllowed = 'copy';
  }

  return (
    <div style={{
      width: SIDEBAR_WIDTH,
      borderRight: '1px solid #d9d9d9',
      padding: 16,
      height: 'calc(100vh - 200px)',
      overflowY: 'auto',
      background: '#fafafa'
    }}>
      <h4>👨‍🏫 选择老师</h4>
      <Select
        style={{ width: '100%', marginBottom: 16 }}
        placeholder="选择老师"
        allowClear
        showSearch
        value={selectedTeacherId}
        onChange={onTeacherChange}
        options={teachers.map(t => ({ label: t.name, value: t.id }))}
        filterOption={(input, option) =>
          (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
        }
      />
      <Divider style={{ margin: '8px 0 16px 0' }} />
      <h4>📚 未结课程 ({filteredCourses.length})</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filteredCourses.map(course => (
          <div
            key={course.id}
            draggable={course.active}
            onDragStart={e => handleDragStart(e, course)}
            style={{
              padding: '8px 12px',
              background: course.active ? 'white' : '#f5f5f5',
              border: '1px solid ' + (course.active ? '#d9d9d9' : '#ccc'),
              borderRadius: 6,
              cursor: course.active ? 'grab' : 'not-allowed',
              transition: 'all 0.3s',
              opacity: course.active ? 1 : 0.6
            }}
            onMouseEnter={e => {
              if (!course.active) return;
              e.currentTarget.style.borderColor = '#1890ff';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
            }}
            onMouseLeave={e => {
              if (!course.active) return;
              e.currentTarget.style.borderColor = '#d9d9d9';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ fontWeight: 'bold', fontSize: 14, color: '#1890ff' }}>
              {course.name}
            </div>
            {course.type !== undefined && (
              <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
                类型: {course.type === CourseType.ONE_ON_ONE ? '一对一' : '班课'}
              </div>
            )}
          </div>
        ))}
        {filteredCourses.length === 0 && (
          <div style={{ textAlign: 'center', color: '#999', padding: '20px 0', fontSize: 14 }}>
            暂无未结课程
          </div>
        )}
      </div>
    </div>
  );
};

const ScheduleCalendar: React.FC = () => {
  const [schedules, setSchedules] = useState<ScheduleEvent[]>([]);
  const today = dayjs();
  let initialMonday = today.startOf('isoWeek'); // 周一为一周起点
  const [currentMonday, setCurrentMonday] = useState<Dayjs>(initialMonday);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleEvent | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [form] = Form.useForm();
  
  const [studentEditModal, setStudentEditModal] = useState({
    open: false,
    schedule: null as ScheduleEvent | null
  });
  const [studentEditForm] = Form.useForm();
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | undefined>(undefined);
  const [teacherInitialized, setTeacherInitialized] = useState(false);

  const [batchDates, setBatchDates] = useState<Dayjs[]>([dayjs()]);
  const [refreshModalVisible, setRefreshModalVisible] = useState(false);
  const [refreshDateRange, setRefreshDateRange] = useState<[Dayjs, Dayjs] | null>(null);

  React.useEffect(() => {
    const loadData = () => {
      try {
        const db = (window as any).dbService;
        if (!db) {
          setTimeout(loadData, 1000);
          return;
        }
        const savedSchedules = localStorage.getItem('schedules');
        if (savedSchedules) setSchedules(JSON.parse(savedSchedules));
        if (db.getAllCourses) {
          const coursesData = db.getAllCourses();
          setCourses(coursesData);
        }
        if (db.getAllTeachers) {
          const teachersData = db.getAllTeachers();
          setTeachers(teachersData);
        }
        if (db.getAllStudents) {
          setAllStudents(db.getAllStudents());
        }
        if (db.getAllRooms) {
          setRooms(db.getAllRooms());
        }
      } catch (e) {
        console.error('加载数据失败', e);
      }
    };
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  // ⑥ 自动选择第一位老师
  React.useEffect(() => {
    if (!teacherInitialized && teachers.length > 0) {
      setSelectedTeacherId(teachers[0].id);
      setTeacherInitialized(true);
    }
  }, [teachers, teacherInitialized]);

  React.useEffect(() => {
    try {
      localStorage.setItem('schedules', JSON.stringify(schedules));
    } catch (e) {
      console.error('保存数据失败', e);
    }
  }, [schedules]);

  function handleDoubleClickDate(day: Dayjs) {
    setEditingSchedule(null);
    form.resetFields();
    form.setFieldValue('date', day);
    setBatchDates([day]);
    setModalVisible(true);
  }

  function handleDoubleClickSchedule(schedule: ScheduleEvent) {
    setEditingSchedule(schedule);
    const [dateStr, timeStr] = schedule.start_time.split(' ');
    const [, endTimeStr] = schedule.end_time.split(' ');
    const startTimeDayjs = dayjs(`1970-01-01 ${timeStr}`);
    const endTimeDayjs = dayjs(`1970-01-01 ${endTimeStr}`);
    const diffMinutes = endTimeDayjs.diff(startTimeDayjs, 'minute');
    const durationHours = diffMinutes / 60;
    const course = courses.find(c => c.id === schedule.course_id);
    
    form.resetFields();
    form.setFieldsValue({
      date: dayjs(dateStr),
      startTime: startTimeDayjs,
      endTime: endTimeDayjs,
      duration: durationHours,
      courseId: schedule.course_id,
      courseName: schedule.course_name,
      teacherId: course?.teacher_id,
      status: schedule.status,
      room: (course?.room_id && course.room_id.split(',')[0].trim()) || (rooms.find(r => r.name === schedule.room)?.id) || schedule.room,
      notes: schedule.notes,
    });
    setBatchDates([dayjs(dateStr)]);
    setModalVisible(true);
  }

  function handleOpenStudentEdit(schedule: ScheduleEvent) {
    const course = courses.find(c => c.id === schedule.course_id);
    if (course) {
      const initialValues = {
        students: (course.student_pricings || []).map(sp => ({
          student_id: sp.student_id,
          tuition: sp.tuition,
          teacher_fee: sp.teacher_fee || sp.tuition,
          status: sp.status || ScheduleStatus.PLANNED  // ① 读取已保存的出勤状态，不再强制重置
        }))
      };
      studentEditForm.setFieldsValue(initialValues);
      setStudentEditModal({ open: true, schedule });
    }
  }

  const courseStudentPricings = (() => {
    if (!studentEditModal.schedule) return [];
    const course = courses.find(c => c.id === (studentEditModal.schedule as any).course_id);
    return course?.student_pricings || [];
  })();

  function handleSaveStudentEdit() {
    const values = studentEditForm.getFieldsValue();
    if (studentEditModal.schedule) {
      const course = courses.find(c => c.id === (studentEditModal.schedule as any).course_id);
      if (course && course.student_pricings) {
        const updatedPricings = course.student_pricings.map((sp, idx) => ({
          ...sp,
          ...values.students[idx]
        }));
        const updatedCourses = courses.map(c => 
          c.id === course.id ? { ...c, student_pricings: updatedPricings } : c
        );
        setCourses(updatedCourses);
        // ① 通过 dbService.updateCourse 写入 browserDatabase（存到 scheduling_system_db_v3）
        const db = (window as any).dbService;
        if (db?.updateCourse) {
          db.updateCourse(course.id, { student_pricings: updatedPricings });
        }
        message.success('学生信息修改成功');
        setStudentEditModal({ open: false, schedule: null });
      }
    }
  }

  function handleScheduleStatusChange(id: string, status: ScheduleStatus) {
    setSchedules(prev => prev.map(s => s.id === id ? { ...s, status } : s));
    message.success('状态已更新');
  }

  function handleDropCourse(course: Course, day: Dayjs, slot: number) {
    const { hour: startH, minute: startM } = slotToTime(slot);
    const startTime = dayjs(day).hour(startH).minute(startM).second(0);
    const endTime = startTime.add(DEFAULT_DURATION_HOURS, 'hour');
    setEditingSchedule(null);
    form.resetFields();
    form.setFieldsValue({
      date: day,
      startTime: startTime,
      endTime: endTime,
      courseId: course.id,
      courseName: course.name,
      teacherId: course.teacher_id,
      room: course.room_id || course.room_name,
      status: ScheduleStatus.PLANNED,
    });
    setBatchDates([day]);
    setModalVisible(true);
  }

  function checkOverlap(scheduleId: string, newStart: string, newEnd: string): ScheduleEvent | null {
    return schedules.find(s => {
      if (s.id === scheduleId) return false;
      if (s.status === ScheduleStatus.CANCELLED || s.status === ScheduleStatus.LEAVE) return false;
      return s.start_time < newEnd && s.end_time > newStart;
    }) || null;
  }

  function handleDragSchedule(schedule: ScheduleEvent, newDay: Dayjs, newSlot: number, ctrlKey: boolean) {
    const { hour: startH, minute: startM } = slotToTime(newSlot);
    const [, oldStartTimeStr] = schedule.start_time.split(' ');
    const [, oldEndTimeStr] = schedule.end_time.split(' ');
    const oldStartDayjs = dayjs(`1970-01-01 ${oldStartTimeStr}`);
    const oldEndDayjs = dayjs(`1970-01-01 ${oldEndTimeStr}`);
    const durationMinutes = oldEndDayjs.diff(oldStartDayjs, 'minute');
    
    const newStartTime = dayjs(newDay).hour(startH).minute(startM).second(0);
    const newEndTime = newStartTime.add(durationMinutes, 'minute');
    const newStartTimeStr = newStartTime.format('YYYY-MM-DD HH:mm');
    const newEndTimeStr = newEndTime.format('YYYY-MM-DD HH:mm');
    
    // ③ 时间互斥检测
    if (!ctrlKey) {
      const overlap = checkOverlap(schedule.id, newStartTimeStr, newEndTimeStr);
      if (overlap) {
        message.warning(`时间重叠：与「${overlap.course_name}」(${overlap.start_time.substring(11,16)}-${overlap.end_time.substring(11,16)})冲突，已恢复`);
        return;
      }
    }
    
    if (ctrlKey) {
      const newSchedule = {
        ...schedule,
        id: uuidv4(),
        start_time: newStartTimeStr,
        end_time: newEndTimeStr
      };
      setSchedules(prev => [...prev, newSchedule]);
      message.success('课程已复制');
    } else {
      setSchedules(prev => prev.map(s => 
        s.id === schedule.id 
          ? { ...s, start_time: newStartTimeStr, end_time: newEndTimeStr }
          : s
      ));
      message.success('课程已移动');
    }
  }

  function handleResizeSchedule(schedule: ScheduleEvent, newStartSlot: number | null, newEndSlot: number | null) {
    const [, oldStartTimeStr] = schedule.start_time.split(' ');
    const [, oldEndTimeStr] = schedule.end_time.split(' ');
    let [startH, startM] = oldStartTimeStr.split(':').map(Number);
    let [endH, endM] = oldEndTimeStr.split(':').map(Number);
    
    if (newStartSlot !== null) {
      const { hour, minute } = slotToTime(newStartSlot);
      startH = hour;
      startM = minute;
    }
    if (newEndSlot !== null) {
      const { hour, minute } = slotToTime(newEndSlot);
      endH = hour;
      endM = minute;
    }
    
    const dateStr = schedule.start_time.split(' ')[0];
    const newStartTime = `${dateStr} ${formatTime(startH, startM)}`;
    const newEndTime = `${dateStr} ${formatTime(endH, endM)}`;
    
    // ③ 时间互斥检测
    const overlap = checkOverlap(schedule.id, newStartTime, newEndTime);
    if (overlap) {
      message.warning(`时间重叠：与「${overlap.course_name}」(${overlap.start_time.substring(11,16)}-${overlap.end_time.substring(11,16)})冲突，已恢复`);
      return;
    }
    
    setSchedules(prev => prev.map(s => 
      s.id === schedule.id 
        ? { ...s, start_time: newStartTime, end_time: newEndTime }
        : s
    ));
    message.success('课程时间已调整');
  }

  function handleDeleteSchedule(id: string) {
    if (window.confirm('确定要删除这节课程吗？')) {
      setSchedules(prev => prev.filter(s => s.id !== id));
      message.success('课程已删除');
    }
  }

  function handleSave() {
    form.validateFields().then(values => {
      const startDayjs = values.startTime;
      const durationHours = values.duration || DEFAULT_DURATION_HOURS;
      const endDayjs = startDayjs.add(durationHours * 60, 'minute');
      
      const course = courses.find(c => c.id === values.courseId);
      const courseName = course?.name || values.courseName;
      
      const datesToSave = batchDates.length > 0 ? batchDates : [values.date];
      const newSchedules: ScheduleEvent[] = [];
      
      datesToSave.forEach((dateDayjs, index) => {
        const dateStr = dateDayjs.format('YYYY-MM-DD');
        const startTimeStr = `${dateStr} ${startDayjs.format('HH:mm')}`;
        const endTimeStr = `${dateStr} ${endDayjs.format('HH:mm')}`;
        
        // ③ 时间互斥检测（排课窗口）
        const eId = editingSchedule?.id || '';
        const overlap = checkOverlap(eId, startTimeStr, endTimeStr);
        if (overlap) {
          message.warning(`时间重叠：${dateStr}与「${overlap.course_name}」(${overlap.start_time.substring(11,16)}-${overlap.end_time.substring(11,16)})冲突，已恢复`);
          return;
        }
        
        if (editingSchedule && index === 0) {
          setSchedules(prev => prev.map(s =>
            s.id === editingSchedule.id
              ? {
                  ...s,
                  start_time: startTimeStr,
                  end_time: endTimeStr,
                  course_id: values.courseId,
                  course_name: courseName,
                  status: values.status || ScheduleStatus.PLANNED,
                  room: rooms.find(r => r.id === values.room)?.name || values.room,
                  notes: values.notes,
                }
              : s
          ));
        } else {
          const newSchedule: ScheduleEvent = {
            id: uuidv4(),
            course_id: values.courseId,
            course_name: courseName,
            course_type: course?.type || CourseType.ONE_ON_ONE,
            start_time: startTimeStr,
            end_time: endTimeStr,
            status: values.status || ScheduleStatus.PLANNED,
            room: rooms.find(r => r.id === values.room)?.name || values.room,
            notes: values.notes,
          };
          newSchedules.push(newSchedule);
        }
      });
      
      if (newSchedules.length > 0) {
        setSchedules(prev => [...prev, ...newSchedules]);
      }
      
      const msg = datesToSave.length > 1 ? `已添加${datesToSave.length}节课程` : '课程已保存';
      message.success(msg);
      setModalVisible(false);
    }).catch(err => {
      console.error(err);
    });
  }

  function goPrevWeek() {
    setCurrentMonday(prev => prev.subtract(1, 'week'));
  }

  function goNextWeek() {
    setCurrentMonday(prev => prev.add(1, 'week'));
  }

  function goToday() {
    setCurrentMonday(today.startOf('isoWeek'));
  }

  function handleAddSchedule() {
    setEditingSchedule(null);
    form.resetFields();
    form.setFieldValue('date', dayjs());
    setBatchDates([dayjs()]);
    setModalVisible(true);
  }

  function handleRefreshCourseInfo() {
    if (!refreshDateRange) {
      message.warning('请选择日期范围');
      return;
    }
    const [startDate, endDate] = refreshDateRange;
    const db = (window as any).dbService;
    let count = 0;
    const updated = schedules.map(s => {
      const sDate = dayjs(s.start_time.split(' ')[0]);
      if (sDate.isBefore(startDate) || sDate.isAfter(endDate)) return s;
      const course = db?.getAllCourses?.()?.find((c: any) => c.id === s.course_id);
      if (!course) return s;
      count++;
      return { 
        ...s, 
        course_name: course.name || s.course_name, 
        room: course.room_name || s.room,
        course_type: course.type || s.course_type
      };
    });
    setSchedules(updated);
    message.success(`已更新 ${count} 条课程信息`);
    setRefreshModalVisible(false);
    setRefreshDateRange(null);
  }

  const upcomingHolidays = getUpcomingHolidays();

  return (
    <div style={{ padding: 16, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {upcomingHolidays.length > 0 && (
        <Alert
          message="📅 近期节假日提醒"
          description={
            <div style={{ lineHeight: '1.8' }}>
              {upcomingHolidays.map((h, idx) => (
                <span key={h.name} style={{ marginRight: 16 }}>
                  {h.name}：{h.start} ~ {h.end}
                  {idx < upcomingHolidays.length - 1 && ' | '}
                </span>
              ))}
            </div>
          }
          type="info"
          showIcon
          closable
          style={{ marginBottom: 16 }}
        />
      )}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Button onClick={goPrevWeek}>← 上周</Button>
          <Button onClick={goToday}>本周</Button>
          <Button onClick={goNextWeek}>下周 →</Button>
          <Divider type="vertical" />
          <Button 
            onClick={() => setCalendarOpen(!calendarOpen)}
            title="点击跳转到选定日期的课程表"
          >
            📅 选择日期
          </Button>
          <Button 
            onClick={() => {
              setRefreshDateRange([currentMonday, currentMonday.add(13, 'day')]);
              setRefreshModalVisible(true);
            }}
            title="刷新日期范围内所有排课的课程信息"
          >
            🔄 刷新课程信息
          </Button>
          {calendarOpen && (
            <div style={{ 
              position: 'absolute', 
              zIndex: 100, 
              background: 'white', 
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)', 
              borderRadius: 8, 
              padding: 8, 
              marginTop: 8 
            }}>
              <Calendar
                fullscreen={false}
                onSelect={(date) => {
                  const monday = date.startOf('isoWeek');
                  setCurrentMonday(monday);
                  setCalendarOpen(false);
                }}
              />
            </div>
          )}
          <Divider type="vertical" />
          <Button type="primary" onClick={handleAddSchedule}>➕ 排课</Button>
        </Space>
      </Card>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar
          teachers={teachers}
          selectedTeacherId={selectedTeacherId}
          courses={courses}
          onTeacherChange={setSelectedTeacherId}
        />

        <div style={{ flex: 1, paddingLeft: 16, overflow: 'auto' }}>
          <TwoWeeksView
            schedules={schedules}
            currentMonday={currentMonday}
            selectedTeacherId={selectedTeacherId}
            courses={courses}
            onDoubleClickDate={handleDoubleClickDate}
            onDoubleClickSchedule={handleDoubleClickSchedule}
            onScheduleStatusChange={handleScheduleStatusChange}
            onDropCourse={handleDropCourse}
            onDragSchedule={handleDragSchedule}
            onResizeSchedule={handleResizeSchedule}
            onDeleteSchedule={handleDeleteSchedule}
            onOpenStudentEdit={handleOpenStudentEdit}
          />
        </div>
      </div>

      <Modal
        title="排课窗口"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setModalVisible(false)}>取消</Button>,
          <Button key="save" type="primary" onClick={handleSave}>保存</Button>,
        ]}
        width={700}
      >
        <Form form={form} layout="vertical">
          <Form.Item label="日期">
            <Space direction="vertical" style={{ width: '100%' }}>
              {batchDates.map((d, idx) => (
                <Space key={idx} style={{ width: '100%' }}>
                  <DatePicker
                    style={{ flex: 1 }}
                    value={d}
                    onChange={(date) => {
                      if (date) {
                        const newDates = [...batchDates];
                        newDates[idx] = date;
                        setBatchDates(newDates);
                      }
                    }}
                  />
                  {batchDates.length > 1 && (
                    <Button
                      type="text"
                      danger
                      icon="❌"
                      onClick={() => {
                        const newDates = [...batchDates];
                        newDates.splice(idx, 1);
                        setBatchDates(newDates);
                      }}
                    />
                  )}
                </Space>
              ))}
              <Button
                type="dashed"
                style={{ width: '100%' }}
                onClick={() => setBatchDates([...batchDates, batchDates[batchDates.length - 1] || dayjs()])}
              >➕ 添加日期</Button>
              <div style={{ fontSize: 12, color: '#666' }}>
                共 {batchDates.length} 节课程
              </div>
            </Space>
          </Form.Item>
          
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="startTime" label="开始时间" rules={[{ required: true }]}>
                <TimePicker
                  format="HH:mm"
                  style={{ width: '100%' }}
                  onChange={(time) => {
                    if (time) {
                      const duration = form.getFieldValue('duration') || DEFAULT_DURATION_HOURS;
                      form.setFieldValue('endTime', time.add(duration, 'hour'));
                    }
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="duration" label="课程时长">
                <Select
                  style={{ width: '100%' }}
                  onChange={(val) => {
                    const startTime = form.getFieldValue('startTime');
                    if (startTime) {
                      form.setFieldValue('endTime', startTime.add(val, 'hour'));
                    }
                  }}
                >
                  <Option value={0.5}>30分钟</Option>
                  <Option value={1}>1小时</Option>
                  <Option value={1.5}>1.5小时</Option>
                  <Option value={2}>2小时</Option>
                  <Option value={2.5}>2.5小时</Option>
                  <Option value={3}>3小时</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="endTime" label="结束时间" rules={[{ required: true }]}>
                <TimePicker format="HH:mm" style={{ width: '100%' }} disabled />
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="teacherId" label="老师">
                <Select
                  mode="tags"
                  placeholder="选择老师"
                  showSearch
                  allowClear
                  maxTagCount={1}
                  options={teachers.map(t => ({ label: t.name, value: t.id }))}
                  filterOption={(input, option) =>
                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                  }
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="courseId" label="课程" rules={[{ required: true }]}>
                <Select
                  placeholder="选择课程"
                  options={courses
                    .filter(c => c.active && (!form.getFieldValue('teacherId') || c.teacher_id === form.getFieldValue('teacherId')))
                    .map(c => ({ label: c.display_name || c.name, value: c.id }))
                  }
                  onChange={(courseId) => {
                    const course = courses.find(c => c.id === courseId);
                    if (course) {
                      form.setFieldValue('courseName', course.display_name || course.name);
                      const roomId = (course.room_id && course.room_id.split(',')[0].trim()) || (rooms.find(r => r.name === course.room_name)?.id) || course.room_name || ''; form.setFieldValue('room', roomId);
                    }
                  }}
                />
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item name="courseName" rules={[{ required: true }]} style={{ display: 'none' }}>
            <Input />
          </Form.Item>
          
          <Form.Item name="status" label="课程状态" initialValue={ScheduleStatus.PLANNED}>
            <Select>
              <Option value={ScheduleStatus.PLANNED}>✅ 正常</Option>
              <Option value={ScheduleStatus.LEAVE}>🏠 请假</Option>
              <Option value={ScheduleStatus.CANCELLED}>❌ 取消</Option>
            </Select>
          </Form.Item>
          
          <Form.Item name="room" label="上课地址">
            <Select
              placeholder="选择上课地址"
              showSearch
              allowClear
              options={rooms.map(r => ({ label: r.address ? `${r.name} (${r.address})` : r.name, value: r.id }))}
            />
          </Form.Item>
          
          <Form.Item name="notes" label="备注">
            <Input.TextArea placeholder="输入备注" rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`学生出勤和费用 - ${studentEditModal.schedule?.course_name || ''}`}
        open={studentEditModal.open}
        onCancel={() => setStudentEditModal({ open: false, schedule: null })}
        onOk={() => handleSaveStudentEdit()}
        width={700}
      >
        {studentEditModal.schedule && (
          <Form form={studentEditForm} layout="vertical">
            {(courseStudentPricings || []).map((sp, idx) => {
              const student = allStudents.find(s => s.id === sp.student_id);
              return (
                <Card
                  size="small"
                  key={sp.student_id}
                  title={`${idx+1}. ${student?.name || '未知学生'}`}
                  style={{ marginBottom: 12 }}
                >
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item
                        name={['students', idx, 'status']}
                        label="出勤状态"
                        initialValue={sp.status || ScheduleStatus.PLANNED}
                      >
                        <Select>
                          <Option value={ScheduleStatus.PLANNED}>正常出勤</Option>
                          <Option value={ScheduleStatus.LEAVE}>请假</Option>
                          <Option value={ScheduleStatus.CANCELLED}>取消</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        name={['students', idx, 'tuition']}
                        label="学费/小时"
                        initialValue={sp.tuition}
                      >
                        <InputNumber min={0} prefix="¥" style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item
                        name={['students', idx, 'teacher_fee']}
                        label="课时费/小时"
                        initialValue={sp.teacher_fee || sp.tuition}
                      >
                        <InputNumber min={0} prefix="¥" style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                </Card>
              );
            })}
            {(!courseStudentPricings || courseStudentPricings.length === 0) && (
              <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>
                该课程未绑定学生信息
              </div>
            )}
          </Form>
        )}
      </Modal>

      <Modal
        title="刷新课程信息"
        open={refreshModalVisible}
        onCancel={() => { setRefreshModalVisible(false); setRefreshDateRange(null); }}
        onOk={handleRefreshCourseInfo}
        okText="开始刷新"
        cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          <p>选择日期范围，系统将遍历该范围内的所有排课，重新从课程数据库读取最新信息并更新排课记录。</p>
          <p style={{ color: '#999', fontSize: 12 }}>更新字段：课程名称、上课地址、老师名称、学生学费/课时费</p>
        </div>
        <Form layout="vertical">
          <Form.Item label="日期范围" required>
            <DatePicker.RangePicker
              value={refreshDateRange as any}
              onChange={(dates) => setRefreshDateRange(dates as [Dayjs, Dayjs])}
              style={{ width: '100%' }}
              format="YYYY-MM-DD"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ScheduleCalendar;
