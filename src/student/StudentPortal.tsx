import { useEffect, useMemo, useState } from 'react';
import { Bell, CalendarClock, Check, CheckCircle2, ExternalLink, Home, Link2, LogOut, Megaphone, Pin, RotateCcw, Sparkles, UserRound, Volume2, VolumeX } from 'lucide-react';
import { Api, emptyLive } from '../lib/api';
import { errorMessage, getApi } from '../lib/cloud';
import { addDays, dueLabel, formatLongToday, formatTime, today } from '../lib/dates';
import { activeNow, isTarget, visibleNotices } from '../lib/visible';
import { LinkItem, LiveDoc, NAME_CHANGE_DAYS, NAME_MAX, Notice, NoticeSummary, Student, StudentSession, StudentStatus, Task } from '../lib/types';
import { Badge, Button, Card, Empty, ErrorNote, Input, LinkIcon, Modal, SectionTitle, Spinner, cx, toast } from '../ui/kit';
import { TagBadge } from '../ui/tags';

type Tab = 'home' | 'links' | 'notices' | 'me';

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
  const [openNotice, setOpenNotice] = useState<NoticeSummary | null>(null);
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
      api.watchStudent(classId, sid, setMe, onErr)
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
  const todo = myTasks.filter((t) => t.due >= t0 && status.tasks[t.id]?.state !== 'checked');
  const overdue = myTasks.filter((t) => t.due < t0 && t.due >= addDays(t0, -30) && !['checked', 'done'].includes(status.tasks[t.id]?.state || ''));
  const visibleLinks = links.filter((l) => !l.hidden);

  const toggleTask = async (t: Task) => {
    if (!api) return;
    const cur = status.tasks[t.id];
    const done = cur?.state !== 'done';
    try {
      await api.markTask(classId, sid, t.id, cur, done);
      toast(done ? '다 했어요! 선생님이 확인할 거예요.' : '되돌렸어요.');
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
    { id: 'links', label: '링크', icon: <Link2 size={22} /> },
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
                  <LinkIcon url={nowLink.url} icon={nowLink.icon} size={60} className="bg-white/95 border-white/40" />
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

            <section>
              <SectionTitle icon={<CheckCircle2 size={18} />} title="오늘 할 일" sub={todo.length ? `${todo.filter((t) => !status.tasks[t.id] || status.tasks[t.id].state !== 'done').length}개 남았어요` : undefined} />
              {todo.length === 0 && overdue.length === 0 ? (
                <Card>
                  <Empty icon={<Check size={22} />} title="할 일을 모두 끝냈어요!">
                    새 과제가 생기면 여기에 보여요.
                  </Empty>
                </Card>
              ) : (
                <div className="space-y-2.5">
                  {todo.map((t) => (
                    <TaskRow key={t.id} task={t} status={status} onToggle={() => toggleTask(t)} />
                  ))}
                </div>
              )}
              {overdue.length > 0 && (
                <div className="mt-5">
                  <h3 className="text-sm font-bold text-warn mb-2 flex items-center gap-1.5">
                    <CalendarClock size={16} /> 마감 지난 과제
                  </h3>
                  <div className="space-y-2.5">
                    {overdue.map((t) => (
                      <TaskRow key={t.id} task={t} status={status} onToggle={() => toggleTask(t)} late />
                    ))}
                  </div>
                </div>
              )}
            </section>

            {visibleLinks.some((l) => l.pinned) && (
              <section>
                <SectionTitle icon={<Link2 size={18} />} title="자주 쓰는 링크" action={<Button variant="ghost" size="sm" onClick={() => setTab('links')}>전체 보기</Button>} />
                <LinkGrid links={visibleLinks.filter((l) => l.pinned)} />
              </section>
            )}
          </>
        )}

        {tab === 'links' && <LinksTab links={visibleLinks} />}

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

        {tab === 'me' && api && <MeTab api={api} session={session} me={me} onSignOut={async () => {
          await api.leaveClass(classId);
          onSignedOut(false);
        }} />}
      </main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-surface/90 backdrop-blur-xl border-t border-line pb-[env(safe-area-inset-bottom)]" aria-label="메뉴">
        <div className="grid grid-cols-4 max-w-lg mx-auto">
          {nav.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setTab(n.id)}
              aria-current={tab === n.id ? 'page' : undefined}
              className={cx('relative h-16 flex flex-col items-center justify-center gap-0.5 text-[13px] font-semibold cursor-pointer transition', tab === n.id ? 'text-brand-strong' : 'text-ink-3')}
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

