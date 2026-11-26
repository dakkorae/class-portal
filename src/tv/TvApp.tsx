import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ListChecks, Maximize, Megaphone, QrCode, Sparkles, TvMinimal } from 'lucide-react';
import { emptyLive } from '../lib/api';
import { errorMessage, getApi, inviteUrl } from '../lib/cloud';
import { dueLabel, formatLongToday, today } from '../lib/dates';
import { activeNow, visibleNotices } from '../lib/visible';
import { LiveDoc, checkItems, markKey } from '../lib/types';
import { cx } from '../ui/kit';

// 교실 TV(전자칠판) 화면: 읽기 전용, 학생 이름은 보이지 않음
// 주소: #tv/학급코드/비밀값 (교사 화면 '학급 관리'에서 받음)
export default function TvApp({ classId, token }: { classId: string; token: string }) {
  const [state, setState] = useState<'loading' | 'ok' | 'denied' | 'error'>('loading');
  const [error, setError] = useState('');
  const [className, setClassName] = useState('');
  const [live, setLive] = useState<LiveDoc>(emptyLive);
  const [now, setNow] = useState(new Date());

  // TV는 항상 어두운 화면
  useEffect(() => {
    document.documentElement.dataset.theme = 'dark';
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, []);

  useEffect(() => {
    let stops: (() => void)[] = [];
    let alive = true;
    (async () => {
      try {
        const api = await getApi();
        if (!(await api.screenLogin(classId, token))) return alive && setState('denied');
        const onErr = (e: unknown) => {
          setError(errorMessage(e));
          setState((s) => (s === 'ok' ? 'denied' : s));
        };
        stops = [api.watchLive(classId, setLive, onErr), api.watchClass(classId, (c) => setClassName(c?.name || ''), () => undefined)];
        if (alive) setState('ok');
      } catch (e) {
        if (!alive) return;
        setError(errorMessage(e));
        setState('error');
      }
    })();
    return () => {
      alive = false;
      stops.forEach((s) => s());
    };
  }, [classId, token]);

  // 시계
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // 화면이 꺼지지 않게 (지원하는 브라우저만)
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const ask = async () => {
      try {
        lock = await (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen') || null;
      } catch {
        // 무시
      }
    };
    ask();
    const onVis = () => document.visibilityState === 'visible' && ask();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      lock?.release().catch(() => undefined);
    };
  }, []);

  if (state !== 'ok') {
    return (
      <div className="min-h-dvh bg-canvas text-ink flex items-center justify-center p-8">
        <div className="text-center max-w-xl">
          <TvMinimal size={56} className="mx-auto text-ink-3 mb-6" />
          {state === 'loading' && <p className="text-2xl font-semibold text-ink-2">TV 화면을 여는 중…</p>}
          {state === 'denied' && (
            <>
              <p className="text-3xl font-bold">이 TV 주소는 쓸 수 없어요</p>
              <p className="text-xl text-ink-3 mt-3">선생님 화면의 ‘학급 관리 → TV 화면’에서 새 주소를 받아 열어 주세요.</p>
            </>
          )}
          {state === 'error' && <p className="text-2xl font-semibold text-bad">{error}</p>}
        </div>
      </div>
    );
  }

  const nowMs = now.getTime();
  const pinned = visibleNotices(live, nowMs).filter((n) => n.pinned);
  const notices = pinned.length ? pinned : visibleNotices(live, nowMs).slice(0, 3);
  const t0 = today();
  const tasks = Object.entries(live.tasks)
    .filter(([, t]) => t.due >= t0)
    .sort((a, b) => a[1].due.localeCompare(b[1].due))
    .slice(0, 5);
  const nowLink = activeNow(live);
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');

  return (
    <div className="h-dvh overflow-hidden bg-canvas text-ink flex flex-col p-[2.2vw] gap-[1.6vw] bg-aurora" style={{ fontSize: 'clamp(14px, 1.25vw, 40px)' }}>
      <header className="flex items-center justify-between gap-6 shrink-0">
        <div className="flex items-center gap-[1vw] min-w-0">
          <span className="w-[3.4em] h-[3.4em] rounded-[1em] bg-brand-gradient flex items-center justify-center text-white shrink-0" aria-hidden>
            <Sparkles className="w-[1.6em] h-[1.6em]" />
          </span>
          <div className="min-w-0">
            <p className="text-[1.1em] font-semibold text-ink-3">{formatLongToday(now)}</p>
            <h1 className="text-[2.3em] font-bold tracking-tight leading-tight truncate">{className}</h1>
          </div>
        </div>
        <div className="flex items-center gap-[1vw]">
          <p className="text-[4.6em] font-bold tracking-tight tabular-nums leading-none">
            {hh}
            <span className="animate-pulse text-ink-3">:</span>
            {mm}
          </p>
          <button
            type="button"
            onClick={() => document.documentElement.requestFullscreen?.().catch(() => undefined)}
            className="w-[2.8em] h-[2.8em] rounded-[0.8em] bg-surface border border-line text-ink-3 hover:text-ink flex items-center justify-center cursor-pointer"
            aria-label="전체 화면"
            title="전체 화면"
          >
            <Maximize className="w-[1.3em] h-[1.3em]" />
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 grid grid-cols-3 gap-[1.6vw]">
        <Panel icon={<Megaphone />} title={pinned.length ? '꼭 볼 공지' : '공지'}>
          {notices.length === 0 ? (
            <Quiet>오늘은 공지가 없어요</Quiet>
          ) : (
            <ul className="space-y-[0.9em]">
              {notices.map((n) => (
                <li key={n.id} className="rounded-[1em] bg-surface-2 border border-line p-[1em]">
                  <span className="inline-block mb-[0.5em] rounded-[0.5em] bg-brand-soft text-brand-strong px-[0.6em] py-[0.2em] text-[1em] font-bold">{n.tag}</span>
                  <p className="text-[1.55em] font-bold leading-snug">{n.title}</p>
                  {n.snippet && <p className="text-[1.15em] text-ink-2 mt-[0.3em] line-clamp-3">{n.snippet}</p>}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel icon={<ListChecks />} title="오늘 미션">
          {tasks.length === 0 ? (
            <Quiet>남은 미션이 없어요</Quiet>
          ) : (
            <ul className="space-y-[0.9em]">
              {tasks.map(([id, t]) => {
                const checks = checkItems(t);
                return (
                  <li key={id} className="rounded-[1em] bg-surface-2 border border-line p-[1em]">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-[1.45em] font-bold leading-snug min-w-0">{t.title}</p>
                      <span className={cx('text-[1em] font-semibold shrink-0', t.due === t0 ? 'text-brand-strong' : 'text-ink-3')}>{dueLabel(t.due)}</span>
                    </div>
                    {checks.length === 0 ? (
                      <p className="mt-[0.4em] text-[1.1em] text-ink-2 line-clamp-2">{(t.items || []).map((i) => i.text).join(' · ')}</p>
                    ) : (
                      <ul className="mt-[0.6em] space-y-[0.5em]">
                        {checks.slice(0, 4).map((i) => {
                          const done = Math.min(live.done[markKey(id, i.id)] || 0, t.total);
                          const all = t.total > 0 && done >= t.total;
                          return (
                            <li key={i.id}>
                              <div className="flex items-baseline justify-between gap-2 text-[1.1em]">
                                <span className="font-semibold text-ink-2 truncate min-w-0">{i.text}</span>
                                <span className={cx('font-bold tabular-nums shrink-0', all ? 'text-ok' : 'text-ink')}>
                                  {done}/{t.total}
                                  {all && ' 🎉'}
                                </span>
                              </div>
                              <div className="mt-[0.3em] h-[0.5em] rounded-full bg-canvas overflow-hidden">
                                <div className={cx('h-full rounded-full transition-[width] duration-700', all ? 'bg-ok' : 'bg-brand')} style={{ width: `${t.total ? Math.round((done / t.total) * 100) : 0}%` }} />
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel icon={<QrCode />} title={nowLink ? '지금 열기' : '우리 반 포털'} highlight={!!nowLink}>
          <div className="h-full flex flex-col items-center justify-center text-center gap-[1em]">
            <div className="bg-white rounded-[1.2em] p-[0.9em] w-full max-w-[min(100%,46vh)] aspect-square shadow-2xl">
              <QRCodeSVG value={nowLink ? nowLink.url : inviteUrl(classId)} size={512} level="M" marginSize={1} className="w-full h-full" title={nowLink ? `${nowLink.title} QR 코드` : '학급 참여 QR 코드'} />
            </div>
            <div>
              <p className="text-[1.8em] font-bold leading-snug break-words">{nowLink ? nowLink.title : '태블릿 카메라로 찍어 들어와요'}</p>
              <p className="text-[1.15em] text-ink-3 mt-[0.3em]">{nowLink ? '태블릿 홈 화면 맨 위에도 떠 있어요' : `학급 코드 ${classId}`}</p>
            </div>
          </div>
        </Panel>
      </main>
    </div>
  );
}

function Panel({ icon, title, children, highlight }: { icon: React.ReactNode; title: string; children: React.ReactNode; highlight?: boolean }) {
  return (
    <section className={cx('min-h-0 rounded-[1.6em] border bg-surface/85 backdrop-blur p-[1.4em] flex flex-col', highlight ? 'border-brand ring-4 ring-brand/30' : 'border-line')}>
      <h2 className="flex items-center gap-[0.5em] text-[1.35em] font-bold text-ink-2 mb-[0.9em] shrink-0 [&>svg]:w-[1.1em] [&>svg]:h-[1.1em] [&>svg]:text-brand-strong">
        {icon}
        {title}
      </h2>
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
    </section>
  );
}

const Quiet = ({ children }: { children: React.ReactNode }) => <p className="h-full flex items-center justify-center text-[1.4em] text-ink-3 font-medium">{children}</p>;
