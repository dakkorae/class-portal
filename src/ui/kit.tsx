import { tileColors } from './tiles';
import React, { ReactNode, useEffect, useRef, useState } from 'react';
import { Check, Copy, Loader2, X } from 'lucide-react';

// 공통 화면 부품 (버튼·카드·입력·모달 등)
const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
export { cx };

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
type BtnSize = 'sm' | 'md' | 'lg' | 'xl';
const variants: Record<BtnVariant, string> = {
  primary: 'bg-brand-gradient text-on-brand hover:brightness-105 shadow-md shadow-brand/25',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-surface-2',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  danger: 'bg-bad-soft text-bad hover:brightness-95 border border-transparent',
  soft: 'bg-brand-soft text-brand-strong hover:brightness-[0.97]'
};
const sizes: Record<BtnSize, string> = {
  sm: 'h-9 px-3.5 text-sm rounded-[var(--btn-radius)] gap-1.5',
  md: 'h-11 px-5 text-[15px] rounded-[var(--btn-radius)] gap-2',
  lg: 'h-12 px-6 text-base rounded-[var(--btn-radius)] gap-2',
  xl: 'h-14 px-7 text-lg rounded-[var(--btn-radius)] gap-2.5'
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize; loading?: boolean; icon?: ReactNode }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || loading}
      className={cx(
        'inline-flex items-center justify-center font-semibold whitespace-nowrap transition-[background,filter,transform] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer select-none',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {loading ? <Loader2 className="animate-spin shrink-0" size={18} aria-hidden /> : icon}
      {children}
    </button>
  );
}

export function IconButton({ label, className, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      {...rest}
      className={cx('inline-flex items-center justify-center w-10 h-10 rounded-xl text-ink-2 hover:bg-surface-2 hover:text-ink transition cursor-pointer disabled:opacity-40 shrink-0', className)}
    >
      {children}
    </button>
  );
}

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cx('bg-surface ui-card rounded-2xl shadow-card', className)}>
      {children}
    </div>
  );
}

export function SectionTitle({ icon, title, action, sub }: { icon?: ReactNode; title: ReactNode; action?: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-[17px] font-bold tracking-tight text-ink">
          {icon && <span className="text-brand-strong shrink-0">{icon}</span>}
          {title}
        </h2>
        {sub && <p className="text-sm text-ink-3 mt-0.5">{sub}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export const inputCls =
  'w-full h-11 px-3.5 rounded-xl bg-surface border border-line-strong text-ink placeholder:text-ink-3 focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/15 transition disabled:opacity-60';

export function Field({ label, hint, error, children, className }: { label: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="block text-sm font-semibold text-ink-2 mb-1.5">{label}</span>
      {children}
      {hint && !error && <span className="block text-xs text-ink-3 mt-1.5">{hint}</span>}
      {error && <span className="block text-xs font-semibold text-bad mt-1.5">{error}</span>}
    </label>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} {...rest} className={cx(inputCls, className)} />;
});

export function Textarea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cx(inputCls, 'h-auto py-3 leading-relaxed resize-y', className)} />;
}

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={cx(inputCls, 'pr-9 cursor-pointer', className)}>
      {children}
    </select>
  );
}

export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; disabled?: boolean }) {
  return (
    <label className={cx('inline-flex items-center gap-2.5 cursor-pointer select-none', disabled && 'opacity-50 pointer-events-none')}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx('relative w-11 h-6 rounded-full transition shrink-0 cursor-pointer', checked ? 'bg-brand' : 'bg-line-strong')}
      >
        <span className={cx('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', checked && 'translate-x-5')} />
      </button>
      <span className="text-sm font-medium text-ink-2">{label}</span>
    </label>
  );
}

export function Segmented<T extends string>({ value, options, onChange, size = 'md', ariaLabel }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; size?: 'sm' | 'md'; ariaLabel?: string }) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex p-1 rounded-xl bg-surface-2 border border-line gap-1 max-w-full overflow-x-auto scrollbar-none">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-lg font-semibold transition whitespace-nowrap cursor-pointer',
            size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-9 px-3.5 text-sm',
            value === o.value ? 'bg-surface text-ink shadow-sm ring-1 ring-line' : 'text-ink-3 hover:text-ink'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

