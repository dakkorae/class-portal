import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  Timestamp,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  increment,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  query,
  serverTimestamp,
  where,
  writeBatch
} from 'firebase/firestore';
import { Data, PermissionError, Store, WriteOp } from './store';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
}

const isDenied = (e: unknown) => (e as { code?: string })?.code === 'permission-denied';

// 읽은 값에서 Timestamp 를 밀리초 숫자로 바꿈
function plain(v: unknown): unknown {
  if (v instanceof Timestamp) return v.toMillis();
  if (Array.isArray(v)) return v.map(plain);
  if (v && typeof v === 'object') {
    const out: Data = {};
    for (const [k, x] of Object.entries(v)) out[k] = plain(x);
    return out;
  }
  return v;
}

// 쓸 값의 특별한 표시를 Firestore 값으로 바꿈
function toFs(v: unknown): unknown {
  if (v && typeof v === 'object' && '__op' in (v as Data)) {
    const s = v as { __op: string; by?: number; ms?: number };
    if (s.__op === 'now') return serverTimestamp();
    if (s.__op === 'inc') return increment(s.by || 0);
    if (s.__op === 'del') return deleteField();
    if (s.__op === 'ts') return Timestamp.fromMillis(s.ms || 0);
  }
  if (Array.isArray(v)) return v.map(toFs);
  if (v && typeof v === 'object') {
    const out: Data = {};
    for (const [k, x] of Object.entries(v)) if (x !== undefined) out[k] = toFs(x);
    return out;
  }
  return v;
}

export function createFirestoreStore(config: FirebaseConfig): Store {
  const app = initializeApp(config);
  const auth = getAuth(app);
  // 기기에 사본을 두어 다시 열 때 빠르게 뜨고 읽기 횟수도 줄임 (교사 화면과 TV 화면을 같은 브라우저의 여러 탭에서 열어도 되도록)
  let db;
  try {
    db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch {
    db = initializeFirestore(app, {});
  }
  const fs = db;

  let signIn: Promise<string> | null = null;
  const uid = () => {
    if (!signIn) {
      signIn = auth
        .authStateReady()
        .then(() => (auth.currentUser ? auth.currentUser : signInAnonymously(auth).then((c) => c.user)))
        .then((u) => u.uid)
        .catch((e) => {
          signIn = null;
          throw new Error(`서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요. (${(e as Error).message})`);
        });
    }
    return signIn;
  };

  const wrap = async <T,>(p: Promise<T>): Promise<T> => {
    try {
      return await p;
    } catch (e) {
      if (isDenied(e)) throw new PermissionError();
      throw e;
    }
  };

  return {
    kind: 'firebase',
    uid,
    async get(path) {
      await uid();
      const snap = await wrap(getDoc(doc(fs, path)));
      return snap.exists() ? (plain(snap.data()) as Data) : null;
    },
    async list(path, w) {
      await uid();
      const ref = collection(fs, path);
      const snap = await wrap(getDocs(w ? query(ref, where(w.field, '==', w.value)) : ref));
      return snap.docs.map((d) => ({ id: d.id, data: plain(d.data()) as Data }));
    },
    async write(ops: WriteOp[]) {
      await uid();
      // 한 묶음은 최대 500개까지
      for (let i = 0; i < ops.length; i += 450) {
        const batch = writeBatch(fs);
        for (const op of ops.slice(i, i + 450)) {
          const ref = doc(fs, op.path);
          if (op.type === 'delete') batch.delete(ref);
          else if (op.type === 'update') batch.update(ref, toFs(op.data) as Record<string, never>);
          else if (op.merge) batch.set(ref, toFs(op.data) as Data, { merge: true });
          else batch.set(ref, toFs(op.data) as Data);
        }
        await wrap(batch.commit());
      }
    },
    watch(path, cb, onError) {
      let stop: (() => void) | null = null;
      let cancelled = false;
      uid()
        .then(() => {
          if (cancelled) return;
          stop = onSnapshot(
            doc(fs, path),
            (s) => cb(s.exists() ? (plain(s.data({ serverTimestamps: 'estimate' })) as Data) : null),
            (e) => onError?.(isDenied(e) ? new PermissionError() : e)
          );
        })
        .catch((e) => onError?.(e));
      return () => {
        cancelled = true;
        stop?.();
      };
    },
    watchList(path, cb, onError) {
      let stop: (() => void) | null = null;
      let cancelled = false;
      uid()
        .then(() => {
          if (cancelled) return;
          stop = onSnapshot(
            collection(fs, path),
            (s) => cb(s.docs.map((d) => ({ id: d.id, data: plain(d.data({ serverTimestamps: 'estimate' })) as Data }))),
            (e) => onError?.(isDenied(e) ? new PermissionError() : e)
          );
        })
        .catch((e) => onError?.(e));
      return () => {
        cancelled = true;
        stop?.();
      };
    }
  };
}
