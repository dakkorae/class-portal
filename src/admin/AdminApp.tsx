import { useEffect, useState } from 'react';
import { ChevronDown, FlaskConical, KeyRound, LogOut, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { Api } from '../lib/api';
import { cloudMode, errorMessage, getApi } from '../lib/cloud';
import { formatTime } from '../lib/dates';
import { adminKeyHash } from '../lib/hash';
import { InviteCode } from '../lib/types';
import { Badge, Button, Card, CopyButton, ErrorNote, Field, Input, Modal, SectionTitle, Spinner, Switch, cx, toast } from '../ui/kit';

// 앱 관리자 화면 (주소 끝 #admin): 학급 개설 코드 발급·관리, 교사 비밀번호 재설정 코드 발급
// 관리자는 학급 이름·학급 코드만 볼 수 있고 학생 명단·과제 기록·공지 내용은 읽지 못함 (보안 규칙이 막음)
export default function AdminApp() {
  const [api, setApi] = useState<Api | null>(null);
  const [admin, setAdmin] = useState<boolean | null>(null);
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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

  useEffect(() => {
    getApi()
      .then(async (a) => {
        setApi(a);
        const ok = await a.isAdmin();
        setAdmin(ok);
        if (ok) setCodes(await a.listInviteCodes());
      })
      .catch((e) => {
        setError(errorMessage(e));
        setAdmin(false);
      });
  }, []);

  const refresh = (a: Api) => a.listInviteCodes().then(setCodes);

  if (admin === null) return <Spinner />;

  return (
    <div className="min-h-dvh bg-aurora">
      <header className="border-b border-line bg-surface/70 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-ink text-canvas flex items-center justify-center">
            <ShieldCheck size={20} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-ink-3">우리 반 포털</p>
            <p className="font-bold">앱 관리자</p>
          </div>
          {admin && api && (
            <Button
              variant="ghost"
              size="sm"
              icon={<LogOut size={16} />}
              onClick={() =>
                run(async (a) => {
                  await a.adminLogout();
                  setAdmin(false);
                })
              }
            >
              로그아웃
            </Button>
          )}
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {cloudMode === 'demo' && (
          <p className="text-sm bg-warn-soft text-warn rounded-xl px-3.5 py-2.5 font-medium flex gap-2">
            <FlaskConical size={18} className="shrink-0" /> 체험용 화면이에요. 관리자 키 demo-admin
          </p>
        )}
        <ErrorNote>{error}</ErrorNote>
        {!admin ? (
          <AdminLogin busy={busy} run={run} onOk={async (a) => (setAdmin(true), await refresh(a))} />
        ) : (
          <>
            <CreateCode busy={busy} run={run} onCreated={(a) => refresh(a)} />
            <section>
              <SectionTitle title="개설 코드" sub="코드를 누르면 그 코드로 만든 학급이 보여요." />
              <div className="space-y-3">
                {codes.length === 0 && <p className="text-sm text-ink-3">아직 만든 코드가 없어요.</p>}
                {codes.map((c) => api && <CodeRow key={c.code} api={api} code={c} onChanged={() => refresh(api)} />)}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function AdminLogin({ busy, run, onOk }: { busy: boolean; run: (fn: (a: Api) => Promise<void>) => void; onOk: (a: Api) => Promise<void> }) {
  const [key, setKey] = useState('');
  const [fail, setFail] = useState('');
  const [setupKey, setSetupKey] = useState('');
  const [hash, setHash] = useState('');
  return (
    <div className="space-y-4">
      <Card className="p-6 space-y-4">
        <h1 className="text-xl font-bold">관리자 키로 들어가기</h1>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            run(async (a) => {
              setFail('');
              if (await a.adminLogin(key)) await onOk(a);
              else setFail('관리자 키가 맞지 않거나, 아직 Firebase 콘솔에 등록값을 넣지 않았어요.');
            });
          }}
        >
          <Input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="관리자 키" autoComplete="current-password" />
          <ErrorNote>{fail}</ErrorNote>
          <Button type="submit" className="w-full" loading={busy} icon={<KeyRound size={17} />}>
            들어가기
          </Button>
        </form>
      </Card>
      <Card className="p-6 space-y-3">
        <h2 className="font-bold">처음 설정할 때 (한 번만)</h2>
        <ol className="text-sm text-ink-2 space-y-1 list-decimal pl-5">
          <li>아래에 쓰고 싶은 관리자 키를 넣고 ‘등록값 만들기’를 누릅니다.</li>
          <li>Firebase 콘솔 → Firestore → 컬렉션 <code className="font-mono">config</code> / 문서 <code className="font-mono">admin</code> 에 필드 <code className="font-mono">keyHash</code>(string)로 붙여 넣습니다.</li>
          <li>위 칸에 같은 관리자 키를 넣고 들어갑니다.</li>
        </ol>
        <div className="flex gap-2">
          <Input type="password" value={setupKey} onChange={(e) => setSetupKey(e.target.value)} placeholder="새 관리자 키 (8글자 이상 권장)" autoComplete="new-password" />
          <Button variant="secondary" onClick={async () => setHash(await adminKeyHash(setupKey))} disabled={setupKey.trim().length < 4}>
            등록값 만들기
          </Button>
        </div>
        {hash && (
          <div className="rounded-xl bg-surface-2 border border-line p-3 flex items-center gap-2">
            <code className="flex-1 font-mono text-xs break-all">{hash}</code>
            <CopyButton text={hash} />
          </div>
        )}
      </Card>
    </div>
  );
}

function CreateCode({ busy, run, onCreated }: { busy: boolean; run: (fn: (a: Api) => Promise<void>) => void; onCreated: (a: Api) => Promise<void> }) {
  const [max, setMax] = useState('1');
  const [memo, setMemo] = useState('');
  const [made, setMade] = useState('');
  return (
    <Card className="p-5 space-y-4">
      <h2 className="font-bold">새 개설 코드</h2>
      <form
        className="grid sm:grid-cols-[8rem_1fr_auto] gap-3 items-end"
        onSubmit={(e) => {
          e.preventDefault();
          run(async (a) => {
            const c = await a.createInviteCode(Math.max(1, Number(max) || 1), memo);
            setMade(c.code);
            setMemo('');
            await onCreated(a);
          });
        }}
      >
        <Field label="만들 수 있는 학급 수">
          <Input type="number" min={1} max={50} value={max} onChange={(e) => setMax(e.target.value)} />
        </Field>
        <Field label="메모 (누구에게 줬는지)">
          <Input value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={40} placeholder="예: 5학년 3반 김 선생님" />
        </Field>
        <Button type="submit" loading={busy} icon={<Plus size={17} />}>
          만들기
        </Button>
      </form>
      {made && (
        <div className="rounded-xl bg-brand-soft p-4 flex items-center justify-between gap-3 animate-pop">
          <div>
            <p className="text-xs font-semibold text-brand-strong">방금 만든 코드 — 선생님께 전해 주세요</p>
            <p className="text-2xl font-bold font-mono tracking-widest">{made}</p>
          </div>
          <CopyButton text={made} />
        </div>
      )}
    </Card>
  );
}

function CodeRow({ api, code: c, onChanged }: { api: Api; code: InviteCode; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [classes, setClasses] = useState<{ id: string; name: string; createdAt: number }[] | null>(null);
  const [issued, setIssued] = useState<Record<string, { code: string; expiresAt: number }>>({});
  const [del, setDel] = useState(false);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setOpen(!open);
    if (!open && !classes) setClasses(await api.listClassesByInvite(c.code).catch(() => []));
  };

  return (
    <Card className={cx(!c.active && 'opacity-70')}>
      <div className="p-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={toggle} className="flex-1 min-w-48 flex items-center gap-3 text-left cursor-pointer" aria-expanded={open}>
          <ChevronDown size={18} className={cx('text-ink-3 transition', open && 'rotate-180')} />
          <span className="min-w-0">
            <span className="block font-mono font-bold text-lg tracking-wider">{c.code}</span>
            <span className="block text-sm text-ink-3 truncate">{c.memo || '메모 없음'} · {formatTime(c.createdAt)}</span>
          </span>
        </button>
        <Badge tone={c.usedCount >= c.maxClasses ? 'neutral' : 'brand'}>
          {c.usedCount}/{c.maxClasses}개 사용
        </Badge>
        <Switch checked={c.active} onChange={(v) => api.setInviteActive(c.code, v).then(onChanged).catch((e) => toast(errorMessage(e)))} label={c.active ? '사용 중' : '중지됨'} />
        <CopyButton text={c.code} />
        <Button variant="danger" size="sm" icon={<Trash2 size={15} />} onClick={() => setDel(true)}>
          삭제
        </Button>
      </div>
      {open && (
        <div className="border-t border-line px-4 py-3 space-y-2">
          {!classes && <p className="text-sm text-ink-3">불러오는 중…</p>}
          {classes?.length === 0 && <p className="text-sm text-ink-3">이 코드로 만든 학급이 없어요.</p>}
          {classes?.map((k) => (
            <div key={k.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
              <span className="flex-1 min-w-0">
                <span className="block font-semibold truncate">{k.name}</span>
                <span className="block text-xs text-ink-3">
                  학급 코드 <b className="font-mono">{k.id}</b> · {formatTime(k.createdAt)}
                </span>
              </span>
              {issued[k.id] ? (
                <span className="flex items-center gap-2">
                  <span className="text-right">
                    <span className="block font-mono font-bold">{issued[k.id].code}</span>
                    <span className="block text-xs text-ink-3">{formatTime(issued[k.id].expiresAt)}까지 · 한 번만</span>
                  </span>
                  <CopyButton text={issued[k.id].code} />
                </span>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<KeyRound size={15} />}
                  onClick={async () => {
                    if (!confirm(`‘${k.name}’ 교사 비밀번호 재설정 코드를 만들까요? (24시간, 한 번만 사용)`)) return;
                    try {
                      const r = await api.createResetCode(k.id);
                      setIssued((m) => ({ ...m, [k.id]: r }));
                    } catch (e) {
                      toast(errorMessage(e));
                    }
                  }}
                >
                  비밀번호 재설정 코드
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      {del && (
        <Modal
          open
          onClose={() => setDel(false)}
          title="개설 코드 삭제"
          footer={
            <>
              <Button variant="secondary" onClick={() => setDel(false)}>
                취소
              </Button>
              <Button
                variant="danger"
                loading={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const n = await api.deleteInviteCode(c.code);
                    toast(`코드와 학급 ${n}개를 지웠어요.`);
                    setDel(false);
                    onChanged();
                  } catch (e) {
                    toast(errorMessage(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                코드와 학급 모두 삭제
              </Button>
            </>
          }
        >
          <p className="text-ink-2">
            <b className="font-mono">{c.code}</b> 코드로 만든 <b>학급 {c.usedCount}개와 그 안의 모든 자료(학생 명단·과제·공지)</b>가 함께 지워지고 되돌릴 수 없어요.
          </p>
        </Modal>
      )}
    </Card>
  );
}
