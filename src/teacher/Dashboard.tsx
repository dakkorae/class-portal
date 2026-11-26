import { useState } from 'react';
import { ArrowRight, Bell, ListChecks, MonitorUp, PartyPopper, Rocket, Send, Square, Users } from 'lucide-react';
import { counted } from '../lib/api';
import { errorMessage, openBoard } from '../lib/cloud';
import { dueLabel, formatLongToday, today } from '../lib/dates';
import { progressOf } from '../lib/mission';
import { activeNow, isTarget, visibleNotices } from '../lib/visible';
import { checkItems, markKey } from '../lib/types';
import { Badge, Button, Card, Input, LinkIcon, Progress, SectionTitle, cx, isValidUrl, normalizeUrl, toast } from '../ui/kit';
import { SchoolToday } from '../ui/school';
import { useData } from './data';
import type { Section } from './Workspace';

export default function Dashboard({ go }: { go: (s: Section) => void }) {
  const d = useData();
  const t0 = today();
  const active = d.tasks.filter((t) => t.due >= t0);
  const withChecks = active.filter((t) => checkItems(t).length > 0);
  const sids = d.students.map((s) => s.sid);
  let todo = 0;
  for (const t of withChecks)
    for (const sid of sids.filter((s) => isTarget(t, s))) for (const i of checkItems(t)) if (!counted(d.statuses[sid]?.tasks?.[markKey(t.id, i.id)]?.state)) todo++;
  const finished = sids.filter((sid) => withChecks.some((t) => isTarget(t, sid)) && withChecks.every((t) => !isTarget(t, sid) || progressOf(t, d.statuses[sid]).all)).length;
  const notices = visibleNotices(d.live);
  const unreadTotal = notices.reduce((sum, n) => sum + sids.filter((sid) => !d.statuses[sid]?.reads?.[n.id]).length, 0);
  const joined = Object.values(d.claimed).filter(Boolean).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-48">
          <p className="text-sm font-medium text-ink-3">{formatLongToday()}</p>
          <h1 className="text-[28px] font-bold tracking-tight mt-0.5">오늘의 우리 반</h1>
        </div>
        <Button variant="soft" icon={<MonitorUp size={17} />} onClick={() => openBoard(d.classId) || toast('새 창이 막혔어요. 팝업을 허용해 주세요.')}>
          TV 화면 열기
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={<ListChecks size={18} />} label="미션 남은 체크" value={todo} unit="칸" onClick={() => go('tasks')} />
        <Stat icon={<PartyPopper size={18} />} label="미션 모두 끝낸 학생" value={finished} unit={`/ ${sids.length}명`} tone={sids.length && finished === sids.length ? 'ok' : undefined} onClick={() => go('tasks')} />
        <Stat icon={<Bell size={18} />} label="공지 안 읽음" value={unreadTotal} unit="건" onClick={() => go('notices')} />
        <Stat icon={<Users size={18} />} label="참여한 학생" value={joined} unit={`/ ${d.info?.maxStudents ?? 0}명`} onClick={() => go('class')} />
      </div>

      <NowSender />

      <SchoolToday school={d.school} />

      <div className="grid lg:grid-cols-2 gap-6">
        <section>
          <SectionTitle icon={<ListChecks size={18} />} title="진행 중인 미션" action={<Button variant="ghost" size="sm" onClick={() => go('tasks')}>미션 <ArrowRight size={15} /></Button>} />
          <Card className="divide-y divide-line">
            {active.length === 0 && <p className="p-5 text-sm text-ink-3">진행 중인 미션이 없어요.</p>}
            {active.slice(0, 6).map((t) => {
              const targets = sids.filter((sid) => isTarget(t, sid));
              const total = targets.length;
              const done = targets.filter((sid) => progressOf(t, d.statuses[sid]).all).length;
              const hasChecks = checkItems(t).length > 0;
              return (
                <div key={t.id} className="p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="font-semibold truncate">{t.title}</p>
                    <span className="text-sm text-ink-3 shrink-0 tabular-nums">
                      {hasChecks ? `${done}/${total}명 · ` : ''}
                      {dueLabel(t.due)}
                    </span>
                  </div>
                  {hasChecks ? <Progress value={done} max={total} tone={total && done >= total ? 'ok' : 'brand'} label={`${t.title} 모두 끝낸 학생`} /> : <p className="text-xs text-ink-3">완료 체크 없는 안내 미션</p>}
                </div>
              );
            })}
          </Card>
        </section>
        <section>
          <SectionTitle icon={<Bell size={18} />} title="게시 중인 공지" action={<Button variant="ghost" size="sm" onClick={() => go('notices')}>공지 관리 <ArrowRight size={15} /></Button>} />
          <Card className="divide-y divide-line">
            {notices.length === 0 && <p className="p-5 text-sm text-ink-3">게시 중인 공지가 없어요.</p>}
            {notices.slice(0, 6).map((n) => {
              const read = sids.filter((sid) => d.statuses[sid]?.reads?.[n.id]).length;
              return (
                <div key={n.id} className="p-4">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <p className="font-semibold truncate">{n.title}</p>
                    <span className="text-sm text-ink-3 shrink-0 tabular-nums">
                      {read}/{sids.length}명 읽음
                    </span>
                  </div>
                  <Progress value={read} max={sids.length} tone={sids.length && read >= sids.length ? 'ok' : 'brand'} label={`${n.title} 읽음`} />
                </div>
              );
            })}
          </Card>
        </section>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, unit, tone, onClick }: { icon: React.ReactNode; label: string; value: number; unit: string; tone?: 'warn' | 'ok'; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-left cursor-pointer group">
      <Card className="p-4 h-full group-hover:border-brand/40 transition">
        <p className={cx('flex items-center gap-1.5 text-sm font-semibold', tone === 'warn' ? 'text-warn' : tone === 'ok' ? 'text-ok' : 'text-ink-3')}>
          {icon}
          {label}
        </p>
        <p className="mt-2 text-3xl font-bold tracking-tight tabular-nums">
          {value}
          <span className="text-base font-semibold text-ink-3 ml-1">{unit}</span>
        </p>
      </Card>
    </button>
  );
}

