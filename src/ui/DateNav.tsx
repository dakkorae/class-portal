import { useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, dayKey, formatDay, today } from '../lib/dates';
import { cx } from './kit';

// 날짜 이동: ‹ 날짜(누르면 달력) › · 오늘. marked: 미션이 있는 날(달력에 점)
export default function DateNav({ value, onChange, marked }: { value: string; onChange: (k: string) => void; marked?: Set<string> }) {
  const [open, setOpen] = useState(false);
  const t0 = today();
  return (
    <div className="relative inline-flex items-center gap-1.5 flex-wrap">
      <button type="button" onClick={() => onChange(addDays(value, -1))} aria-label="이전 날" className="w-10 h-10 rounded-full bg-surface border border-line flex items-center justify-center text-ink-2 hover:border-brand hover:text-brand-strong cursor-pointer transition">
        <ChevronLeft size={19} />
      </button>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="날짜 고르기"
        className="h-10 px-4 rounded-full bg-surface border border-line flex items-center gap-2 font-bold text-ink hover:border-brand cursor-pointer transition"
      >
        <CalendarDays size={17} className="text-brand-strong" />
        {formatDay(value)}
        {value === t0 && <span className="text-xs font-bold text-brand-strong bg-brand-soft rounded-full px-2 py-0.5">오늘</span>}
      </button>
      <button type="button" onClick={() => onChange(addDays(value, 1))} aria-label="다음 날" className="w-10 h-10 rounded-full bg-surface border border-line flex items-center justify-center text-ink-2 hover:border-brand hover:text-brand-strong cursor-pointer transition">
        <ChevronRight size={19} />
      </button>
      {value !== t0 && (
        <button type="button" onClick={() => onChange(t0)} className="h-10 px-3.5 rounded-full bg-brand-soft text-brand-strong text-sm font-bold cursor-pointer hover:brightness-95">
          오늘로
        </button>
      )}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <MiniCalendar
            value={value}
            marked={marked}
            onPick={(k) => {
              onChange(k);
              setOpen(false);
            }}
          />
        </>
      )}
    </div>
  );
}

function MiniCalendar({ value, marked, onPick }: { value: string; marked?: Set<string>; onPick: (k: string) => void }) {
  const [month, setMonth] = useState(value.slice(0, 7));
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const start = dayKey(new Date(y, m - 1, 1 - first.getDay()));
  const weeks = Math.ceil((first.getDay() + new Date(y, m, 0).getDate()) / 7);
  const t0 = today();
  const shift = (n: number) => setMonth(dayKey(new Date(y, m - 1 + n, 1)).slice(0, 7));
  return (
    <div className="absolute left-0 top-full mt-2 z-50 w-[19rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-line bg-surface shadow-pop p-3 animate-pop" role="dialog" aria-label="달력에서 날짜 고르기">
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => shift(-1)} aria-label="지난달" className="w-9 h-9 rounded-full hover:bg-surface-2 flex items-center justify-center cursor-pointer">
          <ChevronLeft size={18} />
        </button>
        <span className="font-bold tabular-nums">
          {y}년 {m}월
        </span>
        <button type="button" onClick={() => shift(1)} aria-label="다음 달" className="w-9 h-9 rounded-full hover:bg-surface-2 flex items-center justify-center cursor-pointer">
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] font-bold text-ink-3 mb-1">
        {['일', '월', '화', '수', '목', '금', '토'].map((w, i) => (
          <span key={w} className={cx(i === 0 && 'text-bad', i === 6 && 'text-brand-strong')}>
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: weeks * 7 }, (_, i) => {
          const k = addDays(start, i);
          const inMonth = k.slice(0, 7) === month;
          return (
            <button
              key={k}
              type="button"
              onClick={() => onPick(k)}
              aria-label={formatDay(k)}
              aria-pressed={k === value}
              className={cx(
                'relative h-9 rounded-full text-sm font-semibold tabular-nums cursor-pointer transition',
                k === value ? 'bg-brand text-on-brand' : k === t0 ? 'text-brand-strong ring-2 ring-brand/40' : 'hover:bg-surface-2',
                !inMonth && 'opacity-35'
              )}
            >
              {Number(k.slice(8))}
              {marked?.has(k) && <span className={cx('absolute left-1/2 -translate-x-1/2 bottom-1 w-1 h-1 rounded-full', k === value ? 'bg-on-brand' : 'bg-brand')} />}
            </button>
          );
        })}
      </div>
      <button type="button" onClick={() => onPick(t0)} className="mt-2 w-full h-9 rounded-full bg-brand-soft text-brand-strong text-sm font-bold cursor-pointer">
        오늘로 가기
      </button>
    </div>
  );
}
