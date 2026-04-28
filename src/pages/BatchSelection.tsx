import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ScheduleStatus, Course } from '../types';
import dayjs, { Dayjs } from 'dayjs';

// 本地的ScheduleEvent类型定义
interface ScheduleEvent {
  id: string;
  course_id: string;
  course_name: string;
  course_type: any;
  start_time: string;
  end_time: string;
  status: ScheduleStatus;
  room?: string;
  notes?: string;
}

// 常量
const COLUMN_WIDTH = 140;
const SLOT_HEIGHT = 2.5;
const MIN_START_HOUR = 8;
const MAX_END_HOUR = 23;
const DAY_GAP = 8;

// 工具函数
const timeToSlot = (hour: number, minute: number) => 
  Math.floor(((hour - MIN_START_HOUR) * 60 + minute) / 5);

const formatTime = (hour: number, minute: number) =>
  `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

interface BatchSelectionProps {
  containerRef: React.RefObject<HTMLDivElement>;
  schedules: ScheduleEvent[];
  courses: Course[];
  currentMonday: Dayjs;
  onSchedulesUpdated: (newSchedules: ScheduleEvent[]) => void;
}

// 核心组件
export const BatchSelection: React.FC<BatchSelectionProps> = ({
  containerRef,
  schedules,
  courses,
  currentMonday,
  onSchedulesUpdated,
}) => {
  // 状态
  const [phase, setPhase] = useState<'idle' | 'drawing' | 'selected' | 'dragging'>('idle');
  const [selection, setSelection] = useState<{
    dayStart: number; slotStart: number; dayEnd: number; slotEnd: number;
    courseIds: string[];
  } | null>(null);
  const [dragStart, setDragStart] = useState<{ day: number; slot: number } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ day: number; slot: number }>({ day: 0, slot: 0 });
  const [isCopy, setIsCopy] = useState(false);
  const [outOfBounds, setOutOfBounds] = useState(false);

  // 两周日期数组
  const twoWeeks = React.useMemo(() => {
    const days: Dayjs[] = [];
    for (let i = 0; i < 14; i++) {
      days.push(currentMonday.add(i, 'day'));
    }
    return days;
  }, [currentMonday]);

  // 从鼠标位置计算 day/slot
  const getDaySlot = useCallback((e: React.MouseEvent): { day: number; slot: number } | null => {
    const container = containerRef.current;
    if (!container) return null;

    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el) return null;

    const dayEl = (el as HTMLElement).closest('[data-date]') as HTMLElement;
    if (!dayEl) return null;
    const dateStr = dayEl.getAttribute('data-date');
    if (!dateStr) return null;

    const dayIdx = twoWeeks.findIndex(d => d.format('YYYY-MM-DD') === dateStr);
    if (dayIdx < 0) return null;

    const bodyEl = dayEl.querySelector('[data-day-body="true"]') as HTMLElement;
    if (!bodyEl) return null;
    const bodyRect = bodyEl.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    const relY = e.clientY - bodyRect.top + container.scrollTop - (bodyRect.top - containerRect.top);
    const slot = Math.floor(relY / SLOT_HEIGHT);

    return { day: dayIdx, slot: Math.max(0, slot) };
  }, [containerRef, twoWeeks]);

  // 处理事件
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) {
      // 右键清除选择
      if (phase !== 'idle') {
        setPhase('idle');
        setSelection(null);
      }
      return;
    }

    const pos = getDaySlot(e);
    if (!pos) return;

    // 检查是否在已有矩形框内
    if (phase === 'selected' && selection) {
      const inRect = pos.day >= selection.dayStart && pos.day <= selection.dayEnd &&
                     pos.slot >= selection.slotStart && pos.slot <= selection.slotEnd;
      if (inRect) {
        // 开始拖拽
        setPhase('dragging');
        setIsCopy(e.ctrlKey || e.metaKey);
        setDragStart({ day: pos.day, slot: pos.slot });
        setDragOffset({ day: 0, slot: 0 });
        return;
      }
    }

    // 点击矩形框外或空闲：清除选择，开始绘制新矩形
    setSelection(null);
    setPhase('drawing');
    setDragStart({ day: pos.day, slot: pos.slot });
    setDragOffset({ day: 0, slot: 0 });
  }, [phase, selection, getDaySlot]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const pos = getDaySlot(e);
    if (!pos) return;

    if (phase === 'drawing' && dragStart) {
      // 绘制矩形：找出框内的所有课程
      const dayStart = Math.min(dragStart.day, pos.day);
      const dayEnd = Math.max(dragStart.day, pos.day);
      const slotStart = Math.min(dragStart.slot, pos.slot);
      const slotEnd = Math.max(dragStart.slot, pos.slot);

      const selectedCourseIds: string[] = [];
      schedules.forEach(s => {
        if (s.status !== ScheduleStatus.PLANNED) return; // 只选正常状态
        const [date, sTime] = s.start_time.split(' ');
        const endParts = s.end_time.split(' ');
        const eTime = endParts.length >= 2 ? endParts[1] : endParts[0];
        if (!eTime) return;
        const [sH, sM] = sTime.split(':').map(Number);
        const [eH, eM] = eTime.split(':').map(Number);
        const cDay = twoWeeks.findIndex(d => d.format('YYYY-MM-DD') === date);
        const cStart = timeToSlot(sH, sM);
        const cEnd = timeToSlot(eH, eM);

        if (cDay >= dayStart && cDay <= dayEnd && cEnd >= slotStart && cStart <= slotEnd) {
          selectedCourseIds.push(s.id);
        }
      });

      setSelection({
        dayStart, slotStart, dayEnd, slotEnd,
        courseIds: selectedCourseIds,
      });
    } else if (phase === 'dragging' && dragStart && selection) {
      // 批量移动/复制
      const deltaDay = pos.day - dragStart.day;
      const deltaSlot = pos.slot - dragStart.slot;
      setDragOffset({ day: deltaDay, slot: deltaSlot });

      // 边界检查
      const newDayEnd = selection.dayEnd + deltaDay;
      const newSlotStart = selection.slotStart + deltaSlot;
      const newSlotEnd = selection.slotEnd + deltaSlot;
      const maxSlot = ((MAX_END_HOUR - MIN_START_HOUR) * 60) / 5;

      setOutOfBounds(newDayEnd < 0 || newDayEnd >= 14 || newSlotStart < 0 || newSlotEnd > maxSlot);
    }
  }, [phase, dragStart, selection, getDaySlot, schedules, twoWeeks]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const pos = getDaySlot(e);

    if (phase === 'drawing') {
      if (selection && selection.courseIds.length > 0) {
        setPhase('selected');
      } else {
        setPhase('idle');
        setSelection(null);
      }
    } else if (phase === 'dragging' && selection && dragStart && pos) {
      const deltaDay = pos.day - dragStart.day;
      const deltaSlot = pos.slot - dragStart.slot;

      if ((deltaDay === 0 && deltaSlot === 0) || outOfBounds) {
        // 没有移动或超界：只结束拖拽
        setPhase('selected');
        setDragOffset({ day: 0, slot: 0 });
        return;
      }

      // 执行批量移动/复制
      const newSchedules = [...schedules];

      if (isCopy) {
        // 复制：创建新排课
        selection.courseIds.forEach(courseId => {
          const s = schedules.find(s => s.id === courseId);
          if (!s) return;
          const [oldDate, oldStartTime] = s.start_time.split(' ');
          const endParts = s.end_time.split(' ');
          const oldEndTime = endParts.length >= 2 ? endParts[1] : endParts[0];
          const [sH, _sM] = oldStartTime.split(':').map(Number);
          const [eH, _eM] = oldEndTime.split(':').map(Number);
          const oldDayIdx = twoWeeks.findIndex(d => d.format('YYYY-MM-DD') === oldDate);
          const oldSlot = timeToSlot(sH, _sM);
          const oldEndSlot = timeToSlot(eH, _eM);
          const duration = oldEndSlot - oldSlot;

          const newDayIdx = oldDayIdx + deltaDay;
          const newSlot = oldSlot + deltaSlot;
          const newEndSlot = newSlot + duration;

          if (newDayIdx < 0 || newDayIdx >= 14) return;

          const newDay = twoWeeks[newDayIdx];
          const nSH = MIN_START_HOUR + Math.floor(newSlot * 5 / 60);
          const nSM = (newSlot * 5) % 60;
          const nEH = MIN_START_HOUR + Math.floor(newEndSlot * 5 / 60);
          const nEM = (newEndSlot * 5) % 60;

          newSchedules.push({
            ...s,
            id: s.id + '_copy_' + Date.now(),
            start_time: `${newDay.format('YYYY-MM-DD')} ${formatTime(nSH, nSM)}`,
            end_time: `${newDay.format('YYYY-MM-DD')} ${formatTime(nEH, nEM)}`,
          });
        });
      } else {
        // 移动：更新原有排课
        selection.courseIds.forEach(courseId => {
          const idx = newSchedules.findIndex(s => s.id === courseId);
          if (idx < 0) return;
          const s = newSchedules[idx];
          const [oldDate, oldStartTime] = s.start_time.split(' ');
          const endParts = s.end_time.split(' ');
          const oldEndTime = endParts.length >= 2 ? endParts[1] : endParts[0];
          const [sH, _sM] = oldStartTime.split(':').map(Number);
          const [eH, _eM] = oldEndTime.split(':').map(Number);
          const oldDayIdx = twoWeeks.findIndex(d => d.format('YYYY-MM-DD') === oldDate);
          const oldSlot = timeToSlot(sH, _sM);
          const oldEndSlot = timeToSlot(eH, _eM);
          const duration = oldEndSlot - oldSlot;

          const newDayIdx = oldDayIdx + deltaDay;
          const newSlot = oldSlot + deltaSlot;
          const newEndSlot = newSlot + duration;

          if (newDayIdx < 0 || newDayIdx >= 14) return;

          const newDay = twoWeeks[newDayIdx];
          const nSH = MIN_START_HOUR + Math.floor(newSlot * 5 / 60);
          const nSM = (newSlot * 5) % 60;
          const nEH = MIN_START_HOUR + Math.floor(newEndSlot * 5 / 60);
          const nEM = (newEndSlot * 5) % 60;

          newSchedules[idx] = {
            ...s,
            start_time: `${newDay.format('YYYY-MM-DD')} ${formatTime(nSH, nSM)}`,
            end_time: `${newDay.format('YYYY-MM-DD')} ${formatTime(nEH, nEM)}`,
          };
        });
      }

      onSchedulesUpdated(newSchedules);
      setPhase('idle');
      setSelection(null);
      setDragOffset({ day: 0, slot: 0 });
    }
  }, [phase, selection, dragStart, outOfBounds, isCopy, getDaySlot, schedules, twoWeeks, onSchedulesUpdated]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setPhase('idle');
    setSelection(null);
  };

  // 计算矩形像素位置（简化版）
  const [rectBounds, setRectBounds] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  useEffect(() => {
    if (!selection || !containerRef.current) {
      setRectBounds(null);
      return;
    }

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const dayEls = container.querySelectorAll('[data-date]');
    let dayStartLeft = 0, dayEndRight = 0;
    dayEls.forEach(el => {
      const e = el as HTMLElement;
      const idx = twoWeeks.findIndex(d => d.format('YYYY-MM-DD') === e.getAttribute('data-date'));
      if (idx === selection.dayStart) {
        const dr = e.getBoundingClientRect();
        dayStartLeft = dr.left - rect.left;
      }
      if (idx === selection.dayEnd) {
        const dr = e.getBoundingClientRect();
        dayEndRight = dr.right - rect.left;
      }
    });

    setRectBounds({
      left: dayStartLeft,
      top: selection.slotStart * SLOT_HEIGHT,
      width: dayEndRight - dayStartLeft,
      height: (selection.slotEnd - selection.slotStart + 1) * SLOT_HEIGHT,
    });
  }, [selection, containerRef, twoWeeks]);

  // 计算拖拽中的虚影位置
  const ghostBounds = React.useMemo(() => {
    if (!rectBounds || phase !== 'dragging') return null;
    return {
      left: rectBounds.left + dragOffset.day * (COLUMN_WIDTH + DAY_GAP),
      top: rectBounds.top + dragOffset.slot * SLOT_HEIGHT,
      width: rectBounds.width,
      height: rectBounds.height,
    };
  }, [rectBounds, phase, dragOffset]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
        pointerEvents: phase === 'idle' ? 'none' : 'auto',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={handleContextMenu}
    >
      {/* 选择矩形 */}
      {rectBounds && (phase === 'selected' || phase === 'drawing') && (
        <div
          style={{
            position: 'absolute',
            left: rectBounds.left,
            top: rectBounds.top,
            width: rectBounds.width,
            height: rectBounds.height,
            border: '2px dashed #1890ff',
            background: 'rgba(24, 144, 255, 0.08)',
            borderRadius: 4,
          }}
        >
          {phase === 'selected' && selection && (
            <div style={{
              position: 'absolute',
              top: -24,
              left: 4,
              background: '#1890ff',
              color: 'white',
              padding: '1px 8px',
              borderRadius: 10,
              fontSize: 11,
              whiteSpace: 'nowrap',
            }}>
              已选 {selection.courseIds.length} 课 · 拖拽移动 · Ctrl+拖拽复制
            </div>
          )}
        </div>
      )}

      {/* 拖拽虚影 */}
      {ghostBounds && selection && (
        <div
          style={{
            position: 'absolute',
            left: ghostBounds.left,
            top: ghostBounds.top,
            width: ghostBounds.width,
            height: ghostBounds.height,
            border: '2px dashed #faad14',
            background: 'rgba(250, 173, 20, 0.12)',
            borderRadius: 4,
          }}
        >
          {outOfBounds ? (
            <div style={{
              position: 'absolute',
              top: -28,
              left: 4,
              background: '#ff4d4f',
              color: 'white',
              padding: '1px 8px',
              borderRadius: 10,
              fontSize: 11,
              whiteSpace: 'nowrap',
              fontWeight: 'bold',
            }}>
              ⚠️ 超出范围，无法放置
            </div>
          ) : (
            <div style={{
              position: 'absolute',
              top: -24,
              left: 4,
              background: '#faad14',
              color: 'white',
              padding: '1px 8px',
              borderRadius: 10,
              fontSize: 11,
              whiteSpace: 'nowrap',
            }}>
              {isCopy ? '复制中…' : '移动中…'} · {selection.courseIds.length} 课 · 松开确认
            </div>
          )}

          {/* 显示选中的课程预览 */}
          {selection.courseIds.map(courseId => {
            const s = schedules.find(s => s.id === courseId);
            if (!s) return null;
            const oldDayIdx = twoWeeks.findIndex(d => d.format('YYYY-MM-DD') === s.start_time.split(' ')[0]);
            const relDay = oldDayIdx - (selection.dayStart || 0);
            const [sTime] = s.start_time.split(' ').slice(1);
            const endParts = s.end_time.split(' ');
            const eTime = endParts.length >= 2 ? endParts[1] : endParts[0];
            const [sH, sM] = sTime.split(':').map(Number);
            const [eH, eM] = eTime.split(':').map(Number);
            const relTop = (timeToSlot(sH, sM) - (selection.slotStart || 0)) * SLOT_HEIGHT;
            const relHeight = Math.max(20, (timeToSlot(eH, eM) - timeToSlot(sH, sM)) * SLOT_HEIGHT);
            return (
              <div key={courseId} style={{
                position: 'absolute',
                left: relDay * (COLUMN_WIDTH + DAY_GAP) + 4,
                top: relTop,
                width: COLUMN_WIDTH - 8,
                height: relHeight,
                background: 'rgba(24, 144, 255, 0.85)',
                borderRadius: 4,
                padding: 2,
                fontSize: 10,
                color: 'white',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                <div style={{ fontWeight: 'bold', lineHeight: 1.1 }}>{s.course_name}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BatchSelection;
