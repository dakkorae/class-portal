import { useEffect, useState } from 'react';
import { ArrowRight, Check, ChevronRight, FlaskConical, GraduationCap, KeyRound, Plus, Sparkles } from 'lucide-react';
import { Api } from '../lib/api';
import { cloudMode, errorMessage, getApi, loadTeacherClasses, saveTeacherClasses } from '../lib/cloud';
import { normalizeCode } from '../lib/hash';
import { MAX_STUDENTS } from '../lib/types';
import { Button, Card, CopyButton, ErrorNote, Field, Input, Segmented, Spinner } from '../ui/kit';
import Workspace from './Workspace';

type Mode = 'open' | 'create' | 'reset';

// 교사 화면 (주소 끝 #teacher)
export default function TeacherApp() {
  const [api, setApi] = useState<Api | null>(null);
  const [saved, setSaved] = useState(loadTeacherClasses);
  const [active, setActive] = useState<{ id: string; name: string } | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  // 개설·재설정 직후 기록 안내
  const [record, setRecord] = useState<{ id: string; name: string; password: string } | null>(null);

  useEffect(() => {
    getApi()
      .then(async (a) => {
        setApi(a);
        // 이 기기에서 마지막으로 연 학급이 아직 교사로 등록돼 있으면 바로 열기
        const list = loadTeacherClasses();
        const last = list[0];
        if (last && (await a.isTeacher(last.id))) setActive(last);
      })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setChecking(false));
  }, []);

  const remember = (c: { id: string; name: string }) => {
    const list = [c, ...loadTeacherClasses().filter((x) => x.id !== c.id)].slice(0, 10);
    saveTeacherClasses(list);
    setSaved(list);
  };

  const logout = async (all: boolean) => {
    if (api) await api.teacherLogout(all ? saved.map((s) => s.id) : active ? [active.id] : []);
    if (all) {
      saveTeacherClasses([]);
      setSaved([]);
    } else if (active) {
      const list = saved.filter((s) => s.id !== active.id);
      saveTeacherClasses(list);
      setSaved(list);
    }
    setActive(null);
  };

  if (checking) return <Spinner />;

  if (record) {
    return <RecordScreen record={record} onDone={() => (setActive({ id: record.id, name: record.name }), setRecord(null))} />;
  }

  if (active && api) {
    return (
      <Workspace
        api={api}
        classId={active.id}
        savedClasses={saved}
        onSwitch={async (c) => {
          if (await api.isTeacher(c.id)) {
            remember(c);
            setActive(c);
          } else setActive(null);
        }}
        onClassName={(name) => remember({ id: active.id, name })}
        onClose={() => setActive(null)}
        onLogout={logout}
        onDeleted={() => {
          const list = saved.filter((s) => s.id !== active.id);
          saveTeacherClasses(list);
          setSaved(list);
          setActive(null);
        }}
      />
    );
  }

  return (
    <Entry
      api={api}
      error={error}
      saved={saved}
      onOpen={(c) => {
        remember(c);
        setActive(c);
      }}
      onCreated={(c, password) => {
        remember(c);
        setRecord({ ...c, password });
      }}
    />
  );
}

