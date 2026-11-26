// 앱 전체에서 쓰는 자료 모양 (시각은 모두 밀리초 숫자)

export const NAME_MAX = 12;
export const NAME_CHANGE_DAYS = 30;
export const MAX_STUDENTS = 40;

export interface InviteCode {
  code: string;
  maxClasses: number;
  usedCount: number;
  active: boolean;
  memo: string;
  createdAt: number;
}

export interface ClassInfo {
  id: string; // 학급 코드
  name: string;
  maxStudents: number;
  createdAt: number;
}

export interface Student {
  sid: string; // 's' + 번호
  number: number;
  name: string;
  joined: boolean; // 학생이 처음 참여를 마쳤는지
  nameAt?: number; // 학생 본인이 이름을 바꾼 때
}

// 바로가기 분류 (학생 화면에서는 맨 앞에 '전체'가 붙음)
export const LINK_CATEGORIES = ['국어', '수학', '사회', '과학', '영어', '도덕', '체육', '음악', '미술', '실과', '기타'] as const;
// 예전 분류(예체능·도구·놀이 등)는 '기타'로 보여 줌
export const linkCategory = (c: string) => ((LINK_CATEGORIES as readonly string[]).includes(c) ? c : '기타');

export interface LinkItem {
  id: string;
  title: string;
  url: string;
  category: string;
  icon: string; // 이모지 (비어 있으면 사이트 아이콘)
  order: number;
  pinned: boolean;
  hidden: boolean;
}

// '지금 열기': 교사가 보낸 바로가기 하나 (그날만 보임)
export interface NowLink {
  title: string;
  url: string;
  icon: string;
  day: string; // YYYY-MM-DD
  at: number;
}

// 미션 칸 상태: 학생이 '완료'를 누르면 done (선생님은 현황만 봄)
export type TaskState = 'todo' | 'done';

// 미션 한 줄. check 가 켜진 줄만 학생이 완료 체크를 함. sub 는 윗줄에 딸린 줄(들여쓰기)
export interface MissionItem {
  id: string;
  text: string;
  check: boolean;
  sub: boolean;
  targets?: string[] | null; // 이 줄을 할 학생 (없거나 null 이면 전체)
}

// 미션 (코드 안에서는 예전 이름 Task 를 그대로 씀)
export interface Task {
  id: string;
  title: string;
  notice: string; // 학생에게 안내할 내용 (공지)
  items: MissionItem[];
  due: string; // YYYY-MM-DD (이 날의 공지·미션)
  targets: string[] | null; // null 이면 전체, 아니면 sid 목록
  linkUrl: string;
  createdAt: number;
}

export interface TaskTemplate {
  id: string;
  title: string;
  notice?: string;
  items: MissionItem[];
  linkUrl: string;
}

export interface TaskMark {
  state: TaskState;
  at: number;
}

// 완료 체크 칸 하나의 이름: 미션ID_줄ID (학생 기록·완료 인원수에 씀)
export const markKey = (taskId: string, itemId: string) => `${taskId}_${itemId}`;
export const checkItems = (t: { items?: MissionItem[] }) => (t.items || []).filter((i) => i.check);
// 이 학생이 할 줄인지 (줄마다 대상 학생을 고를 수 있음)
export const itemFor = (i: MissionItem, sid: string) => !i.targets || i.targets.includes(sid);

// 학생 한 명의 기록: 미션 완료 칸 + 공지 읽은 때
export interface StudentStatus {
  tasks: Record<string, TaskMark>;
  reads: Record<string, number>;
}

export const NOTICE_TAGS = ['안내', '준비물', '행사', '칭찬'] as const;
export type NoticeTag = (typeof NOTICE_TAGS)[number];

export interface NoticeSummary {
  id: string;
  title: string;
  tag: NoticeTag;
  pinned: boolean;
  publishAt: number;
  expireAt: number | null;
  snippet: string;
  images: number;
  at: number;
}

export interface Notice extends NoticeSummary {
  body: string;
  imageData: string[]; // 줄인 그림(data URL), 최대 2장
}

// 학생·TV가 실시간으로 보는 문서 하나 (public/live)
export interface LiveDoc {
  now: NowLink | null;
  notices: Record<string, NoticeSummary>;
  tasks: Record<string, LiveTask>;
  checks: Record<string, true>; // 완료 체크 칸 목록 (보안 규칙이 씀)
  done: Record<string, number>; // 완료 체크 칸별 완료 인원수
}

export interface LiveTask {
  title: string;
  due: string;
  total: number;
  items: MissionItem[];
  targets: string[] | null;
}

// ---- 2차: 학교(나이스) · 1인1역 · 학급 달력 ----
export type SchoolKind = 'els' | 'mis' | 'his';
export interface SchoolInfo {
  office: string; // 시도교육청 코드
  code: string; // 학교 코드
  name: string;
  kind: SchoolKind;
  grade: number;
  classNo: string;
  key: string; // 나이스 인증키 (선택)
}

export interface Role {
  id: string;
  name: string;
  icon: string;
}
// 1인1역: 역할 목록 + 주마다 선생님이 직접 정한 배정 (주의 월요일 → 역할 → 학생 sid 목록)
export interface RolesDoc {
  items: Role[];
  weeks: Record<string, Record<string, string[]>>;
}

export const EVENT_KINDS = ['행사', '시험', '체험학습', '휴일', '기타'] as const;
export interface CalEvent {
  id: string;
  date: string; // YYYY-MM-DD
  end: string; // 끝나는 날 (하루짜리면 date 와 같음)
  title: string;
  kind: string;
}

export interface StudentSession {
  classId: string;
  className: string;
  sid: string;
  number: number;
}
