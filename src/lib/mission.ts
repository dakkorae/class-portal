// 미션 줄 다루기 (붙여넣기 → 줄 목록, 완료 현황 계산)
import { MissionItem, StudentStatus, Task, checkItems, itemFor, markKey } from './types';
import { randomId } from './hash';
import { counted } from './api';

export const newItem = (text = '', check = false, sub = false): MissionItem => ({ id: randomId(), text, check, sub });

// 여러 줄 글을 미션 줄로: 앞에 공백·‘-’·‘·’ 가 있으면 딸린 줄, 끝에 ‘(체크)’ 나 앞에 ‘[ ]’ 가 있으면 완료 체크 줄
export function parseLines(text: string): MissionItem[] {
  return text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((line) => {
      const sub = /^(\s+|[-·•ㄴ└]\s*)/.test(line);
      let t = line.replace(/^\s*[-·•ㄴ└]?\s*/, '');
      let check = false;
      if (/^\[\s?[xvV✓]?\s?\]\s*/.test(t)) (check = true), (t = t.replace(/^\[\s?[xvV✓]?\s?\]\s*/, ''));
      if (/\s*\((완료\s*)?체크(박스)?\)\s*$/.test(t)) (check = true), (t = t.replace(/\s*\((완료\s*)?체크(박스)?\)\s*$/, ''));
      return newItem(t.trim().slice(0, 120), check, sub);
    })
    .filter((i) => i.text);
}

// 학생 한 명이 미션의 완료 칸을 몇 개 했는지 (그 학생이 대상인 줄만 셈)
export function progressOf(t: Pick<Task, 'id' | 'items'>, st: StudentStatus | undefined, sid?: string) {
  const checks = checkItems(t).filter((i) => !sid || itemFor(i, sid));
  const done = checks.filter((i) => counted(st?.tasks?.[markKey(t.id, i.id)]?.state)).length;
  return { done, total: checks.length, all: checks.length > 0 && done === checks.length };
}

// 학생에게 보일 줄: 그 학생이 대상인 줄만. 딸린 줄이 모두 빠진 머리 줄(체크 없는 줄)도 뺌
export function itemsFor(t: Pick<Task, 'items'>, sid: string) {
  const list = t.items.filter((i) => itemFor(i, sid));
  return list.filter((i, idx) => {
    if (i.check || i.sub) return true;
    const next = list[idx + 1];
    const hadSubs = t.items[t.items.indexOf(i) + 1]?.sub;
    return !hadSubs || (next && next.sub);
  });
}
