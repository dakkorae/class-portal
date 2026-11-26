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

export const LINK_CATEGORIES = ['국어', '수학', '사회', '과학', '영어', '예체능', '도구', '놀이', '기타'] as const;

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

// '지금 열기': 교사가 보낸 링크 하나 (그날만 보임)
export interface NowLink {
  title: string;
  url: string;
  icon: string;
  day: string; // YYYY-MM-DD
  at: number;
}

export type TaskState = 'todo' | 'done' | 'checked' | 'redo';
export const TASK_STATE_LABEL: Record<TaskState, string> = {
  todo: '미완료',
  done: '다 했어요',
  checked: '확인',
  redo: '다시 해요'
};

export interface Task {
  id: string;
  title: string;
  desc: string;
  due: string; // YYYY-MM-DD
  targets: string[] | null; // null 이면 전체, 아니면 sid 목록
  linkUrl: string;
  paper: boolean; // 종이 과제 (학생 표시 없이 교사가 확인)
  createdAt: number;
}

export interface TaskTemplate {
  id: string;
  title: string;
  desc: string;
  linkUrl: string;
  paper: boolean;
}

export interface TaskMark {
  state: TaskState;
  note?: string;
  at: number;
}

// 학생 한 명의 기록: 과제 상태 + 공지 읽은 때
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
  tasks: Record<string, { title: string; due: string; total: number; paper: boolean }>;
  done: Record<string, number>; // 과제별 완료(다 했어요 + 확인) 인원수
}

export interface StudentSession {
  classId: string;
  className: string;
  sid: string;
  number: number;
}
