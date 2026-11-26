import { useEffect, useMemo, useState } from 'react';
import { Bell, CalendarDays, Check, ExternalLink, Home, ListChecks, LogOut, Megaphone, Pin, Sparkles, SquareArrowOutUpRight, UserRound } from 'lucide-react';
import { Api, counted, emptyLive } from '../lib/api';
import { errorMessage, getApi } from '../lib/cloud';
import { addDays, formatDay, formatLongToday, formatTime, today } from '../lib/dates';
import { progressOf } from '../lib/mission';
import { rolesOfStudent } from '../lib/roles';
import { activeNow, isTarget, visibleNotices } from '../lib/visible';
import { CalEvent, LINK_CATEGORIES, LinkItem, LiveDoc,  Notice, NoticeSummary, RolesDoc, SchoolInfo, Student, StudentSession, StudentStatus, Task, linkCategory, markKey } from '../lib/types';
import { Badge, Button, Card, Empty, ErrorNote, LinkIcon, Modal, Progress, SectionTitle, Spinner, cx, toast } from '../ui/kit';
import { KIND_TONE, MonthGrid, itemsByDay, monthRange } from '../ui/calendar';
import { SchoolToday, useSchoolSchedule } from '../ui/school';
import { TagBadge } from '../ui/tags';
import DateNav from '../ui/DateNav';
import { ThemeCard } from '../ui/ThemePicker';

type Tab = 'home' | 'links' | 'calendar' | 'notices' | 'me';

