import { useEffect, useState } from 'react';
import { Play, Plus, Rocket, X } from 'lucide-react';
import { randomId } from '../lib/hash';
import { Student } from '../lib/types';
import { cx } from '../ui/kit';

// 지각생 하교 타이머: 지각한 시간만큼 봉사 후 하교. 학생마다 따로 재고, 끝나면 '도-미-솔' 종소리 5번
// 교실 화면을 열어 둔 동안만 기억함 (서버에 저장하지 않음)

type Status = 'waiting' | 'running' | 'alarming' | 'finished';
interface Late {
  id: string;
  name: string;
  total: number; // 밀리초
  left: number; // 기다리는 동안 남은 시간
  endAt: number | null; // 재는 중일 때 끝나는 시각
  status: Status;
}

// 맑은 종소리: 도·미·솔 화음을 1초 간격으로 5번
function chime() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    for (let i = 0; i < 5; i++)
      for (const f of [523.25, 659.25, 783.99]) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        o.connect(g);
        g.connect(ctx.destination);
        const t = ctx.currentTime + i;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.18, t + 0.08);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
        o.start(t);
        o.stop(t + 0.95);
      }
    setTimeout(() => ctx.close(), 6000);
  } catch {
    // 소리를 못 내는 기기는 화면 표시만
  }
}

export function useLateTimers() {
  const [list, setList] = useState<Late[]>([]);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      setList((cur) => {
        let changed = false;
        const next = cur.map((s) => {
          if (s.status === 'running' && s.endAt && s.endAt <= now) {
            changed = true;
            chime();
            return { ...s, status: 'alarming' as Status, left: 0, endAt: now + 5000 };
          }
          if (s.status === 'alarming' && s.endAt && s.endAt <= now) {
            changed = true;
            return { ...s, status: 'finished' as Status, endAt: null };
          }
          return s;
        });
        return changed ? next : cur;
      });
      tick((n) => n + 1);
    }, 250);
    return () => clearInterval(t);
  }, []);
  return {
    list,
    running: list.some((s) => s.status === 'running'),
    add(name: string, minutes: number) {
      const ms = Math.round(minutes * 60000);
      setList((l) => [...l, { id: randomId(), name: name.trim(), total: ms, left: ms, endAt: null, status: 'waiting' }]);
    },
    start(id?: string) {
      const now = Date.now();
      setList((l) => l.map((s) => (s.status === 'waiting' && (!id || s.id === id) ? { ...s, status: 'running', endAt: now + s.left } : s)));
    },
    remove(id: string) {
      setList((l) => l.filter((s) => s.id !== id));
    }
  };
}
export type LateApi = ReturnType<typeof useLateTimers>;

const leftOf = (s: Late) => (s.status === 'running' && s.endAt ? Math.max(0, s.endAt - Date.now()) : s.status === 'waiting' ? s.left : 0);
const mmss = (ms: number) => {
  const sec = Math.ceil(ms / 1000);
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
};

const STATUS: Record<Status, { icon: string; text: string; cls: string }> = {
  waiting: { icon: '⏳', text: '시작 대기 중', cls: 'b-ink2' },
  running: { icon: '⏱️', text: '기다리는 중…', cls: 'b-accent' },
  alarming: { icon: '🔔', text: '하교 가능! (종소리)', cls: 'b-accent' },
  finished: { icon: '✅', text: '집에 가도 좋아요!', cls: 'b-ok' }
};

