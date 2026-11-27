import { useState } from 'react';
import { ArrowRight, Megaphone, ListChecks, MonitorUp, PartyPopper, Rocket, Send, Square } from 'lucide-react';
import { errorMessage } from '../lib/cloud';
import { dueLabel, formatLongToday, today } from '../lib/dates';
import { progressOf } from '../lib/mission';
import { activeNow, isTarget } from '../lib/visible';
import { checkItems } from '../lib/types';
import { Badge, Button, Card, Input, LinkIcon, Progress, SectionTitle, cx, isValidUrl, normalizeUrl, toast } from '../ui/kit';
import { SchoolToday } from '../ui/school';
import { useData } from './data';
import { plainText } from '../ui/RichText';
import type { Section } from './Workspace';

export default function Dashboard({ go }: { go: (s: Section) => void }) {
  const d = useData();
  const t0 = today();
  const active = d.tasks.filter((t) => t.due === t0); // 오늘 미션만
  const withChecks = active.filter((t) => checkItems(t).length > 0);
  const sids = d.students.map((s) => s.sid);
  // 오늘 할 일이 있는 학생 중 모두 끝낸 학생
  const mine = (sid: string) => withChecks.filter((t) => isTarget(t, sid) && progressOf(t, undefined, sid).total > 0);
  const withWork = sids.filter((sid) => mine(sid).length > 0);
  const finished = withWork.filter((sid) => mine(sid).every((t) => progressOf(t, d.statuses[sid], sid).all)).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-48">
          <p className="text-sm font-medium text-ink-3">{formatLongToday()}</p>
          <h1 className="text-[28px] font-bold tracking-tight mt-0.5">오늘의 우리 반</h1>
        </div>
        <Button variant="soft" icon={<MonitorUp size={17} />} onClick={() => go('tv')}>
          TV·편의기능
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat icon={<PartyPopper size={18} />} label="오늘 미션 모두 끝낸 학생" value={finished} unit={`/ ${withWork.length}명`} tone={withWork.length && finished === withWork.length ? 'ok' : undefined} onClick={() => go('tasks')} />
        <Stat icon={<Megaphone size={18} />} label="오늘 올린 공지·미션" value={active.length} unit="개" onClick={() => go('tasks')} />
      </div>

      <NowSender />

      <SchoolToday school={d.school} />

      <div>
        <section>
          <SectionTitle icon={<ListChecks size={18} />} title="오늘의 공지 및 미션" action={<Button variant="ghost" size="sm" onClick={() => go('tasks')}>공지 및 미션 <ArrowRight size={15} /></Button>} />
          <Card className="divide-y divide-line">
            {active.length === 0 && <p className="p-5 text-sm text-ink-3">오늘은 공지·미션이 없어요.</p>}
            {active.slice(0, 6).map((t) => {
              const targets = sids.filter((sid) => isTarget(t, sid) && progressOf(t, undefined, sid).total > 0);
              const total = targets.length;
              const done = targets.filter((sid) => progressOf(t, d.statuses[sid], sid).all).length;
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
                  {t.notice && <p className="text-sm text-ink-3 line-clamp-2 whitespace-pre-wrap mb-2">📢 {plainText(t.notice)}</p>}
                  {hasChecks ? <Progress value={done} max={total} tone={total && done >= total ? 'ok' : 'brand'} label={`${t.title} 모두 끝낸 학생`} /> : <p className="text-xs text-ink-3">완료 체크 없는 안내</p>}
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
      <SectionTitle icon={<Rocket size={18} />} title="지금 열기" sub="보낸 바로가기가 학생 화면 맨 위에 크게 떠요. 오늘이 지나면 저절로 사라져요." />
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
        <div className="flex flex-wrap gap-2 max-h-[13rem] overflow-y-auto -mx-1 px-1 py-0.5">
          {links.map((l) => (
            <button
              key={l.id}
              type="button"
              disabled={busy}
              onClick={() => send({ title: l.title, url: l.url, icon: l.icon })}
              className={cx('max-w-full flex items-center gap-2 h-11 pl-1.5 pr-3.5 rounded-xl border bg-surface hover:border-brand hover:bg-brand-soft transition cursor-pointer', now?.url === l.url ? 'border-brand' : 'border-line')}
            >
              <LinkIcon url={l.url} icon={l.icon} category={l.category} size={32} />
              <span className="text-sm font-semibold truncate">{l.title}</span>
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
