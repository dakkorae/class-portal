import { useEffect, useRef, useState } from 'react';
import { CalendarClock, Clock, Eye, ImagePlus, Megaphone, Pencil, Pin, PinOff, Plus, Trash2, X } from 'lucide-react';
import { errorMessage } from '../lib/cloud';
import { formatTime, fromLocalInput, toLocalInput } from '../lib/dates';
import { MAX_IMAGES, shrinkImage } from '../lib/image';
import { noticeStatus } from '../lib/visible';
import { NOTICE_TAGS, Notice, NoticeTag } from '../lib/types';
import { Badge, Button, Card, Empty, ErrorNote, Field, IconButton, Input, Modal, Progress, SectionTitle, Segmented, Switch, Textarea, cx, toast } from '../ui/kit';
import { TagBadge } from '../ui/tags';
import { useData } from './data';

export default function NoticesPanel() {
  const d = useData();
  const [edit, setEdit] = useState<Partial<Notice> | null>(null);
  const [reads, setReads] = useState<Notice | null>(null);
  const sids = d.students.map((s) => s.sid);

  const sorted = [...d.notices].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.publishAt - a.publishAt);

  return (
    <div className="space-y-6">
      <SectionTitle
        icon={<Megaphone size={20} />}
        title={<span className="text-2xl">공지</span>}
        sub="고정한 공지는 학생 홈과 TV에 크게 보여요. 예약하면 그 시각에 저절로 올라가요."
        action={
          <Button icon={<Plus size={18} />} onClick={() => setEdit({ tag: '안내', pinned: false, publishAt: Date.now(), expireAt: null, imageData: [] })}>
            공지 쓰기
          </Button>
        }
      />
      {sorted.length === 0 ? (
        <Card>
          <Empty icon={<Megaphone size={22} />} title="아직 공지가 없어요" />
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {sorted.map((n) => {
            const st = noticeStatus(n);
            const read = sids.filter((sid) => d.statuses[sid]?.reads?.[n.id]).length;
            return (
              <Card key={n.id} className={cx('p-4 flex flex-col gap-3', st !== 'live' && 'bg-surface-2/50')}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                      <TagBadge tag={n.tag} />
                      {n.pinned && <Badge tone="brand" icon={<Pin size={11} />}>고정</Badge>}
                      {st === 'scheduled' && <Badge tone="warn" icon={<CalendarClock size={11} />}>예약 {formatTime(n.publishAt)}</Badge>}
                      {st === 'expired' && <Badge icon={<Clock size={11} />}>내림</Badge>}
                      {n.images > 0 && <Badge icon={<ImagePlus size={11} />}>그림 {n.images}</Badge>}
                    </div>
                    <p className="font-bold leading-snug">{n.title}</p>
                    <p className="text-sm text-ink-3 line-clamp-2 mt-0.5">{n.snippet}</p>
                  </div>
                  <div className="flex shrink-0 -mr-1.5 -mt-1">
                    <IconButton label={n.pinned ? '고정 풀기' : '고정'} onClick={() => d.api.setNoticePinned(d.classId, n.id, !n.pinned).catch((e) => toast(errorMessage(e)))}>
                      {n.pinned ? <PinOff size={17} /> : <Pin size={17} />}
                    </IconButton>
                    <IconButton label="고치기" onClick={() => setEdit(n)}>
                      <Pencil size={17} />
                    </IconButton>
                  </div>
                </div>
                {st !== 'scheduled' && (
                  <button type="button" onClick={() => setReads(n)} className="text-left cursor-pointer group">
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="font-semibold text-ink-2 group-hover:text-brand-strong flex items-center gap-1">
                        <Eye size={14} /> 읽음 확인
                      </span>
                      <span className="text-ink-3 tabular-nums">
                        {read}/{sids.length}명
                      </span>
                    </div>
                    <Progress value={read} max={sids.length} tone={sids.length && read >= sids.length ? 'ok' : 'brand'} label="읽은 학생" />
                  </button>
                )}
              </Card>
            );
          })}
        </div>
      )}
      {edit && <NoticeEditor initial={edit} onClose={() => setEdit(null)} />}
      {reads && (
        <Modal open onClose={() => setReads(null)} title={`읽음 확인 · ${reads.title}`}>
          <ReadList notice={reads} />
        </Modal>
      )}
    </div>
  );
}

