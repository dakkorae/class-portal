import { Data, Store, WriteOp } from './store';

// 체험용 저장소: 서버 없이 이 브라우저(localStorage) 안에서만 동작
// - 같은 브라우저의 다른 탭(예: TV 화면)에도 바로 반영됨
// - 보안 규칙은 검사하지 않음 (권한 검사는 실제 서버의 firestore.rules 가 담당)
// - 체험용 개설 코드 DEMO-2026, 관리자 키 demo-admin
const KEY = 'cp_demo_store';
const UID_KEY = 'cp_demo_uid';

type Docs = Record<string, Data>;

const load = (): Docs => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
};

const clone = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

function seed(docs: Docs) {
  if (!docs['inviteCodes/DEMO-2026']) {
    docs['inviteCodes/DEMO-2026'] = { maxClasses: 99, usedCount: 0, active: true, memo: '체험용', createdAt: Date.now() };
  }
}

const isSpecial = (v: unknown): v is { __op: string; by?: number; ms?: number } =>
  !!v && typeof v === 'object' && '__op' in (v as Data);
const isObj = (v: unknown): v is Data => !!v && typeof v === 'object' && !Array.isArray(v) && !isSpecial(v);

// 특별한 표시를 실제 값으로 (set: 통째로 바꾸기)
function resolve(v: unknown, now: number, prev?: unknown): unknown {
  if (isSpecial(v)) {
    if (v.__op === 'now') return now;
    if (v.__op === 'ts') return v.ms;
    if (v.__op === 'inc') return (Number(prev) || 0) + (v.by || 0);
    return undefined;
  }
  if (Array.isArray(v)) return v.map((x) => resolve(x, now));
  if (isObj(v)) {
    const out: Data = {};
    for (const [k, x] of Object.entries(v)) {
      const r = resolve(x, now);
      if (r !== undefined) out[k] = r;
    }
    return out;
  }
  return v;
}

// set(merge): 하위 칸까지 합침
function mergeInto(target: Data, data: Data, now: number) {
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    if (isSpecial(v)) {
      if (v.__op === 'del') delete target[k];
      else target[k] = resolve(v, now, target[k]);
    } else if (isObj(v)) {
      if (!isObj(target[k])) target[k] = {};
      mergeInto(target[k] as Data, v, now);
    } else target[k] = resolve(v, now);
  }
}

// update: 'a.b.c' 칸만 바꿈 (값이 객체면 그 칸을 통째로 바꿈)
function setPath(target: Data, key: string, v: unknown, now: number) {
  const parts = key.split('.');
  let cur = target;
  for (const p of parts.slice(0, -1)) {
    if (!isObj(cur[p])) cur[p] = {};
    cur = cur[p] as Data;
  }
  const last = parts[parts.length - 1];
  if (isSpecial(v) && v.__op === 'del') delete cur[last];
  else cur[last] = resolve(v, now, cur[last]);
}

export function createLocalStore(): Store {
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());
  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel('cp_demo');
    channel.onmessage = notify;
  } catch {
    // 지원하지 않는 브라우저: 같은 탭에서만 반영
  }
  window.addEventListener('storage', (e) => e.key === KEY && notify());

  const read = () => {
    const d = load();
    seed(d);
    return d;
  };
  const save = (docs: Docs) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(docs));
    } catch {
      throw new Error('이 기기에 저장할 공간이 부족해요. 체험용 자료를 지우고 다시 시도해 주세요.');
    }
    notify();
    channel?.postMessage('changed');
  };
  const childrenOf = (docs: Docs, path: string) => {
    const depth = path.split('/').length + 1;
    return Object.keys(docs)
      .filter((k) => k.startsWith(path + '/') && k.split('/').length === depth)
      .map((k) => ({ id: k.split('/').pop()!, data: clone(docs[k]) }));
  };

  let myUid = localStorage.getItem(UID_KEY) || '';
  if (!myUid) {
    myUid = 'dev' + Math.random().toString(36).slice(2, 10);
    try {
      localStorage.setItem(UID_KEY, myUid);
    } catch {
      // 무시
    }
  }

  return {
    kind: 'demo',
    uid: async () => myUid,
    async get(path) {
      const d = read()[path];
      return d ? clone(d) : null;
    },
    async list(path, w) {
      const items = childrenOf(read(), path);
      return w ? items.filter((i) => i.data[w.field] === w.value) : items;
    },
    async write(ops: WriteOp[]) {
      const docs = read();
      const now = Date.now();
      for (const op of ops) {
        if (op.type === 'delete') delete docs[op.path];
        else if (op.type === 'set' && !op.merge) docs[op.path] = resolve(op.data, now) as Data;
        else if (op.type === 'set') {
          const cur = docs[op.path] || {};
          mergeInto(cur, op.data, now);
          docs[op.path] = cur;
        } else {
          if (!docs[op.path]) throw new Error('없는 문서를 고치려 했어요.');
          for (const [k, v] of Object.entries(op.data)) setPath(docs[op.path], k, v, now);
        }
      }
      save(docs);
    },
    watch(path, cb) {
      let last = '';
      const run = () => {
        const d = read()[path] || null;
        const s = JSON.stringify(d);
        if (s !== last) {
          last = s;
          cb(clone(d));
        }
      };
      listeners.add(run);
      queueMicrotask(run);
      return () => listeners.delete(run);
    },
    watchList(path, cb) {
      let last = '';
      const run = () => {
        const items = childrenOf(read(), path);
        const s = JSON.stringify(items);
        if (s !== last) {
          last = s;
          cb(items);
        }
      };
      listeners.add(run);
      queueMicrotask(run);
      return () => listeners.delete(run);
    }
  };
}

export function resetDemo() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 무시
  }
}
