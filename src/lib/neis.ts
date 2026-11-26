// 나이스 교육정보 개방 포털(open.neis.go.kr) 호출: 학교 찾기 · 급식 · 시간표 · 학사일정
// - 브라우저에서 바로 부름(서버 없음). 인증키가 없으면 한 번에 5줄까지만 와서, 시간표는 5교시까지만 보일 수 있음
// - 같은 요청은 이 기기에 6시간 동안 기억해 둠
import { SchoolInfo, SchoolKind } from './types';
import { addDays } from './dates';

const BASE = 'https://open.neis.go.kr/hub/';
const TTL = 6 * 60 * 60 * 1000;

type Row = Record<string, string | number | null>;

async function call(service: string, params: Record<string, string | number>, key?: string): Promise<Row[]> {
  const q = new URLSearchParams({ Type: 'json', pIndex: '1', pSize: key ? '300' : '5', ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  if (key) q.set('KEY', key);
  const url = BASE + service + '?' + q.toString();
  const cacheKey = 'cp_neis_' + url.replace(/KEY=[^&]+/, 'KEY');
  try {
    const hit = JSON.parse(localStorage.getItem(cacheKey) || 'null') as { at: number; rows: Row[] } | null;
    if (hit && Date.now() - hit.at < TTL) return hit.rows;
  } catch {
    // 무시
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error('나이스 서버에 연결하지 못했어요.');
  const data = await res.json();
  let rows: Row[] = [];
  const body = data[service];
  if (Array.isArray(body)) {
    const head = body[0]?.head?.[1]?.RESULT;
    if (head && head.CODE !== 'INFO-000') throw new Error(head.MESSAGE || '나이스 자료를 가져오지 못했어요.');
    rows = body[1]?.row || [];
  } else if (data.RESULT && data.RESULT.CODE !== 'INFO-200') {
    // INFO-200: 자료 없음 → 빈 목록
    throw new Error(data.RESULT.MESSAGE || '나이스 자료를 가져오지 못했어요.');
  }
  try {
    localStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), rows }));
  } catch {
    // 저장 공간이 부족하면 기억하지 않음
  }
  return rows;
}

const ymd = (k: string) => k.replace(/-/g, '');
const fromYmd = (v: string) => `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;

export const kindOf = (name: string): SchoolKind => (name.includes('중학교') ? 'mis' : name.includes('고등학교') ? 'his' : 'els');

export interface SchoolHit {
  office: string;
  code: string;
  name: string;
  kindName: string;
  address: string;
}
export async function searchSchools(name: string, key?: string): Promise<SchoolHit[]> {
  const rows = await call('schoolInfo', { SCHUL_NM: name.trim() }, key);
  return rows.map((r) => ({
    office: String(r.ATPT_OFCDC_SC_CODE),
    code: String(r.SD_SCHUL_CODE),
    name: String(r.SCHUL_NM),
    kindName: String(r.SCHUL_KND_SC_NM || ''),
    address: String(r.ORG_RDNMA || '')
  }));
}

const base = (s: SchoolInfo) => ({ ATPT_OFCDC_SC_CODE: s.office, SD_SCHUL_CODE: s.code });

// 급식: 날짜 → 메뉴 목록 (알레르기 번호는 뺌)
export interface Meal {
  dishes: string[];
  cal: string;
}
export const cleanDish = (d: string) =>
  d
    .replace(/\([0-9.\s]+\)/g, '')
    .replace(/[0-9]+\./g, '')
    .replace(/[*#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
export async function getMeals(s: SchoolInfo, from: string, to: string): Promise<Record<string, Meal>> {
  const rows = await call('mealServiceDietInfo', { ...base(s), MLSV_FROM_YMD: ymd(from), MLSV_TO_YMD: ymd(to) }, s.key);
  const out: Record<string, Meal> = {};
  for (const r of rows) {
    if (String(r.MMEAL_SC_CODE) !== '2' && rows.some((x) => x.MLSV_YMD === r.MLSV_YMD && String(x.MMEAL_SC_CODE) === '2')) continue; // 점심 우선
    out[fromYmd(String(r.MLSV_YMD))] = {
      dishes: String(r.DDISH_NM || '')
        .split(/<br\s*\/?>/i)
        .map(cleanDish)
        .filter(Boolean),
      cal: String(r.CAL_INFO || '')
    };
  }
  return out;
}

// 시간표: 날짜 → 교시별 과목
export async function getTimetable(s: SchoolInfo, from: string, to: string): Promise<Record<string, string[]>> {
  const service = `${s.kind}Timetable`;
  const p = { ...base(s), GRADE: s.grade, CLASS_NM: s.classNo };
  const days: string[] = [];
  for (let k = from; k <= to && days.length < 14; k = addDays(k, 1)) if (new Date(k + 'T00:00').getDay() % 6) days.push(k); // 주말 빼기
  // 인증키가 있으면 한 번에, 없으면 하루씩 (한 번에 5줄까지만 오므로)
  const batches = s.key ? [[from, to]] : days.map((d) => [d, d]);
  const rows = (await Promise.all(batches.map(([a, b]) => call(service, { ...p, TI_FROM_YMD: ymd(a), TI_TO_YMD: ymd(b) }, s.key)))).flat();
  const out: Record<string, string[]> = {};
  for (const r of rows) {
    const day = fromYmd(String(r.ALL_TI_YMD));
    const n = Number(r.PERIO) || 0;
    (out[day] ||= [])[n - 1] = String(r.ITRT_CNTNT || '').replace(/^-/, '').trim();
  }
  for (const k of Object.keys(out)) out[k] = Array.from(out[k], (v) => v || '');
  return out;
}

// 학사일정 (토요휴업일 같은 반복 휴일은 뺌)
export async function getSchedule(s: SchoolInfo, from: string, to: string): Promise<{ date: string; title: string; holiday: boolean }[]> {
  const rows = await call('SchoolSchedule', { ...base(s), AA_FROM_YMD: ymd(from), AA_TO_YMD: ymd(to) }, s.key);
  return rows
    .filter((r) => r.EVENT_NM && r.EVENT_NM !== '토요휴업일')
    .map((r) => ({ date: fromYmd(String(r.AA_YMD)), title: String(r.EVENT_NM), holiday: String(r.SBTR_DD_SC_NM || '').includes('휴업') }));
}