function Entry({ api, error: initError, saved, onOpen, onCreated }: { api: Api | null; error: string; saved: { id: string; name: string }[]; onOpen: (c: { id: string; name: string }) => void; onCreated: (c: { id: string; name: string }, password: string) => void }) {
  const [mode, setMode] = useState<Mode>('open');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [invite, setInvite] = useState(cloudMode === 'demo' ? 'DEMO-2026' : '');
  const [name, setName] = useState('');
  const [size, setSize] = useState('25');
  const [resetCode, setResetCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initError);

  const run = async (fn: (a: Api) => Promise<void>) => {
    if (!api) return;
    setBusy(true);
    setError('');
    try {
      await fn(api);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const openClass = (id: string, pw: string) =>
    run(async (a) => {
      const c = await a.getClass(id);
      if (!c) return setError('그런 학급을 찾지 못했어요. 학급 코드를 확인해 주세요.');
      if (!(await a.teacherLogin(c.id, pw))) return setError('교사 비밀번호가 맞지 않아요.');
      onOpen({ id: c.id, name: c.name });
    });

  const quickOpen = (c: { id: string; name: string }) =>
    run(async (a) => {
      if (await a.isTeacher(c.id)) onOpen(c);
      else {
        setMode('open');
        setCode(c.id);
        setError('이 기기의 교사 등록이 끝났어요. 비밀번호를 다시 입력해 주세요.');
      }
    });

  const create = () =>
    run(async (a) => {
      if (!name.trim()) return setError('학급 이름을 적어 주세요.');
      if (password.length < 6) return setError('교사 비밀번호는 6글자 이상으로 정해 주세요.');
      if (password !== password2) return setError('두 비밀번호가 달라요.');
      const c = await a.createClass({ inviteCode: invite, name, maxStudents: Number(size) || 25, password });
      onCreated({ id: c.id, name: c.name }, password);
    });

  const reset = () =>
    run(async (a) => {
      const id = normalizeCode(code);
      if (password.length < 6) return setError('새 비밀번호는 6글자 이상으로 정해 주세요.');
      if (password !== password2) return setError('두 비밀번호가 달라요.');
      const c = await a.getClass(id);
      if (!c) return setError('그런 학급을 찾지 못했어요.');
      if (!(await a.resetTeacherPassword(c.id, resetCode, password))) return setError('재설정 코드가 맞지 않거나, 만료됐거나, 이미 사용됐어요.');
      onCreated({ id: c.id, name: c.name }, password);
    });

  return (
    <div className="min-h-dvh bg-aurora">
      <div className="max-w-md mx-auto px-5 py-10 sm:py-16">
        <div className="flex items-center gap-3 mb-8">
          <span className="w-12 h-12 rounded-2xl bg-brand-gradient text-white flex items-center justify-center shadow-lg shadow-brand/30">
            <GraduationCap size={24} />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink-3">우리 반 포털</p>
            <h1 className="text-2xl font-bold tracking-tight">선생님 화면</h1>
          </div>
        </div>

        {cloudMode === 'demo' && (
          <p className="mb-5 text-sm bg-warn-soft text-warn rounded-xl px-3.5 py-2.5 font-medium flex gap-2">
            <FlaskConical size={18} className="shrink-0" /> 체험용 화면이에요. 자료는 이 브라우저에만 저장돼요. 개설 코드 DEMO-2026
          </p>
        )}

        {saved.length > 0 && mode === 'open' && (
          <Card className="mb-5 divide-y divide-line">
            {saved.map((c) => (
              <button key={c.id} type="button" onClick={() => quickOpen(c)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-surface-2 first:rounded-t-2xl last:rounded-b-2xl cursor-pointer">
                <span className="w-9 h-9 rounded-xl bg-brand-soft text-brand-strong flex items-center justify-center shrink-0">
                  <Sparkles size={17} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold truncate">{c.name}</span>
                  <span className="block text-xs text-ink-3 font-mono">{c.id}</span>
                </span>
                <ChevronRight size={18} className="text-ink-3" />
              </button>
            ))}
          </Card>
        )}

        <Card className="p-5 sm:p-6">
          <div className="mb-5">
            <Segmented
              value={mode}
              onChange={(m) => {
                setMode(m);
                setError('');
              }}
              options={[
                { value: 'open', label: '내 학급 열기' },
                { value: 'create', label: '학급 개설' },
                { value: 'reset', label: '비밀번호 찾기' }
              ]}
            />
          </div>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (mode === 'open') openClass(code, password);
              else if (mode === 'create') create();
              else reset();
            }}
          >
            {mode === 'create' ? (
              <>
                <Field label="개설 코드" hint="앱 관리자에게 받은 코드예요.">
                  <Input value={invite} onChange={(e) => setInvite(e.target.value.toUpperCase())} placeholder="XXXX-XXXX" className="font-mono tracking-wider" autoComplete="off" />
                </Field>
                <Field label="학급 이름">
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 5학년 3반" maxLength={40} />
                </Field>
                <Field label="학생 수" hint={`번호 버튼이 이만큼 생겨요. 나중에 바꿀 수 있어요 (최대 ${MAX_STUDENTS}명).`}>
                  <Input type="number" min={1} max={MAX_STUDENTS} value={size} onChange={(e) => setSize(e.target.value)} />
                </Field>
              </>
            ) : (
              <Field label="학급 코드">
                <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="6자리" className="font-mono tracking-[0.25em] text-lg" autoComplete="off" />
              </Field>
            )}
            {mode === 'reset' && (
              <Field label="재설정 코드" hint="앱 관리자에게 받은 24시간짜리 코드예요.">
                <Input value={resetCode} onChange={(e) => setResetCode(e.target.value.toUpperCase())} placeholder="XXXX-XXXX-XX" className="font-mono tracking-wider" autoComplete="off" />
              </Field>
            )}
            <Field label={mode === 'open' ? '교사 비밀번호' : mode === 'create' ? '교사 비밀번호 정하기' : '새 교사 비밀번호'} hint={mode !== 'open' ? '6글자 이상' : undefined}>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'open' ? 'current-password' : 'new-password'} />
            </Field>
            {mode !== 'open' && (
              <Field label="비밀번호 한 번 더">
                <Input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} autoComplete="new-password" />
              </Field>
            )}
            <ErrorNote>{error}</ErrorNote>
            <Button type="submit" size="lg" className="w-full" loading={busy} icon={mode === 'create' ? <Plus size={18} /> : mode === 'reset' ? <KeyRound size={18} /> : <ArrowRight size={18} />}>
              {mode === 'open' ? '학급 열기' : mode === 'create' ? '학급 만들기' : '새 비밀번호로 열기'}
            </Button>
          </form>
        </Card>
        <p className="text-center text-sm text-ink-3 mt-6">
          학생 화면은 주소 끝의 <code className="font-mono">#teacher</code>를 지운 주소예요.
        </p>
      </div>
    </div>
  );
}

