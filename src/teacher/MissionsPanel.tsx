import { useMemo, useRef, useState } from 'react';
import DateNav from '../ui/DateNav';
import { ArrowDown, ArrowUp, BookmarkPlus, Check, CornerDownRight, ListChecks, MonitorUp, Pencil, Plus, SquareCheckBig, Trash2, X } from 'lucide-react';
import { counted } from '../lib/api';
import { errorMessage, openBoard } from '../lib/cloud';
import { addDays, formatDay, today } from '../lib/dates';
import { newItem, parseLines, progressOf } from '../lib/mission';
import { isTarget } from '../lib/visible';
import { MissionItem, Task, TaskTemplate, checkItems, markKey } from '../lib/types';
import { Badge, Button, Card, Empty, ErrorNote, Field, IconButton, Input, Modal, Progress, SectionTitle, Select, Switch, Textarea, cx, isValidUrl, normalizeUrl, toast } from '../ui/kit';
import { useData } from './data';

const boardOrToast = (cid: string, mid?: string) => {
  if (!openBoard(cid, mid)) toast('새 창이 막혔어요. 브라우저 주소창 오른쪽에서 팝업을 허용해 주세요.');
};

export default function MissionsPanel() {
  const d = useData();
  const [edit, setEdit] = useState<Partial<Task> | null>(null);
  const [day, setDay] = useState(today());
  const [onlyTodo, setOnlyTodo] = useState(false);
  // 고른 날짜의 미션만 (지난 미션은 날짜를 옮겨서 봄)
  const shown = useMemo(() => d.tasks.filter((t) => t.due === day), [d.tasks, day]);
  const marked = useMemo(() => new Set(d.tasks.map((t) => t.due)), [d.tasks]);

  return (
    <div className="space-y-6">
      <SectionTitle
        icon={<ListChecks size={20} />}
        title={<span className="text-2xl">미션</span>}
        sub="날짜마다 미션을 만들어요. 화살표나 달력으로 다른 날의 미션과 완료 기록을 볼 수 있어요."
        action={
          <Button icon={<Plus size={18} />} onClick={() => setEdit({ due: day, targets: null, items: [newItem('', true)] })}>
            미션 추가
          </Button>
        }
      />

      <DateNav value={day} onChange={setDay} marked={marked} />

      {shown.length === 0 ? (
        <Card>
          <Empty icon={<ListChecks size={22} />} title={`${formatDay(day)} 미션이 없어요`}>
            ‘미션 추가’로 이날 할 일을 만들어 보세요.
          </Empty>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {shown.map((t) => (
            <MissionCard key={t.id} task={t} onEdit={() => setEdit(t)} />
          ))}
        </div>
      )}

      {shown.some((t) => checkItems(t).length > 0) && (
        <section className="space-y-3">
          <SectionTitle
            icon={<SquareCheckBig size={18} />}
            title="완료 현황"
            sub="학생이 체크하면 바로 초록색으로 바뀌어요. (보기 전용)"
            action={<Switch checked={onlyTodo} onChange={setOnlyTodo} label="아직 안 한 학생만" />}
          />
          <StatusBoard tasks={shown.filter((t) => checkItems(t).length > 0)} onlyTodo={onlyTodo} />
        </section>
      )}

      <TemplatesCard onUse={(tpl) => setEdit({ title: tpl.title, items: tpl.items.map((i) => newItem(i.text, i.check, i.sub)), linkUrl: tpl.linkUrl, due: day, targets: null })} />

      {edit && <MissionEditor initial={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function MissionCard({ task: t, onEdit }: { task: Task; onEdit: () => void }) {
  const d = useData();
  const targets = d.students.filter((s) => isTarget(t, s.sid));
  const total = targets.length;
  const allDone = targets.filter((s) => progressOf(t, d.statuses[s.sid]).all).length;
  const checks = checkItems(t);
  return (
    <Card className="p-5 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <Badge tone={t.due === today() ? 'brand' : 'neutral'}>{t.due === today() ? '오늘' : formatDay(t.due)}</Badge>
            {t.targets && <Badge>{t.targets.length}명에게</Badge>}
          </div>
          <h3 className="text-lg font-bold leading-snug break-words">{t.title}</h3>
        </div>
        <IconButton label="미션 고치기" onClick={onEdit}>
          <Pencil size={17} />
        </IconButton>
      </div>
      <ul className="space-y-1.5">
        {t.items.map((i) => {
          const done = i.check ? Math.min(d.live.done[markKey(t.id, i.id)] ?? 0, total) : 0;
          return (
            <li key={i.id} className={cx('flex items-start gap-2 text-[15px]', i.sub && 'pl-6')}>
              {i.check ? <SquareCheckBig size={18} className="text-brand-strong mt-0.5 shrink-0" aria-label="완료 체크" /> : <span className="w-[18px] text-center text-ink-3 shrink-0">•</span>}
              <span className="flex-1 min-w-0 break-words text-ink-2">{i.text}</span>
              {i.check && (
                <span className={cx('text-xs font-bold tabular-nums shrink-0 mt-0.5', total && done >= total ? 'text-ok' : 'text-ink-3')}>
                  {done}/{total}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {checks.length > 0 && (
        <div>
          <div className="flex justify-between text-xs font-semibold text-ink-3 mb-1.5">
            <span>모두 끝낸 학생</span>
            <span className="tabular-nums">
              {allDone}/{total}명
            </span>
          </div>
          <Progress value={allDone} max={total} tone={total && allDone >= total ? 'ok' : 'brand'} label={`${t.title} 모두 끝낸 학생`} />
        </div>
      )}
      <div className="flex flex-wrap gap-2 mt-auto pt-1">
        <Button size="sm" variant="soft" icon={<MonitorUp size={16} />} onClick={() => boardOrToast(d.classId, t.id)}>
          TV로 크게 보기
        </Button>
        <Button size="sm" variant="ghost" icon={<Pencil size={15} />} onClick={onEdit}>
          고치기
        </Button>
      </div>
    </Card>
  );
}

// 학생 × 완료 체크 칸 현황표 (선생님은 보기만)
function StatusBoard({ tasks, onlyTodo }: { tasks: Task[]; onlyTodo: boolean }) {
  const d = useData();
  const rows = d.students.filter((s) => !onlyTodo || tasks.some((t) => isTarget(t, s.sid) && !progressOf(t, d.statuses[s.sid]).all));
  if (d.students.length === 0)
    return (
      <Card>
        <Empty title="아직 학생이 없어요">학생이 참여하거나 ‘학급 관리’에서 명단을 넣으면 현황표가 생겨요.</Empty>
      </Card>
    );
  return (
    <Card className="overflow-hidden">
      <div className="overflow-auto max-h-[70dvh]">
        <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th rowSpan={2} className="sticky left-0 top-0 z-30 bg-surface border-b border-r border-line px-3 py-2 text-left font-semibold text-ink-3 w-32 align-bottom">
                학생
              </th>
              {tasks.map((t) => (
                <th key={t.id} colSpan={checkItems(t).length} className="sticky top-0 z-20 h-10 bg-surface border-b border-l border-line px-2 text-left">
                  <span className="font-bold text-ink">{t.title}</span>
                </th>
              ))}
            </tr>
            <tr>
              {tasks.flatMap((t) =>
                checkItems(t).map((i, n) => (
                  <th key={t.id + i.id} className={cx('sticky top-10 z-20 bg-surface border-b border-line px-1.5 py-1.5 text-xs font-semibold text-ink-2 min-w-20 max-w-32 align-bottom', n === 0 && 'border-l')}>
                    <span className="line-clamp-2 leading-tight" title={i.text}>
                      {i.text}
                    </span>
                    <span className="block text-ink-3 tabular-nums mt-0.5">{d.live.done[markKey(t.id, i.id)] ?? 0}명</span>
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.sid} className="group">
                <th className="sticky left-0 z-10 bg-surface group-hover:bg-surface-2 border-b border-r border-line px-3 py-1.5 text-left font-semibold whitespace-nowrap">
                  <span className="text-ink-3 tabular-nums mr-1.5">{s.number}</span>
                  <span className="pii">{d.privacy ? '' : s.name || '—'}</span>
                </th>
                {tasks.flatMap((t) =>
                  checkItems(t).map((i, n) => {
                    const on = counted(d.statuses[s.sid]?.tasks?.[markKey(t.id, i.id)]?.state);
                    return (
                      <td key={t.id + i.id} className={cx('border-b border-line px-1.5 py-1.5 group-hover:bg-surface-2/50', n === 0 && 'border-l')}>
                        {!isTarget(t, s.sid) ? (
                          <span className="block text-center text-ink-3/50">·</span>
                        ) : (
                          <span className={cx('h-8 rounded-lg flex items-center justify-center text-xs font-bold', on ? 'bg-ok-soft text-ok' : 'bg-surface-2/70 text-ink-3/60')} aria-label={on ? '완료' : '아직'}>
                            {on ? <Check size={16} strokeWidth={3} /> : '–'}
                          </span>
                        )}
                      </td>
                    );
                  })
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={1 + tasks.reduce((n, t) => n + checkItems(t).length, 0)} className="p-6 text-center text-ink-3">
                  모두 끝냈어요! 🎉
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function MissionEditor({ initial, onClose }: { initial: Partial<Task>; onClose: () => void }) {
  const d = useData();
  const [title, setTitle] = useState(initial.title || '');
  const [items, setItems] = useState<MissionItem[]>(initial.items?.length ? initial.items : [newItem('', true)]);
  const [due, setDue] = useState(initial.due || today());
  const [all, setAll] = useState(!initial.targets);
  const [targets, setTargets] = useState<string[]>(initial.targets || []);
  const [linkUrl, setLinkUrl] = useState(initial.linkUrl || '');
  const [asTemplate, setAsTemplate] = useState(false);
  const [bulk, setBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refs = useRef<Record<string, HTMLInputElement | null>>({});

  const patch = (id: string, p: Partial<MissionItem>) => setItems((list) => list.map((i) => (i.id === id ? { ...i, ...p } : i)));
  const addAfter = (idx: number, base?: MissionItem) => {
    const it = newItem('', base?.check ?? false, base?.sub ?? false);
    setItems((list) => [...list.slice(0, idx + 1), it, ...list.slice(idx + 1)]);
    setTimeout(() => refs.current[it.id]?.focus(), 0);
  };
  const move = (idx: number, dir: -1 | 1) =>
    setItems((list) => {
      const j = idx + dir;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });

  const save = async () => {
    const clean = items.map((i) => ({ ...i, text: i.text.trim() })).filter((i) => i.text);
    if (!title.trim()) return setError('미션 제목을 적어 주세요.');
    if (!clean.length) return setError('할 일을 한 줄 이상 적어 주세요.');
    if (!due) return setError('날짜를 골라 주세요.');
    const url = linkUrl ? normalizeUrl(linkUrl) : '';
    if (url && !isValidUrl(url)) return setError('바로가기 주소를 확인해 주세요.');
    if (!all && targets.length === 0) return setError('대상 학생을 한 명 이상 골라 주세요.');
    setBusy(true);
    setError('');
    try {
      const tg = all ? null : targets;
      const total = tg ? tg.length : d.students.length;
      const prev = initial.id ? d.tasks.find((t) => t.id === initial.id) : undefined;
      await d.api.saveTask(d.classId, { id: initial.id, createdAt: initial.createdAt, title: title.trim(), items: clean, due, targets: tg, linkUrl: url }, total, prev);
      if (asTemplate) await d.api.saveTemplate(d.classId, { title: title.trim(), items: clean, linkUrl: url });
      toast(initial.id ? '미션을 고쳤어요.' : '미션을 만들었어요.');
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
      title={initial.id ? '미션 고치기' : '미션 추가'}
      footer={
        <>
          {initial.id && (
            <Button
              variant="danger"
              icon={<Trash2 size={16} />}
              className="mr-auto"
              onClick={async () => {
                const t = d.tasks.find((x) => x.id === initial.id);
                if (!t || !confirm(`‘${t.title}’ 미션과 학생들의 체크 기록을 지울까요?`)) return;
                await d.api.deleteTask(d.classId, t).catch((e) => toast(errorMessage(e)));
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
      <div className="space-y-5">
        <div className="grid sm:grid-cols-[1fr_auto] gap-4">
          <Field label="미션 제목">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} placeholder="예: 11월 27일 오늘의 미션" autoFocus={!initial.id} />
          </Field>
          <Field label="날짜">
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            <div className="flex gap-1.5 mt-2">
              {[
                ['오늘', 0],
                ['내일', 1]
              ].map(([l, n]) => (
                <button key={l} type="button" onClick={() => setDue(addDays(today(), n as number))} className="h-8 px-2.5 rounded-lg border border-line text-xs font-semibold text-ink-2 hover:bg-surface-2 cursor-pointer">
                  {l}
                </button>
              ))}
            </div>
          </Field>
        </div>

        <div>
          <div className="flex items-end justify-between gap-2 mb-2">
            <div>
              <span className="block text-sm font-semibold text-ink-2">할 일</span>
              <span className="block text-xs text-ink-3 mt-0.5">
                <SquareCheckBig size={12} className="inline -mt-0.5" /> 완료 체크를 켠 줄만 학생이 체크해요. <CornerDownRight size={12} className="inline -mt-0.5" /> 는 윗줄에 딸린 줄로 들여 써요.
              </span>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setBulk(!bulk)}>
              {bulk ? '닫기' : '여러 줄 한 번에'}
            </Button>
          </div>

          {bulk && (
            <div className="mb-3 rounded-xl border border-line bg-surface-2/60 p-3 space-y-2">
              <Textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={6}
                placeholder={'오늘 시간표 확인, 교과서 준비 (체크)\n우유당번 우유배달\n도서관은 40분까지 다녀오기!\n아침시간 할 것\n  조용히 독서, 알공수학, 엔트리 만들기 (체크)\n  수학 4단원, 과학 3단원 복습하기'}
                className="font-mono text-sm"
              />
              <p className="text-xs text-ink-3">한 줄이 한 칸이 돼요. 줄 끝에 ‘(체크)’를 붙이면 완료 체크 줄, 줄 앞을 띄우거나 ‘-’를 붙이면 딸린 줄이 돼요.</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={!bulkText.trim()}
                  onClick={() => {
                    const parsed = parseLines(bulkText);
                    setItems((list) => [...list.filter((i) => i.text.trim()), ...parsed]);
                    setBulkText('');
                    setBulk(false);
                  }}
                >
                  {parseLines(bulkText).length}줄 넣기
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {items.map((it, idx) => (
              <div key={it.id} className={cx('flex items-center gap-1.5', it.sub && 'pl-5 sm:pl-8')}>
                <IconButton label={it.sub ? '들여쓰기 풀기' : '딸린 줄로 들여쓰기'} onClick={() => patch(it.id, { sub: !it.sub })} className={cx('w-9 h-11', it.sub && 'text-brand-strong bg-brand-soft')}>
                  <CornerDownRight size={16} />
                </IconButton>
                <Input
                  ref={(el) => {
                    refs.current[it.id] = el;
                  }}
                  value={it.text}
                  onChange={(e) => patch(it.id, { text: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      addAfter(idx, it);
                    }
                    if (e.key === 'Backspace' && !it.text && items.length > 1) {
                      e.preventDefault();
                      const prev = items[idx - 1] || items[idx + 1];
                      setItems((list) => list.filter((x) => x.id !== it.id));
                      setTimeout(() => refs.current[prev.id]?.focus(), 0);
                    }
                  }}
                  onPaste={(e) => {
                    const text = e.clipboardData.getData('text');
                    if (!text.includes('\n')) return;
                    e.preventDefault();
                    const parsed = parseLines(text);
                    setItems((list) => [...list.slice(0, idx), ...(it.text.trim() ? [it] : []), ...parsed, ...list.slice(idx + 1)]);
                  }}
                  maxLength={120}
                  placeholder={idx === 0 ? '예: 오늘 시간표 확인, 교과서 준비' : '할 일'}
                  aria-label={`${idx + 1}번째 줄`}
                  className="flex-1 min-w-0"
                />
                <button
                  type="button"
                  onClick={() => patch(it.id, { check: !it.check })}
                  aria-pressed={it.check}
                  title="학생이 완료 체크하는 줄"
                  className={cx('h-11 shrink-0 rounded-xl border px-2.5 flex items-center gap-1.5 text-sm font-semibold cursor-pointer transition', it.check ? 'border-brand bg-brand-soft text-brand-strong' : 'border-line text-ink-3 hover:border-line-strong')}
                >
                  <span className={cx('w-5 h-5 rounded-md border-2 flex items-center justify-center', it.check ? 'bg-brand border-brand text-white' : 'border-line-strong')}>{it.check && <Check size={13} strokeWidth={3.5} />}</span>
                  <span className="hidden sm:inline">완료 체크</span>
                </button>
                <div className="hidden sm:flex">
                  <IconButton label="위로" className="w-8" onClick={() => move(idx, -1)} disabled={idx === 0}>
                    <ArrowUp size={15} />
                  </IconButton>
                  <IconButton label="아래로" className="w-8" onClick={() => move(idx, 1)} disabled={idx === items.length - 1}>
                    <ArrowDown size={15} />
                  </IconButton>
                </div>
                <IconButton label="줄 지우기" className="w-9" onClick={() => setItems((list) => (list.length > 1 ? list.filter((x) => x.id !== it.id) : [newItem()]))}>
                  <X size={16} />
                </IconButton>
              </div>
            ))}
          </div>
          <Button size="sm" variant="ghost" icon={<Plus size={15} />} className="mt-2" onClick={() => addAfter(items.length - 1)}>
            줄 추가
          </Button>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="관련 바로가기 (선택)">
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
          <div className="flex flex-col items-start gap-3 sm:pt-8">
            <Switch checked={!all} onChange={(v) => setAll(!v)} label="일부 학생에게만" />
            {!initial.id && <Switch checked={asTemplate} onChange={setAsTemplate} label="템플릿으로도 저장" />}
          </div>
        </div>
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
      <SectionTitle icon={<BookmarkPlus size={18} />} title="미션 템플릿" sub="자주 내는 미션을 눌러 바로 만들어요." />
      {list.length === 0 ? (
        <p className="text-sm text-ink-3">미션을 만들 때 ‘템플릿으로도 저장’을 켜면 여기에 생겨요.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {list.map((t) => (
            <span key={t.id} className="inline-flex items-center rounded-xl border border-line bg-surface shadow-card">
              <button type="button" onClick={() => onUse(t)} className="h-10 pl-3.5 pr-2 text-sm font-semibold flex items-center gap-1.5 cursor-pointer hover:text-brand-strong">
                <Plus size={15} />
                {t.title}
                <Badge className="h-5 px-1.5">{t.items.length}줄</Badge>
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
