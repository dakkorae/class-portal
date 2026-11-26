import { useEffect, useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { Meal, getMeals, getSchedule } from '../lib/neis';
import { SchoolInfo } from '../lib/types';
import { today } from '../lib/dates';
import { Card } from './kit';

// 오늘(또는 고른 날)의 급식을 나이스에서 가져옴
export function useSchoolMeal(school: SchoolInfo | null, day: string = today()) {
  const [meal, setMeal] = useState<Meal | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const key = school ? `${school.office}/${school.code}/${school.key ? 1 : 0}/${day}` : '';
  useEffect(() => {
    if (!school) return setState('idle');
    let alive = true;
    setState('loading');
    getMeals(school, day, day)
      .then((m) => alive && (setMeal(m[day] || null), setState('ok')))
      .catch(() => alive && (setMeal(null), setState('error')));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { meal, state };
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

// 오늘 급식 카드 (학생 홈 · 교사 대시보드)
export function SchoolToday({ school }: { school: SchoolInfo | null }) {
  const { meal, state } = useSchoolMeal(school);
  if (!school) return null;
  const loading = state === 'loading' || state === 'idle';
  return (
    <Card className="p-4 sm:p-5">
      <h3 className="flex items-center gap-2 font-bold mb-3">
        <span className="w-8 h-8 rounded-lg bg-warn-soft text-warn flex items-center justify-center">
          <UtensilsCrossed size={16} />
        </span>
        오늘 급식
        {meal?.cal && <span className="text-xs font-semibold text-ink-3 ml-auto">{meal.cal}</span>}
      </h3>
      {loading ? (
        <Skeleton rows={3} />
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
  );
}

export const schoolLabel = (s: SchoolInfo) => s.name;
function Skeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2" aria-label="불러오는 중">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-5 rounded-md bg-surface-2 animate-pulse" style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  );
}
