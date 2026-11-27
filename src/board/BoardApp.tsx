import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Dices, Eraser, Expand, Eye, EyeOff, ListChecks, Minus, Pause, PenLine, Play, Plus, RotateCcw, Shrink, Timer, Trash2, Undo2, AlarmClock } from 'lucide-react';
import { emptyLive } from '../lib/api';
import { errorMessage, getApi, loadPref, savePref } from '../lib/cloud';
import { dueLabel, formatLongToday, today } from '../lib/dates';
import { LateView, useLateTimers } from './LateTimer';
import { LiveDoc, Student, Task, markKey } from '../lib/types';
import { cx } from '../ui/kit';
import { Rich } from '../ui/RichText';

// 교실 화면 (교사 기기에서 새 창으로 엶): 미션을 크게 보여 주고, 판서·타이머·번호 뽑기·지각생 하교 타이머를 함께 씀
// 주소: #board/학급코드/미션ID(선택)
type Mode = 'mission' | 'write' | 'timer' | 'picker' | 'late';
const MODES: Mode[] = ['mission', 'write', 'timer', 'picker', 'late'];
type Theme = 'pastel' | 'chalk' | 'dark' | 'white';
type Stroke = { color: string; width: number; erase: boolean; pts: [number, number][] };

const THEMES: Record<Theme, { label: string; vars: Record<string, string> }> = {
  pastel: { label: '솜사탕', vars: { '--b-bg': '#fff6fb', '--b-ink': '#4e3e5e', '--b-ink2': '#7d6c90', '--b-accent': '#df5f9f', '--b-panel': '#fbe9f3', '--b-line': '#f3d9e8', '--b-ok': '#2f9e6c' } },
  chalk: { label: '칠판', vars: { '--b-bg': '#1c3a2e', '--b-ink': '#f6f3ea', '--b-ink2': 'rgba(246,243,234,0.72)', '--b-accent': '#ffd75e', '--b-panel': 'rgba(255,255,255,0.07)', '--b-line': 'rgba(255,255,255,0.16)', '--b-ok': '#7ee2a8' } },
  dark: { label: '검정', vars: { '--b-bg': '#0b0d16', '--b-ink': '#f1f2f8', '--b-ink2': 'rgba(241,242,248,0.68)', '--b-accent': '#a9adff', '--b-panel': 'rgba(255,255,255,0.06)', '--b-line': 'rgba(255,255,255,0.14)', '--b-ok': '#4ade9a' } },
  white: { label: '흰색', vars: { '--b-bg': '#ffffff', '--b-ink': '#111427', '--b-ink2': '#4b5065', '--b-accent': '#4f46e5', '--b-panel': '#f2f4f9', '--b-line': '#dfe3ee', '--b-ok': '#047857' } }
};
const PENS: Record<Theme, string[]> = {
  pastel: ['#4e3e5e', '#ff5fa2', '#4ea8ff', '#2fbf7f', '#ffb020'],
  chalk: ['#ffffff', '#ffd75e', '#ff8fa3', '#7cc8ff', '#9ef0a8'],
  dark: ['#ffffff', '#ffd75e', '#ff7a96', '#7cc8ff', '#4ade9a'],
  white: ['#111427', '#e11d48', '#2563eb', '#059669', '#f59e0b']
};

