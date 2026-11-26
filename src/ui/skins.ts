// 앱 테마(색·모양)와 글꼴 고르기. 기기마다 따로 기억함 (cp_pref_skin, cp_pref_font)
// 테마는 화면 색 토큰(--c-*)과 모서리·테두리·그림자 값을 <html> 에 바로 넣어 바꿈
import { loadPref, savePref } from '../lib/cloud';

type Tokens = {
  canvas: string; surface: string; surface2: string; ink: string; ink2: string; ink3: string; line: string; lineStrong: string;
  brand: string; brandHover: string; brandStrong: string; brandSoft: string; onBrand?: string;
  ok?: string; okSoft?: string; warn?: string; warnSoft?: string; bad?: string; badSoft?: string;
};
type Shape = { radius: [string, string, string, string, string]; cardBw: string; cardLine?: string; shadowCard: string; shadowPop?: string };
type Look = { brandGrad: string; bar: string; aurora: string };

export interface Skin {
  id: string;
  name: string;
  group: '동화' | '모던' | '색깔';
  desc: string;
  font: string; // 테마 기본 글꼴
  dark?: boolean;
  t: Tokens;
  shape: Shape;
  look: Look;
  preview: string[]; // 고르기 화면의 색 점
}

const LIGHT_STATUS = { ok: '#2f9e6c', okSoft: '#e4f8ec', warn: '#b97508', warnSoft: '#fff4d9', bad: '#d9466e', badSoft: '#ffe7ee' };
const DARK_STATUS = { ok: '#7fe0ad', okSoft: '#173326', warn: '#ffd27a', warnSoft: '#3a2c14', bad: '#ff8fab', badSoft: '#3d1b28' };
const ROUND: Shape['radius'] = ['0.6rem', '0.85rem', '1.15rem', '1.6rem', '2rem'];
const SOFT: Shape['radius'] = ['0.5rem', '0.7rem', '0.95rem', '1.3rem', '1.7rem'];
const NORMAL: Shape['radius'] = ['0.375rem', '0.5rem', '0.75rem', '1rem', '1.5rem'];
const SQUARE: Shape['radius'] = ['0', '0', '0', '0', '0'];
const RAINBOW = 'linear-gradient(90deg, #ff9ec4, #ffc98a, #ffe27a, #8fe0b0, #8ec9ff, #c9a7ff)';

// 색 이름 하나로 은은한 배경 번짐 만들기
const glow = (canvas: string, ...c: string[]) =>
  [
    `radial-gradient(42rem 26rem at 0% 0%, color-mix(in oklab, ${c[0]} 34%, transparent), transparent 70%)`,
    `radial-gradient(40rem 26rem at 100% 5%, color-mix(in oklab, ${c[1] || c[0]} 30%, transparent), transparent 70%)`,
    `radial-gradient(44rem 30rem at 85% 100%, color-mix(in oklab, ${c[2] || c[0]} 26%, transparent), transparent 70%)`,
    canvas
  ].join(', ');

