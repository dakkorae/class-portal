import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, Link2, Pencil, Pin, PinOff, Plus, Send, Trash2 } from 'lucide-react';
import { errorMessage } from '../lib/cloud';
import { LINK_CATEGORIES, LinkItem, linkCategory } from '../lib/types';
import { ICON_GROUPS } from '../ui/tiles';
import { Badge, Button, Card, Empty, ErrorNote, Field, IconButton, Input, LinkIcon, Modal, SectionTitle, Select, Switch, cx, isValidUrl, normalizeUrl, toast } from '../ui/kit';
import { useData } from './data';


export default function LinksPanel() {
  const d = useData();
  const [edit, setEdit] = useState<Partial<LinkItem> | null>(null);
  const [order, setOrder] = useState<LinkItem[]>(d.links);
  const [drag, setDrag] = useState<string | null>(null);
  const [cat, setCat] = useState('전체');
  useEffect(() => setOrder(d.links), [d.links]);
  const counts = (c: string) => (c === '전체' ? order.length : order.filter((l) => linkCategory(l.category) === c).length);

  const run = async (fn: () => Promise<unknown>, done?: string) => {
    try {
      await fn();
      if (done) toast(done);
    } catch (e) {
      toast(errorMessage(e));
    }
  };

  const commitOrder = (list: LinkItem[]) => {
    setOrder(list);
    run(() => d.api.reorderLinks(d.classId, list.map((l) => l.id)));
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const list = [...order];
    [list[i], list[j]] = [list[j], list[i]];
    commitOrder(list);
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        icon={<Link2 size={20} />}
        title={<span className="text-2xl">바로가기 모음</span>}
        sub="고정한 바로가기는 학생 홈 맨 위에 보여요. 끌어서 순서를 바꿀 수 있어요."
        action={
          <Button icon={<Plus size={18} />} onClick={() => setEdit({ category: cat === '전체' ? '기타' : cat, icon: '', pinned: false, hidden: false })}>
            바로가기 추가
          </Button>
        }
      />

      <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1" role="tablist" aria-label="분류별로 보기">
        {['전체', ...LINK_CATEGORIES].map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={cat === c}
            onClick={() => setCat(c)}
            className={cx('h-10 px-3.5 rounded-full border text-sm font-semibold whitespace-nowrap transition cursor-pointer', cat === c ? 'bg-ink text-canvas border-ink' : 'bg-surface text-ink-2 border-line hover:border-line-strong')}
          >
            {c}
            <span className={cx('ml-1.5 tabular-nums', cat === c ? 'text-canvas/70' : 'text-ink-3')}>{counts(c)}</span>
          </button>
        ))}
      </div>

      {order.length === 0 ? (
        <Card>
          <Empty icon={<Link2 size={22} />} title="아직 바로가기가 없어요">
            수업에 자주 쓰는 사이트를 추가해 보세요.
          </Empty>
        </Card>
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {order.map((l, i) => (cat !== '전체' && linkCategory(l.category) !== cat ? null : (
            <div
              key={l.id}
              draggable
              onDragStart={() => setDrag(l.id)}
              onDragEnd={() => setDrag(null)}
              onDragOver={(e) => {
                e.preventDefault();
                if (!drag || drag === l.id) return;
                const from = order.findIndex((x) => x.id === drag);
                const list = [...order];
                const [it] = list.splice(from, 1);
                list.splice(i, 0, it);
                setOrder(list);
              }}
              onDrop={(e) => {
                e.preventDefault();
                commitOrder(order);
              }}
              className={cx('flex items-center gap-3 px-3 sm:px-4 py-3 bg-surface transition', drag === l.id && 'opacity-50', l.hidden && 'bg-surface-2/60')}
            >
              <GripVertical size={18} className="text-ink-3 cursor-grab shrink-0 hidden sm:block" aria-hidden />
              <LinkIcon url={l.url} icon={l.icon} category={linkCategory(l.category)} size={44} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className={cx('font-semibold truncate', l.hidden && 'text-ink-3')}>{l.title}</p>
                  <Badge>{linkCategory(l.category)}</Badge>
                  {l.pinned && <Badge tone="brand" icon={<Pin size={11} />}>고정</Badge>}
                  {l.hidden && <Badge tone="warn" icon={<EyeOff size={11} />}>숨김</Badge>}
                </div>
                <p className="text-xs text-ink-3 truncate mt-0.5">{l.url}</p>
              </div>
              <div className="flex items-center shrink-0">
                <Button variant="soft" size="sm" icon={<Send size={14} />} onClick={() => run(() => d.api.sendNow(d.classId, { title: l.title, url: l.url, icon: l.icon }), `‘${l.title}’을(를) 지금 열기로 보냈어요.`)} className="hidden sm:inline-flex mr-1">
                  보내기
                </Button>
                <IconButton label="지금 열기로 보내기" className="sm:hidden" onClick={() => run(() => d.api.sendNow(d.classId, { title: l.title, url: l.url, icon: l.icon }), '지금 열기로 보냈어요.')}>
                  <Send size={17} />
                </IconButton>
                <IconButton label={l.pinned ? '고정 풀기' : '고정'} onClick={() => run(() => d.api.patchLink(d.classId, l.id, { pinned: !l.pinned }))}>
                  {l.pinned ? <PinOff size={17} /> : <Pin size={17} />}
                </IconButton>
                <IconButton label={l.hidden ? '보이기' : '숨기기'} onClick={() => run(() => d.api.patchLink(d.classId, l.id, { hidden: !l.hidden }))}>
                  {l.hidden ? <Eye size={17} /> : <EyeOff size={17} />}
                </IconButton>
                <div className="hidden lg:flex">
                  <IconButton label="위로" onClick={() => move(i, -1)} disabled={i === 0}>
                    <ArrowUp size={17} />
                  </IconButton>
                  <IconButton label="아래로" onClick={() => move(i, 1)} disabled={i === order.length - 1}>
                    <ArrowDown size={17} />
                  </IconButton>
                </div>
                <IconButton label="고치기" onClick={() => setEdit(l)}>
                  <Pencil size={17} />
                </IconButton>
              </div>
            </div>
          )))}
          {cat !== '전체' && counts(cat) === 0 && <p className="p-5 text-sm text-ink-3">‘{cat}’ 바로가기가 없어요.</p>}
        </Card>
      )}

      {edit && <LinkEditor initial={edit} nextOrder={order.length} onClose={() => setEdit(null)} />}
    </div>
  );
}