type Tone = 'neutral' | 'brand' | 'ok' | 'warn' | 'bad';
const tones: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-ink-2 border-line',
  brand: 'bg-brand-soft text-brand-strong border-transparent',
  ok: 'bg-ok-soft text-ok border-transparent',
  warn: 'bg-warn-soft text-warn border-transparent',
  bad: 'bg-bad-soft text-bad border-transparent'
};
export function Badge({ tone = 'neutral', children, className, icon }: { tone?: Tone; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <span className={cx('inline-flex items-center gap-1 h-6 px-2 rounded-md border text-xs font-semibold whitespace-nowrap', tones[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0a0c15]/55 backdrop-blur-[2px] sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className={cx('animate-pop bg-surface w-full sm:rounded-2xl rounded-t-3xl shadow-pop border border-line flex flex-col max-h-[92dvh] focus:outline-none', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 border-b border-line">
          <h2 className="text-lg font-bold tracking-tight text-ink min-w-0">{title}</h2>
          <IconButton label="닫기" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-line flex flex-wrap justify-end gap-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </div>
  );
}

export function CopyButton({ text, label = '복사', size = 'sm' }: { text: string; label?: string; size?: BtnSize }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="secondary"
      size={size}
      icon={done ? <Check size={16} /> : <Copy size={16} />}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? '복사됨' : label}
    </Button>
  );
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="text-center py-10 px-4">
      {icon && <div className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-surface-2 text-ink-3 flex items-center justify-center">{icon}</div>}
      <p className="font-semibold text-ink-2">{title}</p>
      {children && <div className="text-sm text-ink-3 mt-1">{children}</div>}
    </div>
  );
}

export function Spinner({ label = '불러오는 중…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm font-medium text-ink-3" role="status">
      <Loader2 className="animate-spin" size={18} />
      {label}
    </div>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm font-semibold text-bad bg-bad-soft rounded-xl px-3.5 py-2.5">
      {children}
    </p>
  );
}

export function Progress({ value, max, tone = 'brand', label }: { value: number; max: number; tone?: 'brand' | 'ok'; label?: string }) {
  const pct = max ? Math.round((Math.min(value, max) / max) * 100) : 0;
  return (
    <div className="h-2 rounded-full bg-surface-2 overflow-hidden" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      <div className={cx('h-full rounded-full transition-[width] duration-500', tone === 'ok' ? 'bg-ok' : 'bg-rainbow')} style={{ width: `${pct}%` }} />
    </div>
  );
}

// 화면 아래에 잠깐 뜨는 알림
let pushToast: ((msg: string) => void) | null = null;
export const toast = (msg: string) => pushToast?.(msg);
export function Toaster() {
  const [msg, setMsg] = useState('');
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    pushToast = (m) => {
      setMsg(m);
      clearTimeout(t);
      t = setTimeout(() => setMsg(''), 2400);
    };
    return () => {
      pushToast = null;
    };
  }, []);
  if (!msg) return null;
  return (
    <div className="fixed z-[60] left-1/2 -translate-x-1/2 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-6 px-4 w-max max-w-[calc(100vw-2rem)]" role="status" aria-live="polite">
      <div className="animate-pop bg-ink text-canvas text-sm font-semibold px-4 py-2.5 rounded-xl shadow-pop">{msg}</div>
    </div>
  );
}

// 사이트 아이콘(파비콘) 또는 이모지
// 바로가기 아이콘: 반짝이는 3D 타일 (그림을 고르면 분류 색 타일, 안 고르면 흰 타일 + 사이트 아이콘)
export function LinkIcon({ url, icon, size = 40, className, category }: { url: string; icon?: string; size?: number; className?: string; category?: string }) {
  const [failed, setFailed] = useState(false);
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    host = '';
  }
  const radius = Math.round(size * 0.28);
  if (icon) {
    const [c1, c2] = tileColors(icon, category);
    return (
      <span className={cx('tile3d', className)} style={{ width: size, height: size, borderRadius: radius, fontSize: size * 0.54, ['--t1' as string]: c1, ['--t2' as string]: c2 }} aria-hidden>
        <span className="tile3d-emoji">{icon}</span>
      </span>
    );
  }
  return (
    <span className={cx('tile3d tile3d-white', className)} style={{ width: size, height: size, borderRadius: radius, fontSize: size * 0.42 }} aria-hidden>
      {!host || failed ? (
        <span className="font-bold text-[#4b5068]">{(host.replace(/^www\./, '')[0] || '?').toUpperCase()}</span>
      ) : (
        <img src={`https://www.google.com/s2/favicons?domain=${host}&sz=64`} alt="" width={Math.round(size * 0.56)} height={Math.round(size * 0.56)} loading="lazy" onError={() => setFailed(true)} className="relative" />
      )}
    </span>
  );
}

export const normalizeUrl = (raw: string) => {
  const v = raw.trim();
  if (!v) return '';
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
};
export const isValidUrl = (v: string) => {
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};
