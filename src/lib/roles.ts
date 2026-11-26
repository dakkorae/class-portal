// 1인1역 주간 순환: 매주 월요일마다 역할이 다음 학생에게 한 칸씩 넘어감
import { RolesDoc } from './types';
import { dayKey, today } from './dates';

const parse = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const mondayOf = (k: string = today()) => {
  const d = parse(k);
  const back = (d.getDay() + 6) % 7; // 월=0 … 일=6
  return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() - back));
};
export const weekIndex = (start: string, k: string = today()) => Math.round((parse(mondayOf(k)).getTime() - parse(mondayOf(start)).getTime()) / (7 * 86400000));

// 역할 → 학생(sid). weekOffset: 0 이번 주, 1 다음 주
export function assignments(r: RolesDoc, weekOffset = 0, day: string = today()): Record<string, string> {
  const out: Record<string, string> = {};
  const n = r.order.length;
  if (!n) return out;
  const w = (r.start ? weekIndex(r.start, day) : 0) + r.shift + weekOffset;
  r.items.forEach((role, i) => {
    out[role.id] = r.order[(((i + w) % n) + n) % n];
  });
  return out;
}

// 저장된 순서에 없는 학생은 뒤에 붙이고, 없어진 학생은 뺌
export const effectiveOrder = (order: string[], sids: string[]) => {
  const have = new Set(sids);
  const kept = order.filter((s) => have.has(s));
  const seen = new Set(kept);
  return [...kept, ...sids.filter((s) => !seen.has(s))];
};

export const ROLE_PRESETS: { name: string; icon: string }[] = [
  { name: '우유 당번', icon: '🥛' },
  { name: '칠판 지우기', icon: '🧽' },
  { name: '창문 열고 닫기', icon: '🪟' },
  { name: '전등 끄기', icon: '💡' },
  { name: '화분 물 주기', icon: '🪴' },
  { name: '분리수거', icon: '♻️' },
  { name: '급식 당번', icon: '🍱' },
  { name: '책꽂이 정리', icon: '📚' },
  { name: '알림장 쓰기', icon: '📝' },
  { name: '우편 배달부', icon: '📮' },
  { name: '컴퓨터 끄기', icon: '💻' },
  { name: '신발장 정리', icon: '👟' },
  { name: '청소 도구 정리', icon: '🧹' },
  { name: '학습지 나눠 주기', icon: '📄' },
  { name: '줄반장', icon: '🚩' },
  { name: '체육 도구 담당', icon: '⚽' }
];
