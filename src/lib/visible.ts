import { LiveDoc, NoticeSummary, Task } from './types';
import { today } from './dates';

// 지금 학생에게 보이는 공지: 게시 시각이 지났고, 내릴 날짜가 지나지 않은 것 (고정 → 최신 순)
export const visibleNotices = (live: LiveDoc, now = Date.now()): NoticeSummary[] =>
  Object.values(live.notices)
    .filter((n) => n.publishAt <= now && (!n.expireAt || n.expireAt > now))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.publishAt - a.publishAt);

export const noticeStatus = (n: { publishAt: number; expireAt: number | null }, now = Date.now()) =>
  n.publishAt > now ? 'scheduled' : n.expireAt && n.expireAt <= now ? 'expired' : 'live';

// '지금 열기'는 보낸 날에만 보임 (수업일이 바뀌면 사라짐)
export const activeNow = (live: LiveDoc) => (live.now && live.now.day === today() ? live.now : null);

export const isTarget = (t: Pick<Task, 'targets'>, sid: string) => !t.targets || t.targets.includes(sid);