// '지금 열기' 빠른 보내기: 바로가기를 누르면 학생 화면 맨 위와 TV에 크게 뜸
export function NowSender() {
  const d = useData();
  const now = activeNow(d.live);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const links = d.links.filter((l) => !l.hidden).sort((a, b) => Number(b.pinned) - Number(a.pinned) || a.order - b.order);

  const send = async (link: { title: string; url: string; icon: string } | null) => {
    setBusy(true);
    try {
      await d.api.sendNow(d.classId, link);
      toast(link ? `‘${link.title}’을(를) 보냈어요.` : '지금 열기를 끝냈어요.');
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5 overflow-hidden relative">
      <div className="absolute inset-x-0 top-0 h-1 bg-brand-gradient" aria-hidden />
      <SectionTitle icon={<Rocket size={18} />} title="지금 열기" sub="보낸 바로가기가 학생 화면 맨 위와 TV에 크게 떠요. 오늘이 지나면 저절로 사라져요." />
      {now && (
        <div className="mb-4 flex items-center gap-3 rounded-xl bg-brand-soft p-3">
          <LinkIcon url={now.url} icon={now.icon} size={40} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-brand-strong flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-brand animate-pulse" /> 지금 보내는 중
            </p>
            <p className="font-semibold truncate">{now.title}</p>
          </div>
          <Button variant="secondary" size="sm" icon={<Square size={14} />} onClick={() => send(null)} loading={busy}>
            끝내기
          </Button>
        </div>
      )}
      {links.length > 0 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 -mx-1 px-1">
          {links.map((l) => (
            <button
              key={l.id}
              type="button"
              disabled={busy}
              onClick={() => send({ title: l.title, url: l.url, icon: l.icon })}
              className={cx('shrink-0 flex items-center gap-2 h-11 pl-1.5 pr-3.5 rounded-xl border bg-surface hover:border-brand hover:bg-brand-soft transition cursor-pointer', now?.url === l.url ? 'border-brand' : 'border-line')}
            >
              <LinkIcon url={l.url} icon={l.icon} category={l.category} size={32} />
              <span className="text-sm font-semibold whitespace-nowrap">{l.title}</span>
              {l.pinned && <Badge tone="brand" className="h-5 px-1.5">고정</Badge>}
            </button>
          ))}
        </div>
      )}
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const u = normalizeUrl(url);
          if (!isValidUrl(u)) return toast('주소를 확인해 주세요.');
          let host = u;
          try {
            host = new URL(u).hostname.replace(/^www\./, '');
          } catch {
            // 무시
          }
          send({ title: host, url: u, icon: '' }).then(() => setUrl(''));
        }}
      >
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="목록에 없는 주소를 바로 보내기" inputMode="url" aria-label="보낼 주소" />
        <Button type="submit" icon={<Send size={16} />} loading={busy} disabled={!url.trim()}>
          보내기
        </Button>
      </form>
    </Card>
  );
}
