import { Fragment, ReactNode } from 'react';
import { Bold, Highlighter, RemoveFormatting, Underline } from 'lucide-react';
import { cx } from './kit';

// 공지·미션 글 꾸미기: 글 안에 간단한 표시를 넣고, 화면에 보일 때 모양으로 바꿈 (HTML 은 쓰지 않아 안전)
//   **굵게**   __밑줄__   {빨강}글자{/}  {형광}글자{/}
export const COLORS: { key: string; label: string; cls: string; swatch: string }[] = [
  { key: '빨강', label: '빨강', cls: 'rt-red', swatch: '#e5484d' },
  { key: '주황', label: '주황', cls: 'rt-orange', swatch: '#f76b15' },
  { key: '초록', label: '초록', cls: 'rt-green', swatch: '#2f9e6c' },
  { key: '파랑', label: '파랑', cls: 'rt-blue', swatch: '#1e7ae0' },
  { key: '보라', label: '보라', cls: 'rt-purple', swatch: '#8e4ec6' },
  { key: '형광', label: '형광펜', cls: 'rt-mark', swatch: '#ffe066' }
];
const COLOR_CLS = Object.fromEntries(COLORS.map((c) => [c.key, c.cls]));
const TOKEN = /\*\*(.+?)\*\*|__(.+?)__|\{(빨강|주황|초록|파랑|보라|형광)\}([\s\S]+?)\{\/\}/;

export function renderRich(text: string, key = 'r'): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = text;
  let n = 0;
  while (rest) {
    const m = TOKEN.exec(rest);
    if (!m) {
      out.push(rest);
      break;
    }
    if (m.index) out.push(rest.slice(0, m.index));
    const k = `${key}-${n++}`;
    if (m[1] !== undefined) out.push(<strong key={k} className="font-extrabold">{renderRich(m[1], k)}</strong>);
    else if (m[2] !== undefined) out.push(<u key={k} className="underline decoration-2 underline-offset-[0.18em]">{renderRich(m[2], k)}</u>);
    else out.push(<span key={k} className={COLOR_CLS[m[3]]}>{renderRich(m[4], k)}</span>);
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

export function Rich({ text, className }: { text: string; className?: string }) {
  return <span className={className}>{renderRich(text).map((p, i) => <Fragment key={i}>{p}</Fragment>)}</span>;
}

// 표시를 뺀 글 (미리보기·CSV)
export const plainText = (text: string) => text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').replace(/\{(빨강|주황|초록|파랑|보라|형광)\}([\s\S]+?)\{\/\}/g, '$2').replace(/\{\/\}/g, '');

type Field = HTMLInputElement | HTMLTextAreaElement;

// 꾸미기 막대: 마지막으로 누른 입력칸의 고른 글자를 감쌈. onApply(칸, 새 값)로 상태를 바꿈
export function FormatBar({ getTarget, onApply, className }: { getTarget: () => Field | null; onApply: (el: Field, value: string) => void; className?: string }) {
  const wrap = (open: string, close: string) => {
    const el = getTarget();
    if (!el) return;
    const s = el.selectionStart ?? el.value.length;
    const e = el.selectionEnd ?? el.value.length;
    const sel = el.value.slice(s, e) || '글자';
    const value = el.value.slice(0, s) + open + sel + close + el.value.slice(e);
    onApply(el, value);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + open.length, s + open.length + sel.length);
    });
  };
  const clear = () => {
    const el = getTarget();
    if (!el) return;
    const s = el.selectionStart ?? 0;
    const e = el.selectionEnd ?? el.value.length;
    const all = s === e;
    const value = all ? plainText(el.value) : el.value.slice(0, s) + plainText(el.value.slice(s, e)) + el.value.slice(e);
    onApply(el, value);
  };
  const btn = 'h-9 min-w-9 px-2 rounded-lg border border-line bg-surface flex items-center justify-center gap-1 text-sm font-bold text-ink-2 hover:border-brand hover:text-brand-strong cursor-pointer transition';
  // 버튼을 눌러도 입력칸의 선택이 풀리지 않게 mousedown 기본 동작을 막음
  const keep = (e: React.MouseEvent) => e.preventDefault();
  return (
    <div className={cx('flex flex-wrap items-center gap-1.5', className)} role="toolbar" aria-label="글자 꾸미기">
      <button type="button" onMouseDown={keep} onClick={() => wrap('**', '**')} className={btn} title="굵게" aria-label="굵게">
        <Bold size={16} strokeWidth={3} />
      </button>
      <button type="button" onMouseDown={keep} onClick={() => wrap('__', '__')} className={btn} title="밑줄" aria-label="밑줄">
        <Underline size={16} />
      </button>
      <span className="w-px h-6 bg-line mx-0.5" aria-hidden />
      {COLORS.map((c) => (
        <button key={c.key} type="button" onMouseDown={keep} onClick={() => wrap(`{${c.key}}`, '{/}')} className={btn} title={c.label} aria-label={`${c.label} 글자`}>
          {c.key === '형광' ? <Highlighter size={16} style={{ color: '#d4a800' }} /> : <span className="w-4 h-4 rounded-full" style={{ background: c.swatch }} />}
        </button>
      ))}
      <span className="w-px h-6 bg-line mx-0.5" aria-hidden />
      <button type="button" onMouseDown={keep} onClick={clear} className={btn} title="꾸미기 지우기" aria-label="꾸미기 지우기">
        <RemoveFormatting size={16} />
      </button>
      <span className="text-xs text-ink-3 ml-1">글자를 고른 뒤 누르세요</span>
    </div>
  );
}
