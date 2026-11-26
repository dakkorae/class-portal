import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, Link2, Pencil, Pin, PinOff, Plus, Send, Trash2 } from 'lucide-react';
import { errorMessage } from '../lib/cloud';
import { LINK_CATEGORIES, LinkItem } from '../lib/types';
import { Badge, Button, Card, Empty, ErrorNote, Field, IconButton, Input, LinkIcon, Modal, SectionTitle, Select, Switch, cx, isValidUrl, normalizeUrl, toast } from '../ui/kit';
import { useData } from './data';

const EMOJIS = ['', '📚', '✏️', '🧮', '🔬', '🌏', '🎨', '🎵', '⚽', '🎮', '🧩', '📝', '🎬', '💡', '🗂️', '🧠', '📊', '🔤', '🌱', '⭐'];

export default function LinksPanel() {
  const d = useData();
  const [edit, setEdit] = useState<Partial<LinkItem> | null>(null);
  const [order, setOrder] = useState<LinkItem[]>(d.links);
  const [drag, setDrag] = useState<string | null>(null);
  useEffect(() => setOrder(d.links), [d.links]);

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
        title={<span className="text-2xl">링크 모음</span>}
        sub="고정한 링크는 학생 홈 맨 위에 보여요. 끌어서 순서를 바꿀 수 있어요."
        action={
          <Button icon={<Plus size={18} />} onClick={() => setEdit({ category: '도구', icon: '', pinned: false, hidden: false })}>
            링크 추가
          </Button>
        }
      />

      {order.length === 0 ? (
        <Card>
          <Empty icon={<Link2 size={22} />} title="아직 링크가 없어요">
            수업에 자주 쓰는 사이트를 추가해 보세요.
          </Empty>
        </Card>
      ) : (
        <Card className="divide-y divide-line overflow-hidden">
          {order.map((l, i) => (
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
              <LinkIcon url={l.url} icon={l.icon} size={40} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className={cx('font-semibold truncate', l.hidden && 'text-ink-3')}>{l.title}</p>
                  <Badge>{l.category}</Badge>
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
          ))}
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
  const [category, setCategory] = useState(initial.category || '도구');
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
      toast(initial.id ? '링크를 고쳤어요.' : '링크를 추가했어요.');
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
      title={initial.id ? '링크 고치기' : '링크 추가'}
      footer={
        <>
          {initial.id && (
            <Button
              variant="danger"
              icon={<Trash2 size={16} />}
              className="mr-auto"
              onClick={async () => {
                if (!confirm(`‘${initial.title}’ 링크를 지울까요?`)) return;
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
            <LinkIcon url={fullUrl} icon={icon} size={44} />
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
        <Field label="카테고리">
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {LINK_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <div>
          <span className="block text-sm font-semibold text-ink-2 mb-1.5">아이콘</span>
          <div className="flex flex-wrap gap-1.5">
            {EMOJIS.map((e) => (
              <button
                key={e || 'auto'}
                type="button"
                onClick={() => setIcon(e)}
                aria-pressed={icon === e}
                className={cx('h-10 min-w-10 px-2 rounded-lg border text-lg cursor-pointer transition', icon === e ? 'border-brand bg-brand-soft' : 'border-line hover:border-line-strong')}
              >
                {e || <span className="text-xs font-semibold text-ink-3">사이트</span>}
              </button>
            ))}
          </div>
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