export default function StudentPortal({ session, onSignedOut }: { session: StudentSession; onSignedOut: (relogin: boolean) => void }) {
  const { classId, sid } = session;
  const [api, setApi] = useState<Api | null>(null);
  const [ok, setOk] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>('home');
  const [live, setLive] = useState<LiveDoc>(emptyLive);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [status, setStatus] = useState<StudentStatus>({ tasks: {}, reads: {} });
  const [me, setMe] = useState<Student | null>(null);
  const [school, setSchool] = useState<SchoolInfo | null>(null);
  const [roles, setRoles] = useState<RolesDoc | null>(null);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [openNotice, setOpenNotice] = useState<NoticeSummary | null>(null);
  const [day, setDay] = useState(today());
  const [error, setError] = useState('');
  const [, tick] = useState(0);

  // 이 기기가 아직 이 학생으로 인정되는지 먼저 확인 (교사가 PIN을 초기화했으면 다시 로그인)
  useEffect(() => {
    let alive = true;
    getApi()
      .then(async (a) => {
        const valid = await a.checkMember(classId, sid);
        if (!alive) return;
        if (!valid) return onSignedOut(true);
        setApi(a);
        setOk(true);
      })
      .catch((e) => alive && setError(errorMessage(e)));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, sid]);

  useEffect(() => {
    if (!api || !ok) return;
    const onErr = (e: unknown) => setError(errorMessage(e));
    const stops = [
      api.watchLive(classId, setLive, onErr),
      api.watchLinks(classId, setLinks, onErr),
      api.watchTasks(classId, setTasks, onErr),
      api.watchMyStatus(classId, sid, setStatus, onErr),
      api.watchStudent(classId, sid, setMe, onErr),
      api.watchSchool(classId, setSchool, () => undefined),
      api.watchRoles(classId, setRoles, () => undefined),
      api.watchCalendar(classId, setEvents, () => undefined)
    ];
    // 예약 공지·날짜 바뀜을 반영하려고 1분마다 다시 그림
    const t = setInterval(() => tick((n) => n + 1), 60000);
    return () => {
      stops.forEach((s) => s());
      clearInterval(t);
    };
  }, [api, ok, classId, sid]);

  const notices = visibleNotices(live);
  const unread = notices.filter((n) => !status.reads[n.id]).length;
  const nowLink = activeNow(live);
  const t0 = today();
  const myTasks = useMemo(() => tasks.filter((t) => isTarget(t, sid)), [tasks, sid]);
  // 고른 날짜의 미션만 보여 줌 (지난 날 미션은 날짜를 옮겨서 봄)
  const todo = myTasks.filter((t) => t.due === day);
  const marked = useMemo(() => new Set(myTasks.map((t) => t.due)), [myTasks]);
  const visibleLinks = links.filter((l) => !l.hidden);
  const myRoles = rolesOfStudent(roles, sid);
  const soon = events.filter((e) => (e.end || e.date) >= t0 && e.date <= addDays(t0, 7));

  const toggleItem = async (t: Task, itemId: string) => {
    if (!api) return;
    const key = markKey(t.id, itemId);
    const cur = status.tasks[key];
    const done = !counted(cur?.state);
    try {
      await api.markTask(classId, sid, key, cur, done);
      const after = progressOf(t, { ...status, tasks: { ...status.tasks, [key]: { state: done ? 'done' : 'todo', at: Date.now() } } });
      toast(done ? (after.all ? `‘${t.title}’ 미션 완료! 🎉` : '완료!') : '되돌렸어요.');
    } catch (e) {
      toast(errorMessage(e));
    }
  };

  if (error && !ok) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6">
        <Card className="p-6 max-w-sm w-full space-y-4">
          <ErrorNote>{error}</ErrorNote>
          <Button className="w-full" onClick={() => location.reload()}>
            다시 시도
          </Button>
        </Card>
      </div>
    );
  }
  if (!ok) return <Spinner label="우리 반에 들어가는 중…" />;

  const nav: { id: Tab; label: string; icon: React.ReactNode; dot?: boolean }[] = [
    { id: 'home', label: '홈', icon: <Home size={22} /> },
    { id: 'links', label: '바로가기', icon: <SquareArrowOutUpRight size={22} /> },
    { id: 'calendar', label: '달력', icon: <CalendarDays size={22} /> },
    { id: 'notices', label: '공지', icon: <Megaphone size={22} />, dot: unread > 0 },
    { id: 'me', label: '나', icon: <UserRound size={22} /> }
  ];

  return (
    <div className="min-h-dvh bg-aurora text-[17px] md:text-lg">
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-canvas/75 border-b border-line/70 pt-[env(safe-area-inset-top)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-brand-gradient text-white flex items-center justify-center shrink-0 shadow-md shadow-brand/30" aria-hidden>
            <Sparkles size={19} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-ink-3 truncate">{session.className}</p>
            <p className="font-bold leading-tight truncate">{me?.name || `${session.number}번`}</p>
          </div>
          <nav className="hidden md:flex items-center gap-1" aria-label="메뉴">
            {nav.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => setTab(n.id)}
                aria-current={tab === n.id ? 'page' : undefined}
                className={cx('relative h-11 px-4 rounded-xl font-semibold flex items-center gap-2 transition cursor-pointer', tab === n.id ? 'bg-surface text-ink shadow-card border border-line' : 'text-ink-3 hover:text-ink')}
              >
                {n.icon}
                {n.label}
                {n.dot && <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-bad ring-2 ring-canvas" aria-label="새 공지" />}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-5 pb-32 md:pb-12 space-y-6">
        {error && <ErrorNote>{error}</ErrorNote>}

        {tab === 'home' && (
          <>
            <div>
              <p className="text-ink-3 font-medium">{formatLongToday()}</p>
              <h1 className="text-[28px] sm:text-3xl font-bold tracking-tight mt-0.5">안녕, {me?.name || `${session.number}번`} 👋</h1>
            </div>

            {nowLink && (
              <a
                href={nowLink.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group block rounded-3xl bg-brand-gradient text-white p-5 sm:p-6 shadow-xl shadow-brand/25 animate-glow focus-visible:outline-offset-4"
              >
                <p className="text-sm font-bold text-white/85 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" aria-hidden /> 지금 열기 · 선생님이 보냈어요
                </p>
                <div className="flex items-center gap-4 mt-3">
                  <LinkIcon url={nowLink.url} icon={nowLink.icon} size={60} />
                  <p className="text-2xl sm:text-3xl font-bold tracking-tight flex-1 min-w-0 break-words">{nowLink.title}</p>
                  <span className="hidden sm:flex w-14 h-14 rounded-2xl bg-white/20 items-center justify-center group-hover:bg-white/30 transition shrink-0">
                    <ExternalLink size={26} />
                  </span>
                </div>
              </a>
            )}

            {notices.some((n) => n.pinned) && (
              <section>
                <SectionTitle icon={<Pin size={18} />} title="꼭 볼 공지" />
                <div className="grid gap-3 sm:grid-cols-2">
                  {notices
                    .filter((n) => n.pinned)
                    .map((n) => (
                      <NoticeRow key={n.id} n={n} unread={!status.reads[n.id]} onOpen={() => setOpenNotice(n)} />
                    ))}
                </div>
              </section>
            )}

            {myRoles.length > 0 && (
              <Card className="p-4 sm:p-5 flex items-center gap-4 bg-gradient-to-br from-brand-soft to-surface">
                <span className="text-4xl" aria-hidden>
                  {myRoles[0].icon}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-3">이번 주 내 역할</p>
                  <p className="text-xl font-bold truncate">{myRoles.map((r) => r.name).join(' · ')}</p>
                </div>
              </Card>
            )}

            <section>
              <SectionTitle
                icon={<ListChecks size={18} />}
                title={day === t0 ? '오늘의 미션' : '미션'}
                sub={(() => {
                  const left = todo.reduce((n, t) => n + (progressOf(t, status).total - progressOf(t, status).done), 0);
                  return todo.length ? (left ? `체크할 일 ${left}개 남았어요` : '모두 끝냈어요! 🎉') : undefined;
                })()}
              />
              <div className="mb-3">
                <DateNav value={day} onChange={setDay} marked={marked} />
              </div>
              {todo.length === 0 ? (
                <Card>
                  <Empty icon={<Check size={22} />} title={day === t0 ? '오늘은 미션이 없어요' : '이날은 미션이 없어요'}>
                    선생님이 미션을 내면 여기에 보여요.
                  </Empty>
                </Card>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {todo.map((t) => (
                    <MissionCard key={t.id} task={t} status={status} onToggle={(id) => toggleItem(t, id)} />
                  ))}
                </div>
              )}
            </section>

            <SchoolToday school={school} />

            {soon.length > 0 && (
              <section>
                <SectionTitle icon={<CalendarDays size={18} />} title="다가오는 일정" action={<Button variant="ghost" size="sm" onClick={() => setTab('calendar')}>달력 보기</Button>} />
                <Card className="divide-y divide-line">
                  {soon.slice(0, 5).map((e) => (
                    <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                      <span className={cx('text-xs font-bold rounded-md px-1.5 py-0.5 shrink-0', KIND_TONE[e.kind] || KIND_TONE.기타)}>{e.kind}</span>
                      <span className="flex-1 min-w-0 font-semibold truncate">{e.title}</span>
                      <span className="text-sm text-ink-3 shrink-0">{e.date === t0 ? '오늘' : formatDay(e.date)}</span>
                    </div>
                  ))}
                </Card>
              </section>
            )}

            {visibleLinks.some((l) => l.pinned) && (
              <section>
                <SectionTitle icon={<SquareArrowOutUpRight size={18} />} title="자주 쓰는 바로가기" action={<Button variant="ghost" size="sm" onClick={() => setTab('links')}>전체 보기</Button>} />
                <LinkGrid links={visibleLinks.filter((l) => l.pinned)} />
              </section>
            )}
          </>
        )}

        {tab === 'links' && <LinksTab links={visibleLinks} />}

        {tab === 'calendar' && <CalendarTab events={events} school={school} />}

        {tab === 'notices' && (
          <section>
            <SectionTitle icon={<Megaphone size={18} />} title="공지" sub={unread ? `읽지 않은 공지 ${unread}개` : '모두 읽었어요'} />
            {notices.length === 0 ? (
              <Card>
                <Empty icon={<Bell size={22} />} title="아직 공지가 없어요" />
              </Card>
            ) : (
              <div className="space-y-2.5">
                {notices.map((n) => (
                  <NoticeRow key={n.id} n={n} unread={!status.reads[n.id]} onOpen={() => setOpenNotice(n)} />
                ))}
              </div>
            )}
          </section>
        )}

        {tab === 'me' && api && <MeTab session={session} me={me} onSignOut={async () => {
          await api.leaveClass(classId);
          onSignedOut(false);
        }} />}
      </main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface/90 backdrop-blur-xl border-t border-line pb-[env(safe-area-inset-bottom)]" aria-label="메뉴">
        <div className="grid grid-cols-5 max-w-xl mx-auto">
          {nav.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setTab(n.id)}
              aria-current={tab === n.id ? 'page' : undefined}
              className={cx('relative h-16 flex flex-col items-center justify-center gap-0.5 text-[12px] min-[400px]:text-[13px] font-semibold cursor-pointer transition', tab === n.id ? 'text-brand-strong' : 'text-ink-3')}
            >
              {n.icon}
              {n.label}
              {n.dot && <span className="absolute top-2.5 left-[calc(50%+6px)] w-2.5 h-2.5 rounded-full bg-bad ring-2 ring-surface" aria-label="새 공지" />}
            </button>
          ))}
        </div>
      </nav>

      {openNotice && api && (
        <NoticeModal
          api={api}
          classId={classId}
          summary={openNotice}
          read={!!status.reads[openNotice.id]}
          onRead={() => api.markRead(classId, sid, openNotice.id).catch((e) => toast(errorMessage(e)))}
          onClose={() => setOpenNotice(null)}
        />
      )}
    </div>
  );
}