export const SKINS: Skin[] = [
  {
    id: 'cottoncandy', name: '솜사탕 파스텔', group: '동화', desc: '무지개 파스텔 · 동글동글', font: 'gowun-dodum',
    t: { canvas: '#fff7fb', surface: '#ffffff', surface2: '#fcf1f7', ink: '#4e3e5e', ink2: '#6a5a7d', ink3: '#8b7a9c', line: '#f6e3ee', lineStrong: '#ebd3e3', brand: '#df5f9f', brandHover: '#cf4f8f', brandStrong: '#c4458a', brandSoft: '#ffe8f3' },
    shape: { radius: ROUND, cardBw: '2px', shadowCard: '0 2px 4px rgb(214 140 190 / 0.06), 0 10px 24px -12px rgb(214 140 190 / 0.38)' },
    look: {
      brandGrad: 'linear-gradient(135deg, #ff9ec4 0%, #e48bd6 50%, #b79bff 100%)', bar: RAINBOW,
      aurora: ['radial-gradient(42rem 26rem at 0% 0%, color-mix(in oklab, #ffb3d1 38%, transparent), transparent 70%)', 'radial-gradient(36rem 24rem at 55% -10%, color-mix(in oklab, #ffe3a3 34%, transparent), transparent 70%)', 'radial-gradient(40rem 26rem at 100% 10%, color-mix(in oklab, #bfe6ff 40%, transparent), transparent 70%)', 'radial-gradient(44rem 30rem at 85% 100%, color-mix(in oklab, #d9c7ff 34%, transparent), transparent 70%)', 'radial-gradient(40rem 28rem at 10% 100%, color-mix(in oklab, #c9f2d6 34%, transparent), transparent 70%)', '#fff7fb'].join(', ')
    },
    preview: ['#ff9ec4', '#ffe27a', '#8fe0b0', '#8ec9ff', '#c9a7ff']
  },
  {
    id: 'crayon', name: '크레파스 동화책', group: '동화', desc: '도화지 · 굵은 테두리 · 스티커 그림자', font: 'gowun-dodum',
    t: { canvas: '#fff7e8', surface: '#ffffff', surface2: '#fff1d6', ink: '#3d2c52', ink2: '#54436a', ink3: '#7a6a7e', line: '#eedfc4', lineStrong: '#d9c6a4', brand: '#f0603d', brandHover: '#de4f2c', brandStrong: '#c8401f', brandSoft: '#ffe5d6' },
    shape: { radius: SOFT, cardBw: '2.5px', cardLine: '#3d2c52', shadowCard: '4px 4px 0 #3d2c52', shadowPop: '6px 6px 0 #3d2c52' },
    look: {
      brandGrad: '#f0603d',
      bar: 'repeating-linear-gradient(90deg, #ff6b6b 0 18px, #ffb84d 18px 36px, #ffe14d 36px 54px, #5fd68a 54px 72px, #4db8ff 72px 90px, #9b7bff 90px 108px)',
      aurora: 'radial-gradient(circle at 18px 18px, #f1dfbf 2px, transparent 2.6px) 0 0 / 32px 32px, #fff7e8'
    },
    preview: ['#ff6b6b', '#ffb84d', '#ffe14d', '#5fd68a', '#4db8ff']
  },
  {
    id: 'jelly', name: '젤리 무지개', group: '동화', desc: '말랑한 젤리 · 보라 포인트', font: 'gowun-dodum',
    t: { canvas: '#fbf8ff', surface: '#ffffff', surface2: '#f4efff', ink: '#3b2a63', ink2: '#54457a', ink3: '#7d70a0', line: '#ece5fb', lineStrong: '#dcd0f5', brand: '#7b4dff', brandHover: '#6a3cf0', brandStrong: '#6235e0', brandSoft: '#efe8ff' },
    shape: { radius: ROUND, cardBw: '0px', shadowCard: '0 12px 30px -14px rgb(123 77 255 / 0.45)' },
    look: { brandGrad: 'linear-gradient(180deg, #a77bff, #7b4dff)', bar: 'linear-gradient(90deg, #ff6fb5, #ffb648, #4fd8a4, #4fa8ff, #a46bff)', aurora: glow('#f6f0ff', '#ffd6f5', '#c6f0ff', '#fff0b3') },
    preview: ['#ff6fb5', '#ffb648', '#4fd8a4', '#4fa8ff', '#a46bff']
  },
  {
    id: 'minimal', name: '화이트 미니멀', group: '모던', desc: '흰 바탕 · 얇은 선 · 검정 포인트', font: 'nanum-gothic',
    t: { canvas: '#f6f6f4', surface: '#ffffff', surface2: '#f1f1ef', ink: '#141414', ink2: '#3c3c3c', ink3: '#707070', line: '#e6e6e4', lineStrong: '#cfcfcd', brand: '#141414', brandHover: '#333333', brandStrong: '#141414', brandSoft: '#ececea', ok: '#1f7a4d', okSoft: '#e8f3ec' },
    shape: { radius: NORMAL, cardBw: '1px', shadowCard: 'none' },
    look: { brandGrad: '#141414', bar: '#141414', aurora: '#f6f6f4' },
    preview: ['#ffffff', '#e6e6e4', '#9a9a9a', '#3c3c3c', '#141414']
  },
  {
    id: 'charcoal', name: '차콜 다크', group: '모던', desc: '어두운 숯색 · 흰 글씨', font: 'nanum-gothic', dark: true,
    t: { canvas: '#121213', surface: '#1d1d1f', surface2: '#26262a', ink: '#f2f2f2', ink2: '#cfcfd3', ink3: '#9e9ea5', line: '#2e2e32', lineStrong: '#45454b', brand: '#ececec', brandHover: '#ffffff', brandStrong: '#ffffff', brandSoft: '#2c2c30', onBrand: '#111111', ok: '#8fe3b4', okSoft: '#1b2e24', warn: '#f2cf7a', warnSoft: '#33291a', bad: '#ff9aae', badSoft: '#3a1f26' },
    shape: { radius: NORMAL, cardBw: '1px', shadowCard: 'none', shadowPop: '0 18px 44px -12px rgb(0 0 0 / 0.7)' },
    look: { brandGrad: '#ececec', bar: 'linear-gradient(90deg, #8a8a8a, #ffffff)', aurora: '#121213' },
    preview: ['#121213', '#26262a', '#45454b', '#9e9ea5', '#f2f2f2']
  },
  {
    id: 'grid', name: '그레이 그리드', group: '모던', desc: '각진 모서리 · 굵은 검정 선', font: 'nanum-gothic',
    t: { canvas: '#e9e9e6', surface: '#ffffff', surface2: '#f0f0ed', ink: '#111111', ink2: '#333333', ink3: '#666666', line: '#d3d3cf', lineStrong: '#111111', brand: '#111111', brandHover: '#333333', brandStrong: '#111111', brandSoft: '#e2e2de', ok: '#1f7a4d', okSoft: '#e5efe8' },
    shape: { radius: SQUARE, cardBw: '1.5px', cardLine: '#111111', shadowCard: 'none', shadowPop: '6px 6px 0 #111111' },
    look: { brandGrad: '#111111', bar: '#111111', aurora: '#e9e9e6' },
    preview: ['#ffffff', '#e9e9e6', '#9a9a96', '#333333', '#111111']
  },
  {
    id: 'mint', name: '민트 숲', group: '색깔', desc: '싱그러운 초록', font: 'gowun-dodum',
    t: { canvas: '#f2fbf6', surface: '#ffffff', surface2: '#e9f7ef', ink: '#1d3a31', ink2: '#33564b', ink3: '#5c7a70', line: '#d9efe3', lineStrong: '#bfe1cf', brand: '#14936d', brandHover: '#0f805e', brandStrong: '#0e7556', brandSoft: '#dcf4e9' },
    shape: { radius: SOFT, cardBw: '1.5px', shadowCard: '0 10px 24px -14px rgb(20 147 109 / 0.35)' },
    look: { brandGrad: 'linear-gradient(135deg, #3cc79a, #14936d)', bar: 'linear-gradient(90deg, #a3e6c4, #3cc79a, #14936d)', aurora: glow('#f2fbf6', '#a8ecd0', '#d4f3a8', '#9fe0ea') },
    preview: ['#d4f3a8', '#a8ecd0', '#3cc79a', '#14936d', '#0e5c45']
  },
  {
    id: 'ocean', name: '바다 하늘', group: '색깔', desc: '시원한 파랑', font: 'gowun-dodum',
    t: { canvas: '#f2f7ff', surface: '#ffffff', surface2: '#e8f1ff', ink: '#1b2d48', ink2: '#33496b', ink3: '#5b7091', line: '#dae7fa', lineStrong: '#bdd3f2', brand: '#2672d9', brandHover: '#1d62c2', brandStrong: '#1a58b0', brandSoft: '#dfeaff' },
    shape: { radius: SOFT, cardBw: '1.5px', shadowCard: '0 10px 24px -14px rgb(38 114 217 / 0.35)' },
    look: { brandGrad: 'linear-gradient(135deg, #4fb3ff, #2672d9)', bar: 'linear-gradient(90deg, #9fe3ff, #4fb3ff, #2672d9)', aurora: glow('#f2f7ff', '#a9dcff', '#b9f0ee', '#c9d4ff') },
    preview: ['#b9f0ee', '#a9dcff', '#4fb3ff', '#2672d9', '#173f7a']
  },
  {
    id: 'lemon', name: '레몬 햇살', group: '색깔', desc: '따뜻한 노랑·주황', font: 'gowun-dodum',
    t: { canvas: '#fffbec', surface: '#ffffff', surface2: '#fff4d6', ink: '#3e3015', ink2: '#5b4a26', ink3: '#7e6c45', line: '#f6e8bd', lineStrong: '#ead69a', brand: '#c76a00', brandHover: '#b05d00', brandStrong: '#9e5300', brandSoft: '#ffefc7' },
    shape: { radius: ROUND, cardBw: '2px', shadowCard: '0 10px 24px -14px rgb(220 150 20 / 0.4)' },
    look: { brandGrad: 'linear-gradient(135deg, #ffb53d, #e07a00)', bar: 'linear-gradient(90deg, #ffe46b, #ffb53d, #ff8a3d)', aurora: glow('#fffbec', '#ffe680', '#ffc89a', '#fff3b0') },
    preview: ['#fff3b0', '#ffe46b', '#ffb53d', '#ff8a3d', '#c76a00']
  },
  {
    id: 'lavender', name: '라벤더 꿈', group: '색깔', desc: '은은한 보라', font: 'gowun-dodum',
    t: { canvas: '#f8f5ff', surface: '#ffffff', surface2: '#f1ebff', ink: '#2f2547', ink2: '#4a3e66', ink3: '#71668c', line: '#e9e1fa', lineStrong: '#d6c9f3', brand: '#8452e8', brandHover: '#7441d9', brandStrong: '#6a38cc', brandSoft: '#eee6ff' },
    shape: { radius: ROUND, cardBw: '1.5px', shadowCard: '0 10px 24px -14px rgb(132 82 232 / 0.35)' },
    look: { brandGrad: 'linear-gradient(135deg, #c3a1ff, #8452e8)', bar: 'linear-gradient(90deg, #f1c6ff, #c3a1ff, #8452e8)', aurora: glow('#f8f5ff', '#dcc8ff', '#ffd1ec', '#c8d6ff') },
    preview: ['#ffd1ec', '#f1c6ff', '#c3a1ff', '#8452e8', '#4b2a99']
  },
  {
    id: 'indigo', name: '인디고 클래식', group: '색깔', desc: '처음 디자인 · 남색 보라', font: 'noto-sans-kr',
    t: { canvas: '#f5f6fa', surface: '#ffffff', surface2: '#f0f2f8', ink: '#0e1120', ink2: '#383d52', ink3: '#62677d', line: '#e3e6ef', lineStrong: '#cdd2df', brand: '#4f46e5', brandHover: '#4338ca', brandStrong: '#4338ca', brandSoft: '#eef0ff', ok: '#047857', okSoft: '#e4f6ee', warn: '#a14a05', warnSoft: '#fff3dd', bad: '#be123c', badSoft: '#ffe9ee' },
    shape: { radius: NORMAL, cardBw: '1px', shadowCard: '0 1px 2px rgb(15 18 34 / 0.04), 0 4px 16px -4px rgb(15 18 34 / 0.06)' },
    look: { brandGrad: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 55%, #c026d3 100%)', bar: '#4f46e5', aurora: glow('#f5f6fa', '#6366f1', '#a855f7', '#e0e7ff') },
    preview: ['#e0e7ff', '#a5b4fc', '#6366f1', '#7c3aed', '#c026d3']
  },
  {
    id: 'plum', name: '자두 밤하늘', group: '색깔', desc: '짙은 보라 · 어두운 화면', font: 'gowun-dodum', dark: true,
    t: { canvas: '#1d1627', surface: '#271e33', surface2: '#30253f', ink: '#fcf0fa', ink2: '#e0cfe8', ink3: '#b7a5c8', line: '#3b2f4d', lineStrong: '#4d3e63', brand: '#e46aa6', brandHover: '#ee7bb3', brandStrong: '#ffb0d6', brandSoft: '#43264a', ...DARK_STATUS },
    shape: { radius: ROUND, cardBw: '1.5px', shadowCard: '0 12px 28px -16px rgb(0 0 0 / 0.7)', shadowPop: '0 18px 44px -12px rgb(0 0 0 / 0.7)' },
    look: { brandGrad: 'linear-gradient(135deg, #ff8fc0 0%, #c08bea 100%)', bar: RAINBOW, aurora: glow('#1d1627', '#7a3d7a', '#3d3d8a', '#5a2d5a') },
    preview: ['#1d1627', '#43264a', '#e46aa6', '#c08bea', '#ffb0d6']
  }
];

export interface FontOption {
  id: string;
  name: string;
  family: string;
  desc: string;
  load?: () => Promise<unknown>;
}
export const FONTS: FontOption[] = [
  { id: 'gowun-dodum', name: '고운돋움', family: '"Gowun Dodum"', desc: '부드럽고 단정한' },
  { id: 'nanum-gothic', name: '나눔고딕', family: '"Nanum Gothic"', desc: '익숙하고 또렷한', load: () => Promise.all([import('@fontsource/nanum-gothic/400.css'), import('@fontsource/nanum-gothic/700.css'), import('@fontsource/nanum-gothic/800.css')]) },
  { id: 'noto-sans-kr', name: '본고딕', family: '"Noto Sans KR"', desc: '깔끔한 기본 글꼴', load: () => Promise.all([import('@fontsource/noto-sans-kr/400.css'), import('@fontsource/noto-sans-kr/700.css')]) },
  { id: 'jua', name: '주아', family: 'Jua', desc: '동글동글 귀여운', load: () => import('@fontsource/jua/400.css') },
  { id: 'do-hyeon', name: '도현', family: '"Do Hyeon"', desc: '굵고 힘 있는', load: () => import('@fontsource/do-hyeon/400.css') },
  { id: 'gaegu', name: '개구', family: 'Gaegu', desc: '손글씨 느낌', load: () => Promise.all([import('@fontsource/gaegu/400.css'), import('@fontsource/gaegu/700.css')]) },
  { id: 'gowun-batang', name: '고운바탕', family: '"Gowun Batang"', desc: '책 같은 바탕체', load: () => Promise.all([import('@fontsource/gowun-batang/400.css'), import('@fontsource/gowun-batang/700.css')]) },
  { id: 'system', name: '기기 기본', family: '-apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif', desc: '기기에 들어 있는 글꼴' }
];
const FALLBACK = ', -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", "Segoe UI", Roboto, sans-serif';

export const DEFAULT_SKIN = 'cottoncandy';
export const skinOf = (id: string) => SKINS.find((s) => s.id === id) || SKINS[0];
export const fontOf = (id: string) => FONTS.find((f) => f.id === id) || FONTS[0];

// 테마·글꼴을 화면에 적용 (fontId 가 'auto' 면 테마 기본 글꼴)
export function applyAppearance(skinId: string, fontId: string = 'auto') {
  const s = skinOf(skinId);
  const f = fontOf(fontId === 'auto' ? s.font : fontId);
  f.load?.().catch(() => undefined);
  const r = document.documentElement;
  const st = { ...LIGHT_STATUS, ...(s.dark ? DARK_STATUS : {}), ...s.t };
  const vars: Record<string, string> = {
    '--c-canvas': st.canvas, '--c-surface': st.surface, '--c-surface-2': st.surface2, '--c-ink': st.ink, '--c-ink-2': st.ink2, '--c-ink-3': st.ink3,
    '--c-line': st.line, '--c-line-strong': st.lineStrong, '--c-brand': st.brand, '--c-brand-hover': st.brandHover, '--c-brand-strong': st.brandStrong,
    '--c-brand-soft': st.brandSoft, '--c-on-brand': st.onBrand || '#ffffff', '--c-ok': st.ok, '--c-ok-soft': st.okSoft, '--c-warn': st.warn,
    '--c-warn-soft': st.warnSoft, '--c-bad': st.bad, '--c-bad-soft': st.badSoft,
    '--radius-md': s.shape.radius[0], '--radius-lg': s.shape.radius[1], '--radius-xl': s.shape.radius[2], '--radius-2xl': s.shape.radius[3], '--radius-3xl': s.shape.radius[4],
    '--card-bw': s.shape.cardBw, '--card-line': s.shape.cardLine || st.line, '--shadow-card': s.shape.shadowCard,
    '--shadow-pop': s.shape.shadowPop || '0 18px 44px -12px rgb(60 40 80 / 0.3)',
    '--btn-radius': s.shape.radius[4] === '0' ? '0' : s.shape.radius === ROUND ? '999px' : s.shape.radius[2],
    '--brand-grad': s.look.brandGrad, '--bar': s.look.bar, '--aurora': s.look.aurora,
    '--font-sans': f.family + FALLBACK
  };
  for (const [k, v] of Object.entries(vars)) r.style.setProperty(k, v);
  r.style.colorScheme = s.dark ? 'dark' : 'light';
  r.dataset.skin = s.id;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', st.canvas);
}

export const loadAppearance = () => ({ skin: loadPref('skin', DEFAULT_SKIN), font: loadPref('font', 'auto') });
export function saveAppearance(skin: string, font: string) {
  savePref('skin', skin);
  savePref('font', font);
  applyAppearance(skin, font);
}
