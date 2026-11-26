import { useEffect, useState } from 'react';
import { Check, Palette, Type } from 'lucide-react';
import { FONTS, SKINS, Skin, fontOf, loadAppearance, saveAppearance, skinOf } from './skins';
import { Card, SectionTitle, cx, toast } from './kit';

// 테마·글꼴 고르기 (교사 '화면 설정', 학생 '나'). 이 기기에만 적용됨
export default function ThemePicker() {
  const [{ skin, font }, setLook] = useState(loadAppearance);
  // 글꼴 미리보기를 위해 모든 글꼴을 미리 불러 둠
  useEffect(() => {
    FONTS.forEach((f) => f.load?.().catch(() => undefined));
  }, []);

  const pick = (s: string, f: string) => {
    setLook({ skin: s, font: f });
    saveAppearance(s, f);
  };
  const autoFont = fontOf(skinOf(skin).font);

  return (
    <div className="space-y-6">
      <section>
        <SectionTitle icon={<Palette size={18} />} title="테마" sub="색과 모양을 골라요. 이 기기에만 적용돼요." />
        {(['동화', '모던', '색깔'] as const).map((g) => (
          <div key={g} className="mb-4">
            <p className="text-sm font-bold text-ink-3 mb-2">{g === '동화' ? '무지개 동화' : g === '모던' ? '무채색 모던' : '여러 가지 색'}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {SKINS.filter((s) => s.group === g).map((s) => (
                <SkinCard key={s.id} s={s} on={skin === s.id} onClick={() => (pick(s.id, font), toast(`‘${s.name}’ 테마로 바꿨어요.`))} />
              ))}
            </div>
          </div>
        ))}
      </section>

      <section>
        <SectionTitle icon={<Type size={18} />} title="글꼴" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {[{ id: 'auto', name: '테마 기본', family: autoFont.family, desc: autoFont.name }, ...FONTS].map((f) => {
            const on = font === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => pick(skin, f.id)}
                aria-pressed={on}
                className={cx('text-left rounded-xl border-2 p-3 cursor-pointer transition bg-surface', on ? 'border-brand ring-4 ring-brand/15' : 'border-line hover:border-line-strong')}
              >
                <span className="flex items-center justify-between gap-2 text-xs font-bold text-ink-3">
                  {f.name}
                  {on && <Check size={15} className="text-brand-strong" strokeWidth={3} />}
                </span>
                <span className="block text-xl mt-1 truncate" style={{ fontFamily: f.family }}>
                  우리 반 가나다 123
                </span>
                <span className="block text-xs text-ink-3 mt-0.5 truncate">{f.desc}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// 테마 미리보기 카드: 그 테마의 바탕·카드·버튼 모양을 작게 그림
function SkinCard({ s, on, onClick }: { s: Skin; on: boolean; onClick: () => void }) {
  const r = s.shape.radius;
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={cx('text-left rounded-2xl border-2 p-1.5 cursor-pointer transition bg-surface', on ? 'border-brand ring-4 ring-brand/15' : 'border-line hover:border-line-strong')}>
      <div className="h-24 p-2.5 flex flex-col gap-1.5 overflow-hidden" style={{ background: s.look.aurora, borderRadius: `calc(${r[3]} * 0.7)` }}>
        <div
          className="flex-1 p-2 flex flex-col justify-between"
          style={{ background: s.t.surface, borderRadius: `calc(${r[3]} * 0.6)`, border: `${s.shape.cardBw} solid ${s.shape.cardLine || s.t.line}`, boxShadow: s.shape.shadowCard }}
        >
          <div className="flex gap-1">
            {s.preview.map((c) => (
              <span key={c} className="w-3.5 h-3.5 rounded-full" style={{ background: c, border: `1px solid ${s.t.line}` }} />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 rounded-full flex-1" style={{ background: s.t.surface2 }} />
            <span className="h-5 px-2 text-[10px] font-bold flex items-center" style={{ background: s.look.brandGrad, color: s.t.onBrand || '#fff', borderRadius: r[4] === '0' ? 0 : 99 }}>
              미션
            </span>
          </div>
        </div>
      </div>
      <div className="px-1.5 pt-2 pb-1">
        <p className="font-bold text-sm flex items-center justify-between gap-1">
          {s.name}
          {on && <Check size={15} className="text-brand-strong shrink-0" strokeWidth={3} />}
        </p>
        <p className="text-xs text-ink-3 truncate">{s.desc}</p>
      </div>
    </button>
  );
}

export function ThemeCard() {
  return (
    <Card className="p-5">
      <ThemePicker />
    </Card>
  );
}
