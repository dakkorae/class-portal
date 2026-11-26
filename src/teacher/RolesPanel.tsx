import { useState } from 'react';
import { ChevronLeft, ChevronRight, ClipboardCopy, Eraser, Plus, Trash2, UserPlus, UsersRound, X } from 'lucide-react';
import { errorMessage } from '../lib/cloud';
import { addDays, formatDay } from '../lib/dates';
import { randomId } from '../lib/hash';
import { ROLE_PRESETS, mondayOf } from '../lib/roles';
import { Role, RolesDoc } from '../lib/types';
import { Button, Card, Empty, IconButton, Input, Modal, SectionTitle, cx, toast } from '../ui/kit';
import { useData } from './data';

// 1인1역: 역할을 만들고, 주마다 선생님이 역할별 학생을 직접 배정
export default function RolesPanel() {
  const d = useData();
  const doc: RolesDoc = d.roles || { items: [], weeks: {} };
  const [week, setWeek] = useState(mondayOf());
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('⭐');
  const [picking, setPicking] = useState<Role | null>(null);
  const thisWeek = mondayOf();
  const assign = doc.weeks[week] || {};
  const prevAssign = doc.weeks[addDays(week, -7)] || {};

  const save = async (next: Partial<RolesDoc>, msg?: string) => {
    try {
      await d.api.saveRoles(d.classId, { items: doc.items, weeks: doc.weeks, ...next });
      if (msg) toast(msg);
    } catch (e) {
      toast(errorMessage(e));
    }
  };
  const setWeekAssign = (a: Record<string, string[]>, msg?: string) => save({ weeks: { ...doc.weeks, [week]: a } }, msg);
  const addRole = (r: Omit<Role, 'id'>) => {
    if (!r.name.trim()) return;
    if (doc.items.some((x) => x.name === r.name.trim())) return toast('이미 있는 역할이에요.');
    save({ items: [...doc.items, { id: randomId(), name: r.name.trim().slice(0, 20), icon: r.icon }] });
  };

  const assigned = new Set(Object.values(assign).flat());
  const unassigned = d.students.filter((s) => !assigned.has(s.sid));
  const label = (sid: string) => (d.privacy ? `${Number(sid.slice(1))}번` : `${Number(sid.slice(1))} ${d.students.find((s) => s.sid === sid)?.name || ''}`.trim());

  return (
    <div className="space-y-6">
      <SectionTitle
        icon={<UsersRound size={20} />}
        title={<span className="text-2xl">1인1역</span>}
        sub="역할을 만들고, 주마다 맡을 학생을 직접 정해요. 학생 홈에는 ‘이번 주 내 역할’이 보여요."
        action={
          doc.items.length > 0 && (
            <Button
              variant="danger"
              size="sm"
              icon={<Trash2 size={15} />}
              onClick={() => confirm('역할과 모든 주의 배정을 전부 지울까요? 되돌릴 수 없어요.') && save({ items: [], weeks: {} }, '역할을 모두 지웠어요.')}
            >
              역할 전체 삭제
            </Button>
          )
        }
      />

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6 items-start">
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <IconButton label="지난주" onClick={() => setWeek(addDays(week, -7))} className="rounded-full bg-surface border border-line">
              <ChevronLeft size={18} />
            </IconButton>
            <span className="h-10 px-4 rounded-full bg-surface border border-line flex items-center font-bold">
              {formatDay(week)} ~ {formatDay(addDays(week, 4)).replace(/^\d+월 /, '')}
              {week === thisWeek && <span className="ml-2 text-xs font-bold text-brand-strong bg-brand-soft rounded-full px-2 py-0.5">이번 주</span>}
            </span>
            <IconButton label="다음 주" onClick={() => setWeek(addDays(week, 7))} className="rounded-full bg-surface border border-line">
              <ChevronRight size={18} />
            </IconButton>
            {week !== thisWeek && (
              <button type="button" onClick={() => setWeek(thisWeek)} className="h-10 px-3.5 rounded-full bg-brand-soft text-brand-strong text-sm font-bold cursor-pointer">
                이번 주로
              </button>
            )}
          </div>

          {doc.items.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                icon={<ClipboardCopy size={15} />}
                disabled={!Object.keys(prevAssign).length}
                onClick={() => (!Object.keys(assign).length || confirm('이 주에 이미 정한 배정을 지난주 배정으로 바꿀까요?')) && setWeekAssign(prevAssign, '지난주 배정을 가져왔어요.')}
              >
                지난주 배정 가져오기
              </Button>
              <Button size="sm" variant="ghost" icon={<Eraser size={15} />} disabled={!Object.keys(assign).length} onClick={() => confirm('이 주의 배정을 모두 비울까요?') && setWeekAssign({}, '이 주 배정을 비웠어요.')}>
                이 주 배정 비우기
              </Button>
            </div>
          )}

          {doc.items.length === 0 ? (
            <Card>
              <Empty icon={<UsersRound size={22} />} title="아직 역할이 없어요">
                오른쪽에서 역할을 고르거나 직접 만들어 보세요.
              </Empty>
            </Card>
          ) : (
            <Card className="divide-y divide-line">
              {doc.items.map((r) => {
                const sids = assign[r.id] || [];
                return (
                  <div key={r.id} className="p-3 sm:p-4 flex items-center gap-3">
                    <span className="w-11 h-11 rounded-2xl bg-surface-2 border border-line flex items-center justify-center text-2xl shrink-0" aria-hidden>
                      {r.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate">{r.name}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {sids.map((sid) => (
                          <span key={sid} className="inline-flex items-center gap-1 h-8 pl-3 pr-1 rounded-full bg-brand-soft text-brand-strong text-sm font-bold">
                            <span className="pii">{label(sid)}</span>
                            <button
                              type="button"
                              aria-label={`${label(sid)} 빼기`}
                              onClick={() => setWeekAssign({ ...assign, [r.id]: sids.filter((x) => x !== sid) })}
                              className="w-6 h-6 rounded-full hover:bg-surface flex items-center justify-center cursor-pointer"
                            >
                              <X size={13} />
                            </button>
                          </span>
                        ))}
                        <button type="button" onClick={() => setPicking(r)} className="h-8 px-3 rounded-full border border-dashed border-line-strong text-sm font-semibold text-ink-3 hover:border-brand hover:text-brand-strong flex items-center gap-1 cursor-pointer">
                          <UserPlus size={14} /> 학생
                        </button>
                      </div>
                    </div>
                    <IconButton label={`${r.name} 역할 지우기`} onClick={() => confirm(`‘${r.name}’ 역할을 지울까요?`) && save({ items: doc.items.filter((x) => x.id !== r.id) })}>
                      <Trash2 size={16} />
                    </IconButton>
                  </div>
                );
              })}
            </Card>
          )}
          {doc.items.length > 0 && d.students.length > 0 && (
            <p className="text-sm text-ink-3">
              {unassigned.length ? (
                <>
                  이 주에 역할이 없는 학생 {unassigned.length}명: <span className="pii">{unassigned.map((s) => s.number).join(', ')}번</span>
                </>
              ) : (
                '모든 학생이 역할을 맡았어요. 🎉'
              )}
            </p>
          )}
        </section>

        <section className="space-y-3">
          <Card className="p-5 space-y-3">
            <h3 className="font-bold">역할 직접 만들기</h3>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                addRole({ name, icon });
                setName('');
              }}
            >
              <div className="w-14 shrink-0">
                <Input value={icon} onChange={(e) => setIcon(Array.from(e.target.value).slice(-2).join('') || '⭐')} className="text-center text-xl px-0" aria-label="역할 그림" />
              </div>
              <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="예: 우유 당번" aria-label="역할 이름" />
              <Button type="submit" icon={<Plus size={16} />} disabled={!name.trim()}>
                추가
              </Button>
            </form>
          </Card>
          <Card className="p-5 space-y-3">
            <h3 className="font-bold">자주 쓰는 역할</h3>
            <div className="flex flex-wrap gap-1.5">
              {ROLE_PRESETS.map((p) => {
                const have = doc.items.some((x) => x.name === p.name);
                return (
                  <button
                    key={p.name}
                    type="button"
                    disabled={have}
                    onClick={() => addRole(p)}
                    className={cx('h-10 px-3 rounded-xl border text-sm font-semibold flex items-center gap-1.5 transition cursor-pointer', have ? 'border-brand/30 bg-brand-soft text-brand-strong cursor-default' : 'border-line hover:border-brand hover:bg-brand-soft')}
                  >
                    <span aria-hidden>{p.icon}</span>
                    {p.name}
                  </button>
                );
              })}
            </div>
          </Card>
        </section>
      </div>

      {picking && (
        <PickStudents
          role={picking}
          selected={assign[picking.id] || []}
          others={assigned}
          onClose={() => setPicking(null)}
          onSave={(sids) => {
            setWeekAssign({ ...assign, [picking.id]: sids });
            setPicking(null);
          }}
        />
      )}
    </div>
  );
}

