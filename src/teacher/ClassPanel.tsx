import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ClipboardPaste, Download, ExternalLink, KeyRound, LogOut, QrCode, RefreshCw, Save, Settings2, Trash2, TvMinimal, UserMinus, Users } from 'lucide-react';
import { errorMessage, inviteUrl, tvUrl } from '../lib/cloud';
import { formatTime, today } from '../lib/dates';
import { MAX_STUDENTS, NAME_MAX, TASK_STATE_LABEL } from '../lib/types';
import { Badge, Button, Card, CopyButton, ErrorNote, Field, IconButton, Input, Modal, SectionTitle, Textarea, toast } from '../ui/kit';
import { useData } from './data';

export default function ClassPanel({ onClassName, onLogout, onDeleted }: { onClassName: (n: string) => void; onLogout: (all: boolean) => void; onDeleted: () => void }) {
  const d = useData();
  const info = d.info!;
  const [name, setName] = useState(info.name);
  const [size, setSize] = useState(String(info.maxStudents));
  const [qr, setQr] = useState(false);
  const [paste, setPaste] = useState(false);
  const [del, setDel] = useState(false);
  const [token, setToken] = useState('');
  useEffect(() => {
    d.api.getTvToken(d.classId).then(setToken).catch(() => undefined);
  }, [d.api, d.classId]);

  const run = async (fn: () => Promise<unknown>, msg?: string) => {
    try {
      await fn();
      if (msg) toast(msg);
    } catch (e) {
      toast(errorMessage(e));
    }
  };

  const tv = token ? tvUrl(d.classId, token) : '';

  return (
    <div className="space-y-8">
      <SectionTitle icon={<Settings2 size={20} />} title={<span className="text-2xl">학급 관리</span>} />

      <div className="grid lg:grid-cols-2 gap-4">
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
          <div className="rounded-xl bg-surface-2 border border-line p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-ink-3">학급 코드</p>
              <p className="text-2xl font-bold font-mono tracking-[0.2em] text-brand-strong">{d.classId}</p>
            </div>
            <div className="flex gap-2">
              <CopyButton text={d.classId} />
              <Button variant="soft" size="sm" icon={<QrCode size={16} />} onClick={() => setQr(true)}>
                초대 QR
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h3 className="font-bold flex items-center gap-2">
            <TvMinimal size={18} /> TV 화면 주소
          </h3>
          <p className="text-sm text-ink-3">교실 전자칠판 브라우저에서 이 주소를 열어 두세요. 로그인 없이 공지·과제 완료 인원수·지금 열기 QR이 보이고, 학생 이름은 보이지 않아요.</p>
          <div className="rounded-xl bg-surface-2 border border-line px-3.5 py-3 font-mono text-xs break-all text-ink-2">{tv || '불러오는 중…'}</div>
          <div className="flex flex-wrap gap-2">
            <CopyButton text={tv} label="주소 복사" />
            <Button variant="soft" size="sm" icon={<ExternalLink size={16} />} onClick={() => window.open(tv, '_blank', 'noopener')} disabled={!tv}>
              열기
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<RefreshCw size={16} />}
              onClick={() => confirm('새 주소를 만들면 지금 켜 둔 TV는 더 이상 내용을 받지 못해요. 바꿀까요?') && run(async () => setToken(await d.api.rotateTvToken(d.classId)), '새 TV 주소를 만들었어요.')}
            >
              새 주소 만들기
            </Button>
          </div>
        </Card>
      </div>

      <Roster onPaste={() => setPaste(true)} />

      <Card className="p-5 space-y-4">
        <h3 className="font-bold">기록 내보내기 · 정리</h3>
        <p className="text-sm text-ink-3">월 1회와 학기 말에 내려받아 두세요. 엑셀에서 열 수 있어요(CSV).</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" icon={<Download size={16} />} onClick={() => exportCsv(d)}>
            과제·공지 기록 내려받기
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

  return (
    <section>
      <SectionTitle
        icon={<Users size={18} />}
        title="학생 명단"
        sub="이름은 언제든 고칠 수 있어요. PIN을 잊은 학생은 ‘PIN 초기화’ 후 다시 정하게 해 주세요."
        action={
          <Button variant="secondary" size="sm" icon={<ClipboardPaste size={16} />} onClick={onPaste}>
            명단 붙여넣기
          </Button>
        }
      />
      <Card className="divide-y divide-line">
        {numbers.map((n) => (
          <RosterRow key={n} number={n} student={byNum.get(n)} claimed={!!d.claimed['s' + n]} />
        ))}
      </Card>
    </section>
  );
}

function RosterRow({ number, student, claimed }: { number: number; student?: { sid: string; name: string; joined: boolean }; claimed: boolean }) {
  const d = useData();
  const sid = 's' + number;
  const [name, setName] = useState(student?.name || '');
  useEffect(() => setName(student?.name || ''), [student?.name]);
  const dirty = name.trim() !== (student?.name || '') && name.trim().length > 0;
  const status = claimed ? (student?.joined ? { tone: 'ok' as const, label: '참여함' } : { tone: 'brand' as const, label: 'PIN 정함' }) : student ? { tone: 'warn' as const, label: '아직 안 들어옴' } : { tone: 'neutral' as const, label: '빈 번호' };

  return (
    <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2">
      <span className="w-9 text-center font-bold tabular-nums text-ink-3 shrink-0">{number}</span>
      <form
        className="flex-1 min-w-0 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!dirty) return;
          d.api
            .renameStudent(d.classId, sid, name)
            .then(() => toast('이름을 고쳤어요.'))
            .catch((er) => toast(errorMessage(er)));
        }}
      >
        <Input value={d.privacy ? '' : name} onChange={(e) => setName(e.target.value)} maxLength={NAME_MAX} placeholder={d.privacy ? '가림 모드' : '이름'} disabled={d.privacy} className="h-10 pii" aria-label={`${number}번 이름`} />
        {dirty && (
          <Button type="submit" size="sm" className="h-10">
            저장
          </Button>
        )}
      </form>
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
        onClick={() => confirm(`${number}번 학생의 이름·PIN·과제 기록을 모두 지울까요?`) && d.api.removeStudent(d.classId, sid).then(() => toast(`${number}번을 지웠어요.`)).catch((e) => toast(errorMessage(e)))}
      >
        <UserMinus size={17} />
      </IconButton>
    </div>
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
      <p className="text-ink-2">학생 명단, 과제 기록, 공지, 링크가 모두 지워지고 되돌릴 수 없어요. 먼저 기록을 내려받아 두세요.</p>
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
  const notices = [...d.notices].sort((a, b) => a.publishAt - b.publishAt);
  const head = ['번호', '이름', ...tasks.map((t) => `[과제 ${t.due}] ${t.title}`), ...notices.map((n) => `[공지] ${n.title}`)];
  const lines = [head.map(esc).join(',')];
  for (const s of d.students) {
    const st = d.statuses[s.sid];
    const row: (string | number)[] = [s.number, s.name];
    tasks.forEach((t) => {
      if (t.targets && !t.targets.includes(s.sid)) return row.push('대상 아님');
      const m = st?.tasks?.[t.id];
      row.push(m ? TASK_STATE_LABEL[m.state] + (m.note ? ` (${m.note})` : '') : TASK_STATE_LABEL.todo);
    });
    notices.forEach((n) => row.push(st?.reads?.[n.id] ? `읽음 ${formatTime(st.reads[n.id])}` : '안 읽음'));
    lines.push(row.map(esc).join(','));
  }
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${d.info?.name || d.classId}_기록_${today()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
