import { useEffect, useState } from 'react';
import { Clock3, UtensilsCrossed } from 'lucide-react';
import { Meal, getMeals, getSchedule, getTimetable } from '../lib/neis';
import { SchoolInfo } from '../lib/types';
import { formatDay, today } from '../lib/dates';
import { Card, cx } from './kit';

// 오늘(또는 고른 날)의 급식·시간표를 나이스에서 가져옴
export function useSchoolDay(school: SchoolInfo | null, day: string = today()) {
  const [meal, setMeal] = useState<Meal | null>(null);
  const [periods, setPeriods] = useState<string[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const key = school ? `${school.office}/${school.code}/${school.grade}/${school.classNo}/${school.key ? 1 : 0}/${day}` : '';
  useEffect(() => {
    if (!school) return setState('idle');
    let alive = true;
    setState('loading');
    Promise.allSettled([getMeals(school, day, day), getTimetable(school, day, day)]).then(([m, t]) => {
      if (!alive) return;
      setMeal(m.status === 'fulfilled' ? m.value[day] || null : null);
      setPeriods(t.status === 'fulfilled' ? t.value[day] || [] : []);
      setState(m.status === 'rejected' && t.status === 'rejected' ? 'error' : 'ok');
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { meal, periods, state };
}

export function useSchoolSchedule(school: SchoolInfo | null, from: string, to: string) {
  const [items, setItems] = useState<{ date: string; title: string; holiday: boolean }[]>([]);
  const key = school ? `${school.office}/${school.code}/${from}/${to}` : '';
  useEffect(() => {
    if (!school) return setItems([]);
    let alive = true;
    getSchedule(school, from, to)
      .then((r) => alive && setItems(r))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return items;
}

// 시간표 + 급식 카드 두 장 (학생 홈 · 교사 대시보드)
export function SchoolToday({ school, compact }: { school: SchoolInfo | null; compact?: boolean }) {
  const { meal, periods, state } = useSchoolDay(school);
  if (!school) return null;
  const loading = state === 'loading' || state === 'idle';
  const weekend = [0, 6].includes(new Date().getDay());
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Card className="p-4 sm:p-5">
        <h3 className="flex items-center gap-2 font-bold mb-3">
          <span className="w-8 h-8 rounded-lg bg-brand-soft text-brand-strong flex items-center justify-center">
            <Clock3 size={17} />
          </span>
          오늘 시간표
          <span className="text-xs font-semibold text-ink-3 ml-auto">
            {school.grade}학년 {school.classNo}반
          </span>
        </h3>
        {loading ? (
          <Skeleton rows={4} />
        ) : periods.length === 0 ? (
          <p className="text-sm text-ink-3 py-2">{weekend ? '오늘은 수업이 없어요.' : state === 'error' ? '시간표를 불러오지 못했어요.' : '나이스에 오늘 시간표가 없어요.'}</p>
        ) : (
          <ol className={cx('grid gap-1.5', compact ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3')}>
            {periods.map((p, i) => (
              <li key={i} className="flex items-center gap-2 rounded-xl bg-surface-2 border border-line px-2.5 h-11 min-w-0">
                <span className="text-xs font-bold text-brand-strong tabular-nums shrink-0">{i + 1}교시</span>
                <span className="font-semibold truncate">{p || '—'}</span>
              </li>
            ))}
          </ol>
        )}
        {!school.key && periods.length === 5 && <p className="text-xs text-ink-3 mt-2">6교시는 나이스 인증키를 넣으면 보여요.</p>}
      </Card>
      <Card className="p-4 sm:p-5">
        <h3 className="flex items-center gap-2 font-bold mb-3">
          <span className="w-8 h-8 rounded-lg bg-warn-soft text-warn flex items-center justify-center">
            <UtensilsCrossed size={16} />
          </span>
          오늘 급식
          {meal?.cal && <span className="text-xs font-semibold text-ink-3 ml-auto">{meal.cal}</span>}
        </h3>
        {loading ? (
          <Skeleton rows={4} />
        ) : !meal ? (
          <p className="text-sm text-ink-3 py-2">{state === 'error' ? '급식을 불러오지 못했어요.' : '오늘은 급식이 없어요.'}</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {meal.dishes.map((d, i) => (
              <li key={i} className="h-9 px-3 rounded-full bg-surface-2 border border-line flex items-center font-semibold text-[15px]">
                {d}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export const schoolLabel = (s: SchoolInfo) => `${s.name} ${s.grade}학년 ${s.classNo}반`;
export const dayTitle = (k: string) => formatDay(k);

function Skeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2" aria-label="불러오는 중">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-5 rounded-md bg-surface-2 animate-pulse" style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  );
}
