import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ClipboardPaste, Download, KeyRound, LogOut, QrCode, Save, Search, School, Settings2, Trash2, Undo2, UserMinus, Users } from 'lucide-react';
import { counted } from '../lib/api';
import { errorMessage, inviteUrl } from '../lib/cloud';
import { formatTime, today } from '../lib/dates';
import { SchoolHit, kindOf, searchSchools } from '../lib/neis';
import { MAX_STUDENTS, NAME_MAX, SchoolInfo, Student, checkItems, itemFor, markKey } from '../lib/types';
import { Badge, Button, Card, CopyButton, ErrorNote, Field, IconButton, Input, Modal, SectionTitle, Textarea, cx, toast } from '../ui/kit';
import { schoolLabel } from '../ui/school';
import { useData } from './data';

export default function ClassPanel({ onClassName, onLogout, onDeleted }: { onClassName: (n: string) => void; onLogout: (all: boolean) => void; onDeleted: () => void }) {
  const d = useData();
  const info = d.info!;
  const [name, setName] = useState(info.name);
  const [size, setSize] = useState(String(info.maxStudents));
  const [qr, setQr] = useState(false);
  const [paste, setPaste] = useState(false);
  const [del, setDel] = useState(false);

  const run = async (fn: () => Promise<unknown>, msg?: string) => {
    try {
      await fn();
      if (msg) toast(msg);
    } catch (e) {
      toast(errorMessage(e));
    }
  };


  return (
    <div className="space-y-8">
      <SectionTitle icon={<Settings2 size={20} />} title={<span className="text-2xl">학급 관리</span>} />

      <div className="grid gap-4">
        <Card className="p-5 space-y-4">
          <h3 className="font-bold">학급 정보</h3>
          <div className="flex gap-2 items-end">
            <Field label="학급 이름" className="flex-1">
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
            </Field>
            <Button variant="secondary" icon={<Save size={16} />} disabled={!name.trim() || name === info.name} onClick={() => run(async () => (await d.api.renameClass(d.classId, name), onClassName(name.trim())), '학급 이름을 바꿨어요.')}>
              저장
            </Button>
          </div>
          <div className="flex gap-2 items-end">
            <Field label={`학생 수 (번호 버튼 개수, 최대 ${MAX_STUDENTS})`} className="flex-1">
              <Input type="number" min={1} max={MAX_STUDENTS} value={size} onChange={(e) => setSize(e.target.value)} />
            </Field>
            <Button variant="secondary" icon={<Save size={16} />} disabled={Number(size) === info.maxStudents || !Number(size)} onClick={() => run(() => d.api.setMaxStudents(d.classId, Number(size)), '학생 수를 바꿨어요.')}>
              저장
            </Button>
          </div>
          <div className="rounded-xl bg-surface-2 border border-line p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-ink-3">학급 코드</p>
              <p className="text-2xl font-bold font-mono tracking-[0.2em] text-brand-strong whitespace-nowrap">{d.classId}</p>
            </div>
            <div className="flex gap-2">
              <CopyButton text={d.classId} />
              <Button variant="soft" size="sm" icon={<QrCode size={16} />} onClick={() => setQr(true)}>
                초대 QR
              </Button>
            </div>
          </div>
        </Card>

      </div>

      <SchoolCard />

      <Roster onPaste={() => setPaste(true)} />

      <Card className="p-5 space-y-4">
        <h3 className="font-bold">기록 내보내기 · 정리</h3>
        <p className="text-sm text-ink-3">월 1회와 학기 말에 내려받아 두세요. 엑셀에서 열 수 있어요(CSV).</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={<Download size={16} />} onClick={() => exportCsv(d)}>
            공지·미션 기록 내려받기
          </Button>
          <Button variant="secondary" icon={<LogOut size={16} />} onClick={() => onLogout(false)}>
            이 기기에서 로그아웃
          </Button>
          <Button variant="danger" icon={<Trash2 size={16} />} onClick={() => setDel(true)}>
            학급 전체 삭제
          </Button>
        </div>
      </Card>

      {qr && (
        <Modal open onClose={() => setQr(false)} title={`학생 초대 · ${info.name}`}>
          <div className="text-center space-y-4">
            <div className="mx-auto w-full max-w-xs bg-white p-3 rounded-2xl border-4 border-ink">
              <QRCodeSVG value={inviteUrl(d.classId)} size={512} level="M" marginSize={1} className="w-full h-auto" title="학급 참여 QR 코드" />
            </div>
            <p className="font-semibold">카메라로 찍으면 학급 코드가 자동으로 들어가요.</p>
            <p className="text-ink-3">
              QR이 안 되면 학급 코드 <b className="font-mono text-2xl tracking-[0.2em] text-brand-strong align-middle">{d.classId}</b>
            </p>
            <p className="text-xs text-ink-3 break-all">{inviteUrl(d.classId)}</p>
          </div>
        </Modal>
      )}
      {paste && <PasteRoster onClose={() => setPaste(false)} />}
      {del && <DeleteClass onClose={() => setDel(false)} onDeleted={onDeleted} />}
    </div>
  );
}

