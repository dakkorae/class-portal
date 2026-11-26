import { useState } from 'react';
import { CalendarDays, ChevronDown, Eye, EyeOff, LayoutDashboard, ListChecks, LogOut, Megaphone, MonitorUp, Settings2, Sparkles, SquareArrowOutUpRight, UsersRound } from 'lucide-react';
import { Api } from '../lib/api';
import { loadPref, openBoard, savePref } from '../lib/cloud';
import { Button, ErrorNote, IconButton, Spinner, cx, toast } from '../ui/kit';
import { DataContext, useClassData } from './data';
import Dashboard from './Dashboard';
import LinksPanel from './LinksPanel';
import MissionsPanel from './MissionsPanel';
import NoticesPanel from './NoticesPanel';
import ClassPanel from './ClassPanel';
import RolesPanel from './RolesPanel';
import CalendarPanel from './CalendarPanel';

export type Section = 'home' | 'links' | 'tasks' | 'notices' | 'roles' | 'calendar' | 'class';

const NAV: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'home', label: '대시보드', icon: <LayoutDashboard size={19} /> },
  { id: 'tasks', label: '미션', icon: <ListChecks size={19} /> },
  { id: 'links', label: '바로가기', icon: <SquareArrowOutUpRight size={19} /> },
  { id: 'notices', label: '공지', icon: <Megaphone size={19} /> },
  { id: 'roles', label: '1인1역', icon: <UsersRound size={19} /> },
  { id: 'calendar', label: '학급 달력', icon: <CalendarDays size={19} /> },
  { id: 'class', label: '학급 관리', icon: <Settings2 size={19} /> }
];

export default function Workspace({
  api,
  classId,
  savedClasses,
  onSwitch,
  onClassName,
  onClose,
  onLogout,
  onDeleted
}: {
  api: Api;
  classId: string;
  savedClasses: { id: string; name: string }[];
  onSwitch: (c: { id: string; name: string }) => void;
  onClassName: (name: string) => void;
  onClose: () => void;
  onLogout: (all: boolean) => void;
  onDeleted: () => void;
}) {
  const [section, setSection] = useState<Section>(() => loadPref<Section>('section', 'home'));
  const [privacy, setPrivacy] = useState(() => loadPref('privacy', false));
  const [menu, setMenu] = useState(false);
  const data = useClassData(api, classId, privacy);
  const go = (s: Section) => {
    setSection(s);
    savePref('section', s);
    window.scrollTo({ top: 0 });
  };

  // TV 화면 열기: 오늘 미션을 새 창에 크게 띄움 (판서·타이머·번호 뽑기 함께)
  const openTv = () => {
    if (!openBoard(classId)) toast('새 창이 막혔어요. 브라우저 주소창 오른쪽에서 팝업을 허용해 주세요.');
  };

  const name = data.info?.name || savedClasses.find((c) => c.id === classId)?.name || classId;

  return (
    <DataContext.Provider value={data}>
      <div className={cx('min-h-dvh bg-aurora md:flex', privacy && 'privacy')}>
        {/* 넓은 화면: 왼쪽 메뉴 */}
        <aside className="hidden md:flex md:flex-col w-64 shrink-0 h-dvh sticky top-0 border-r border-line bg-surface/60 backdrop-blur px-3 py-4">
          <ClassSwitcher name={name} classId={classId} saved={savedClasses} open={menu} setOpen={setMenu} onSwitch={onSwitch} onClose={onClose} />
          <nav className="mt-4 space-y-1" aria-label="교사 메뉴">
            {NAV.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => go(n.id)}
                aria-current={section === n.id ? 'page' : undefined}
                className={cx(
                  'w-full h-11 px-3 rounded-xl flex items-center gap-3 font-semibold text-[15px] transition cursor-pointer',
                  section === n.id ? 'bg-brand-soft text-brand-strong' : 'text-ink-2 hover:bg-surface-2'
                )}
              >
                {n.icon}
                {n.label}
              </button>
            ))}
          </nav>
          <div className="mt-auto space-y-1">
            <SideAction icon={<MonitorUp size={18} />} label="TV 화면 열기" onClick={openTv} />
            <SideAction
              icon={privacy ? <EyeOff size={18} /> : <Eye size={18} />}
              label={privacy ? '가림 모드 켜짐' : '가림 모드'}
              active={privacy}
              onClick={() => {
                setPrivacy(!privacy);
                savePref('privacy', !privacy);
              }}
            />
            <SideAction icon={<LogOut size={18} />} label="로그아웃" onClick={() => onLogout(false)} />
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          {/* 좁은 화면: 위쪽 머리글 + 가로 메뉴 */}
          <header className="md:hidden sticky top-0 z-30 bg-surface/85 backdrop-blur-xl border-b border-line pt-[env(safe-area-inset-top)]">
            <div className="px-3 h-14 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <ClassSwitcher name={name} classId={classId} saved={savedClasses} open={menu} setOpen={setMenu} onSwitch={onSwitch} onClose={onClose} compact />
              </div>
              <IconButton label="TV 화면 열기" onClick={openTv}>
                <MonitorUp size={19} />
              </IconButton>
              <IconButton
                label={privacy ? '가림 모드 끄기' : '가림 모드 켜기'}
                onClick={() => {
                  setPrivacy(!privacy);
                  savePref('privacy', !privacy);
                }}
                className={privacy ? 'bg-brand-soft text-brand-strong' : ''}
              >
                {privacy ? <EyeOff size={19} /> : <Eye size={19} />}
              </IconButton>
            </div>
            <nav className="flex gap-1 px-2 pb-2 overflow-x-auto scrollbar-none" aria-label="교사 메뉴">
              {NAV.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => go(n.id)}
                  aria-current={section === n.id ? 'page' : undefined}
                  className={cx('h-9 px-3 rounded-lg flex items-center gap-1.5 text-sm font-semibold whitespace-nowrap cursor-pointer', section === n.id ? 'bg-brand-soft text-brand-strong' : 'text-ink-3')}
                >
                  {n.icon}
                  {n.label}
                </button>
              ))}
            </nav>
          </header>

          <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            {data.error && (
              <div className="mb-4">
                <ErrorNote>{data.error}</ErrorNote>
              </div>
            )}
            {!data.ready ? (
              <Spinner />
            ) : !data.info ? (
              <div className="text-center py-16 space-y-4">
                <p className="text-ink-2 font-semibold">학급을 찾지 못했어요. 삭제되었을 수 있어요.</p>
                <Button onClick={onDeleted}>목록으로</Button>
              </div>
            ) : (
              <>
                {section === 'home' && <Dashboard go={go} />}
                {section === 'links' && <LinksPanel />}
                {section === 'tasks' && <MissionsPanel />}
                {section === 'notices' && <NoticesPanel />}
                {section === 'roles' && <RolesPanel />}
                {section === 'calendar' && <CalendarPanel />}
                {section === 'class' && <ClassPanel onClassName={onClassName} onLogout={onLogout} onDeleted={onDeleted} />}
              </>
            )}
          </main>
        </div>
      </div>
    </DataContext.Provider>
  );
}

