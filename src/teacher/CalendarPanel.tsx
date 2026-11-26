import { useState } from 'react';
import { CalendarDays, Pencil, Plus, Trash2 } from 'lucide-react';
import { errorMessage } from '../lib/cloud';
import { formatDay, today } from '../lib/dates';
import { CalEvent, EVENT_KINDS } from '../lib/types';
import { Button, Card, ErrorNote, Field, IconButton, Input, Modal, SectionTitle, Select, cx, toast } from '../ui/kit';
import { KIND_TONE, MonthGrid, itemsByDay, monthRange } from '../ui/calendar';
import { useSchoolSchedule } from '../ui/school';
import { useData } from './data';

export default function CalendarPanel() {
  const d = useData();
  const [month, setMonth] = useState(today().slice(0, 7));
  const [selected, setSelected] = useState(today());
  const [edit, setEdit] = useState<Partial<CalEvent> | null>(null);
  const { from, to } = monthRange(month);
  const school = useSchoolSchedule(d.school, from, to);
  const byDay = itemsByDay(d.events, school);
  const dayItems = byDay[selected] || [];

  return (
    <div className="space-y-6">
      <SectionTitle
        icon={<CalendarDays size={20} />}
        title={<span className="text-2xl">학급 달력</span>}
        sub={d.school ? '우리 반 일정과 나이스 학사일정이 함께 보여요. 학생 화면에도 그대로 보여요.' : '우리 반 일정을 넣으면 학생 화면에 보여요. 학급 관리에서 학교를 정하면 학사일정도 함께 보여요.'}
        action={
          <Button icon={<Plus size={18} />} onClick={() => setEdit({ date: selected, end: selected, kind: '행사' })}>
            일정 추가
          </Button>
        }
      />
      <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        <Card className="p-3 sm:p-5">
          <MonthGrid month={month} setMonth={setMonth} byDay={byDay} selected={selected} onSelect={(k) => (setSelected(k), setMonth(k.slice(0, 7)))} />
        </Card>
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="font-bold flex-1">{formatDay(selected)}</h3>
            <Button size="sm" variant="soft" icon={<Plus size={15} />} onClick={() => setEdit({ date: selected, end: selected, kind: '행사' })}>
              추가
            </Button>
          </div>
          {dayItems.length === 0 ? (
            <p className="text-sm text-ink-3">일정이 없어요.</p>
          ) : (
            <ul className="space-y-2">
              {dayItems.map((x) => (
                <li key={x.id} className="flex items-center gap-2 rounded-xl border border-line p-2.5">
                  <span className={cx('text-xs font-bold rounded-md px-1.5 py-0.5 shrink-0', KIND_TONE[x.kind] || KIND_TONE.기타)}>{x.kind}</span>
                  <span className="flex-1 min-w-0 font-semibold break-words">{x.title}</span>
                  {x.event && (
                    <IconButton label="고치기" onClick={() => setEdit(x.event!)}>
                      <Pencil size={15} />
                    </IconButton>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      {edit && <EventEditor initial={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function EventEditor({ initial, onClose }: { initial: Partial<CalEvent>; onClose: () => void }) {
  const d = useData();
  const [title, setTitle] = useState(initial.title || '');
  const [date, setDate] = useState(initial.date || today());
  const [end, setEnd] = useState(initial.end || initial.date || today());
  const [kind, setKind] = useState(initial.kind || '행사');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    if (!title.trim()) return setError('일정 이름을 적어 주세요.');
    setBusy(true);
    try {
      await d.api.saveEvent(d.classId, { id: initial.id, title: title.trim(), date, end: end < date ? date : end, kind });
      toast(initial.id ? '일정을 고쳤어요.' : '일정을 넣었어요.');
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
      title={initial.id ? '일정 고치기' : '일정 추가'}
      footer={
        <>
          {initial.id && (
            <Button
              variant="danger"
              icon={<Trash2 size={16} />}
              className="mr-auto"
              onClick={async () => {
                if (!confirm(`‘${initial.title}’ 일정을 지울까요?`)) return;
                await d.api.deleteEvent(d.classId, initial.id!).catch((e) => toast(errorMessage(e)));
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
      <form className="space-y-4" onSubmit={(e) => (e.preventDefault(), save())}>
        <Field label="일정 이름">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} placeholder="예: 현장체험학습" autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="시작">
            <Input type="date" value={date} onChange={(e) => (setDate(e.target.value), end < e.target.value && setEnd(e.target.value))} />
          </Field>
          <Field label="끝 (하루면 같게)">
            <Input type="date" value={end} min={date} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>
        <Field label="종류">
          <Select value={kind} onChange={(e) => setKind(e.target.value)}>
            {EVENT_KINDS.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </Select>
        </Field>
        <ErrorNote>{error}</ErrorNote>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