function Roster({ onPaste }: { onPaste: () => void }) {
  const d = useData();
  const max = d.info?.maxStudents ?? 0;
  const byNum = new Map(d.students.map((s) => [s.number, s]));
  const numbers = Array.from(new Set([...Array.from({ length: max }, (_, i) => i + 1), ...d.students.map((s) => s.number)])).sort((a, b) => a - b);
  // 고친 이름만 모아 두었다가 ‘일괄 저장’으로 한 번에 저장
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const dirty = Object.entries(edits)
    .map(([n, name]) => ({ number: Number(n), name: name.trim() }))
    .filter((r) => r.name && r.name !== (byNum.get(r.number)?.name || ''));

  const saveAll = async () => {
    if (!dirty.length) return;
    setBusy(true);
    try {
      await d.api.upsertStudents(d.classId, dirty, d.students);
      setEdits({});
      toast(`${dirty.length}명의 이름을 저장했어요.`);
    } catch (e) {
      toast(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const bar = (
    <div className="flex items-center gap-2">
      {dirty.length > 0 && (
        <Button variant="ghost" size="sm" icon={<Undo2 size={15} />} onClick={() => setEdits({})}>
          되돌리기
        </Button>
      )}
      <Button size="sm" icon={<Save size={16} />} disabled={!dirty.length || d.privacy} loading={busy} onClick={saveAll}>
        {dirty.length ? `${dirty.length}명 일괄 저장` : '일괄 저장'}
      </Button>
    </div>
  );

  return (
    <section>
      <SectionTitle
        icon={<Users size={18} />}
        title="학생 명단"
        sub="이름을 여러 명 고친 뒤 ‘일괄 저장’을 눌러요. PIN을 잊은 학생은 ‘PIN 초기화’ 후 다시 정하게 해 주세요."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" icon={<ClipboardPaste size={16} />} onClick={onPaste}>
              명단 붙여넣기
            </Button>
            {bar}
          </div>
        }
      />
      <Card className="divide-y divide-line">
        {numbers.map((n) => (
          <RosterRow
            key={n}
            number={n}
            student={byNum.get(n)}
            claimed={!!d.claimed['s' + n]}
            value={edits[n] ?? byNum.get(n)?.name ?? ''}
            changed={n in edits && (edits[n] || '').trim() !== (byNum.get(n)?.name || '')}
            onChange={(v) => setEdits((m) => ({ ...m, [n]: v }))}
            onEnter={saveAll}
          />
        ))}
      </Card>
      {dirty.length > 0 && (
        <div className="sticky bottom-4 z-20 mt-3 flex justify-end">
          <div className="rounded-2xl bg-surface border border-line shadow-pop p-2 flex items-center gap-2">
            <span className="text-sm font-semibold text-ink-2 px-2">고친 이름 {dirty.length}개</span>
            {bar}
          </div>
        </div>
      )}
    </section>
  );
}

function RosterRow({ number, student, claimed, value, changed, onChange, onEnter }: { number: number; student?: Student; claimed: boolean; value: string; changed: boolean; onChange: (v: string) => void; onEnter: () => void }) {
  const d = useData();
  const sid = 's' + number;
  const status = claimed ? (student?.joined ? { tone: 'ok' as const, label: '참여함' } : { tone: 'brand' as const, label: 'PIN 정함' }) : student ? { tone: 'warn' as const, label: '아직 안 들어옴' } : { tone: 'neutral' as const, label: '빈 번호' };

  return (
    <div className={cx('flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2', changed && 'bg-brand-soft/40')}>
      <span className="w-9 text-center font-bold tabular-nums text-ink-3 shrink-0">{number}</span>
      <Input
        value={d.privacy ? '' : value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && onEnter()}
        maxLength={NAME_MAX}
        placeholder={d.privacy ? '가림 모드' : '이름'}
        disabled={d.privacy}
        className={cx('h-10 pii flex-1 min-w-0', changed && 'border-brand')}
        aria-label={`${number}번 이름`}
      />
      <Badge tone={status.tone} className="hidden sm:inline-flex">
        {status.label}
      </Badge>
      <IconButton
        label="PIN 초기화"
        disabled={!claimed}
        onClick={() => confirm(`${number}번의 PIN을 초기화할까요? 학생이 다음에 들어올 때 새 PIN을 정해요.`) && d.api.resetPin(d.classId, sid).then(() => toast(`${number}번 PIN을 초기화했어요.`)).catch((e) => toast(errorMessage(e)))}
      >
        <KeyRound size={17} />
      </IconButton>
      <IconButton
        label="학생 지우기"
        disabled={!student && !claimed}
        onClick={() => confirm(`${number}번 학생의 이름·PIN·미션 기록을 모두 지울까요?`) && d.api.removeStudent(d.classId, sid).then(() => toast(`${number}번을 지웠어요.`)).catch((e) => toast(errorMessage(e)))}
      >
        <UserMinus size={17} />
      </IconButton>
    </div>
  );
}

// 학교(나이스) 설정: 급식·학사일정을 불러오려고 학교를 정함
function SchoolCard() {
  const d = useData();
  const cur = d.school;
  const [open, setOpen] = useState(false);
  return (
    <Card className="p-5 space-y-3">
      <h3 className="font-bold flex items-center gap-2">
        <School size={18} /> 우리 학교 (급식·학사일정)
      </h3>
      {cur ? (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-48">
            <p className="text-lg font-bold">{schoolLabel(cur)}</p>
            <p className="text-sm text-ink-3">나이스에서 오늘 급식과 학사일정을 가져와 학생 홈과 달력에 보여 줘요.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            바꾸기
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-ink-3 flex-1 min-w-48">학교를 정하면 나이스의 오늘 급식이 학생 홈에 보이고, 학사일정이 학급 달력에 함께 보여요.</p>
          <Button size="sm" icon={<Search size={15} />} onClick={() => setOpen(true)}>
            학교 찾기
          </Button>
        </div>
      )}
      {open && <SchoolEditor onClose={() => setOpen(false)} />}
    </Card>
  );
}

function SchoolEditor({ onClose }: { onClose: () => void }) {
  const d = useData();
  const cur = d.school;
  const [q, setQ] = useState(cur?.name || '');
  const [hits, setHits] = useState<SchoolHit[] | null>(null);
  const [pick, setPick] = useState<Pick<SchoolInfo, 'office' | 'code' | 'name' | 'kind'> | null>(cur ? { office: cur.office, code: cur.code, name: cur.name, kind: cur.kind } : null);
  const [key, setKey] = useState(cur?.key || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const search = async () => {
    if (q.trim().length < 2) return setError('학교 이름을 두 글자 이상 적어 주세요.');
    setBusy(true);
    setError('');
    try {
      const list = await searchSchools(q, key.trim() || undefined);
      setHits(list);
      if (!list.length) setError('찾는 학교가 없어요. 이름을 확인해 주세요.');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (!pick) return setError('학교를 골라 주세요.');
    setBusy(true);
    try {
      await d.api.saveSchool(d.classId, { ...pick, grade: cur?.grade || 1, classNo: cur?.classNo || '1', key: key.trim() });
      toast('학교를 정했어요.');
      onClose();
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="우리 학교 정하기"
      footer={
        <>
          {cur && (
            <Button variant="danger" className="mr-auto" onClick={() => confirm('학교 설정을 지울까요?') && d.api.saveSchool(d.classId, null).then(onClose).catch((e) => toast(errorMessage(e)))}>
              설정 지우기
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button onClick={save} loading={busy} disabled={!pick}>
            저장
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <form className="flex gap-2" onSubmit={(e) => (e.preventDefault(), search())}>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="학교 이름 (예: 서울대도초등학교)" aria-label="학교 이름" autoFocus />
          <Button type="submit" icon={<Search size={16} />} loading={busy}>
            찾기
          </Button>
        </form>
        {hits && hits.length > 0 && (
          <div className="max-h-56 overflow-y-auto space-y-1.5">
            {hits.map((h) => (
              <button
                key={h.office + h.code}
                type="button"
                onClick={() => setPick({ office: h.office, code: h.code, name: h.name, kind: kindOf(h.kindName) })}
                aria-pressed={pick?.code === h.code}
                className={cx('w-full text-left rounded-xl border px-3 py-2.5 cursor-pointer transition', pick?.code === h.code ? 'border-brand bg-brand-soft' : 'border-line hover:border-line-strong')}
              >
                <span className="block font-semibold">{h.name}</span>
                <span className="block text-xs text-ink-3 truncate">{h.address}</span>
              </button>
            ))}
          </div>
        )}
        {pick && <p className="text-sm font-semibold text-brand-strong">고른 학교: {pick.name}</p>}
        <Field label="나이스 인증키 (선택)" hint="없어도 돼요. 나이스 호출 한도가 넉넉해져요. open.neis.go.kr 에서 무료로 받을 수 있고, 학생 기기에서도 쓰여요(개인정보 없는 공개 자료용).">
          <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="인증키" className="font-mono text-sm" />
        </Field>
        <ErrorNote>{error}</ErrorNote>
      </div>
    </Modal>
  );
}

// "1 김하늘" 처럼 한 줄에 번호와 이름 (탭·쉼표·공백 모두 가능, 엑셀에서 두 칸 복사해도 됨)
export function parseRoster(text: string) {
  const rows: { number: number; name: string }[] = [];
  const bad: string[] = [];
  text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line) => {
      const m = line.match(/^(\d{1,3})\s*(?:번)?[\s,.\t:)-]*\s*(.+)$/);
      const name = m?.[2]?.trim().replace(/^["']|["']$/g, '');
      if (m && name && Number(m[1]) >= 1 && Number(m[1]) <= MAX_STUDENTS && name.length <= NAME_MAX) rows.push({ number: Number(m[1]), name });
      else bad.push(line);
    });
  return { rows, bad };
}

function PasteRoster({ onClose }: { onClose: () => void }) {
  const d = useData();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { rows, bad } = parseRoster(text);
  const max = d.info?.maxStudents ?? 0;
  const over = rows.filter((r) => r.number > max);

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const top = Math.max(0, ...rows.map((r) => r.number));
      if (top > max) await d.api.setMaxStudents(d.classId, top);
      await d.api.upsertStudents(d.classId, rows, d.students);
      toast(`${rows.length}명을 넣었어요.`);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="명단 붙여넣기"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button onClick={save} loading={busy} disabled={!rows.length || bad.length > 0}>
            {rows.length}명 넣기
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-3 mb-3">한 줄에 한 명씩 “번호 이름”으로 써 주세요. 엑셀에서 번호·이름 두 칸을 복사해 붙여넣어도 돼요. 이미 있는 번호는 이름만 바뀌어요.</p>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} placeholder={'1 김하늘\n2 이바다\n3 박구름'} className="font-mono text-sm" autoFocus />
      <div className="mt-3 space-y-2">
        {bad.length > 0 && <ErrorNote>알아보지 못한 줄: {bad.slice(0, 3).join(' / ')}{bad.length > 3 ? ` 외 ${bad.length - 3}줄` : ''} (이름은 {NAME_MAX}글자까지)</ErrorNote>}
        <ErrorNote>{error}</ErrorNote>
        {over.length > 0 && <p className="text-sm text-warn font-medium">학생 수({max}명)보다 큰 번호가 있어 학생 수를 {Math.max(...over.map((r) => r.number))}명으로 늘려요.</p>}
      </div>
    </Modal>
  );
}

function DeleteClass({ onClose, onDeleted }: { onClose: () => void; onDeleted: () => void }) {
  const d = useData();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <Modal
      open
      onClose={onClose}
      title="학급 전체 삭제"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button
            variant="danger"
            loading={busy}
            disabled={code.toUpperCase() !== d.classId}
            onClick={async () => {
              setBusy(true);
              try {
                await d.api.deleteClass(d.classId);
                toast('학급을 삭제했어요.');
                onDeleted();
              } catch (e) {
                setError(errorMessage(e));
                setBusy(false);
              }
            }}
          >
            영구 삭제
          </Button>
        </>
      }
    >
      <p className="text-ink-2">학생 명단, 공지·미션과 기록, 바로가기, 1인1역, 달력이 모두 지워지고 되돌릴 수 없어요. 먼저 기록을 내려받아 두세요.</p>
      <Field label={`확인을 위해 학급 코드 ${d.classId}를 입력하세요`} className="mt-4">
        <Input value={code} onChange={(e) => setCode(e.target.value)} className="font-mono tracking-widest" />
      </Field>
      <div className="mt-3">
        <ErrorNote>{error}</ErrorNote>
      </div>
    </Modal>
  );
}

function exportCsv(d: ReturnType<typeof useData>) {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const tasks = [...d.tasks].sort((a, b) => a.due.localeCompare(b.due));
  const cols = tasks.flatMap((t) => checkItems(t).map((i) => ({ t, i })));
  const head = ['번호', '이름', ...cols.map(({ t, i }) => `[${t.due}] ${t.title} - ${i.text}`)];
  const lines = [head.map(esc).join(',')];
  for (const s of d.students) {
    const st = d.statuses[s.sid];
    const row: (string | number)[] = [s.number, s.name];
    cols.forEach(({ t, i }) => {
      if ((t.targets && !t.targets.includes(s.sid)) || !itemFor(i, s.sid)) return row.push('대상 아님');
      const m = st?.tasks?.[markKey(t.id, i.id)];
      row.push(counted(m?.state) ? `완료 ${m ? formatTime(m.at) : ''}`.trim() : '미완료');
    });
    lines.push(row.map(esc).join(','));
  }
  const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${d.info?.name || d.classId}_기록_${today()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
