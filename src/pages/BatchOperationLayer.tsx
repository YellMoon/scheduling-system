import React, { useState, useRef, useCallback, useEffect } from 'react';
import { ScheduleEvent, Course } from '../types';
import dayjs, { Dayjs } from 'dayjs';

// 常量（与 ScheduleCalendar 保持一致）
const COLUMN_WIDTH = 140;
const SLOT_HEIGHT = 2.5;
const MIN_START_HOUR = 8;
const MAX_END_HOUR = 23;
const SLOT_DURATION = 5;
const DAY_GAP = 8;

function timeToSlot(hour: number, minute: number) {
  return Math.floor(((hour - MIN_START_HOUR) * 60 + minute) / SLOT_DURATION);
}

function formatTime(hour: number, minute: number) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

interface BatchOperationLayerProps {
  containerRef: React.RefObject<HTMLDivElement>;
  schedules: ScheduleEvent[];
  currentMonday: Dayjs;
  onSchedulesUpdated: (updatedSchedules: ScheduleEvent[]) => void;
}

interface RectBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface SelectionState {
  bounds: RectBounds;    // 矩形在容器内的像素位置
  dayStart: number;      // 矩形左上角对应第几天（0-13）
  slotStart: number;     // 矩形左上角对应哪个slot
  dayEnd: number;
  slotEnd: number;
  courseIds: string[];   // 框中的课程ID列表
}

// 根据容器内像素坐标计算 dayIndex 和 slot
function pixelToDaySlot(
  containerRect: DOMRect,
  scrollTop: number,
  clientX: number,
  clientY: number,
  firstWeekHeaderHeight: number,
  dayHeaderHeight: number
): { dayIndex: number; slot: number } | null {
  const x = clientX - containerRect.left;
  const y = clientY - containerRect.top + scrollTop;

  // 第一周Y偏移 = 第一周header
  // 第二周Y偏移 = 第一周总高度 + 第二周header + 一些间距
  
  // 简化：查找包含 data-date 属性的元素
  const el = document.elementFromPoint(clientX, clientY);
  if (!el) return null;
  
  const dayEl = (el as HTMLElement).closest('[data-date]');
  if (!dayEl) return null;
  
  const dateStr = dayEl.getAttribute('data-date');
  if (!dateStr) return null;
  
  // 找到 dayBody（时间格子区域）
  const dayBody = dayEl.querySelector('[data-day-body]') || dayEl.querySelector('div:nth-child(2)');
  if (!dayBody) return null;
  
  const bodyRect = dayBody.getBoundingClientRect();
  const bodyY = clientY - bodyRect.top;
  const slot = Math.floor(bodyY / SLOT_HEIGHT);
  
  // 计算 dayIndex：相对于 currentMonday
  const dayDate = dayjs(dateStr);
  return { dayIndex: 0, slot: Math.max(0, slot) };
}