// 학급 개설·비밀번호 재설정 직후: 학급 코드와 비밀번호를 적어 두었는지 확인해야 넘어감
function RecordScreen({ record, onDone }: { record: { id: string; name: string; password: string }; onDone: () => void }) {
  const [checked, setChecked] = useState(false);
  return (
    <div className="min-h-dvh bg-aurora flex items-center justify-center p-5">
      <Card className="w-full max-w-md p-6 sm:p-7 animate-pop">
        <span className="w-12 h-12 rounded-2xl bg-ok-soft text-ok flex items-center justify-center mb-4">
          <Check size={26} strokeWidth={3} />
        </span>
        <h1 className="text-2xl font-bold tracking-tight">{record.name}</h1>
        <p className="text-ink-3 mt-1">아래 두 가지를 꼭 적어 두세요. 비밀번호는 다시 볼 수 없어요.</p>
        <div className="mt-5 space-y-3">
          <div className="rounded-xl bg-surface-2 border border-line p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-ink-3">학급 코드 (학생에게 알려 줘요)</p>
              <p className="text-3xl font-bold font-mono tracking-[0.2em] text-brand-strong">{record.id}</p>
            </div>
            <CopyButton text={record.id} />
          </div>
          <div className="rounded-xl bg-surface-2 border border-line p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-ink-3">교사 비밀번호</p>
              <p className="text-xl font-bold font-mono break-all">{record.password}</p>
            </div>
            <CopyButton text={`학급 코드 ${record.id} / 교사 비밀번호 ${record.password}`} label="모두 복사" />
          </div>
        </div>
        <label className="mt-5 flex items-center gap-3 cursor-pointer select-none">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="w-5 h-5 accent-[var(--c-brand)]" />
          <span className="font-semibold text-ink-2">학급 코드와 비밀번호를 적어 두었어요</span>
        </label>
        <Button size="lg" className="w-full mt-5" disabled={!checked} onClick={onDone} icon={<ArrowRight size={18} />}>
          학급으로 들어가기
        </Button>
      </Card>
    </div>
  );
}