export default function BoardApp({ classId, missionId, initialMode }: { classId: string; missionId?: string; initialMode?: string }) {
  const [state, setState] = useState<'loading' | 'ok' | 'denied' | 'error'>('loading');
  const [error, setError] = useState('');
  const [className, setClassName] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [live, setLive] = useState<LiveDoc>(emptyLive);
  const [students, setStudents] = useState<Student[]>([]);
  const [maxStudents, setMax] = useState(30);
  const [mode, setMode] = useState<Mode>(MODES.includes(initialMode as Mode) ? (initialMode as Mode) : 'mission');
  const [theme, setTheme] = useState<Theme>(() => loadPref<Theme>('board_theme', 'pastel'));
  const [scale, setScale] = useState(() => loadPref('board_scale', 1));
  const [showCount, setShowCount] = useState(() => loadPref('board_count', true));
  const [showNames, setShowNames] = useState(false);
  const [current, setCurrent] = useState<string | undefined>(missionId);
  const [now, setNow] = useState(new Date());
  const [full, setFull] = useState(false);

  useEffect(() => {
    document.title = '교실 화면 · 우리 반 포털';
    let stops: (() => void)[] = [];
    let alive = true;
    (async () => {
      try {
        const a = await getApi();
        if (!(await a.isTeacher(classId))) return alive && setState('denied');
        const onErr = (e: unknown) => setError(errorMessage(e));
        stops = [
          a.watchClass(classId, (c) => (setClassName(c?.name || ''), setMax(c?.maxStudents || 30)), onErr),
          a.watchTasks(classId, setTasks, onErr),
          a.watchLive(classId, setLive, onErr),
          a.watchStudents(classId, setStudents, onErr)
        ];
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
  }, [classId]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    const onFs = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      clearInterval(t);
      document.removeEventListener('fullscreenchange', onFs);
    };
  }, []);

  const t0 = today();
  const list = useMemo(() => {
    const active = tasks.filter((t) => t.due === t0); // 오늘 미션
    const pick = current && tasks.find((t) => t.id === current);
    return pick && !active.includes(pick) ? [pick, ...active] : active;
  }, [tasks, t0, current]);
  const idx = Math.max(0, list.findIndex((t) => t.id === current));
  const task = list[idx];
  const go = useCallback((dir: -1 | 1) => list.length && setCurrent(list[(idx + dir + list.length) % list.length].id), [list, idx]);

  const toggleFull = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => undefined);
  const setPref = <T,>(set: (v: T) => void, key: string) => (v: T) => (set(v), savePref(key, v));

  // ---- 판서 ----
  const [pen, setPen] = useState(false);
  const [eraser, setEraser] = useState(false);
  const [color, setColor] = useState(PENS[theme][0]);
  const [width, setWidth] = useState(6);
  const [strokes, setStrokes] = useState<Record<string, Stroke[]>>({});
  const boardKey = mode === 'mission' ? 'm:' + (task?.id || '') : mode;
  useEffect(() => setColor(PENS[theme][0]), [theme]);

  // ---- 타이머 ----
  const timer = useTimer();
  // ---- 지각생 하교 타이머 (다른 메뉴로 가도 계속 잼) ----
  const late = useLateTimers();
  // ---- 번호 뽑기 ----
  const pool = useMemo(() => (students.length ? students.map((s) => s.number) : Array.from({ length: maxStudents }, (_, i) => i + 1)), [students, maxStudents]);

  // 키보드: ←/→ 미션 넘기기, F 전체 화면, P 펜
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight' && mode === 'mission') go(1);
      if (e.key === 'ArrowLeft' && mode === 'mission') go(-1);
      if (e.key.toLowerCase() === 'f') toggleFull();
      if (e.key.toLowerCase() === 'p') setPen((v) => !v);
      if (e.key === 'Escape') setPen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, mode]);

  const vars = THEMES[theme].vars as React.CSSProperties;

  if (state !== 'ok') {
    return (
      <div className="board min-h-dvh flex items-center justify-center p-8 text-center" style={vars}>
        <div className="max-w-xl">
          {state === 'loading' && <p className="text-2xl font-semibold b-ink2">교실 화면을 여는 중…</p>}
          {state === 'denied' && (
            <>
              <p className="text-3xl font-bold">선생님 기기에서만 열 수 있어요</p>
              <p className="text-xl b-ink2 mt-3">교사 화면에서 ‘TV 화면 열기’를 눌러 주세요.</p>
            </>
          )}
          {state === 'error' && <p className="text-2xl font-semibold text-[#ff8fa3]">{error}</p>}
        </div>
      </div>
    );
  }

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');

  return (
    <div className="board h-dvh overflow-hidden flex flex-col select-none" style={vars}>
      {/* 위 도구 막대 */}
      <header className="shrink-0 flex flex-wrap items-center gap-2 px-3 sm:px-5 py-2.5 border-b b-line">
        <div className="min-w-0 mr-2">
          <p className="text-xs font-semibold b-ink2 truncate">{formatLongToday(now)}</p>
          <p className="font-bold truncate leading-tight">{className}</p>
        </div>
        <nav className="flex items-center gap-1 rounded-xl b-panel p-1" aria-label="교실 화면 메뉴">
          {(
            [
              ['mission', '공지·미션', <ListChecks key="m" size={18} />],
              ['write', '판서', <PenLine key="w" size={18} />],
              ['timer', '타이머', <Timer key="t" size={18} />],
              ['picker', '번호 뽑기', <Dices key="p" size={18} />],
              ['late', '지각생 타이머', <AlarmClock key="l" size={18} />]
            ] as [Mode, string, React.ReactNode][]
          ).map(([m, label, icon]) => (
            <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m} className={cx('h-10 px-3 rounded-lg flex items-center gap-1.5 font-bold text-sm cursor-pointer transition', mode === m ? 'b-active' : 'b-ink2 hover:b-ink')}>
              {icon}
              <span className="hidden md:inline">{label}</span>
            </button>
          ))}
          {timer.running && mode !== 'timer' && <span className="px-2 font-bold tabular-nums b-accent text-sm">{fmt(timer.left)}</span>}
          {late.running && mode !== 'late' && <span className="px-2 font-bold b-accent text-sm">⏱️ 지각생 {late.list.filter((x) => x.status === 'running').length}명</span>}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <ToolBtn label="펜 (P)" active={pen} onClick={() => setPen(!pen)}>
            <PenLine size={18} />
          </ToolBtn>
          <ToolBtn label="글자 작게" onClick={() => setPref(setScale, 'board_scale')(Math.max(0.6, +(scale - 0.1).toFixed(1)))}>
            <Minus size={18} />
          </ToolBtn>
          <span className="text-xs font-bold b-ink2 w-9 text-center tabular-nums">{Math.round(scale * 100)}%</span>
          <ToolBtn label="글자 크게" onClick={() => setPref(setScale, 'board_scale')(Math.min(1.8, +(scale + 0.1).toFixed(1)))}>
            <Plus size={18} />
          </ToolBtn>
          <select value={theme} onChange={(e) => setPref(setTheme, 'board_theme')(e.target.value as Theme)} className="h-10 rounded-lg b-panel border b-line px-2 text-sm font-semibold cursor-pointer" aria-label="화면 색">
            {(Object.keys(THEMES) as Theme[]).map((k) => (
              <option key={k} value={k}>
                {THEMES[k].label}
              </option>
            ))}
          </select>
          <span className="hidden lg:block text-2xl font-bold tabular-nums px-2">
            {hh}:{mm}
          </span>
          <ToolBtn label={full ? '전체 화면 끝내기 (F)' : '전체 화면 (F)'} onClick={toggleFull}>
            {full ? <Shrink size={18} /> : <Expand size={18} />}
          </ToolBtn>
        </div>
      </header>

      {pen && (
        <div className="shrink-0 flex flex-wrap items-center gap-2 px-3 sm:px-5 py-2 border-b b-line b-panel">
          {PENS[theme].map((c) => (
            <button key={c} type="button" onClick={() => (setColor(c), setEraser(false))} aria-label={`펜 색 ${c}`} aria-pressed={!eraser && color === c} className={cx('w-9 h-9 rounded-full border-2 cursor-pointer', !eraser && color === c ? 'b-ring' : 'border-transparent')} style={{ background: c }} />
          ))}
          <span className="w-px h-7 b-divider mx-1" />
          {[3, 6, 12].map((w) => (
            <button key={w} type="button" onClick={() => setWidth(w)} aria-pressed={width === w} aria-label={`굵기 ${w}`} className={cx('w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer', width === w ? 'b-active' : 'hover:b-panel')}>
              <span className="rounded-full" style={{ width: w + 2, height: w + 2, background: 'var(--b-ink)' }} />
            </button>
          ))}
          <span className="w-px h-7 b-divider mx-1" />
          <ToolBtn label="지우개" active={eraser} onClick={() => setEraser(!eraser)}>
            <Eraser size={18} />
          </ToolBtn>
          <ToolBtn label="한 획 되돌리기" onClick={() => setStrokes((m) => ({ ...m, [boardKey]: (m[boardKey] || []).slice(0, -1) }))}>
            <Undo2 size={18} />
          </ToolBtn>
          <ToolBtn label="판서 모두 지우기" onClick={() => setStrokes((m) => ({ ...m, [boardKey]: [] }))}>
            <Trash2 size={18} />
          </ToolBtn>
          <button type="button" onClick={() => setPen(false)} className="ml-auto h-9 px-3 rounded-lg b-active font-bold text-sm cursor-pointer">
            펜 끝내기
          </button>
        </div>
      )}

      <main className="relative flex-1 min-h-0" style={{ fontSize: `calc(clamp(15px, 1.9vw, 60px) * ${scale})` }}>
        <div className="absolute inset-0 overflow-auto">
          {mode === 'mission' && <MissionView task={task} index={idx} count={list.length} live={live} total={task ? (task.targets ? task.targets.length : students.length) : 0} showCount={showCount} onToggleCount={() => setPref(setShowCount, 'board_count')(!showCount)} onPrev={() => go(-1)} onNext={() => go(1)} />}
          {mode === 'write' && <WriteView />}
          {mode === 'timer' && <TimerView timer={timer} />}
          {mode === 'picker' && <PickerView pool={pool} students={students} showNames={showNames} setShowNames={setShowNames} />}
          {mode === 'late' && <LateView late={late} students={students} />}
        </div>
        <PenCanvas active={pen} eraser={eraser} color={color} width={width} strokes={strokes[boardKey] || []} onStroke={(s) => setStrokes((m) => ({ ...m, [boardKey]: [...(m[boardKey] || []), s] }))} />
      </main>
      {error && <p className="shrink-0 text-center text-sm py-1 text-[#ff8fa3]">{error}</p>}
      {timer.ringing && <TimesUp onClose={timer.reset} />}
    </div>
  );
}