// 역할을 맡을 학생 고르기 (여러 명 가능). 다른 역할을 맡은 학생은 옅게 표시
function PickStudents({ role, selected, others, onClose, onSave }: { role: Role; selected: string[]; others: Set<string>; onClose: () => void; onSave: (sids: string[]) => void }) {
  const d = useData();
  const [sel, setSel] = useState<string[]>(selected);
  return (
    <Modal
      open
      onClose={onClose}
      title={`${role.icon} ${role.name} 맡을 학생`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button onClick={() => onSave(sel)}>{sel.length}명 저장</Button>
        </>
      }
    >
      {d.students.length === 0 ? (
        <p className="text-ink-3">학급 관리에서 학생 명단을 먼저 넣어 주세요.</p>
      ) : (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-[55dvh] overflow-y-auto p-0.5">
            {d.students.map((s) => {
              const on = sel.includes(s.sid);
              const busy = !on && others.has(s.sid) && !selected.includes(s.sid);
              return (
                <button
                  key={s.sid}
                  type="button"
                  onClick={() => setSel(on ? sel.filter((x) => x !== s.sid) : [...sel, s.sid])}
                  aria-pressed={on}
                  className={cx('h-11 px-2 rounded-xl border text-sm font-semibold truncate cursor-pointer transition', on ? 'border-brand bg-brand-soft text-brand-strong' : busy ? 'border-line text-ink-3/60' : 'border-line text-ink-2 hover:border-line-strong')}
                >
                  <span className="tabular-nums mr-1">{s.number}</span>
                  <span className="pii">{d.privacy ? '' : s.name}</span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-ink-3 mt-3">옅은 칸은 이 주에 이미 다른 역할을 맡은 학생이에요. 그래도 고를 수 있어요.</p>
        </>
      )}
    </Modal>
  );
}
