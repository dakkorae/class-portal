import { AlarmClock, Dices, Expand, ListChecks, MonitorUp, PenLine, Timer, ZoomIn } from 'lucide-react';
import { BoardMode, openBoard } from '../lib/cloud';
import { today } from '../lib/dates';
import { Button, Card, SectionTitle, toast } from '../ui/kit';
import { useData } from './data';

// TV·편의기능: 교실 TV(전자칠판)에 띄울 화면을 새 창으로 엶
const TOOLS: { mode: BoardMode; icon: React.ReactNode; title: string; desc: string }[] = [
  { mode: 'mission', icon: <ListChecks size={26} />, title: '공지·미션 크게 띄우기', desc: '오늘 올린 공지와 미션을 크게 보여 줘요. 글자 크기를 키우고 줄일 수 있고, 체크한 인원도 보여요.' },
  { mode: 'write', icon: <PenLine size={26} />, title: '판서', desc: '공지·미션과 따로 전할 내용을 키보드로 크게 쓰거나, 펜으로 직접 그려요.' },
  { mode: 'timer', icon: <Timer size={26} />, title: '타이머', desc: '1·3·5·10분 등을 골라 크게 재요. 끝나면 소리가 나요.' },
  { mode: 'picker', icon: <Dices size={26} />, title: '번호 뽑기', desc: '우리 반 번호 중 하나를 뽑아요. 한 번 뽑힌 번호는 뺄 수 있어요.' },
  { mode: 'late', icon: <AlarmClock size={26} />, title: '지각생 하교 타이머', desc: '지각한 시간만큼 기다린 뒤 하교하도록 학생마다 시간을 재요.' }
];

export default function TvToolsPanel() {
  const d = useData();
  const todayCount = d.tasks.filter((t) => t.due === today()).length;
  const open = (mode?: BoardMode) => {
    if (!openBoard(d.classId, undefined, mode)) toast('새 창이 막혔어요. 브라우저 주소창 오른쪽에서 팝업을 허용해 주세요.');
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        icon={<MonitorUp size={20} />}
        title={<span className="text-2xl">TV·편의기능</span>}
        sub="교실 TV(전자칠판)에 연결된 이 컴퓨터에서 새 창으로 띄워요. 창 안에서도 메뉴를 바꿀 수 있어요."
        action={
          <Button size="lg" icon={<MonitorUp size={19} />} onClick={() => open()}>
            TV 화면 열기
          </Button>
        }
      />

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {TOOLS.map((t) => (
          <Card key={t.mode} className="p-5 flex flex-col gap-3">
            <span className="w-12 h-12 rounded-2xl bg-brand-soft text-brand-strong flex items-center justify-center">{t.icon}</span>
            <div className="flex-1">
              <h3 className="text-lg font-bold">{t.title}</h3>
              <p className="text-sm text-ink-3 mt-1">{t.desc}</p>
              {t.mode === 'mission' && <p className="text-sm font-semibold text-brand-strong mt-2">오늘 올린 공지·미션 {todayCount}개</p>}
            </div>
            <Button variant="soft" icon={<MonitorUp size={16} />} onClick={() => open(t.mode)}>
              띄우기
            </Button>
          </Card>
        ))}
      </div>

      <Card className="p-5 space-y-2 text-sm text-ink-2">
        <h3 className="font-bold text-ink">쓰는 법</h3>
        <p className="flex items-start gap-2">
          <ZoomIn size={16} className="mt-0.5 shrink-0 text-brand-strong" /> 창 위쪽의 <b>−</b> / <b>+</b> 로 글자 배율을 60%~180%까지 바꿔요. 이 기기에 기억돼요.
        </p>
        <p className="flex items-start gap-2">
          <PenLine size={16} className="mt-0.5 shrink-0 text-brand-strong" /> 펜 버튼(또는 키보드 P)을 누르면 어떤 화면 위에든 그릴 수 있어요.
        </p>
        <p className="flex items-start gap-2">
          <Expand size={16} className="mt-0.5 shrink-0 text-brand-strong" /> 전체 화면 버튼(또는 키보드 F)으로 TV에 꽉 차게 보여요.
        </p>
        <p className="text-ink-3">새 창이 안 뜨면 크롬 주소창 오른쪽의 팝업 차단 표시를 눌러 ‘항상 허용’을 골라 주세요.</p>
      </Card>
    </div>
  );
}