function LinkEditor({ initial, nextOrder, onClose }: { initial: Partial<LinkItem>; nextOrder: number; onClose: () => void }) {
  const d = useData();
  const [title, setTitle] = useState(initial.title || '');
  const [url, setUrl] = useState(initial.url || '');
  const [category, setCategory] = useState(linkCategory(initial.category || '기타'));
  const [group, setGroup] = useState<string>(() => Object.entries(ICON_GROUPS).find(([, list]) => list.includes(initial.icon || ''))?.[0] || linkCategory(initial.category || '기타'));
  const [icon, setIcon] = useState(initial.icon || '');
  const [pinned, setPinned] = useState(!!initial.pinned);
  const [hidden, setHidden] = useState(!!initial.hidden);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fullUrl = normalizeUrl(url);
  const host = isValidUrl(fullUrl) ? new URL(fullUrl).hostname.replace(/^www\./, '') : '';

  const save = async () => {
    if (!isValidUrl(fullUrl)) return setError('주소를 확인해 주세요. (https:// 로 시작)');
    const name = title.trim() || host;
    setBusy(true);
    setError('');
    try {
      await d.api.saveLink(d.classId, { id: initial.id, title: name, url: fullUrl, category, icon, pinned, hidden, order: initial.order ?? nextOrder });
      toast(initial.id ? '바로가기를 고쳤어요.' : '바로가기를 추가했어요.');
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
      title={initial.id ? '바로가기 고치기' : '바로가기 추가'}
      footer={
        <>
          {initial.id && (
            <Button
              variant="danger"
              icon={<Trash2 size={16} />}
              className="mr-auto"
              onClick={async () => {
                if (!confirm(`‘${initial.title}’ 바로가기를 지울까요?`)) return;
                await d.api.deleteLink(d.classId, initial.id!).catch((e) => toast(errorMessage(e)));
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
        <Field label="주소" hint="붙여넣으면 사이트 아이콘을 자동으로 가져와요.">
          <div className="flex gap-2 items-center">
            <LinkIcon url={fullUrl} icon={icon} category={category} size={48} />
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://"
              inputMode="url"
              autoFocus={!initial.id}
            />
          </div>
        </Field>
        <Field label="이름" hint={!title.trim() && host ? `비워 두면 ‘${host}’(으)로 저장돼요.` : undefined}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={30} placeholder={host || '예: 클래스카드'} />
        </Field>
        <Field label="분류">
          <Select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setGroup(e.target.value);
            }}
          >
            {LINK_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <div>
          <span className="block text-sm font-semibold text-ink-2 mb-1.5">아이콘</span>
          <div className="flex gap-1 overflow-x-auto scrollbar-none pb-2">
            {Object.keys(ICON_GROUPS).map((g) => (
              <button key={g} type="button" onClick={() => setGroup(g)} aria-pressed={group === g} className={cx('h-8 px-3 rounded-full text-xs font-bold whitespace-nowrap border cursor-pointer transition', group === g ? 'bg-brand-soft text-brand-strong border-brand/40' : 'border-line text-ink-3 hover:text-ink')}>
                {g}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-1.5">
            <button type="button" onClick={() => setIcon('')} aria-pressed={icon === ''} aria-label="사이트 아이콘 쓰기" className={cx('h-[52px] rounded-xl border-2 flex items-center justify-center cursor-pointer transition', icon === '' ? 'border-brand bg-brand-soft' : 'border-transparent hover:bg-surface-2')}>
              <LinkIcon url={fullUrl} size={38} />
            </button>
            {ICON_GROUPS[group as keyof typeof ICON_GROUPS].map((e) => (
              <button key={e} type="button" onClick={() => setIcon(e)} aria-pressed={icon === e} aria-label={`아이콘 ${e}`} className={cx('h-[52px] rounded-xl border-2 flex items-center justify-center cursor-pointer transition', icon === e ? 'border-brand bg-brand-soft' : 'border-transparent hover:bg-surface-2')}>
                <LinkIcon url="" icon={e} category={group} size={38} />
              </button>
            ))}
          </div>
          <p className="text-xs text-ink-3 mt-1.5">첫 칸은 사이트 아이콘이에요. 그림을 고르면 분류 색의 3D 타일로 보여요.</p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-3 pt-1">
          <Switch checked={pinned} onChange={setPinned} label="학생 홈에 고정" />
          <Switch checked={hidden} onChange={setHidden} label="학생에게 숨기기" />
        </div>
        <ErrorNote>{error}</ErrorNote>
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
