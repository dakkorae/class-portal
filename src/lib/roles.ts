// 1인1역: 주(월요일 기준)마다 선생님이 역할별 학생을 직접 배정
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
// 한 주의 배정 (역할 ID → 학생 sid 목록). 선생님이 주마다 직접 정함
export const weekOf = (r: RolesDoc | null, monday: string = mondayOf()) => r?.weeks?.[monday] || {};
export const rolesOfStudent = (r: RolesDoc | null, sid: string, monday: string = mondayOf()) => (r ? r.items.filter((x) => (weekOf(r, monday)[x.id] || []).includes(sid)) : []);

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
