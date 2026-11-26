// 서버 저장소를 감싼 얇은 층
// - 실제 서버(Firestore)와 체험용(이 브라우저 localStorage) 두 가지 구현이 같은 모양을 따름
// - 앱의 모든 동작(api.ts)은 이 모양만 쓰므로, 체험용에서 눌러 본 흐름이 실제 서버에서도 같음
// - 시각(Timestamp)은 읽을 때 모두 밀리초 숫자로 바꿔서 돌려줌

export type Data = Record<string, unknown>;

// 쓰기에 넣는 특별한 값 (서버 시각, 1 올리기, 칸 지우기, 특정 시각)
export type Special =
  | { __op: 'now' }
  | { __op: 'inc'; by: number }
  | { __op: 'del' }
  | { __op: 'ts'; ms: number };

export const NOW: Special = { __op: 'now' };
export const inc = (by: number): Special => ({ __op: 'inc', by });
export const DEL: Special = { __op: 'del' };
export const ts = (ms: number): Special => ({ __op: 'ts', ms });

export type WriteOp =
  | { type: 'set'; path: string; data: Data; merge?: boolean }
  // update: 'tasks.t1' 처럼 점으로 이은 칸 이름을 쓸 수 있음 (그 칸만 바뀜)
  | { type: 'update'; path: string; data: Data }
  | { type: 'delete'; path: string };

export interface Where {
  field: string;
  value: unknown;
}

export interface Store {
  readonly kind: 'firebase' | 'demo';
  uid(): Promise<string>;
  get(path: string): Promise<Data | null>;
  list(collectionPath: string, where?: Where): Promise<{ id: string; data: Data }[]>;
  // 여러 쓰기를 한 번에 (모두 되거나 모두 안 됨). 보안 규칙이 막으면 PermissionError
  write(ops: WriteOp[]): Promise<void>;
  watch(path: string, cb: (d: Data | null) => void, onError?: (e: unknown) => void): () => void;
  watchList(collectionPath: string, cb: (items: { id: string; data: Data }[]) => void, onError?: (e: unknown) => void): () => void;
}

export class PermissionError extends Error {
  constructor(message = '권한이 없어요.') {
    super(message);
  }
}
