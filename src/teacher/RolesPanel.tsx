import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Shuffle, Trash2, UsersRound } from 'lucide-react';
import { errorMessage } from '../lib/cloud';
import { addDays, formatDay, today } from '../lib/dates';
import { randomId } from '../lib/hash';
import { ROLE_PRESETS, assignments, effectiveOrder, mondayOf } from '../lib/roles';
import { Role, RolesDoc } from '../lib/types';
import { Button, Card, Empty, IconButton, Input, SectionTitle, Segmented, cx, toast } from '../ui/kit';
import { useData } from './data';

export default function RolesPanel() {
  const d = useData();
  const sids = d.students.map((s) => s.sid);
  const doc: RolesDoc = d.roles || { items: [], order: [], start: mondayOf(), shift: 0 };
  const order = effectiveOrder(doc.order, sids);
  const orderChanged = order.join() !== doc.order.join();
  const [week, setWeek] = useState<'0' | '1'>('0');
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('⭐');

  const save = async (next: Partial<RolesDoc>, msg?: string) => {
    try {
      await d.api.saveRoles(d.classId, { ...doc, start: doc.start || mondayOf(), order, ...next });
      if (msg) toast(msg);
    } catch (e) {
      toast(errorMessage(e));
    }
  };
  const addRole = (r: Omit<Role, 'id'>) => {
    if (!r.name.trim()) return;
    if (doc.items.some((x) => x.name === r.name.trim())) return toast('이미 있는 역할이에요.');
    save({ items: [...doc.items, { id: randomId(), name: r.name.trim().slice(0, 20), icon: r.icon }] });
  };

  const live = { ...doc, order };
  const map = assignments(live, Number(week));
  const monday = addDays(mondayOf(), Number(week) * 7);
  const nameOf = (sid?: string) => (sid ? d.nameOf(sid) : '—');
  const numOf = (sid?: string) => (sid ? Number(sid.slice(1)) : 0);

  return (
    <div className="space-y-6">
      <SectionTitle
        icon={<UsersRound size={20} />}
        title={<span className="text-2xl">1인1역</span>}
        sub="매주 월요일마다 역할이 다음 번호 학생에게 한 칸씩 넘어가요. 학생 홈에는 ‘이번 주 내 역할’이 보여요."
      />

      {orderChanged && d.students.length > 0 && doc.items.length > 0 && (
        <Card className="p-4 flex flex-wrap items-center gap-3 bg-warn-soft/50 border-warn/30">
          <p className="text-sm font-semibold text-warn flex-1 min-w-48">학생 명단이 바뀌었어요. 순서에 반영해야 학생 화면에도 맞게 보여요.</p>
          <Button size="sm" onClick={() => save({}, '새 명단을 반영했어요.')}>
            반영하기
          </Button>
        </Card>
      )}

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6 items-start">
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              value={week}
              onChange={setWeek}
              size="sm"
              ariaLabel="주"
              options={[
                { value: '0', label: '이번 주' },
                { value: '1', label: '다음 주' }
              ]}
            />
            <span className="text-sm font-semibold text-ink-3">{formatDay(monday)} ~</span>
            <div className="ml-auto flex items-center gap-1">
              <IconButton label="한 칸 앞으로 (모두 이전 역할로)" onClick={() => save({ shift: doc.shift - 1 })} disabled={!doc.items.length}>
                <ChevronLeft size={18} />
              </IconButton>
              <IconButton label="한 칸 뒤로 (모두 다음 역할로)" onClick={() => save({ shift: doc.shift + 1 })} disabled={!doc.items.length}>
                <ChevronRight size={18} />
              </IconButton>
              <Button
                size="sm"
                variant="secondary"
                icon={<Shuffle size={15} />}
                disabled={!doc.items.length || order.length < 2}
                onClick={() => {
                  if (!confirm('학생 순서를 무작위로 섞을까요? 이번 주 역할도 바뀌어요.')) return;
                  const shuffled = [...order];
                  for (let i = shuffled.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                  }
                  save({ order: shuffled, start: mondayOf(), shift: 0 }, '순서를 섞었어요.');
                }}
              >
                섞기
              </Button>
            </div>
          </div>

          {doc.items.length === 0 ? (
            <Card>
              <Empty icon={<UsersRound size={22} />} title="아직 역할이 없어요">
                오른쪽에서 역할을 고르거나 직접 만들어 보세요.
              </Empty>
            </Card>
          ) : d.students.length === 0 ? (
            <Card>
              <Empty title="아직 학생이 없어요">학생이 참여하거나 ‘학급 관리’에서 명단을 넣으면 역할이 정해져요.</Empty>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2.5">
              {doc.items.map((r) => (
                <Card key={r.id} className="p-3.5 flex items-center gap-3">
                  <span className="w-12 h-12 rounded-2xl bg-surface-2 border border-line flex items-center justify-center text-2xl shrink-0" aria-hidden>
                    {r.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink-3 truncate">{r.name}</p>
                    <p className="text-lg font-bold truncate">
                      <span className="tabular-nums text-brand-strong mr-1.5">{numOf(map[r.id])}</span>
                      <span className="pii">{d.privacy ? '' : nameOf(map[r.id])}</span>
                    </p>
                  </div>
                  <IconButton label={`${r.name} 지우기`} onClick={() => confirm(`‘${r.name}’ 역할을 지울까요?`) && save({ items: doc.items.filter((x) => x.id !== r.id) })}>
                    <Trash2 size={16} />
                  </IconButton>
                </Card>
              ))}
            </div>
          )}
          {doc.items.length > 0 && order.length > doc.items.length && <p className="text-sm text-ink-3">학생이 역할보다 {order.length - doc.items.length}명 많아요. 역할이 없는 학생은 다음 주에 차례가 와요.</p>}
          {doc.items.length > order.length && order.length > 0 && <p className="text-sm text-warn font-medium">역할이 학생보다 많아서 한 학생이 역할을 두 개 맡을 수 있어요.</p>}
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
            <p className="text-xs text-ink-3">순환은 {formatDay(mondayOf(doc.start || today()))} 주부터 셈해요.</p>
          </Card>
        </section>
      </div>
    </div>
  );
}
