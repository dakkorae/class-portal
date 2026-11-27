import { useMemo, useRef, useState } from 'react';
import DateNav from '../ui/DateNav';
import { ArrowDown, ArrowUp, BookmarkPlus, Check, CornerDownRight, ListChecks, Megaphone, Pencil, Plus, SquareCheckBig, Trash2, Users, X } from 'lucide-react';
import { counted } from '../lib/api';
import { errorMessage } from '../lib/cloud';
import { addDays, formatDay, today } from '../lib/dates';
import { newItem, parseLines, progressOf } from '../lib/mission';
import { isTarget } from '../lib/visible';
import { MissionItem, Task, TaskTemplate, checkItems, itemFor, markKey } from '../lib/types';
import { Badge, Button, Card, Empty, ErrorNote, Field, IconButton, Input, Modal, Progress, SectionTitle, Select, Switch, Textarea, cx, isValidUrl, normalizeUrl, toast } from '../ui/kit';
import { useData } from './data';
import { FormatBar, Rich, plainText } from '../ui/RichText';

// 줄 하나를 할 학생 수 (미션 대상과 줄 대상이 모두 맞는 학생)
const itemTotal = (t: Task, i: MissionItem, sids: string[]) => sids.filter((sid) => isTarget(t, sid) && itemFor(i, sid)).length;

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
        title={<span className="text-2xl">공지 및 미션</span>}
        sub="날짜마다 학생에게 안내할 내용(공지)과 할 일(미션)을 함께 올려요. 미션 줄마다 일부 학생에게만 줄 수도 있어요."
        action={
          <Button icon={<Plus size={18} />} onClick={() => setEdit({ due: day, targets: null, notice: '', items: [newItem('', true)] })}>
            공지·미션 올리기
          </Button>
        }
      />

      <DateNav value={day} onChange={setDay} marked={marked} />

      {shown.length === 0 ? (
        <Card>
          <Empty icon={<ListChecks size={22} />} title={`${formatDay(day)} 공지·미션이 없어요`}>
            ‘공지·미션 올리기’로 이날 안내할 내용과 할 일을 올려 보세요.
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

      <TemplatesCard onUse={(tpl) => setEdit({ title: tpl.title, notice: tpl.notice || '', items: tpl.items.map((i) => newItem(i.text, i.check, i.sub)), linkUrl: tpl.linkUrl, due: day, targets: null })} />

      {edit && <MissionEditor initial={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function MissionCard({ task: t, onEdit }: { task: Task; onEdit: () => void }) {
  const d = useData();
  const sids = d.students.map((s) => s.sid);
  const targets = d.students.filter((s) => isTarget(t, s.sid) && progressOf(t, undefined, s.sid).total > 0);
  const total = targets.length;
  const allDone = targets.filter((s) => progressOf(t, d.statuses[s.sid], s.sid).all).length;
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
        <IconButton label="고치기" onClick={onEdit}>
          <Pencil size={17} />
        </IconButton>
      </div>
      {t.notice && (
        <div className="rounded-xl bg-brand-soft/60 border border-line p-3">
          <p className="text-xs font-bold text-brand-strong flex items-center gap-1 mb-1">
            <Megaphone size={13} /> 공지
          </p>
          <p className="text-[15px] text-ink-2 whitespace-pre-wrap break-words"><Rich text={t.notice} /></p>
        </div>
      )}
      <ul className="space-y-1.5">
        {t.items.map((i) => {
          const tot = itemTotal(t, i, sids);
          const done = i.check ? Math.min(d.live.done[markKey(t.id, i.id)] ?? 0, tot) : 0;
          return (
            <li key={i.id} className={cx('flex items-start gap-2 text-[15px]', i.sub && 'pl-6')}>
              {i.check ? <SquareCheckBig size={18} className="text-brand-strong mt-0.5 shrink-0" aria-label="완료 체크" /> : <span className="w-[18px] text-center text-ink-3 shrink-0">•</span>}
              <span className="flex-1 min-w-0 break-words text-ink-2">
                <Rich text={i.text} />
                {i.targets && (
                  <span className="ml-1.5 inline-flex items-center gap-0.5 text-[11px] font-bold text-brand-strong bg-brand-soft rounded-full px-1.5 py-0.5 align-middle">
                    <Users size={11} /> {i.targets.length}명
                  </span>
                )}
              </span>
              {i.check && (
                <span className={cx('text-xs font-bold tabular-nums shrink-0 mt-0.5', tot && done >= tot ? 'text-ok' : 'text-ink-3')}>
                  {done}/{tot}
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
  const rows = d.students.filter((s) => !onlyTodo || tasks.some((t) => isTarget(t, s.sid) && progressOf(t, undefined, s.sid).total > 0 && !progressOf(t, d.statuses[s.sid], s.sid).all));
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
                    <span className="line-clamp-2 leading-tight" title={plainText(i.text)}>
                      {plainText(i.text)}
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
                        {!isTarget(t, s.sid) || !itemFor(i, s.sid) ? (
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
  const [notice, setNotice] = useState(initial.notice || '');
  const [items, setItems] = useState<MissionItem[]>(initial.items?.length ? initial.items : [newItem('', true)]);
  const [due, setDue] = useState(initial.due || today());
  const [picking, setPicking] = useState<MissionItem | null>(null);
  const [linkUrl, setLinkUrl] = useState(initial.linkUrl || '');
  const [asTemplate, setAsTemplate] = useState(false);
  const [bulk, setBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refs = useRef<Record<string, HTMLInputElement | null>>({});
  // 꾸미기 막대가 감쌀 칸: 마지막으로 누른 공지 칸 또는 미션 줄
  const lastField = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const noticeRef = useRef<HTMLTextAreaElement | null>(null);

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
    const clean = items.map((i) => ({ ...i, text: i.text.trim(), targets: i.targets && i.targets.length ? i.targets : null })).filter((i) => i.text);
    if (!title.trim()) return setError('제목을 적어 주세요.');
    if (!clean.length && !notice.trim()) return setError('공지 내용이나 미션을 한 줄 이상 적어 주세요.');
    if (!due) return setError('날짜를 골라 주세요.');
    const url = linkUrl ? normalizeUrl(linkUrl) : '';
    if (url && !isValidUrl(url)) return setError('바로가기 주소를 확인해 주세요.');
    setBusy(true);
    setError('');
    try {
      const tg = initial.targets || null; // 예전 자료의 미션 전체 대상은 그대로 둠
      const total = tg ? tg.length : d.students.length;
      const prev = initial.id ? d.tasks.find((t) => t.id === initial.id) : undefined;
      await d.api.saveTask(d.classId, { id: initial.id, createdAt: initial.createdAt, title: title.trim(), notice: notice.trim(), items: clean, due, targets: tg, linkUrl: url }, total, prev);
      if (asTemplate) await d.api.saveTemplate(d.classId, { title: title.trim(), notice: notice.trim(), items: clean.map((i) => ({ ...i, targets: null })), linkUrl: url });
      toast(initial.id ? '공지·미션을 고쳤어요.' : '공지·미션을 올렸어요.');
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
      title={initial.id ? '공지·미션 고치기' : '공지·미션 올리기'}
      footer={
        <>
          {initial.id && (
            <Button
              variant="danger"
              icon={<Trash2 size={16} />}
              className="mr-auto"
              onClick={async () => {
                const t = d.tasks.find((x) => x.id === initial.id);
                if (!t || !confirm(`‘${t.title}’과(와) 학생들의 체크 기록을 지울까요?`)) return;
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
      <div
        className="space-y-5"
        onFocusCapture={(e) => {
          const el = e.target as HTMLElement;
          if (el.dataset.rich) lastField.current = el as HTMLInputElement | HTMLTextAreaElement;
        }}
      >
        <div className="grid sm:grid-cols-[1fr_auto] gap-4">
          <Field label="제목">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} placeholder="예: 11월 27일 알림장" autoFocus={!initial.id} />
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

        <div className="sticky -top-4 z-10 -mx-5 px-5 py-2 bg-surface border-b border-line shadow-sm">
          <FormatBar
            getTarget={() => lastField.current || noticeRef.current}
            onApply={(el, value) => {
              const id = el.dataset.rich;
              if (id === 'notice') setNotice(value.slice(0, 2000));
              else if (id) patch(id, { text: value.slice(0, 200) });
            }}
          />
        </div>
        <Field label={<span className="flex items-center gap-1.5"><Megaphone size={15} className="text-brand-strong" /> 공지 (학생에게 안내할 내용, 선택)</span>}>
          <Textarea ref={noticeRef} data-rich="notice" value={notice} onChange={(e) => setNotice(e.target.value)} rows={4} maxLength={2000} placeholder={'예: 내일은 체육복을 입고 와요.\n준비물: 색연필, 가위'} />
        </Field>

        <div>
          <div className="flex items-end justify-between gap-2 mb-2">
            <div>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-ink-2"><ListChecks size={15} className="text-brand-strong" /> 미션 (할 일, 선택)</span>
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
                  data-rich={it.id}
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
                  maxLength={200}
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
                <button
                  type="button"
                  onClick={() => setPicking(it)}
                  title="이 줄을 할 학생 고르기"
                  className={cx('h-11 shrink-0 rounded-xl border px-2.5 flex items-center gap-1 text-sm font-semibold cursor-pointer transition', it.targets?.length ? 'border-brand bg-brand-soft text-brand-strong' : 'border-line text-ink-3 hover:border-line-strong')}
                >
                  <Users size={15} />
                  <span className="whitespace-nowrap">{it.targets?.length ? `${it.targets.length}명` : '전체'}</span>
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

        {(notice.trim() || items.some((i) => i.text.trim())) && (
          <div className="rounded-xl border border-dashed border-line-strong p-3.5">
            <p className="text-xs font-bold text-ink-3 mb-2">학생에게 보이는 모습 (미리보기)</p>
            {notice.trim() && (
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words mb-2">
                <Rich text={notice} />
              </p>
            )}
            <ul className="space-y-1">
              {items
                .filter((i) => i.text.trim())
                .map((i) => (
                  <li key={i.id} className={cx('flex items-start gap-2 text-[15px]', i.sub && 'pl-6')}>
                    {i.check ? <SquareCheckBig size={17} className="text-brand-strong mt-0.5 shrink-0" /> : <span className="w-[17px] text-center text-ink-3 shrink-0">•</span>}
                    <Rich text={i.text} className="break-words min-w-0" />
                  </li>
                ))}
            </ul>
          </div>
        )}

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
            {!initial.id && <Switch checked={asTemplate} onChange={setAsTemplate} label="템플릿으로도 저장" />}
          </div>
        </div>
        <ErrorNote>{error}</ErrorNote>
      </div>
      {picking && (
        <ItemTargets
          item={picking}
          onClose={() => setPicking(null)}
          onSave={(tg) => {
            patch(picking.id, { targets: tg });
            setPicking(null);
          }}
        />
      )}
    </Modal>
  );
}

// 미션 줄 하나를 할 학생 고르기 (아무도 안 고르면 전체)
function ItemTargets({ item, onClose, onSave }: { item: MissionItem; onClose: () => void; onSave: (t: string[] | null) => void }) {
  const d = useData();
  const [sel, setSel] = useState<string[]>(item.targets || []);
  return (
    <Modal
      open
      onClose={onClose}
      title="이 줄을 할 학생"
      footer={
        <>
          <Button variant="ghost" className="mr-auto" onClick={() => onSave(null)}>
            전체 학생으로
          </Button>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button onClick={() => onSave(sel.length ? sel : null)}>{sel.length ? `${sel.length}명 저장` : '전체로 저장'}</Button>
        </>
      }
    >
      <p className="text-sm text-ink-2 mb-3 break-words">‘{item.text || '(빈 줄)'}’</p>
      {d.students.length === 0 ? (
        <p className="text-ink-3">학급 관리에서 학생 명단을 먼저 넣어 주세요.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-[50dvh] overflow-y-auto p-0.5">
          {d.students.map((s) => {
            const on = sel.includes(s.sid);
            return (
              <button
                key={s.sid}
                type="button"
                onClick={() => setSel(on ? sel.filter((x) => x !== s.sid) : [...sel, s.sid])}
                aria-pressed={on}
                className={cx('h-11 px-2 rounded-xl border text-sm font-semibold truncate cursor-pointer transition', on ? 'border-brand bg-brand-soft text-brand-strong' : 'border-line text-ink-2 hover:border-line-strong')}
              >
                <span className="tabular-nums mr-1">{s.number}</span>
                <span className="pii">{d.privacy ? '' : s.name}</span>
              </button>
            );
          })}
        </div>
      )}
      <p className="text-xs text-ink-3 mt-3">아무도 고르지 않으면 반 전체가 해요.</p>
    </Modal>
  );
}

function TemplatesCard({ onUse }: { onUse: (t: TaskTemplate) => void }) {
  const d = useData();
  const list = d.templates;
  return (
    <section>
      <SectionTitle icon={<BookmarkPlus size={18} />} title="템플릿" sub="자주 올리는 공지·미션을 눌러 바로 만들어요." />
      {list.length === 0 ? (
        <p className="text-sm text-ink-3">공지·미션을 올릴 때 ‘템플릿으로도 저장’을 켜면 여기에 생겨요.</p>
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
