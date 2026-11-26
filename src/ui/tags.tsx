import { Backpack, CalendarHeart, Info, PartyPopper } from 'lucide-react';
import { NoticeTag } from '../lib/types';
import { Badge } from './kit';

// 공지 말머리: 색과 함께 아이콘·글자를 같이 보여 줌 (색만으로 구분하지 않음)
const TAGS: Record<NoticeTag, { tone: 'brand' | 'warn' | 'ok' | 'bad'; icon: React.ReactNode }> = {
  안내: { tone: 'brand', icon: <Info size={12} /> },
  준비물: { tone: 'warn', icon: <Backpack size={12} /> },
  행사: { tone: 'bad', icon: <CalendarHeart size={12} /> },
  칭찬: { tone: 'ok', icon: <PartyPopper size={12} /> }
};

export function TagBadge({ tag }: { tag: NoticeTag }) {
  const t = TAGS[tag] || TAGS['안내'];
  return (
    <Badge tone={t.tone} icon={t.icon}>
      {tag}
    </Badge>
  );
}
