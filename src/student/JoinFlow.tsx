import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, KeyRound, School, Sparkles, UserRound } from 'lucide-react';
import { errorMessage, getApi, loadRememberedClass, saveRememberedClass } from '../lib/cloud';
import { normalizeCode } from '../lib/hash';
import { ClassInfo, NAME_MAX, StudentSession } from '../lib/types';
import { Button, Card, ErrorNote, Input, cx } from '../ui/kit';
import PinPad from './PinPad';

type Step = 'code' | 'number' | 'pin' | 'newpin' | 'confirm' | 'name';

// 학생 입장: 학급 코드 → 번호 → PIN (처음이면 PIN 정하기 → 이름 확인)
export default function JoinFlow({ onJoined, initialNumber }: { onJoined: (s: StudentSession) => void; initialNumber?: number }) {
  const joinParam = new URLSearchParams(location.search).get('join');
  const remembered = loadRememberedClass();
  const [step, setStep] = useState<Step>('code');
  const [code, setCode] = useState(joinParam ? normalizeCode(joinParam) : remembered?.id || '');
  const [cls, setCls] = useState<ClassInfo | null>(null);
  const [claimed, setClaimed] = useState<Record<string, boolean>>({});
  const [number, setNumber] = useState(0);
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [name, setName] = useState('');
  // 선생님이 명단에 넣어 둔 이름이 있으면 학생은 확인만 함 (이름은 선생님만 바꿀 수 있음)
  const [fixedName, setFixedName] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // QR(?join=)로 들어왔거나 기억된 학급이 있으면 바로 번호 고르기로
  useEffect(() => {
    if (code) openClass(code, initialNumber);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 번호를 고르는 동안 등록 여부를 실시간으로 받음
  useEffect(() => {
    if (!cls) return;
    let stop = () => {};
    getApi().then((api) => (stop = api.watchRoster(cls.id, setClaimed)));
    return () => stop();
  }, [cls]);

  const openClass = async (raw: string, preNumber?: number) => {
    const id = normalizeCode(raw);
    if (id.length < 4) return setError('학급 코드를 확인해 주세요.');
    setBusy(true);
    setError('');
    try {
      const api = await getApi();
      const c = await api.getClass(id);
      if (!c) {
        setError('그런 학급을 찾지 못했어요. 코드를 다시 확인해 주세요.');
        setStep('code');
        return;
      }
      setCls(c);
      saveRememberedClass({ id: c.id, name: c.name });
      if (joinParam) history.replaceState(null, '', location.pathname + location.hash);
      if (preNumber) {
        setNumber(preNumber);
        setStep('pin');
      } else setStep('number');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const pick = (n: number) => {
    setNumber(n);
    setPin('');
    setFirstPin('');
    setError('');
    setStep(claimed['s' + n] ? 'pin' : 'newpin');
  };

  const finish = (sid: string) => onJoined({ classId: cls!.id, className: cls!.name, sid, number });

  // 이미 등록된 번호: PIN 확인
  useEffect(() => {
    if (step !== 'pin' || pin.length !== 4 || !cls) return;
    (async () => {
      setBusy(true);
      setError('');
      try {
        const api = await getApi();
        const sid = 's' + number;
        // 교사가 PIN을 초기화한 번호: 방금 누른 숫자를 새 PIN 첫 입력으로 쓰고 한 번 더 확인
        if (!claimed[sid]) {
          setFirstPin(pin);
          setPin('');
          setStep('confirm');
          return;
        }
        if (await api.loginStudent(cls.id, number, pin)) {
          const me = await api.getStudent(cls.id, sid);
          if (!me?.joined) {
            setName(me?.name || '');
            setFixedName(!!me?.name);
            setStep('name');
          } else finish(sid);
        } else {
          setError('PIN이 맞지 않아요. 다시 눌러 보세요. 잊었으면 선생님께 말해 주세요.');
          setPin('');
        }
      } catch (e) {
        setError(errorMessage(e));
        setPin('');
      } finally {
        setBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, step]);

  // 새 PIN: 두 번 눌러 확인
  useEffect(() => {
    if (pin.length !== 4) return;
    if (step === 'newpin') {
      setFirstPin(pin);
      setPin('');
      setStep('confirm');
    } else if (step === 'confirm') {
      if (pin !== firstPin) {
        setError('두 번 누른 PIN이 달라요. 처음부터 다시 정해 주세요.');
        setPin('');
        setFirstPin('');
        setStep('newpin');
        return;
      }
      (async () => {
        setBusy(true);
        setError('');
        try {
          const api = await getApi();
          const r = await api.registerStudent(cls!.id, number, pin);
          if (r === 'taken') {
            setError('이 번호는 방금 다른 기기에서 등록됐어요. 내 번호가 맞다면 선생님께 말해 주세요.');
            setPin('');
            setStep('number');
            return;
          }
          const me = await api.getStudent(cls!.id, 's' + number);
          if (me?.joined) return finish('s' + number);
          setName(me?.name || '');
          setFixedName(!!me?.name);
          setStep('name');
        } catch (e) {
          setError(errorMessage(e));
          setPin('');
        } finally {
          setBusy(false);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, step]);

  const saveName = async () => {
    const v = name.trim();
    if (v.length < 1 || v.length > NAME_MAX) return setError(`이름은 1~${NAME_MAX}글자로 써 주세요.`);
    setBusy(true);
    setError('');
    try {
      const api = await getApi();
      await api.confirmName(cls!.id, 's' + number, v);
      finish('s' + number);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const back = () => {
    setError('');
    setPin('');
    if (step === 'number') setStep('code');
    else if (step === 'pin' || step === 'newpin' || step === 'confirm') setStep('number');
  };

  return (
    <div className="min-h-dvh bg-aurora flex flex-col">
      <header className="px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-2 flex items-center gap-3 max-w-xl w-full mx-auto">
        {step !== 'code' && step !== 'name' ? (
          <button type="button" onClick={back} className="w-11 h-11 rounded-xl bg-surface/80 border border-line flex items-center justify-center text-ink-2 cursor-pointer" aria-label="뒤로">
            <ArrowLeft size={20} />
          </button>
        ) : (
          <span className="w-11 h-11 rounded-xl bg-brand-gradient text-white flex items-center justify-center shadow-lg shadow-brand/30" aria-hidden>
            <Sparkles size={20} />
          </span>
        )}
        <div className="min-w-0">
          <p className="text-xs font-semibold text-ink-3">우리 반 포털</p>
          <p className="font-bold text-ink truncate">{cls ? cls.name : '학급에 들어가기'}</p>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-5 pb-10 pt-4 max-w-xl w-full mx-auto">
        {step === 'code' && (
          <Card className="w-full p-6 sm:p-8 animate-pop">
            <div className="w-12 h-12 rounded-2xl bg-brand-soft text-brand-strong flex items-center justify-center mb-4">
              <School size={24} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">학급 코드를 넣어 주세요</h1>
            <p className="text-ink-3 mt-1 mb-6 text-[17px]">선생님이 알려 준 6자리 코드예요. QR로 들어오면 자동으로 채워져요.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                openClass(code);
              }}
              className="space-y-4"
            >
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="예: K7M2QX"
                autoCapitalize="characters"
                autoComplete="off"
                maxLength={8}
                aria-label="학급 코드"
                className="h-16 text-center text-3xl font-bold tracking-[0.3em] font-mono"
              />
              <ErrorNote>{error}</ErrorNote>
              <Button type="submit" size="xl" className="w-full" loading={busy} icon={<ArrowRight size={20} />}>
                들어가기
              </Button>
            </form>
          </Card>
        )}

        {step === 'number' && cls && (
          <div className="w-full animate-pop">
            <h1 className="text-2xl font-bold tracking-tight text-center">내 번호를 골라요</h1>
            <p className="text-ink-3 mt-1 mb-6 text-center text-[17px]">처음이면 번호를 고른 뒤 PIN 4자리를 정해요.</p>
            <ErrorNote>{error}</ErrorNote>
            <div className="grid grid-cols-5 sm:grid-cols-6 gap-2.5 mt-3">
              {Array.from({ length: cls.maxStudents }, (_, i) => i + 1).map((n) => {
                const on = claimed['s' + n];
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => pick(n)}
                    className={cx(
                      'aspect-square min-h-14 rounded-2xl border text-2xl font-bold transition active:scale-95 cursor-pointer flex flex-col items-center justify-center gap-0.5',
                      on ? 'bg-surface border-line text-ink shadow-card hover:border-brand' : 'bg-surface/60 border-dashed border-line-strong text-ink-2 hover:border-brand'
                    )}
                  >
                    {n}
                    <span className={cx('text-[11px] font-semibold', on ? 'text-ok' : 'text-ink-3')}>{on ? '등록됨' : '처음'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {(step === 'pin' || step === 'newpin' || step === 'confirm') && (
          <div className="w-full animate-pop text-center">
            <span className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-brand-soft text-brand-strong text-sm font-bold mb-3">
              <UserRound size={15} /> {number}번
            </span>
            <h1 className="text-2xl font-bold tracking-tight">
              {step === 'pin' ? 'PIN 4자리를 눌러요' : step === 'newpin' ? '새 PIN 4자리를 정해요' : '한 번 더 눌러 확인해요'}
            </h1>
            <p className="text-ink-3 mt-1 mb-6 text-[17px]">
              {step === 'pin' ? '처음 정한 숫자 4개예요.' : '나만 아는 숫자로 정하고, 친구에게 알려 주지 마세요.'}
            </p>
            <PinPad value={pin} onChange={setPin} disabled={busy} error={!!error} />
            <div className="mt-5 min-h-12">
              <ErrorNote>{error}</ErrorNote>
            </div>
          </div>
        )}

        {step === 'name' && (
          <Card className="w-full p-6 sm:p-8 animate-pop">
            <div className="w-12 h-12 rounded-2xl bg-ok-soft text-ok flex items-center justify-center mb-4">
              <KeyRound size={24} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">PIN을 정했어요!</h1>
            <p className="text-ink-3 mt-1 mb-6 text-[17px]">{fixedName ? '마지막으로 내 이름이 맞는지 확인해요.' : '마지막으로 내 이름을 적어요.'}</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveName();
              }}
              className="space-y-4"
            >
              {fixedName ? (
                <p className="h-14 rounded-xl bg-surface-2 border border-line px-4 flex items-center text-xl font-semibold" aria-label="이름">
                  {number}번 {name}
                </p>
              ) : (
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={NAME_MAX} placeholder="이름" aria-label="이름" className="h-14 text-xl font-semibold" autoFocus />
              )}
              <p className="text-sm text-ink-3">{fixedName ? '이름이 틀렸으면 선생님께 말해 주세요.' : `1~${NAME_MAX}글자 · 한 번 정하면 선생님만 바꿀 수 있어요.`}</p>
              <ErrorNote>{error}</ErrorNote>
              <Button type="submit" size="xl" className="w-full" loading={busy}>
                {fixedName ? '네, 맞아요 · 시작하기' : '시작하기'}
              </Button>
            </form>
          </Card>
        )}
      </main>
    </div>
  );
}
