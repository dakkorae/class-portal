import { Delete } from 'lucide-react';
import { cx } from '../ui/kit';

// 숫자 4자리 입력판 (태블릿에서 손가락으로 누르기 쉽게 큼직하게)
export default function PinPad({ value, onChange, disabled, error }: { value: string; onChange: (v: string) => void; disabled?: boolean; error?: boolean }) {
  const press = (d: string) => !disabled && value.length < 4 && onChange(value + d);
  const back = () => !disabled && onChange(value.slice(0, -1));
  return (
    <div className="w-full max-w-[19rem] mx-auto">
      <div className={cx('flex justify-center gap-3 mb-6', error && 'animate-[shake_0.3s]')} aria-live="polite" aria-label={`${value.length}자리 입력함`}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={cx(
              'w-14 h-16 rounded-2xl border-2 flex items-center justify-center text-3xl font-bold transition',
              i < value.length ? 'border-brand bg-brand-soft text-brand-strong' : 'border-line-strong bg-surface',
              error && 'border-bad bg-bad-soft'
            )}
          >
            {i < value.length ? '●' : ''}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <Key key={d} onClick={() => press(d)} disabled={disabled}>
            {d}
          </Key>
        ))}
        <span />
        <Key onClick={() => press('0')} disabled={disabled}>
          0
        </Key>
        <Key onClick={back} disabled={disabled} label="한 글자 지우기">
          <Delete size={26} />
        </Key>
      </div>
    </div>
  );
}

function Key({ children, onClick, disabled, label }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="h-16 rounded-2xl bg-surface border border-line text-2xl font-semibold text-ink shadow-card hover:bg-surface-2 active:scale-95 transition cursor-pointer disabled:opacity-50 flex items-center justify-center"
    >
      {children}
    </button>
  );
}
