// 날짜는 모두 기기의 현지 시각(한국) 기준 YYYY-MM-DD
export const dayKey = (d: Date = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const today = () => dayKey();

export const addDays = (key: string, n: number) => {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + n));
};

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

export const formatDay = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${m}월 ${d}일 (${WEEK[date.getDay()]})`;
};

export const formatLongToday = (d = new Date()) => `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEK[d.getDay()]}요일`;

export const formatTime = (ms: number) => {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// 마감까지 남은 날 표시
export const dueLabel = (due: string) => {
  const t = today();
  if (due === t) return '오늘까지';
  if (due === addDays(t, 1)) return '내일까지';
  if (due < t) return '마감 지남';
  return `${formatDay(due)}까지`;
};

// <input type="datetime-local"> 값과 밀리초 사이 변환
export const toLocalInput = (ms: number) => {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const fromLocalInput = (v: string) => (v ? new Date(v).getTime() : NaN);