function SideAction({ icon, label, onClick, active }: { icon: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cx('w-full h-10 px-3 rounded-xl flex items-center gap-3 text-sm font-semibold transition cursor-pointer', active ? 'bg-brand-soft text-brand-strong' : 'text-ink-3 hover:bg-surface-2 hover:text-ink')}>
      {icon}
      {label}
    </button>
  );
}

function ClassSwitcher({ name, classId, saved, open, setOpen, onSwitch, onClose, compact }: { name: string; classId: string; saved: { id: string; name: string }[]; open: boolean; setOpen: (v: boolean) => void; onSwitch: (c: { id: string; name: string }) => void; onClose: () => void; compact?: boolean }) {
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className={cx('w-full flex items-center gap-2.5 rounded-xl hover:bg-surface-2 transition text-left cursor-pointer', compact ? 'px-1.5 py-1' : 'p-2')}>
        <span className={cx('rounded-xl bg-brand-gradient text-white flex items-center justify-center shrink-0 shadow-md shadow-brand/25', compact ? 'w-9 h-9' : 'w-10 h-10')} aria-hidden>
          <Sparkles size={18} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-bold truncate leading-tight">{name}</span>
          <span className="block text-xs text-ink-3 font-mono">학급 코드 {classId}</span>
        </span>
        <ChevronDown size={16} className={cx('text-ink-3 transition shrink-0', open && 'rotate-180')} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 left-0 right-0 mt-1.5 min-w-60 rounded-xl border border-line bg-surface shadow-pop p-1.5 animate-pop">
            {saved
              .filter((c) => c.id !== classId)
              .map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onSwitch(c);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-surface-2 cursor-pointer"
                >
                  <span className="block font-semibold text-sm truncate">{c.name}</span>
                  <span className="block text-xs text-ink-3 font-mono">{c.id}</span>
                </button>
              ))}
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onClose();
              }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-surface-2 text-sm font-semibold text-brand-strong cursor-pointer"
            >
              다른 학급 열기 · 새 학급 만들기
            </button>
          </div>
        </>
      )}
    </div>
  );
}