export const BatchOperationLayer: React.FC<BatchOperationLayerProps> = ({
  containerRef,
  schedules,
  currentMonday,
  onSchedulesUpdated,
}) => {
  const [drawing, setDrawing] = useState(false);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [dragMode, setDragMode] = useState<'none' | 'move' | 'copy'>('none');
  const [dragOffset, setDragOffset] = useState({ day: 0, slot: 0 });
  const [startPos, setStartPos] = useState({ x: 0, y: 0, dayIdx: 0, slot: 0 });
  const [outOfBounds, setOutOfBounds] = useState(false);
  const [ghostRect, setGhostRect] = useState<RectBounds | null>(null);

  // 计算两周所有14天的日期数组
  const twoWeeks = React.useMemo(() => {
    const days: Dayjs[] = [];
    for (let i = 0; i < 14; i++) {
      days.push(currentMonday.add(i, 'day'));
    }
    return days;
  }, [currentMonday]);

  // 根据 dayIndex 和 slot 计算日期时间
  const daySlotToDateTime = useCallback((dayIdx: number, slot: number) => {
    const day = twoWeeks[Math.max(0, Math.min(13, dayIdx))];
    const totalMins = slot * SLOT_DURATION;
    const hour = MIN_START_HOUR + Math.floor(totalMins / 60);
    const minute = totalMins % 60;
    return { date: day.format('YYYY-MM-DD'), time: formatTime(hour, minute), day, hour, minute };
  }, [twoWeeks]);

  // 获取鼠标所在位置的 dayIndex 和 slot
  const getDaySlotFromEvent = useCallback((e: React.MouseEvent): { dayIdx: number; slot: number } | null => {
    const container = containerRef.current;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top + container.scrollTop;

    // 查找鼠标下的 day 列
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el) return null;
    const dayEl = (el as HTMLElement).closest('[data-date]') as HTMLElement;
    if (!dayEl) return null;

    // 获取 day 列的 rect
    const dayRect = dayEl.getBoundingClientRect();
    const dayLeft = dayRect.left - rect.left;
    const dayIdx = twoWeeks.findIndex(d => d.format('YYYY-MM-DD') === dayEl.getAttribute('data-date'));
    if (dayIdx < 0) return null;

    // 找到时间格子区域
    const bodyEl = dayEl.querySelector('[data-day-body]') as HTMLElement;
    if (!bodyEl) return null;
    const bodyRect = bodyEl.getBoundingClientRect();
    const relY = e.clientY - bodyRect.top + container.scrollTop - (bodyRect.top - rect.top) + container.scrollTop;
    
    // 简化：直接用 bodyRect
    const bodyRelY = e.clientY - bodyRect.top;
    const slot = Math.floor(bodyRelY / SLOT_HEIGHT);

    return { dayIdx, slot: Math.max(0, slot) };
  }, [containerRef, twoWeeks]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) {
      // 右键：清除选择
      if (selection) { setSelection(null); setDrawing(false); }
      return;
    }

    if (e.ctrlKey || e.metaKey) return; // Ctrl+Click 由 mousemove 处理

    const pos = getDaySlotFromEvent(e);
    if (!pos) return;

    // 检查是否在已有矩形框内
    if (selection) {
      const inRect = pos.dayIdx >= selection.dayStart && pos.dayIdx <= selection.dayEnd &&
                     pos.slot >= selection.slotStart && pos.slot <= selection.slotEnd;
      if (inRect) {
        // 进入批量移动状态
        setDragMode('move');
        setDragOffset({ day: 0, slot: 0 });
        setStartPos({ x: e.clientX, y: e.clientY, dayIdx: pos.dayIdx, slot: pos.slot });
        setGhostRect({ ...selection.bounds });
        return;
      }
      // 点击矩形框外：清除选择
      setSelection(null);
      setDrawing(false);
    }

    // 开始绘制新矩形
    setDrawing(true);
    setStartPos({ x: e.clientX, y: e.clientY, dayIdx: pos.dayIdx, slot: pos.slot });
    setSelection(null);
  }, [selection, getDaySlotFromEvent]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const pos = getDaySlotFromEvent(e);
    if (!pos) return;

    if (!e.buttons) {
      // 没有按键按下
      setDrawing(false);
      if (dragMode !== 'none') {
        // 释放拖拽
        finishBatch(dragMode, pos);
      }
      return;
    }

    if (e.ctrlKey && selection && !drawing) {
      // Ctrl+左键在矩形框内：进入批量复制
      const inRect = pos.dayIdx >= selection.dayStart && pos.dayIdx <= selection.dayEnd &&
                     pos.slot >= selection.slotStart && pos.slot <= selection.slotEnd;
      if (inRect && dragMode !== 'copy') {
        setDragMode('copy');
        setDragOffset({ day: 0, slot: 0 });
        if (!startPos.x) setStartPos({ x: e.clientX, y: e.clientY, dayIdx: pos.dayIdx, slot: pos.slot });
        setGhostRect({ ...selection.bounds });
      }
    }

    if (dragMode !== 'none') {
      // 批量移动/复制
      const deltaDay = pos.dayIdx - startPos.dayIdx;
      const deltaSlot = pos.slot - startPos.slot;
      setDragOffset({ day: deltaDay, slot: deltaSlot });

      // 边界检查
      const newDayEnd = selection!.dayEnd + deltaDay;
      const newSlotStart = selection!.slotStart + deltaSlot;
      const newSlotEnd = selection!.slotEnd + deltaSlot;
      const maxSlot = ((MAX_END_HOUR - MIN_START_HOUR) * 60) / SLOT_DURATION;

      if (newDayEnd < 0 || newDayEnd >= 14 || newSlotStart < 0 || newSlotEnd > maxSlot) {
        setOutOfBounds(true);
      } else {
        setOutOfBounds(false);
      }

      // 更新虚影位置
      if (selection) {
        const container = containerRef.current;
        if (container) {
          const rect = container.getBoundingClientRect();
          setGhostRect({
            left: selection.bounds.left + deltaDay * (COLUMN_WIDTH + DAY_GAP),
            top: selection.bounds.top + deltaSlot * SLOT_HEIGHT,
            width: selection.bounds.width,
            height: selection.bounds.height,
          });
        }
      }
      return;
    }

    if (!drawing) return;

    // 绘制选择矩形
    const dayStart = Math.min(startPos.dayIdx, pos.dayIdx);
    const dayEnd = Math.max(startPos.dayIdx, pos.dayIdx);
    const slotStart = Math.min(startPos.slot, pos.slot);
    const slotEnd = Math.max(startPos.slot, pos.slot);

    // 找出矩形框内的所有课程（状态为正常）
    const selectedCourseIds: string[] = [];
    schedules.forEach(s => {
      if (s.status !== 'planned') return; // 只选正常状态的课程
      const [date, sTime] = s.start_time.split(' ');
      const [sH, sM] = sTime.split(':').map(Number);
      const [eTime] = s.end_time.split(' ')[1]?.split(', ') || [s.end_time.split(' ')[1]];
      if (!eTime) return;
      const [eH, eM] = eTime.split(':').map(Number);
      const cDay = twoWeeks.findIndex(d => d.format('YYYY-MM-DD') === date);
      const cStartSlot = timeToSlot(sH, sM);
      const cEndSlot = timeToSlot(eH, eM);

      if (cDay >= dayStart && cDay <= dayEnd && cEndSlot >= slotStart && cStartSlot <= slotEnd) {
        selectedCourseIds.push(s.id);
      }
    });

    // 计算矩形像素位置
    const container = containerRef.current;
    if (container) {
      const cr = container.getBoundingClientRect();
      // 找到 dayStart 列的左边和 dayEnd 列的右边
      const dayEls = container.querySelectorAll('[data-date]');
      let dayStartLeft = 0, dayEndRight = 0;
      dayEls.forEach((el) => {
        const dEl = el as HTMLElement;
        const dateStr = dEl.getAttribute('data-date');
        if (!dateStr) return;
        const idx = twoWeeks.findIndex(d => d.format('YYYY-MM-DD') === dateStr);
        if (idx === dayStart) {
          const dr = dEl.getBoundingClientRect();
          dayStartLeft = dr.left - cr.left;
        }
        if (idx === dayEnd) {
          const dr = dEl.getBoundingClientRect();
          dayEndRight = dr.right - cr.left;
        }
      });

      setSelection({
        bounds: {
          left: dayStartLeft,
          top: slotStart * SLOT_HEIGHT,
          width: dayEndRight - dayStartLeft,
          height: (slotEnd - slotStart + 1) * SLOT_HEIGHT,
        },
        dayStart,
        slotStart,
        dayEnd,
        slotEnd: slotEnd + 1,
        courseIds: selectedCourseIds,
      });
    }
  }, [drawing, dragMode, selection, startPos, getDaySlotFromEvent, schedules, twoWeeks, containerRef]);

  // 完成批量移动或复制
  const finishBatch = useCallback((mode: string, pos: { dayIdx: number; slot: number }) => {
    if (!selection || !selection.courseIds.length) {
      setDragMode('none');
      setGhostRect(null);
      return;
    }

    const deltaDay = pos.dayIdx - startPos.dayIdx;
    const deltaSlot = pos.slot - startPos.slot;

    if (deltaDay === 0 && deltaSlot === 0) {
      setDragMode('none');
      setGhostRect(null);
      return;
    }

    const updatedSchedules = [...schedules];

    if (mode === 'move') {
      // 批量移动：更新原有课程时间
      selection.courseIds.forEach(courseId => {
        const idx = updatedSchedules.findIndex(s => s.id === courseId);
        if (idx < 0) return;
        const s = updatedSchedules[idx];
        const [oldDate, oldStartTime] = s.start_time.split(' ');
        const [oldEndDate, oldEndTime] = s.end_time.split(' ');
        const [sH, _sM] = oldStartTime.split(':').map(Number);
        const [eH, _eM] = oldEndTime.split(':').map(Number);
        const oldDayIdx = twoWeeks.findIndex(d => d.format('YYYY-MM-DD') === oldDate);
        const oldSlot = timeToSlot(sH, _sM);
        const oldEndSlot = timeToSlot(eH, _eM);
        const durationSlots = oldEndSlot - oldSlot;

        const newDayIdx = oldDayIdx + deltaDay;
        const newSlot = oldSlot + deltaSlot;
        const newEndSlot = newSlot + durationSlots;

        if (newDayIdx < 0 || newDayIdx >= 14) return;

        const newDay = twoWeeks[newDayIdx];
        const totalStartMins = newSlot * SLOT_DURATION;
        const totalEndMins = newEndSlot * SLOT_DURATION;
        const nSH = MIN_START_HOUR + Math.floor(totalStartMins / 60);
        const nSM = totalStartMins % 60;
        const nEH = MIN_START_HOUR + Math.floor(totalEndMins / 60);
        const nEM = totalEndMins % 60;

        updatedSchedules[idx] = {
          ...s,
          start_time: `${newDay.format('YYYY-MM-DD')} ${formatTime(nSH, nSM)}`,
          end_time: `${newDay.format('YYYY-MM-DD')} ${formatTime(nEH, nEM)}`,
        };
      });
    } else if (mode === 'copy') {
      // 批量复制：创建新课程副本
      const newSchedules = [...schedules];
      selection.courseIds.forEach(courseId => {
        const s = schedules.find(s => s.id === courseId);
        if (!s) return;
        const [oldDate, oldStartTime] = s.start_time.split(' ');
        const [oldEndDate, oldEndTime] = s.end_time.split(' ');
        const [sH, _sM] = oldStartTime.split(':').map(Number);
        const [eH, _eM] = oldEndTime.split(':').map(Number);
        const oldDayIdx = twoWeeks.findIndex(d => d.format('YYYY-MM-DD') === oldDate);
        const oldSlot = timeToSlot(sH, _sM);
        const oldEndSlot = timeToSlot(eH, _eM);
        const durationSlots = oldEndSlot - oldSlot;

        const newDayIdx = oldDayIdx + deltaDay;
        const newSlot = oldSlot + deltaSlot;
        const newEndSlot = newSlot + durationSlots;

        if (newDayIdx < 0 || newDayIdx >= 14) return;

        const newDay = twoWeeks[newDayIdx];
        const totalStartMins = newSlot * SLOT_DURATION;
        const totalEndMins = newEndSlot * SLOT_DURATION;
        const nSH = MIN_START_HOUR + Math.floor(totalStartMins / 60);
        const nSM = totalStartMins % 60;
        const nEH = MIN_START_HOUR + Math.floor(totalEndMins / 60);
        const nEM = totalEndMins % 60;

        newSchedules.push({
          ...s,
          id: s.id + '_copy_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          start_time: `${newDay.format('YYYY-MM-DD')} ${formatTime(nSH, nSM)}`,
          end_time: `${newDay.format('YYYY-MM-DD')} ${formatTime(nEH, nEM)}`,
        });
      });
      onSchedulesUpdated(newSchedules);
      setSelection(null);
      setDragMode('none');
      setGhostRect(null);
      return;
    }

    onSchedulesUpdated(updatedSchedules);
    setSelection(null);
    setDragMode('none');
    setGhostRect(null);
  }, [selection, startPos, schedules, twoWeeks, onSchedulesUpdated]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (drawing) {
      // 完成矩形选择
      setDrawing(false);
      // 如果矩形太小（无效选择），清除
      if (selection && selection.dayStart === selection.dayEnd && 
          selection.slotEnd - selection.slotStart <= 2) {
        setSelection(null);
      }
    }
    if (dragMode !== 'none') {
      const pos = getDaySlotFromEvent(e);
      if (pos) finishBatch(dragMode, pos);
    }
  }, [drawing, dragMode, selection, getDaySlotFromEvent, finishBatch]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (selection) setSelection(null);
  }, [selection]);

  // 获取选中的课程列表
  const selectedCourses = selection ? schedules.filter(s => selection.courseIds.includes(s.id)) : [];
  
  // 是否显示批量操作虚影
  const showGhost = dragMode !== 'none' && ghostRect && selection;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
        pointerEvents: selection || drawing ? 'auto' : 'none',
        cursor: dragMode !== 'none' ? 'grabbing' : drawing ? 'crosshair' : selection ? 'default' : 'crosshair',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={handleContextMenu}
      onMouseLeave={() => {
        // 如果正在拖拽，不取消
        if (dragMode !== 'none') return;
      }}
    >
      {/* 选择矩形框 */}
      {selection && !showGhost && (
        <div
          style={{
            position: 'absolute',
            left: selection.bounds.left,
            top: selection.bounds.top,
            width: selection.bounds.width,
            height: selection.bounds.height,
            border: '2px dashed #1890ff',
            background: 'rgba(24, 144, 255, 0.08)',
            borderRadius: 4,
            zIndex: 101,
            pointerEvents: 'none',
          }}
        >
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
        </div>
      )}

      {/* 批量操作虚影 */}
      {showGhost && ghostRect && (
        <div
          style={{
            position: 'absolute',
            left: ghostRect.left,
            top: ghostRect.top,
            width: ghostRect.width,
            height: ghostRect.height,
            border: '2px dashed #faad14',
            background: 'rgba(250, 173, 20, 0.12)',
            borderRadius: 4,
            zIndex: 102,
            pointerEvents: 'none',
          }}
        >
          {outOfBounds && (
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
              ⚠️ 超出时间范围，无法放置
            </div>
          )}
          {!outOfBounds && (
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
              {dragMode === 'move' ? '移动中…' : '复制中…'} 
              {selection && selection.courseIds.length} 课 · 松开确认
            </div>
          )}

          {/* 悬浮课程框预览 */}
          {selectedCourses.map(s => {
            const oldDayIdx = twoWeeks.findIndex(d => d.format('YYYY-MM-DD') === s.start_time.split(' ')[0]);
            const relDay = oldDayIdx - (selection?.dayStart || 0);
            const [sTime] = s.start_time.split(' ').slice(1);
            const [eTime] = s.end_time.split(' ').slice(1);
            const [sH, sM] = sTime.split(':').map(Number);
            const [eH, eM] = eTime.split(':').map(Number);
            const relTop = (timeToSlot(sH, sM) - (selection?.slotStart || 0)) * SLOT_HEIGHT;
            const relHeight = Math.max(20, (timeToSlot(eH, eM) - timeToSlot(sH, sM)) * SLOT_HEIGHT);
            return (
              <div key={s.id} style={{
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
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 103,
              }}>
                <div style={{ fontWeight: 'bold', lineHeight: 1.1 }}>{s.course_name}</div>
                <div style={{ fontSize: 9, opacity: 0.9 }}>{formatTime(sH, sM)}-{formatTime(eH, eM)}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* 高亮选中的课程 */}
      {selection && !showGhost && selection.courseIds.map(courseId => {
        const s = schedules.find(s => s.id === courseId);
        if (!s) return null;
        const dayIdx = twoWeeks.findIndex(d => d.format('YYYY-MM-DD') === s.start_time.split(' ')[0]);
        if (dayIdx < 0) return null;
        const [sTime] = s.start_time.split(' ').slice(1);
        const [eTime] = s.end_time.split(' ').slice(1);
        const [sH, sM] = sTime.split(':').map(Number);
        const [eH, eM] = eTime.split(':').map(Number);
        return (
          <div key={'hl-' + courseId} style={{
            position: 'absolute',
            left: 0, // will be adjusted below
            top: timeToSlot(sH, sM) * SLOT_HEIGHT,
            width: 0, // will be adjusted below
            height: Math.max(20, (timeToSlot(eH, eM) - timeToSlot(sH, sM)) * SLOT_HEIGHT),
            border: '2px solid #1890ff',
            background: 'rgba(24, 144, 255, 0.15)',
            borderRadius: 4,
            zIndex: 99,
            pointerEvents: 'none',
          }} />
        );
      })}
    </div>
  );
};

export default BatchOperationLayer;