function ReadList({ notice }: { notice: Notice }) {
  const d = useData();
  const unread = d.students.filter((s) => !d.statuses[s.sid]?.reads?.[notice.id]);
  const read = d.students.filter((s) => d.statuses[s.sid]?.reads?.[notice.id]);
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-bold text-bad mb-2">아직 안 읽은 학생 {unread.length}명</h3>
        <div className="flex flex-wrap gap-1.5">
          {unread.map((s) => (
            <span key={s.sid} className="h-8 px-2.5 rounded-lg bg-bad-soft text-bad text-sm font-semibold inline-flex items-center">
              <span className="pii">{d.nameOf(s.sid)}</span>
            </span>
          ))}
          {unread.length === 0 && <p className="text-sm text-ink-3">모두 읽었어요! 🎉</p>}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-bold text-ok mb-2">읽은 학생 {read.length}명</h3>
        <div className="flex flex-wrap gap-1.5">
          {read.map((s) => (
            <span key={s.sid} className="h-8 px-2.5 rounded-lg bg-ok-soft text-ok text-sm font-semibold inline-flex items-center">
              <span className="pii">{d.nameOf(s.sid)}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function NoticeEditor({ initial, onClose }: { initial: Partial<Notice>; onClose: () => void }) {
  const d = useData();
  const [, setFull] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(!!initial.id);
  const [title, setTitle] = useState(initial.title || '');
  const [body, setBody] = useState('');
  const [tag, setTag] = useState<NoticeTag>(initial.tag || '안내');
  const [pinned, setPinned] = useState(!!initial.pinned);
  const [images, setImages] = useState<string[]>([]);
  const [schedule, setSchedule] = useState(!!initial.publishAt && initial.publishAt > Date.now());
  const [publishAt, setPublishAt] = useState(toLocalInput(initial.publishAt && initial.publishAt > Date.now() ? initial.publishAt : nextMorning()));
  const [expire, setExpire] = useState(!!initial.expireAt);
  const [expireAt, setExpireAt] = useState(initial.expireAt ? toLocalInput(initial.expireAt) : toLocalInput(Date.now() + 7 * 86400000));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // 고칠 때는 본문·그림을 서버에서 불러옴
  useEffect(() => {
    if (!initial.id) return;
    d.api
      .getNotice(d.classId, initial.id)
      .then((n) => {
        if (!n) return setError('공지를 불러오지 못했어요.');
        setFull(n);
        setBody(n.body);
        setImages(n.imageData || []);
      })
      .catch((e) => setError(errorMessage(e)))
      .finally(() => setLoading(false));
  }, [d.api, d.classId, initial.id]);

  const addImages = async (files: FileList | null) => {
    if (!files) return;
    setError('');
    const list = [...images];
    for (const f of Array.from(files)) {
      if (list.length >= MAX_IMAGES) {
        setError(`그림은 ${MAX_IMAGES}장까지 넣을 수 있어요.`);
        break;
      }
      try {
        list.push(await shrinkImage(f));
      } catch (e) {
        setError(errorMessage(e));
      }
    }
    setImages(list);
    if (fileRef.current) fileRef.current.value = '';
  };

  const save = async () => {
    if (!title.trim()) return setError('제목을 적어 주세요.');
    const pub = schedule ? fromLocalInput(publishAt) : initial.id && initial.publishAt && initial.publishAt <= Date.now() ? initial.publishAt : Date.now();
    if (Number.isNaN(pub)) return setError('게시 시각을 확인해 주세요.');
    const exp = expire ? fromLocalInput(expireAt) : null;
    if (exp !== null && (Number.isNaN(exp) || exp <= pub)) return setError('내릴 시각은 게시 시각보다 뒤여야 해요.');
    setBusy(true);
    setError('');
    try {
      await d.api.saveNotice(d.classId, { id: initial.id, title: title.trim(), body: body.trim(), tag, pinned, publishAt: pub, expireAt: exp, imageData: images });
      toast(schedule ? '공지를 예약했어요.' : initial.id ? '공지를 고쳤어요.' : '공지를 올렸어요.');
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
      title={initial.id ? '공지 고치기' : '공지 쓰기'}
      footer={
        <>
          {initial.id && (
            <Button
              variant="danger"
              icon={<Trash2 size={16} />}
              className="mr-auto"
              onClick={async () => {
                if (!confirm(`‘${initial.title}’ 공지를 지울까요?`)) return;
                await d.api.deleteNotice(d.classId, initial.id!).catch((e) => toast(errorMessage(e)));
                onClose();
              }}
            >
              지우기
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button onClick={save} loading={busy} disabled={loading}>
            {schedule ? '예약하기' : initial.id ? '저장' : '올리기'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Segmented value={tag} onChange={setTag} ariaLabel="말머리" options={NOTICE_TAGS.map((t) => ({ value: t, label: t }))} />
        <Field label="제목">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={60} placeholder="예: 내일 체육복 챙겨 오기" autoFocus={!initial.id} />
        </Field>
        <Field label="내용">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} maxLength={2000} disabled={loading} placeholder={loading ? '불러오는 중…' : '학생이 읽을 내용 (읽어 주기 버튼으로 소리 내어 들을 수도 있어요)'} />
        </Field>
        <div>
          <span className="block text-sm font-semibold text-ink-2 mb-1.5">그림 (최대 {MAX_IMAGES}장 · 올릴 때 자동으로 작게 줄여요)</span>
          <div className="flex flex-wrap gap-2">
            {images.map((src, i) => (
              <div key={i} className="relative w-28 h-28 rounded-xl overflow-hidden border border-line">
                <img src={src} alt={`첨부 그림 ${i + 1}`} className="w-full h-full object-cover" />
                <button type="button" onClick={() => setImages(images.filter((_, j) => j !== i))} className="absolute top-1 right-1 w-7 h-7 rounded-lg bg-black/60 text-white flex items-center justify-center cursor-pointer" aria-label="그림 빼기">
                  <X size={15} />
                </button>
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <button type="button" onClick={() => fileRef.current?.click()} className="w-28 h-28 rounded-xl border-2 border-dashed border-line-strong text-ink-3 hover:border-brand hover:text-brand-strong flex flex-col items-center justify-center gap-1 text-sm font-semibold cursor-pointer transition">
                <ImagePlus size={22} />
                그림 넣기
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addImages(e.target.files)} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4 pt-1">
          <div className="space-y-2">
            <Switch checked={schedule} onChange={setSchedule} label="예약 게시" />
            {schedule && <Input type="datetime-local" value={publishAt} onChange={(e) => setPublishAt(e.target.value)} aria-label="게시 시각" />}
          </div>
          <div className="space-y-2">
            <Switch checked={expire} onChange={setExpire} label="내릴 날짜 정하기" />
            {expire && <Input type="datetime-local" value={expireAt} onChange={(e) => setExpireAt(e.target.value)} aria-label="내릴 시각" />}
          </div>
          <Switch checked={pinned} onChange={setPinned} label="중요 공지로 고정 (학생 홈·TV)" />
        </div>
        <ErrorNote>{error}</ErrorNote>
      </div>
    </Modal>
  );
}

// 기본 예약 시각: 다음 날 아침 8시
function nextMorning() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  return d.getTime();
}
