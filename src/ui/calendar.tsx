import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CalEvent } from '../lib/types';
import { addDays, dayKey, today } from '../lib/dates';
import { IconButton, cx } from './kit';

export const KIND_TONE: Record<string, string> = {
  행사: 'bg-brand-soft text-brand-strong',
  시험: 'bg-bad-soft text-bad',
  체험학습: 'bg-ok-soft text-ok',
  휴일: 'bg-warn-soft text-warn',
  기타: 'bg-surface-2 text-ink-2',
  학교: 'bg-surface-2 text-ink-3'
};
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

export interface DayItem {
  id: string;
  title: string;
  kind: string; // 학교 = 나이스 학사일정
  event?: CalEvent;
}

// 달력에 보일 일정: 여러 날짜 일정은 그 사이 날마다 보임
export function itemsByDay(events: CalEvent[], school: { date: string; title: string; holiday: boolean }[]) {
  const map: Record<string, DayItem[]> = {};
  for (const e of events) {
    const end = e.end && e.end >= e.date ? e.end : e.date;
    for (let k = e.date, n = 0; k <= end && n < 62; k = addDays(k, 1), n++) (map[k] ||= []).push({ id: e.id, title: e.title, kind: e.kind, event: e });
  }
  for (const s of school) (map[s.date] ||= []).push({ id: 'neis-' + s.date + s.title, title: s.title, kind: s.holiday ? '휴일' : '학교' });
  return map;
}

export const monthRange = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return { from: dayKey(new Date(y, m - 1, 1)), to: dayKey(new Date(y, m, 0)) };
};
export const shiftMonth = (month: string, n: number) => {
  const [y, m] = month.split('-').map(Number);
  return dayKey(new Date(y, m - 1 + n, 1)).slice(0, 7);
};

export function MonthGrid({ month, setMonth, byDay, selected, onSelect }: { month: string; setMonth: (m: string) => void; byDay: Record<string, DayItem[]>; selected: string; onSelect: (k: string) => void }) {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const start = dayKey(new Date(y, m - 1, 1 - first.getDay()));
  const weeks = Math.ceil((first.getDay() + new Date(y, m, 0).getDate()) / 7);
  const t0 = today();
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-xl font-bold tracking-tight tabular-nums">
          {y}년 {m}월
        </h3>
        <div className="ml-auto flex items-center">
          <IconButton label="지난달" onClick={() => setMonth(shiftMonth(month, -1))}>
            <ChevronLeft size={18} />
          </IconButton>
          <button type="button" onClick={() => (setMonth(t0.slice(0, 7)), onSelect(t0))} className="h-9 px-3 rounded-lg text-sm font-semibold text-ink-2 hover:bg-surface-2 cursor-pointer">
            오늘
          </button>
          <IconButton label="다음 달" onClick={() => setMonth(shiftMonth(month, 1))}>
            <ChevronRight size={18} />
          </IconButton>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-xs font-bold text-ink-3 mb-1">
        {WEEK.map((w, i) => (
          <span key={w} className={cx('py-1', i === 0 && 'text-bad', i === 6 && 'text-brand-strong')}>
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: weeks * 7 }, (_, i) => {
          const k = addDays(start, i);
          const inMonth = k.slice(0, 7) === month;
          const items = byDay[k] || [];
          const dow = i % 7;
          const holiday = items.some((x) => x.kind === '휴일');
          return (
            <button
              key={k}
              type="button"
              onClick={() => onSelect(k)}
              aria-pressed={selected === k}
              aria-label={`${Number(k.slice(5, 7))}월 ${Number(k.slice(8))}일${items.length ? `, 일정 ${items.length}개` : ''}`}
              className={cx(
                'min-h-14 sm:min-h-20 rounded-lg border p-1 text-left flex flex-col gap-0.5 cursor-pointer transition overflow-hidden',
                selected === k ? 'border-brand ring-2 ring-brand/25 bg-brand-soft/40' : 'border-line hover:border-line-strong bg-surface',
                !inMonth && 'opacity-40'
              )}
            >
              <span
                className={cx(
                  'text-xs font-bold tabular-nums w-6 h-6 rounded-full flex items-center justify-center shrink-0',
                  k === t0 ? 'bg-brand text-white' : dow === 0 || holiday ? 'text-bad' : dow === 6 ? 'text-brand-strong' : 'text-ink-2'
                )}
              >
                {Number(k.slice(8))}
              </span>
              {items.slice(0, 2).map((x) => (
                <span key={x.id} className={cx('hidden sm:block text-[11px] font-semibold leading-tight rounded px-1 py-0.5 truncate', KIND_TONE[x.kind] || KIND_TONE.기타)}>
                  {x.title}
                </span>
              ))}
              {items.length > 0 && (
                <span className="sm:hidden flex gap-0.5 px-1">
                  {items.slice(0, 3).map((x) => (
                    <span key={x.id} className={cx('w-1.5 h-1.5 rounded-full', x.kind === '학교' ? 'bg-ink-3' : x.kind === '시험' ? 'bg-bad' : x.kind === '휴일' ? 'bg-warn' : x.kind === '체험학습' ? 'bg-ok' : 'bg-brand')} />
                  ))}
                </span>
              )}
              {items.length > 2 && <span className="hidden sm:block text-[10px] text-ink-3 font-semibold px-1">+{items.length - 2}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