function ToolBtn({ label, onClick, active, children }: { label: string; onClick: () => void; active?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} aria-pressed={active} className={cx('w-10 h-10 rounded-lg flex items-center justify-center cursor-pointer transition', active ? 'b-active' : 'b-ink2 hover:b-panel')}>
      {children}
    </button>
  );
}

// ---------- 미션 크게 보기 ----------
function MissionView({ task, index, count, live, total, showCount, onToggleCount, onPrev, onNext }: { task?: Task; index: number; count: number; live: LiveDoc; total: number; showCount: boolean; onToggleCount: () => void; onPrev: () => void; onNext: () => void }) {
  if (!task)
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <p className="text-[2em] font-bold">오늘은 공지·미션이 없어요</p>
        <p className="text-[1em] b-ink2 mt-[0.4em]">교사 화면의 ‘공지 및 미션’에서 올리거나, 위의 ‘판서’에서 직접 써 보세요.</p>
      </div>
    );
  return (
    <div className="min-h-full flex flex-col px-[4%] py-[2.5%]">
      <div className="flex items-center gap-[0.5em] mb-[0.6em]">
        <span className="text-[0.75em] font-bold rounded-[0.4em] px-[0.5em] py-[0.15em] b-panel b-accent">{dueLabel(task.due)}</span>
        {count > 1 && (
          <span className="text-[0.7em] font-bold b-ink2 tabular-nums">
            {index + 1} / {count}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={onToggleCount} className="h-10 px-3 rounded-lg b-ink2 hover:b-panel text-sm font-bold flex items-center gap-1.5 cursor-pointer" title="완료 인원 보이기/숨기기">
            {showCount ? <Eye size={17} /> : <EyeOff size={17} />}
            <span className="hidden sm:inline">완료 인원</span>
          </button>
          {count > 1 && (
            <>
              <button type="button" onClick={onPrev} aria-label="이전 미션" className="w-11 h-11 rounded-lg b-panel flex items-center justify-center cursor-pointer">
                <ChevronLeft size={22} />
              </button>
              <button type="button" onClick={onNext} aria-label="다음 미션" className="w-11 h-11 rounded-lg b-panel flex items-center justify-center cursor-pointer">
                <ChevronRight size={22} />
              </button>
            </>
          )}
        </div>
      </div>
      <h1 className="text-[2.3em] font-extrabold tracking-tight leading-[1.15] break-words">{task.title}</h1>
      {task.notice && (
        <div className="mt-[0.6em] rounded-[0.5em] b-panel border-2 b-line px-[0.7em] py-[0.5em]">
          <p className="text-[0.7em] font-bold b-accent mb-[0.15em]">📢 공지</p>
          <p className="text-[1.35em] font-semibold leading-snug whitespace-pre-wrap break-words"><Rich text={task.notice} /></p>
        </div>
      )}
      <ul className="mt-[0.8em] space-y-[0.45em]">
        {task.items.map((i) => {
          const tot = i.targets ? i.targets.length : total;
          const done = Math.min(live.done[markKey(task.id, i.id)] || 0, tot);
          const all = tot > 0 && done >= tot;
          return (
            <li key={i.id} className={cx('flex items-start gap-[0.55em] leading-snug', i.sub ? 'pl-[1.6em] text-[1.2em]' : 'text-[1.45em]')}>
              {i.check ? (
                <span className={cx('mt-[0.12em] w-[1.05em] h-[1.05em] rounded-[0.22em] border-[0.11em] shrink-0 flex items-center justify-center', all ? 'b-ok-box' : 'b-box')} aria-hidden>
                  {all && <Check className="w-[0.75em] h-[0.75em]" strokeWidth={4} />}
                </span>
              ) : (
                <span className={cx('shrink-0 rounded-full mt-[0.5em]', i.sub ? 'w-[0.3em] h-[0.3em] b-dot2' : 'w-[0.36em] h-[0.36em] b-dot')} aria-hidden />
              )}
              <span className="flex-1 min-w-0 font-semibold break-words">
                <Rich text={i.text} />
                {i.targets && <span className="ml-[0.4em] text-[0.55em] font-bold b-ink2 align-middle">({i.targets.length}명)</span>}
              </span>
              {i.check && showCount && (
                <span className={cx('shrink-0 text-[0.62em] font-bold tabular-nums rounded-full px-[0.6em] py-[0.15em] mt-[0.25em]', all ? 'b-ok-pill' : 'b-panel b-ink2')}>
                  {done}/{tot}명{all && ' 🎉'}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------- 판서 캔버스 ----------
function PenCanvas({ active, eraser, color, width, strokes, onStroke }: { active: boolean; eraser: boolean; color: string; width: number; strokes: Stroke[]; onStroke: (s: Stroke) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef<Stroke | null>(null);

  const paint = useCallback(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const list = drawing.current ? [...strokes, drawing.current] : strokes;
    for (const s of list) {
      ctx.globalCompositeOperation = s.erase ? 'destination-out' : 'source-over';
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.erase ? s.width * 4 : s.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      s.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h)));
      if (s.pts.length === 1) ctx.lineTo(s.pts[0][0] * w + 0.1, s.pts[0][1] * h);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }, [strokes]);

  useEffect(() => {
    paint();
    const ro = new ResizeObserver(paint);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, [paint]);

  const point = (e: React.PointerEvent): [number, number] => {
    const r = ref.current!.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };

  return (
    <canvas
      ref={ref}
      className={cx('absolute inset-0 w-full h-full touch-none', active ? 'cursor-crosshair' : 'pointer-events-none')}
      aria-hidden
      onPointerDown={(e) => {
        if (!active) return;
        (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
        drawing.current = { color, width, erase: eraser, pts: [point(e)] };
        paint();
      }}
      onPointerMove={(e) => {
        if (!drawing.current) return;
        drawing.current.pts.push(point(e));
        paint();
      }}
      onPointerUp={() => {
        if (drawing.current) onStroke(drawing.current);
        drawing.current = null;
      }}
      onPointerCancel={() => {
        drawing.current = null;
        paint();
      }}
    />
  );
}

// ---------- 타이머 ----------
const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

function beep() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    [0, 0.35, 0.7].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.28);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.3);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {
    // 소리를 못 내는 기기는 화면 표시만
  }
}

function useTimer() {
  const [total, setTotal] = useState(5 * 60000);
  const [left, setLeft] = useState(5 * 60000);
  const [endAt, setEndAt] = useState<number | null>(null);
  const [ringing, setRinging] = useState(false);
  useEffect(() => {
    if (!endAt) return;
    const t = setInterval(() => {
      const l = endAt - Date.now();
      setLeft(Math.max(0, l));
      if (l <= 0) {
        setEndAt(null);
        setRinging(true);
        beep();
      }
    }, 200);
    return () => clearInterval(t);
  }, [endAt]);
  return {
    total,
    left,
    running: !!endAt,
    ringing,
    set(ms: number) {
      const v = Math.max(1000, Math.min(99 * 60000, ms));
      setTotal(v);
      setLeft(v);
      setEndAt(null);
      setRinging(false);
    },
    start() {
      if (left <= 0) return;
      setRinging(false);
      setEndAt(Date.now() + left);
    },
    pause() {
      setEndAt(null);
    },
    reset() {
      setEndAt(null);
      setLeft(total);
      setRinging(false);
    }
  };
}
type TimerApi = ReturnType<typeof useTimer>;

function TimerView({ timer }: { timer: TimerApi }) {
  const pct = timer.total ? timer.left / timer.total : 0;
  const R = 46;
  const C = 2 * Math.PI * R;
  const warn = timer.left <= 10000 && timer.running;
  return (
    <div className="min-h-full flex flex-col items-center justify-center gap-[0.8em] p-[3%]">
      <div className="relative" style={{ width: 'min(62vh, 80vw)', aspectRatio: '1' }}>
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full -rotate-90" aria-hidden>
          <circle cx="50" cy="50" r={R} fill="none" strokeWidth="5" className="b-track" />
          <circle cx="50" cy="50" r={R} fill="none" strokeWidth="5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct)} className={warn ? 'b-arc-warn' : 'b-arc'} style={{ transition: 'stroke-dashoffset 0.25s linear' }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className={cx('font-extrabold tabular-nums leading-none tracking-tight', warn && 'animate-pulse')} style={{ fontSize: 'min(15vh, 19vw)' }} role="timer" aria-live="off">
            {fmt(timer.left)}
          </p>
          {!timer.running && (
            <div className="flex items-center gap-2 mt-[0.4em]">
              <button type="button" onClick={() => timer.set(timer.total - 60000)} className="h-10 px-3 rounded-lg b-panel font-bold text-sm cursor-pointer">
                −1분
              </button>
              <button type="button" onClick={() => timer.set(timer.total + 60000)} className="h-10 px-3 rounded-lg b-panel font-bold text-sm cursor-pointer">
                +1분
              </button>
              <button type="button" onClick={() => timer.set(timer.total + 10000)} className="h-10 px-3 rounded-lg b-panel font-bold text-sm cursor-pointer">
                +10초
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {[1, 3, 5, 10, 15, 20].map((m) => (
          <button key={m} type="button" onClick={() => timer.set(m * 60000)} aria-pressed={timer.total === m * 60000} className={cx('h-12 min-w-16 px-4 rounded-xl font-bold cursor-pointer text-base', timer.total === m * 60000 ? 'b-active' : 'b-panel')}>
            {m}분
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        {timer.running ? (
          <button type="button" onClick={timer.pause} className="h-14 px-8 rounded-2xl b-primary font-extrabold text-lg flex items-center gap-2 cursor-pointer">
            <Pause size={22} /> 멈춤
          </button>
        ) : (
          <button type="button" onClick={timer.start} disabled={timer.left <= 0} className="h-14 px-8 rounded-2xl b-primary font-extrabold text-lg flex items-center gap-2 cursor-pointer disabled:opacity-50">
            <Play size={22} /> 시작
          </button>
        )}
        <button type="button" onClick={timer.reset} className="h-14 px-6 rounded-2xl b-panel font-bold text-lg flex items-center gap-2 cursor-pointer">
          <RotateCcw size={20} /> 처음으로
        </button>
      </div>
    </div>
  );
}

function TimesUp({ onClose }: { onClose: () => void }) {
  return (
    <button type="button" onClick={onClose} className="fixed inset-0 z-50 flex flex-col items-center justify-center b-timesup cursor-pointer">
      <p className="font-extrabold animate-pulse" style={{ fontSize: 'min(20vh, 16vw)' }}>
        시간 끝!
      </p>
      <p className="text-2xl font-bold mt-4 opacity-80">눌러서 닫기</p>
    </button>
  );
}

// ---------- 번호 뽑기 ----------
function PickerView({ pool, students, showNames, setShowNames }: { pool: number[]; students: Student[]; showNames: boolean; setShowNames: (v: boolean) => void }) {
  const [noRepeat, setNoRepeat] = useState(true);
  const [picked, setPicked] = useState<number[]>([]);
  const [shown, setShown] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const names = new Map(students.map((s) => [s.number, s.name]));
  const left = noRepeat ? pool.filter((n) => !picked.includes(n)) : pool;

  const draw = () => {
    if (rolling || !left.length) return;
    setRolling(true);
    const final = left[Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32 * left.length)];
    let n = 0;
    const steps = 18;
    const tick = () => {
      n++;
      if (n >= steps) {
        setShown(final);
        setPicked((p) => [...p, final]);
        setRolling(false);
        return;
      }
      setShown(pool[Math.floor(Math.random() * pool.length)]);
      setTimeout(tick, 40 + n * 9);
    };
    tick();
  };

  return (
    <div className="min-h-full flex flex-col items-center justify-center gap-[0.6em] p-[3%]">
      <div className={cx('rounded-[0.6em] b-panel border b-line flex flex-col items-center justify-center', !rolling && shown !== null && 'b-pop')} style={{ width: 'min(58vh, 80vw)', aspectRatio: '1.25' }}>
        <p className={cx('font-extrabold tabular-nums leading-none', rolling ? 'b-ink2' : 'b-accent')} style={{ fontSize: 'min(26vh, 30vw)' }} aria-live="polite">
          {shown ?? '?'}
        </p>
        {showNames && shown !== null && !rolling && names.get(shown) && <p className="text-[1.6em] font-bold mt-[0.2em]">{names.get(shown)}</p>}
      </div>
      <button type="button" onClick={draw} disabled={rolling || !left.length} className="h-16 px-10 rounded-2xl b-primary font-extrabold text-2xl flex items-center gap-3 cursor-pointer disabled:opacity-50">
        <Dices size={28} /> {left.length ? '뽑기' : '모두 뽑았어요'}
      </button>
      <div className="flex flex-wrap justify-center items-center gap-x-5 gap-y-2 text-base font-semibold">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={noRepeat} onChange={(e) => setNoRepeat(e.target.checked)} className="w-5 h-5 accent-current" /> 한 번 뽑힌 번호는 빼기
        </label>
        {students.length > 0 && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showNames} onChange={(e) => setShowNames(e.target.checked)} className="w-5 h-5" /> 이름도 보이기
          </label>
        )}
        <span className="b-ink2">
          남은 번호 {left.length} / {pool.length}
        </span>
        {picked.length > 0 && (
          <button type="button" onClick={() => (setPicked([]), setShown(null))} className="h-9 px-3 rounded-lg b-panel flex items-center gap-1.5 cursor-pointer">
            <RotateCcw size={16} /> 다시 시작
          </button>
        )}
      </div>
      {picked.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5 max-w-4xl">
          {picked.map((n, i) => (
            <span key={i} className="h-9 min-w-9 px-2 rounded-lg b-panel flex items-center justify-center font-bold tabular-nums text-base">
              {n}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- 판서: 공지·미션과 따로 전할 내용을 크게 직접 씀 (펜으로 덧그리기도 됨) ----------
function WriteView() {
  const [text, setText] = useState(() => loadPref('board_write', ''));
  const save = (v: string) => {
    setText(v);
    savePref('board_write', v);
  };
  return (
    <div className="min-h-full flex flex-col px-[4%] py-[2.5%] gap-[0.4em]">
      <div className="flex items-center gap-2">
        <p className="text-[0.7em] font-bold b-ink2 flex-1">✍️ 키보드로 쓰고, 위쪽 펜 버튼으로 그 위에 그릴 수도 있어요. 쓴 내용은 이 기기에 남아요.</p>
        <button type="button" onClick={() => text && confirm('판서 내용을 모두 지울까요?') && save('')} className="h-10 px-3 rounded-lg b-panel font-bold text-sm flex items-center gap-1.5 cursor-pointer shrink-0">
          <Trash2 size={16} /> 지우기
        </button>
      </div>
      <textarea
        value={text}
        onChange={(e) => save(e.target.value)}
        placeholder="여기에 학생들에게 전할 내용을 쓰세요"
        aria-label="판서 내용"
        className="flex-1 min-h-[60vh] w-full resize-none bg-transparent outline-none rounded-[0.5em] border-2 border-dashed b-line p-[0.5em] text-[1.6em] font-semibold leading-snug placeholder:opacity-50"
        style={{ color: 'var(--b-ink)' }}
      />
    </div>
  );
}
