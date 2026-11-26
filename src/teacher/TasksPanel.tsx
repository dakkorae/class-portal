import { useMemo, useState } from 'react';
import { BookmarkPlus, Check, CheckCheck, ClipboardCheck, FileText, Minus, MoreHorizontal, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { counted } from '../lib/api';
import { errorMessage } from '../lib/cloud';
import { addDays, formatDay, today } from '../lib/dates';
import { isTarget } from '../lib/visible';
import { Task, TaskState, TaskTemplate } from '../lib/types';
import { Badge, Button, Card, Empty, ErrorNote, Field, Input, Modal, Segmented, SectionTitle, Select, Switch, Textarea, cx, isValidUrl, normalizeUrl, toast } from '../ui/kit';
import { useData } from './data';

type Range = 'active' | 'recent' | 'all';

export default function TasksPanel() {
  const d = useData();
  const [edit, setEdit] = useState<Partial<Task> | null>(null);
  const [range, setRange] = useState<Range>('active');
  const [onlyTodo, setOnlyTodo] = useState(false);
  const [cell, setCell] = useState<{ sid: string; task: Task } | null>(null);
  const [colMenu, setColMenu] = useState<string | null>(null);
  const t0 = today();

  const shown = useMemo(() => {
    if (range === 'active') return d.tasks.filter((t) => t.due >= t0);
    if (range === 'recent') return d.tasks.filter((t) => t.due >= addDays(t0, -14));
    return d.tasks;
  }, [d.tasks, range, t0]);

  const stateOf = (sid: string, t: Task): TaskState => d.statuses[sid]?.tasks?.[t.id]?.state || 'todo';
  const rows = d.students.filter((s) => !onlyTodo || shown.some((t) => isTarget(t, s.sid) && !counted(stateOf(s.sid, t))));

  const setMarks = async (changes: { sid: string; taskId: string; state: TaskState; note?: string }[], msg?: string) => {
    try {
      await d.api.setMarks(d.classId, changes);
      if (msg) toast(msg);
    } catch (e) {
      toast(errorMessage(e));
    }
  };

  const bulk = (t: Task, which: 'done' | 'all') => {
    const targets = d.students.filter((s) => isTarget(t, s.sid)).map((s) => s.sid);
    const changes = targets.filter((sid) => (which === 'done' ? stateOf(sid, t) === 'done' : stateOf(sid, t) !== 'checked')).map((sid) => ({ sid, taskId: t.id, state: 'checked' as TaskState }));
    if (!changes.length) return toast('바꿀 칸이 없어요.');
    setMarks(changes, `${changes.length}명을 확인했어요.`);
    setColMenu(null);
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        icon={<ClipboardCheck size={20} />}
        title={<span className="text-2xl">과제 체크</span>}
        sub="학생이 ‘다 했어요’를 누르면 노란 칸으로 바뀌어요. 칸을 눌러 확인하거나 다시 하게 할 수 있어요."
        action={
          <Button icon={<Plus size={18} />} onClick={() => setEdit({ due: t0, targets: null, paper: false })}>
            과제 추가
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          value={range}
          onChange={setRange}
          size="sm"
          ariaLabel="보일 과제"
          options={[
            { value: 'active', label: '진행 중' },
            { value: 'recent', label: '최근 2주' },
            { value: 'all', label: '전체' }
          ]}
        />
        <Switch checked={onlyTodo} onChange={setOnlyTodo} label="미완료만 보기" />
        <Legend />
      </div>

      {shown.length === 0 ? (
        <Card>
          <Empty icon={<ClipboardCheck size={22} />} title={range === 'active' ? '진행 중인 과제가 없어요' : '과제가 없어요'}>
            ‘과제 추가’로 오늘 할 일을 만들어 보세요.
          </Empty>
        </Card>
      ) : d.students.length === 0 ? (
        <Card>
          <Empty title="아직 학생이 없어요">학생이 참여하거나 ‘학급 관리’에서 명단을 넣으면 현황판이 생겨요.</Empty>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-auto max-h-[70dvh]">
            <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-20 bg-surface border-b border-r border-line px-3 py-2 text-left font-semibold text-ink-3 w-36">학생</th>
                  {shown.map((t) => {
                    const total = d.live.tasks[t.id]?.total ?? 0;
                    const done = d.live.done[t.id] ?? 0;
                    return (
                      <th key={t.id} className="sticky top-0 z-10 bg-surface border-b border-line px-2 py-2 align-bottom min-w-32 max-w-44">
                        <div className="relative">
                          <button type="button" onClick={() => setEdit(t)} className="block w-full text-left cursor-pointer group" title="과제 고치기">
                            <span className="flex items-center gap-1 text-xs font-semibold text-ink-3">
                              {t.paper && <FileText size={12} aria-label="종이 과제" />}
                              {formatDay(t.due)}
                            </span>
                            <span className="block font-bold text-ink leading-snug line-clamp-2 group-hover:text-brand-strong">{t.title}</span>
                          </button>
                          <div className="flex items-center justify-between gap-1 mt-1">
                            <span className="text-xs font-semibold text-ink-3 tabular-nums">
                              {Math.min(done, total)}/{total}
                            </span>
                            <button type="button" onClick={() => setColMenu(colMenu === t.id ? null : t.id)} className="w-7 h-7 rounded-md hover:bg-surface-2 flex items-center justify-center text-ink-3 cursor-pointer" aria-label={`${t.title} 일괄 처리`}>
                              <MoreHorizontal size={16} />
                            </button>
                          </div>
                          {colMenu === t.id && (
                            <>
                              <div className="fixed inset-0 z-30" onClick={() => setColMenu(null)} />
                              <div className="absolute right-0 top-full z-40 mt-1 w-48 rounded-xl border border-line bg-surface shadow-pop p-1.5 text-left font-normal animate-pop">
                                <MenuItem icon={<Check size={15} />} onClick={() => bulk(t, 'done')}>‘다 했어요’만 확인</MenuItem>
                                <MenuItem icon={<CheckCheck size={15} />} onClick={() => bulk(t, 'all')}>모두 확인 (종이 과제)</MenuItem>
                                <MenuItem icon={<Pencil size={15} />} onClick={() => (setEdit(t), setColMenu(null))}>과제 고치기</MenuItem>
                              </div>
                            </>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.sid} className="group">
                    <th className="sticky left-0 z-10 bg-surface group-hover:bg-surface-2 border-b border-r border-line px-3 py-1.5 text-left font-semibold whitespace-nowrap">
                      <span className="text-ink-3 tabular-nums mr-1.5">{s.number}</span>
                      <span className="pii">{d.privacy ? '' : s.name || '—'}</span>
                    </th>
                    {shown.map((t) => (
                      <td key={t.id} className="border-b border-line px-1.5 py-1.5 group-hover:bg-surface-2/50">
                        {isTarget(t, s.sid) ? <Cell state={stateOf(s.sid, t)} note={d.statuses[s.sid]?.tasks?.[t.id]?.note} onClick={() => setCell({ sid: s.sid, task: t })} /> : <span className="block text-center text-ink-3/50">·</span>}
                      </td>
                    ))}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={shown.length + 1} className="p-6 text-center text-ink-3">
                      모두 끝냈어요! 🎉
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <TemplatesCard onUse={(tpl) => setEdit({ title: tpl.title, desc: tpl.desc, linkUrl: tpl.linkUrl, paper: tpl.paper, due: t0, targets: null })} />

      {cell && <CellMenu sid={cell.sid} task={cell.task} state={stateOf(cell.sid, cell.task)} note={d.statuses[cell.sid]?.tasks?.[cell.task.id]?.note || ''} onClose={() => setCell(null)} onSet={(state, note) => (setMarks([{ sid: cell.sid, taskId: cell.task.id, state, note }]), setCell(null))} />}
      {edit && <TaskEditor initial={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

const CELL: Record<TaskState, { cls: string; label: string; icon: React.ReactNode }> = {
  todo: { cls: 'bg-surface border-line text-ink-3', label: '미완료', icon: <Minus size={14} /> },
  done: { cls: 'bg-warn-soft border-warn/40 text-warn', label: '다 했어요', icon: <CheckCheck size={14} /> },
  checked: { cls: 'bg-ok-soft border-ok/30 text-ok', label: '확인', icon: <Check size={14} strokeWidth={3} /> },
  redo: { cls: 'bg-bad-soft border-bad/30 text-bad', label: '다시 해요', icon: <RotateCcw size={14} /> }
};

function Cell({ state, note, onClick }: { state: TaskState; note?: string; onClick: () => void }) {
  const c = CELL[state];
  return (
    <button type="button" onClick={onClick} title={note ? `메모: ${note}` : c.label} className={cx('w-full h-9 rounded-lg border flex items-center justify-center gap-1 text-xs font-bold transition hover:brightness-95 active:scale-95 cursor-pointer', c.cls)}>
      {c.icon}
      {c.label}
    </button>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-1.5 ml-auto">
      {(Object.keys(CELL) as TaskState[]).map((s) => (
        <span key={s} className={cx('inline-flex items-center gap-1 h-7 px-2 rounded-md border text-xs font-bold', CELL[s].cls)}>
          {CELL[s].icon}
          {CELL[s].label}
        </span>
      ))}
    </div>
  );
}

function MenuItem({ icon, children, onClick }: { icon: React.ReactNode; children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-surface-2 text-sm font-semibold text-ink-2 cursor-pointer">
      {icon}
      {children}
    </button>
  );
}

function CellMenu({ sid, task, state, note: initNote, onClose, onSet }: { sid: string; task: Task; state: TaskState; note: string; onClose: () => void; onSet: (s: TaskState, note?: string) => void }) {
  const d = useData();
  const [note, setNote] = useState(initNote);
  return (
    <Modal open onClose={onClose} title={<span className="pii">{d.nameOf(sid)}</span>}>
      <p className="text-sm text-ink-3 mb-1">{task.title}</p>
      <p className="text-sm mb-4">
        지금 상태: <b className="text-ink">{CELL[state].label}</b>
      </p>
      <div className="grid grid-cols-3 gap-2">
        <Button size="lg" className="bg-ok text-white hover:brightness-95 hover:bg-ok" icon={<Check size={18} strokeWidth={3} />} onClick={() => onSet('checked')}>
          확인
        </Button>
        <Button size="lg" variant="danger" icon={<RotateCcw size={18} />} onClick={() => onSet('redo', note.trim())}>
          다시 해요
        </Button>
        <Button size="lg" variant="secondary" icon={<X size={18} />} onClick={() => onSet('todo')}>
          미완료
        </Button>
      </div>
      <Field label="‘다시 해요’ 메모 (학생에게 보여요)" className="mt-4">
        <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={60} placeholder="예: 3번 문제 풀이를 더 써 주세요" />
      </Field>
    </Modal>
  );
}

function TaskEditor({ initial, onClose }: { initial: Partial<Task>; onClose: () => void }) {
  const d = useData();
  const [title, setTitle] = useState(initial.title || '');
  const [desc, setDesc] = useState(initial.desc || '');
  const [due, setDue] = useState(initial.due || today());
  const [all, setAll] = useState(!initial.targets);
  const [targets, setTargets] = useState<string[]>(initial.targets || []);
  const [linkUrl, setLinkUrl] = useState(initial.linkUrl || '');
  const [paper, setPaper] = useState(!!initial.paper);
  const [asTemplate, setAsTemplate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!title.trim()) return setError('과제 이름을 적어 주세요.');
    if (!due) return setError('마감일을 골라 주세요.');
    const url = linkUrl ? normalizeUrl(linkUrl) : '';
    if (url && !isValidUrl(url)) return setError('링크 주소를 확인해 주세요.');
    if (!all && targets.length === 0) return setError('대상 학생을 한 명 이상 골라 주세요.');
    setBusy(true);
    setError('');
    try {
      const tg = all ? null : targets;
      const total = tg ? tg.length : d.students.length;
      await d.api.saveTask(d.classId, { id: initial.id, createdAt: initial.createdAt, title: title.trim(), desc: desc.trim(), due, targets: tg, linkUrl: url, paper }, total);
      if (asTemplate) await d.api.saveTemplate(d.classId, { title: title.trim(), desc: desc.trim(), linkUrl: url, paper });
      toast(initial.id ? '과제를 고쳤어요.' : '과제를 만들었어요.');
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
      wide
      onClose={onClose}
      title={initial.id ? '과제 고치기' : '과제 추가'}
      footer={
        <>
          {initial.id && (
            <Button
              variant="danger"
              icon={<Trash2 size={16} />}
              className="mr-auto"
              onClick={async () => {
                if (!confirm(`‘${initial.title}’ 과제와 학생들의 체크 기록을 지울까요?`)) return;
                await d.api.deleteTask(d.classId, initial.id!).catch((e) => toast(errorMessage(e)));
                onClose();
              }}
            >
              지우기
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button onClick={save} loading={busy}>
            저장
          </Button>
        </>
      }
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="과제 이름" className="sm:col-span-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} placeholder="예: 독서록 쓰기" autoFocus={!initial.id} />
        </Field>
        <Field label="설명 (선택)" className="sm:col-span-2">
          <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} maxLength={300} placeholder="학생에게 보이는 짧은 안내" />
        </Field>
        <Field label="마감일">
          <div className="flex gap-2">
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </div>
          <div className="flex gap-1.5 mt-2">
            {[
              ['오늘', 0],
              ['내일', 1],
              ['일주일', 7]
            ].map(([l, n]) => (
              <button key={l} type="button" onClick={() => setDue(addDays(today(), n as number))} className="h-8 px-2.5 rounded-lg border border-line text-xs font-semibold text-ink-2 hover:bg-surface-2 cursor-pointer">
                {l}
              </button>
            ))}
          </div>
        </Field>
        <Field label="관련 링크 (선택)">
          <Select value={d.links.some((l) => l.url === linkUrl) ? linkUrl : linkUrl ? '__custom' : ''} onChange={(e) => setLinkUrl(e.target.value === '__custom' ? linkUrl || 'https://' : e.target.value)}>
            <option value="">없음</option>
            {d.links.map((l) => (
              <option key={l.id} value={l.url}>
                {l.title}
              </option>
            ))}
            <option value="__custom">직접 입력</option>
          </Select>
          {linkUrl && !d.links.some((l) => l.url === linkUrl) && <Input className="mt-2" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://" inputMode="url" />}
        </Field>
        <div className="sm:col-span-2 space-y-3">
          <Switch checked={!all} onChange={(v) => setAll(!v)} label="일부 학생에게만 내기" />
          {!all && (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 max-h-48 overflow-y-auto p-1">
              {d.students.map((s) => {
                const on = targets.includes(s.sid);
                return (
                  <button
                    key={s.sid}
                    type="button"
                    onClick={() => setTargets(on ? targets.filter((x) => x !== s.sid) : [...targets, s.sid])}
                    aria-pressed={on}
                    className={cx('h-10 px-2 rounded-lg border text-sm font-semibold truncate cursor-pointer transition', on ? 'border-brand bg-brand-soft text-brand-strong' : 'border-line text-ink-2 hover:border-line-strong')}
                  >
                    <span className="tabular-nums mr-1">{s.number}</span>
                    <span className="pii">{d.privacy ? '' : s.name}</span>
                  </button>
                );
              })}
            </div>
          )}
          <Switch checked={paper} onChange={setPaper} label="종이 과제 (학생 표시 없이 선생님이 확인)" />
          {!initial.id && <Switch checked={asTemplate} onChange={setAsTemplate} label="템플릿으로도 저장" />}
        </div>
      </div>
      <div className="mt-4">
        <ErrorNote>{error}</ErrorNote>
      </div>
    </Modal>
  );
}

function TemplatesCard({ onUse }: { onUse: (t: TaskTemplate) => void }) {
  const d = useData();
  const list = d.templates;
  return (
    <section>
      <SectionTitle icon={<BookmarkPlus size={18} />} title="과제 템플릿" sub="자주 내는 과제를 눌러 바로 만들어요." />
      {list.length === 0 ? (
        <p className="text-sm text-ink-3">과제를 만들 때 ‘템플릿으로도 저장’을 켜면 여기에 생겨요.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {list.map((t) => (
            <span key={t.id} className="inline-flex items-center rounded-xl border border-line bg-surface shadow-card">
              <button type="button" onClick={() => onUse(t)} className="h-10 pl-3.5 pr-2 text-sm font-semibold flex items-center gap-1.5 cursor-pointer hover:text-brand-strong">
                <Plus size={15} />
                {t.title}
                {t.paper && <Badge className="h-5 px-1.5">종이</Badge>}
              </button>
              <button
                type="button"
                onClick={() => confirm(`‘${t.title}’ 템플릿을 지울까요?`) && d.api.deleteTemplate(d.classId, t.id).catch((e) => toast(errorMessage(e)))}
                className="h-10 w-9 flex items-center justify-center text-ink-3 hover:text-bad cursor-pointer border-l border-line"
                aria-label={`${t.title} 템플릿 지우기`}
              >
                <X size={15} />
              </button>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

