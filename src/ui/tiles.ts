// 바로가기 아이콘: 분류별 그림(이모지)과 3D 타일 색
import { LINK_CATEGORIES } from '../lib/types';

export const ICON_GROUPS: Record<(typeof LINK_CATEGORIES)[number], string[]> = {
  국어: ['📖', '📚', '✏️', '📝', '🖊️', '✍️', '📜', '🗣️', '💬', '🔤', '🎭', '📰', '📕', '🔖', '🎤', '🏷️'],
  수학: ['🧮', '➕', '➗', '✖️', '📐', '📏', '🔢', '📊', '📈', '🎲', '🧩', '🔺', '⏱️', '💯', '🪙', '🧠'],
  사회: ['🌏', '🗺️', '🧭', '🏛️', '🏯', '🏙️', '🏘️', '🚩', '⚖️', '🗳️', '👑', '🏺', '🚂', '🌐', '📮', '🧳'],
  과학: ['🔬', '🧪', '🔭', '🧲', '⚗️', '🌱', '🦋', '🐞', '🌋', '🪐', '🌡️', '💡', '🦠', '🧬', '🌊', '⚡'],
  도덕: ['💖', '🤝', '🕊️', '🌈', '😊', '🙏', '🫶', '🌻', '🍀', '🧸', '👪', '💌', '🌟', '🎗️', '☮️', '🫂'],
  미술: ['🎨', '🖌️', '🖍️', '🖼️', '✂️', '🧶', '🪡', '📷', '🎬', '🪅', '🧑‍🎨', '🏺', '🌸', '🎀', '🟣', '🖋️'],
  실과: ['💻', '🤖', '⌨️', '🖱️', '🔧', '🪛', '🛠️', '🧰', '🔌', '🍳', '🥕', '🌾', '🌿', '🐔', '🏠', '🧵'],
  기타: ['⭐', '🎮', '🎵', '🎹', '🎸', '⚽', '🏀', '🏃', '🎯', '🗂️', '📅', '🔗', '📣', '🎁', '🏫', '🔔']
};

// [밝은 색, 진한 색]
export const TILE_COLORS: Record<string, [string, string]> = {
  국어: ['#fb7185', '#e11d48'],
  수학: ['#60a5fa', '#2563eb'],
  사회: ['#fbbf24', '#ea580c'],
  과학: ['#34d399', '#0d9488'],
  도덕: ['#c4b5fd', '#7c3aed'],
  미술: ['#f9a8d4', '#db2777'],
  실과: ['#a3e635', '#15803d'],
  기타: ['#a5b4fc', '#4f46e5']
};

const byIcon = new Map<string, string>();
for (const [cat, list] of Object.entries(ICON_GROUPS)) for (const e of list) if (!byIcon.has(e)) byIcon.set(e, cat);

// 그림이 들어 있는 분류의 색 → 없으면 바로가기 분류의 색 → 기본 색
export const tileColors = (icon?: string, category?: string): [string, string] =>
  TILE_COLORS[(icon && byIcon.get(icon)) || (category && TILE_COLORS[category] ? category : '') || '기타'];