export function LateView({ late, students }: { late: LateApi; students: Student[] }) {
  const [name, setName] = useState('');
  const [min, setMin] = useState('');
  const [error, setError] = useState('');
  const waiting = late.list.filter((s) => s.status === 'waiting').length;

  const add = () => {
    const m = Number(min);
    if (!name.trim() || !m || m <= 0) return setError('이름과 지각 시간(분)을 넣어 주세요.');
    if (m > 120) return setError('지각 시간은 120분까지 넣을 수 있어요.');
    setError('');
    late.add(name, m);
    setName('');
    setMin('');
  };

  return (
    <div className="min-h-full px-[4%] py-[2.5%]">
      <header className="text-center mb-[0.6em]">
        <h1 className="text-[1.5em] font-extrabold tracking-tight">🕒 지각생 하교 타이머</h1>
        <p className="text-[0.7em] b-ink2 mt-[0.15em]">지각한 시간만큼 봉사 후 하교합시다.</p>
      </header>

      <div className="max-w-5xl mx-auto rounded-[0.8em] b-panel border-2 b-line p-[0.7em] mb-[0.8em]">
        <form
          className="grid grid-cols-1 sm:grid-cols-[1fr_10rem_auto] gap-3 items-end"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <label className="block">
            <span className="block text-sm font-bold b-ink2 mb-1 ml-1">학생 이름</span>
            <input value={name} onChange={(e) => setName(e.target.value)} list="late-names" maxLength={12} placeholder="예: 홍길동" className="w-full h-12 px-4 rounded-xl border-2 b-line b-field text-lg outline-none" />
            <datalist id="late-names">
              {students.map((s) => (
                <option key={s.sid} value={s.name || `${s.number}번`} />
              ))}
            </datalist>
          </label>
          <label className="block">
            <span className="block text-sm font-bold b-ink2 mb-1 ml-1">지각 시간 (분)</span>
            <input value={min} onChange={(e) => setMin(e.target.value)} type="number" min={1} max={120} inputMode="numeric" placeholder="예: 3" className="w-full h-12 px-4 rounded-xl border-2 b-line b-field text-lg outline-none" />
          </label>
          <button type="submit" className="h-12 px-6 rounded-xl b-primary font-extrabold text-base flex items-center justify-center gap-2 cursor-pointer">
            <Plus size={20} /> 학생 추가
          </button>
        </form>
        {error && <p className="text-sm font-bold text-[#ff6b81] mt-2 ml-1">{error}</p>}
        {waiting > 0 && (
          <div className="border-t-2 border-dashed b-line mt-[0.6em] pt-[0.6em] text-center">
            <button type="button" onClick={() => late.start()} className="h-14 px-10 rounded-2xl b-primary font-extrabold text-lg inline-flex items-center gap-2 cursor-pointer">
              <Rocket size={22} /> 모든 타이머 일괄 시작 ({waiting}명)
            </button>
          </div>
        )}
      </div>

      {late.list.length === 0 ? (
        <p className="text-center text-[1.1em] b-ink2 mt-[2em]">지각한 학생의 이름과 지각 시간을 넣어 주세요.</p>
      ) : (
        <div className="grid gap-[0.5em]" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 11em), 1fr))' }}>
          {late.list.map((s) => {
            const left = leftOf(s);
            const pct = s.total ? (left / s.total) * 100 : 0;
            const st = STATUS[s.status];
            return (
              <div key={s.id} className={cx('rounded-[0.6em] border-2 p-[0.5em] b-panel transition', s.status === 'alarming' ? 'b-alarm' : s.status === 'finished' ? 'b-ok-border' : 'b-line')}>
                <div className="flex items-start justify-between gap-2 mb-[0.4em]">
                  <div className="min-w-0">
                    <h3 className="text-[1.05em] font-extrabold truncate">{s.name}</h3>
                    <p className={cx('text-[0.62em] font-bold', st.cls)}>
                      {st.icon} {st.text}
                    </p>
                  </div>
                  <button type="button" onClick={() => late.remove(s.id)} aria-label={`${s.name} 빼기`} className="w-10 h-10 rounded-lg b-ink2 hover:b-panel flex items-center justify-center cursor-pointer shrink-0">
                    <X size={22} />
                  </button>
                </div>
                <div className={cx('text-center font-black tabular-nums rounded-[0.6em] py-[0.25em] mb-[0.4em] b-inset', st.cls)} style={{ fontSize: '2.4em', lineHeight: 1.15 }}>
                  {mmss(left)}
                </div>
                <div className="h-3 rounded-full b-track-bg overflow-hidden">
                  <div className={cx('h-full rounded-full transition-[width] duration-300 ease-linear', s.status === 'running' ? 'b-fill' : 'b-fill-idle')} style={{ width: `${pct}%` }} />
                </div>
                {s.status === 'waiting' && (
                  <button type="button" onClick={() => late.start(s.id)} className="mt-[0.5em] w-full h-11 rounded-xl b-panel border-2 b-line font-bold flex items-center justify-center gap-1.5 cursor-pointer">
                    <Play size={17} /> 이 학생만 시작
                  </button>
                )}
                {s.status === 'finished' && (
                  <button type="button" onClick={() => late.remove(s.id)} className="mt-[0.5em] w-full h-12 rounded-xl b-ok-btn font-extrabold text-lg cursor-pointer">
                    확인 완료 (하교)
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