function TaskRow({ task, status, onToggle, late }: { task: Task; status: StudentStatus; onToggle: () => void; late?: boolean }) {
  const mark = status.tasks[task.id];
  const state = mark?.state || 'todo';
  const done = state === 'done';
  return (
    <Card className={cx('p-4 flex items-start gap-3.5 transition', done && 'bg-ok-soft/60 border-ok/20')}>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5 mb-1">
          <Badge tone={late ? 'warn' : task.due === today() ? 'brand' : 'neutral'}>{dueLabel(task.due)}</Badge>
          {state === 'redo' && <Badge tone="bad" icon={<RotateCcw size={12} />}>다시 해요</Badge>}
          {done && <Badge tone="ok" icon={<Check size={12} />}>선생님 확인 전</Badge>}
        </div>
        <p className={cx('font-bold text-ink leading-snug', done && 'text-ink-2')}>{task.title}</p>
        {task.desc && <p className="text-[15px] text-ink-3 mt-0.5 whitespace-pre-wrap">{task.desc}</p>}
        {state === 'redo' && mark?.note && <p className="text-[15px] font-semibold text-bad mt-1.5">선생님: {mark.note}</p>}
        {task.linkUrl && (
          <a href={task.linkUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 mt-2 text-[15px] font-semibold text-brand-strong hover:underline">
            <ExternalLink size={15} /> 과제 링크 열기
          </a>
        )}
      </div>
      {task.paper ? (
        <span className="text-sm text-ink-3 font-medium shrink-0 self-center text-right">종이 과제<br />선생님이 확인</span>
      ) : (
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={done}
          className={cx(
            'shrink-0 self-center h-14 min-w-24 px-4 rounded-2xl font-bold flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer border-2',
            done ? 'bg-ok text-white border-ok' : 'bg-surface text-ink border-line-strong hover:border-brand hover:text-brand-strong'
          )}
        >
          {done ? (
            <>
              <Check size={20} strokeWidth={3} /> 했어요
            </>
          ) : (
            '다 했어요'
          )}
        </button>
      )}
    </Card>
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
    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
      {links.map((l) => (
        <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer" className="group">
          <Card className="p-3 pt-4 h-full flex flex-col items-center text-center gap-2.5 group-hover:-translate-y-0.5 group-hover:shadow-pop transition">
            <LinkIcon url={l.url} icon={l.icon} size={52} />
            <span className="text-[15px] font-semibold text-ink leading-tight line-clamp-2">{l.title}</span>
          </Card>
        </a>
      ))}
    </div>
  );
}

function LinksTab({ links }: { links: LinkItem[] }) {
  const cats = Array.from(new Set(links.map((l) => l.category)));
  const [cat, setCat] = useState('전체');
  const shown = cat === '전체' ? links : links.filter((l) => l.category === cat);
  return (
    <section>
      <SectionTitle icon={<Link2 size={18} />} title="링크 모음" />
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
          <Empty icon={<Link2 size={22} />} title="아직 링크가 없어요" />
        </Card>
      ) : (
        <LinkGrid links={shown} />
      )}
    </section>
  );
}

function NoticeModal({ api, classId, summary, read, onRead, onClose }: { api: Api; classId: string; summary: NoticeSummary; read: boolean; onRead: () => void; onClose: () => void }) {
  const [n, setN] = useState<Notice | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    api
      .getNotice(classId, summary.id)
      .then((d) => (d ? setN(d) : setError('공지를 열지 못했어요.')))
      .catch((e) => setError(errorMessage(e)));
    return () => window.speechSynthesis?.cancel();
  }, [api, classId, summary.id]);

  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const speak = () => {
    if (!n) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(`${n.title}. ${n.body}`);
    u.lang = 'ko-KR';
    u.rate = 0.95;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  };

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
          {canSpeak && (
            <Button variant="secondary" size="lg" icon={speaking ? <VolumeX size={18} /> : <Volume2 size={18} />} onClick={speak} disabled={!n}>
              {speaking ? '그만 읽기' : '읽어 주기'}
            </Button>
          )}
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

function MeTab({ api, session, me, onSignOut }: { api: Api; session: StudentSession; me: Student | null; onSignOut: () => void }) {
  const [name, setName] = useState(me?.name || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => setName(me?.name || ''), [me?.name]);
  const nextChange = me?.nameAt ? me.nameAt + NAME_CHANGE_DAYS * 86400000 : 0;
  const locked = nextChange > Date.now();

  const save = async () => {
    if (!me) return;
    const v = name.trim();
    if (!v || v.length > NAME_MAX) return setError(`이름은 1~${NAME_MAX}글자로 써 주세요.`);
    setBusy(true);
    setError('');
    try {
      const r = await api.renameSelf(session.classId, me, v);
      if (r === 'too-soon') setError(`이름은 ${NAME_CHANGE_DAYS}일에 한 번만 바꿀 수 있어요.`);
      else toast('이름을 바꿨어요.');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4 max-w-xl">
      <SectionTitle icon={<UserRound size={18} />} title="나" />
      <Card className="p-5 flex items-center gap-4">
        <span className="w-14 h-14 rounded-2xl bg-brand-soft text-brand-strong text-2xl font-bold flex items-center justify-center shrink-0">{session.number}</span>
        <div className="min-w-0">
          <p className="text-xl font-bold truncate">{me?.name}</p>
          <p className="text-ink-3 truncate">{session.className} · {session.number}번</p>
        </div>
      </Card>
      <Card className="p-5 space-y-3">
        <h3 className="font-bold">이름 바꾸기</h3>
        <div className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={NAME_MAX} disabled={locked || busy} aria-label="새 이름" className="h-12 text-lg" />
          <Button size="lg" onClick={save} loading={busy} disabled={locked || name.trim() === me?.name}>
            저장
          </Button>
        </div>
        <p className="text-sm text-ink-3">
          {locked ? `${new Date(nextChange).toLocaleDateString('ko-KR')}부터 다시 바꿀 수 있어요.` : `${NAME_CHANGE_DAYS}일에 한 번 바꿀 수 있어요. 선생님은 언제든 고칠 수 있어요.`}
        </p>
        <ErrorNote>{error}</ErrorNote>
      </Card>
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