function MissionCard({ task, status, onToggle }: { task: Task; status: StudentStatus; onToggle: (itemId: string) => void }) {
  const p = progressOf(task, status);
  return (
    <Card className={cx('p-4 sm:p-5 transition', p.all && 'bg-ok-soft/50 border-ok/25')}>
      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
        <Badge tone={task.due === today() ? 'brand' : 'neutral'}>{task.due === today() ? '오늘' : formatDay(task.due)}</Badge>
        {p.all && <Badge tone="ok" icon={<Check size={12} />}>미션 완료</Badge>}
      </div>
      <h3 className="text-lg font-bold leading-snug break-words">{task.title}</h3>
      <ul className="mt-3 space-y-2">
        {task.items.map((i) => {
          const done = counted(status.tasks[markKey(task.id, i.id)]?.state);
          return i.check ? (
            <li key={i.id} className={cx(i.sub && 'pl-6')}>
              <button
                type="button"
                onClick={() => onToggle(i.id)}
                aria-pressed={done}
                className={cx(
                  'w-full min-h-14 rounded-2xl border-2 px-3.5 py-2.5 flex items-center gap-3 text-left cursor-pointer transition active:scale-[0.99]',
                  done ? 'border-ok/40 bg-ok-soft' : 'border-line-strong bg-surface hover:border-brand'
                )}
              >
                <span className={cx('w-7 h-7 rounded-lg border-2 flex items-center justify-center shrink-0 transition', done ? 'bg-ok border-ok text-white' : 'border-line-strong bg-surface')}>{done && <Check size={18} strokeWidth={3.5} />}</span>
                <span className={cx('flex-1 min-w-0 font-semibold leading-snug break-words', done ? 'text-ink-2 line-through decoration-ok/60 decoration-2' : 'text-ink')}>{i.text}</span>
              </button>
            </li>
          ) : (
            <li key={i.id} className={cx('flex items-start gap-2.5 px-1 text-[16px] text-ink-2 leading-snug', i.sub && 'pl-7')}>
              <span className="w-1.5 h-1.5 rounded-full bg-ink-3 mt-2.5 shrink-0" aria-hidden />
              <span className="break-words min-w-0">{i.text}</span>
            </li>
          );
        })}
      </ul>
      {p.total > 0 && (
        <div className="mt-4">
          <Progress value={p.done} max={p.total} tone={p.all ? 'ok' : 'brand'} label={`${task.title} 진행`} />
          <p className="text-xs font-semibold text-ink-3 mt-1.5 tabular-nums">
            {p.done} / {p.total} 완료
          </p>
        </div>
      )}
      {task.linkUrl && (
        <a href={task.linkUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 mt-3 text-[15px] font-semibold text-brand-strong hover:underline">
          <ExternalLink size={15} /> 바로가기 열기
        </a>
      )}
    </Card>
  );
}

function CalendarTab({ events, school }: { events: CalEvent[]; school: SchoolInfo | null }) {
  const [month, setMonth] = useState(today().slice(0, 7));
  const [selected, setSelected] = useState(today());
  const { from, to } = monthRange(month);
  const neis = useSchoolSchedule(school, from, to);
  const byDay = itemsByDay(events, neis);
  const items = byDay[selected] || [];
  return (
    <section className="space-y-4">
      <SectionTitle icon={<CalendarDays size={18} />} title="학급 달력" />
      <Card className="p-3 sm:p-5">
        <MonthGrid month={month} setMonth={setMonth} byDay={byDay} selected={selected} onSelect={(k) => (setSelected(k), setMonth(k.slice(0, 7)))} />
      </Card>
      <Card className="p-4 sm:p-5">
        <h3 className="font-bold mb-2">{formatDay(selected)}</h3>
        {items.length === 0 ? (
          <p className="text-ink-3">일정이 없어요.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((x) => (
              <li key={x.id} className="flex items-center gap-2">
                <span className={cx('text-xs font-bold rounded-md px-1.5 py-0.5 shrink-0', KIND_TONE[x.kind] || KIND_TONE.기타)}>{x.kind}</span>
                <span className="font-semibold">{x.title}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}

function NoticeRow({ n, unread, onOpen }: { n: NoticeSummary; unread: boolean; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="w-full text-left cursor-pointer group">
      <Card className="p-4 flex items-start gap-3 group-hover:border-brand/40 transition">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <TagBadge tag={n.tag} />
            {n.pinned && <Badge tone="brand" icon={<Pin size={11} />}>고정</Badge>}
            <span className="text-xs text-ink-3 ml-auto">{formatTime(n.publishAt)}</span>
          </div>
          <p className="font-bold text-ink leading-snug">{n.title}</p>
          {n.snippet && <p className="text-[15px] text-ink-3 mt-0.5 line-clamp-2">{n.snippet}</p>}
        </div>
        {unread && <span className="mt-1.5 w-2.5 h-2.5 rounded-full bg-bad shrink-0" aria-label="안 읽음" />}
      </Card>
    </button>
  );
}

function LinkGrid({ links }: { links: LinkItem[] }) {
  return (
    <div className="grid grid-cols-3 min-[480px]:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
      {links.map((l) => (
        <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer" className="group">
          <Card className="p-3 pt-4 h-full flex flex-col items-center text-center gap-2.5 group-hover:-translate-y-0.5 group-hover:shadow-pop transition">
            <LinkIcon url={l.url} icon={l.icon} category={linkCategory(l.category)} size={60} className="group-hover:scale-105 transition-transform" />
            <span className="text-[15px] font-semibold text-ink leading-tight line-clamp-2">{l.title}</span>
          </Card>
        </a>
      ))}
    </div>
  );
}

function LinksTab({ links }: { links: LinkItem[] }) {
  const have = new Set(links.map((l) => linkCategory(l.category)));
  const cats = LINK_CATEGORIES.filter((c) => have.has(c));
  const [cat, setCat] = useState('전체');
  const shown = cat === '전체' ? links : links.filter((l) => linkCategory(l.category) === cat);
  return (
    <section>
      <SectionTitle icon={<SquareArrowOutUpRight size={18} />} title="바로가기 모음" />
      <div className="flex gap-2 overflow-x-auto scrollbar-none pb-3 -mx-4 px-4">
        {['전체', ...cats].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCat(c)}
            aria-pressed={cat === c}
            className={cx('h-11 px-4 rounded-full font-semibold whitespace-nowrap border transition cursor-pointer', cat === c ? 'bg-ink text-canvas border-ink' : 'bg-surface text-ink-2 border-line hover:border-line-strong')}
          >
            {c}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <Card>
          <Empty icon={<SquareArrowOutUpRight size={22} />} title="아직 바로가기가 없어요" />
        </Card>
      ) : (
        <LinkGrid links={shown} />
      )}
    </section>
  );
}

function NoticeModal({ api, classId, summary, read, onRead, onClose }: { api: Api; classId: string; summary: NoticeSummary; read: boolean; onRead: () => void; onClose: () => void }) {
  const [n, setN] = useState<Notice | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api
      .getNotice(classId, summary.id)
      .then((d) => (d ? setN(d) : setError('공지를 열지 못했어요.')))
      .catch((e) => setError(errorMessage(e)));
  }, [api, classId, summary.id]);

  return (
    <Modal
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <TagBadge tag={summary.tag} /> 공지
        </span>
      }
      footer={
        <>
          <Button size="lg" variant={read ? 'soft' : 'primary'} icon={<Check size={18} />} onClick={read ? onClose : () => (onRead(), onClose())} disabled={!n}>
            {read ? '확인했어요 ✓' : '확인했어요'}
          </Button>
        </>
      }
    >
      <h3 className="text-2xl font-bold tracking-tight leading-snug">{summary.title}</h3>
      <p className="text-sm text-ink-3 mt-1">{formatTime(summary.publishAt)}</p>
      <ErrorNote>{error}</ErrorNote>
      {!n && !error && <Spinner />}
      {n && (
        <>
          <p className="mt-4 text-[17px] leading-relaxed whitespace-pre-wrap text-ink-2">{n.body}</p>
          {n.imageData?.length > 0 && (
            <div className="mt-4 grid gap-3">
              {n.imageData.map((src, i) => (
                <img key={i} src={src} alt={`공지 그림 ${i + 1}`} className="w-full rounded-2xl border border-line" />
              ))}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

function MeTab({ session, me, onSignOut }: { session: StudentSession; me: Student | null; onSignOut: () => void }) {
  return (
    <section className="space-y-4 max-w-3xl">
      <SectionTitle icon={<UserRound size={18} />} title="나" />
      <Card className="p-5 flex items-center gap-4">
        <span className="w-14 h-14 rounded-2xl bg-brand-soft text-brand-strong text-2xl font-bold flex items-center justify-center shrink-0">{session.number}</span>
        <div className="min-w-0">
          <p className="text-xl font-bold truncate">{me?.name}</p>
          <p className="text-ink-3 truncate">
            {session.className} · {session.number}번
          </p>
          <p className="text-xs text-ink-3 mt-1">이름이 틀렸으면 선생님께 말해 주세요.</p>
        </div>
      </Card>
      <ThemeCard />
      <Card className="p-5 space-y-3">
        <h3 className="font-bold">이 기기에서 로그아웃</h3>
        <p className="text-[15px] text-ink-3">여럿이 함께 쓰는 기기라면 다 쓴 뒤 로그아웃해 주세요. 내 기록은 그대로 남아요.</p>
        <Button variant="secondary" size="lg" icon={<LogOut size={18} />} onClick={onSignOut}>
          로그아웃
        </Button>
      </Card>
    </section>
  );
}
