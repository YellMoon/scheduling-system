import React, { useState, useCallback, useEffect } from 'react';
import { ScheduleStatus, Course } from '../types';
import dayjs, { Dayjs } from 'dayjs';

// 本地ScheduleEvent类型
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

const COLUMN_WIDTH = 140;
const SLOT_HEIGHT = 2.5;
const MIN_START_HOUR = 8;
const MAX_END_HOUR = 23;
const DAY_GAP = 8;

const timeToSlot = (h: number, m: number) => Math.floor(((h - MIN_START_HOUR) * 60 + m) / 5);
const formatTime = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

export interface BatchState {
  phase: 'idle' | 'drawing' | 'selected' | 'dragging';
  rectBounds: { left: number; top: number; width: number; height: number } | null;
  ghostBounds: { left: number; top: number; width: number; height: number } | null;
  selectionInfo: { courseIds: string[] } | null;
  coursePreviews: Array<{ id: string; relDay: number; relTop: number; relHeight: number; name: string; sH: number; sM: number; eH: number; eM: number }>;
  isCopy: boolean;
  outOfBounds: boolean;
}

// 纯渲染组件——不处理鼠标事件
export const BatchVisuals: React.FC<{ state: BatchState }> = ({ state }) => {
  if (state.phase === 'idle') return null;
  return (
    <>
      {(state.phase === 'selected' || state.phase === 'drawing') && state.rectBounds && (
        <div style={{ position: 'absolute', left: state.rectBounds.left, top: state.rectBounds.top, width: state.rectBounds.width, height: state.rectBounds.height, border: '2px dashed #1890ff', background: 'rgba(24,144,255,0.08)', borderRadius: 4, zIndex: 101, pointerEvents: 'none' }}>
          {state.phase === 'selected' && state.selectionInfo && (
            <div style={{ position: 'absolute', top: -24, left: 4, background: '#1890ff', color: 'white', padding: '1px 8px', borderRadius: 10, fontSize: 11, whiteSpace: 'nowrap' }}>
              已选 {state.selectionInfo.courseIds.length} 课 · 拖拽移动 · Ctrl+拖拽复制
            </div>
          )}
        </div>
      )}
      {state.phase === 'dragging' && state.ghostBounds && (
        <div style={{ position: 'absolute', left: state.ghostBounds.left, top: state.ghostBounds.top, width: state.ghostBounds.width, height: state.ghostBounds.height, border: '2px dashed #faad14', background: 'rgba(250,173,20,0.12)', borderRadius: 4, zIndex: 102, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: state.outOfBounds ? -28 : -24, left: 4, background: state.outOfBounds ? '#ff4d4f' : '#faad14', color: 'white', padding: '1px 8px', borderRadius: 10, fontSize: 11, whiteSpace: 'nowrap', fontWeight: state.outOfBounds ? 'bold' : 'normal' }}>
            {state.outOfBounds ? '⚠️ 超出范围，无法放置' : `${state.isCopy ? '复制中…' : '移动中…'} · 松开确认`}
          </div>
          {state.coursePreviews.map(cp => (
            <div key={cp.id} style={{ position: 'absolute', left: cp.relDay * (COLUMN_WIDTH + DAY_GAP) + 4, top: cp.relTop, width: COLUMN_WIDTH - 8, height: Math.max(20, cp.relHeight), background: 'rgba(24,144,255,0.85)', borderRadius: 4, padding: 2, fontSize: 10, color: 'white', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ fontWeight: 'bold', lineHeight: 1.1 }}>{cp.name}</div>
              <div style={{ fontSize: 9, opacity: 0.9 }}>{formatTime(cp.sH, cp.sM)}-{formatTime(cp.eH, cp.eM)}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

// 事件处理 Hook
export function useBatchSelection(
  containerRef: React.RefObject<HTMLDivElement>,
  schedules: ScheduleEvent[],
  courses: Course[],
  currentMonday: Dayjs,
  onSchedulesUpdated: (s: ScheduleEvent[]) => void
) {
  const [phase, setPhase] = useState<'idle' | 'drawing' | 'selected' | 'dragging'>('idle');
  const [selection, setSelection] = useState<{ dayStart: number; slotStart: number; dayEnd: number; slotEnd: number; courseIds: string[] } | null>(null);
  const [dragStart, setDragStart] = useState<{ day: number; slot: number } | null>(null);
  const [dragOffset, setDragOffset] = useState({ day: 0, slot: 0 });
  const [isCopy, setIsCopy] = useState(false);
  const [outOfBounds, setOutOfBounds] = useState(false);
  const [rectBounds, setRectBounds] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  const twoWeeks = React.useMemo(() => {
    const days: Dayjs[] = [];
    for (let i = 0; i < 14; i++) days.push(currentMonday.add(i, 'day'));
    return days;
  }, [currentMonday]);

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

  // 检查点击是否在课程卡片上
  const isOnCourse = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // 课程框有 draggable="true" 属性
    if (target.closest('[draggable="true"]')) return true;
    // 检查是否点击在课程渲染区域内（通过样式判断：绝对定位 + 有背景色的子元素）
    const dayBody = target.closest('[data-day-body="true"]');
    if (!dayBody) return false;
    // 如果点击的元素或其父元素有绝对定位且不是dayBody本身，可能是课程卡
    let el: HTMLElement | null = target;
    while (el && el !== dayBody) {
      if (el.style.position === 'absolute' || el.getAttribute('draggable') === 'true') return true;
      el = el.parentElement;
    }
    return false;
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) {
      if (phase !== 'idle') { setPhase('idle'); setSelection(null); }
      return;
    }
    // 如果点击在课程卡片上，不处理
    if (isOnCourse(e)) return;

    const pos = getDaySlot(e);
    if (!pos) return;

    if (phase === 'selected' && selection) {
      const inRect = pos.day >= selection.dayStart && pos.day <= selection.dayEnd && pos.slot >= selection.slotStart && pos.slot <= selection.slotEnd;
      if (inRect) {
        setPhase('dragging');
        setIsCopy(e.ctrlKey || e.metaKey);
        setDragStart({ day: pos.day, slot: pos.slot });
        setDragOffset({ day: 0, slot: 0 });
        e.preventDefault();
        return;
      }
    }

    setSelection(null);
    setPhase('drawing');
    setDragStart({ day: pos.day, slot: pos.slot });
    setDragOffset({ day: 0, slot: 0 });
    e.preventDefault();
  }, [phase, selection, getDaySlot, isOnCourse]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (phase === 'idle') return;
    const pos = getDaySlot(e);
    if (!pos) return;

    if (phase === 'drawing' && dragStart) {
      const dayStart = Math.min(dragStart.day, pos.day);
      const dayEnd = Math.max(dragStart.day, pos.day);
      const slotStart = Math.min(dragStart.slot, pos.slot);
      const slotEnd = Math.max(dragStart.slot, pos.slot);
      const ids: string[] = [];
      schedules.forEach(s => {
        if (s.status !== ScheduleStatus.PLANNED) return;
        const [date, sTime] = s.start_time.split(' ');
        const ep = s.end_time.split(' ');
        const eTime = ep.length >= 2 ? ep[1] : ep[0];
        if (!eTime) return;
        const [sH, sM] = sTime.split(':').map(Number);
        const [eH, eM] = eTime.split(':').map(Number);
        const cDay = twoWeeks.findIndex(d => d.format('YYYY-MM-DD') === date);
        if (cDay >= dayStart && cDay <= dayEnd && timeToSlot(eH, eM) >= slotStart && timeToSlot(sH, sM) <= slotEnd) {
          ids.push(s.id);
        }
      });
      setSelection({ dayStart, slotStart, dayEnd, slotEnd, courseIds: ids });
    } else if (phase === 'dragging' && dragStart && selection) {
      const dd = pos.day - dragStart.day;
      const ds = pos.slot - dragStart.slot;
      setDragOffset({ day: dd, slot: ds });
      const nde = selection.dayEnd + dd;
      const nss = selection.slotStart + ds;
      const nse = selection.slotEnd + ds;
      const maxSlot = ((MAX_END_HOUR - MIN_START_HOUR) * 60) / 5;
      setOutOfBounds(nde < 0 || nde >= 14 || nss < 0 || nse > maxSlot);
    }
  }, [phase, dragStart, selection, getDaySlot, schedules, twoWeeks]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const pos = getDaySlot(e);
    if (phase === 'drawing') {
      setPhase(selection && selection.courseIds.length > 0 ? 'selected' : 'idle');
      if (!selection || selection.courseIds.length === 0) setSelection(null);
    } else if (phase === 'dragging' && selection && dragStart && pos) {
      const dd = pos.day - dragStart.day;
      const ds = pos.slot - dragStart.slot;
      if ((dd === 0 && ds === 0) || outOfBounds) {
        setPhase('selected'); setDragOffset({ day: 0, slot: 0 }); return;
      }
      const newSchedules = [...schedules];
      selection.courseIds.forEach(courseId => {
        const s = schedules.find(s => s.id === courseId);
        if (!s) return;
        const [oldDate, oldST] = s.start_time.split(' ');
        const ep = s.end_time.split(' ');
        const oldET = ep.length >= 2 ? ep[1] : ep[0];
        const [sH, _sM] = oldST.split(':').map(Number);
        const [eH, _eM] = oldET.split(':').map(Number);
        const oldDay = twoWeeks.findIndex(d => d.format('YYYY-MM-DD') === oldDate);
        const oldSlot = timeToSlot(sH, _sM);
        const dur = timeToSlot(eH, _eM) - oldSlot;
        const nd = oldDay + dd, ns = oldSlot + ds, ne = ns + dur;
        if (nd < 0 || nd >= 14) return;
        const newDay = twoWeeks[nd];
        const nSH = MIN_START_HOUR + Math.floor(ns * 5 / 60), nSM = (ns * 5) % 60;
        const nEH = MIN_START_HOUR + Math.floor(ne * 5 / 60), nEM = (ne * 5) % 60;

        if (isCopy) {
          newSchedules.push({ ...s, id: s.id + '_copy_' + Date.now(), start_time: `${newDay.format('YYYY-MM-DD')} ${formatTime(nSH, nSM)}`, end_time: `${newDay.format('YYYY-MM-DD')} ${formatTime(nEH, nEM)}` });
        } else {
          const idx = newSchedules.findIndex(x => x.id === courseId);
          if (idx >= 0) newSchedules[idx] = { ...s, start_time: `${newDay.format('YYYY-MM-DD')} ${formatTime(nSH, nSM)}`, end_time: `${newDay.format('YYYY-MM-DD')} ${formatTime(nEH, nEM)}` };
        }
      });
      onSchedulesUpdated(newSchedules);
      setPhase('idle'); setSelection(null); setDragOffset({ day: 0, slot: 0 });
    }
  }, [phase, selection, dragStart, outOfBounds, isCopy, getDaySlot, schedules, twoWeeks, onSchedulesUpdated]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (phase !== 'idle') {
      e.preventDefault();
      setPhase('idle'); setSelection(null);
    }
  }, [phase]);

  // 更新像素位置
  useEffect(() => {
    if (!selection || !containerRef.current) { setRectBounds(null); return; }
    const container = containerRef.current;
    const cr = container.getBoundingClientRect();
    const dayEls = container.querySelectorAll('[data-date]');
    let left = 0, right = 0;
    dayEls.forEach(el => {
      const e = el as HTMLElement;
      const idx = twoWeeks.findIndex(d => d.format('YYYY-MM-DD') === e.getAttribute('data-date'));
      if (idx === selection.dayStart) { const dr = e.getBoundingClientRect(); left = dr.left - cr.left; }
      if (idx === selection.dayEnd) { const dr = e.getBoundingClientRect(); right = dr.right - cr.left; }
    });
    setRectBounds({ left, top: selection.slotStart * SLOT_HEIGHT, width: right - left, height: (selection.slotEnd - selection.slotStart + 1) * SLOT_HEIGHT });
  }, [selection, containerRef, twoWeeks]);

  const ghostBounds = React.useMemo(() => {
    if (!rectBounds || phase !== 'dragging') return null;
    return { left: rectBounds.left + dragOffset.day * (COLUMN_WIDTH + DAY_GAP), top: rectBounds.top + dragOffset.slot * SLOT_HEIGHT, width: rectBounds.width, height: rectBounds.height };
  }, [rectBounds, phase, dragOffset]);

  // 构建批量状态
  const batchState: BatchState = {
    phase, rectBounds, ghostBounds,
    selectionInfo: selection ? { courseIds: selection.courseIds } : null,
    coursePreviews: (phase === 'dragging' && selection) ? selection.courseIds.map(courseId => {
      const s = schedules.find(s => s.id === courseId);
      if (!s) return { id: courseId, relDay: 0, relTop: 0, relHeight: 20, name: '?', sH: 8, sM: 0, eH: 9, eM: 0 };
      const oldDayIdx = twoWeeks.findIndex(d => d.format('YYYY-MM-DD') === s.start_time.split(' ')[0]);
      const [sTime] = s.start_time.split(' ').slice(1);
      const ep = s.end_time.split(' ');
      const eTime = ep.length >= 2 ? ep[1] : ep[0];
      const [sH, sM] = sTime.split(':').map(Number);
      const [eH, eM] = eTime.split(':').map(Number);
      return { id: courseId, relDay: oldDayIdx - (selection?.dayStart || 0), relTop: (timeToSlot(sH, sM) - (selection?.slotStart || 0)) * SLOT_HEIGHT, relHeight: (timeToSlot(eH, eM) - timeToSlot(sH, sM)) * SLOT_HEIGHT, name: s.course_name || courses.find(c => c.id === s.course_id)?.name || '课程', sH, sM, eH, eM };
    }) : [],
    isCopy, outOfBounds,
  };

  return { batchState, handleMouseDown, handleMouseMove, handleMouseUp, handleContextMenu };
}

export default useBatchSelection;
