import { Api, createApi } from './api';
import { DEFAULT_FIREBASE_CONFIG } from './firebaseConfig';
import { StudentSession } from './types';

// 어떤 서버를 쓸지 결정
// - VITE_CLOUD_DEMO=1 이거나 Firebase 설정이 비어 있으면 체험용(이 브라우저 안에서만 동작)
// - 그 밖에는 실제 서버(Firebase). .env 의 VITE_FIREBASE_* 값이 firebaseConfig.ts 보다 우선
const env = import.meta.env;
const config = {
  apiKey: (env.VITE_FIREBASE_API_KEY as string | undefined) || DEFAULT_FIREBASE_CONFIG.apiKey,
  authDomain: (env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined) || DEFAULT_FIREBASE_CONFIG.authDomain,
  projectId: (env.VITE_FIREBASE_PROJECT_ID as string | undefined) || DEFAULT_FIREBASE_CONFIG.projectId,
  appId: (env.VITE_FIREBASE_APP_ID as string | undefined) || DEFAULT_FIREBASE_CONFIG.appId
};

export const cloudMode: 'firebase' | 'demo' = env.VITE_CLOUD_DEMO === '1' || !config.apiKey || !config.projectId ? 'demo' : 'firebase';

let apiPromise: Promise<Api> | null = null;
export function getApi(): Promise<Api> {
  if (!apiPromise) {
    apiPromise =
      cloudMode === 'firebase'
        ? import('./firestoreStore').then((m) =>
            createApi(
              m.createFirestoreStore({
                apiKey: config.apiKey,
                authDomain: config.authDomain || `${config.projectId}.firebaseapp.com`,
                projectId: config.projectId,
                appId: config.appId
              })
            )
          )
        : import('./localStore').then((m) => createApi(m.createLocalStore()));
    apiPromise.catch(() => (apiPromise = null));
  }
  return apiPromise;
}

export const errorMessage = (e: unknown) => {
  const code = (e as { code?: string })?.code;
  if (code === 'unavailable') return '서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.';
  return e instanceof Error && e.message ? e.message : '문제가 생겼어요. 잠시 후 다시 시도해 주세요.';
};

// ---- 이 기기에 기억하는 값 (모두 cp_ 로 시작) ----
const read = <T,>(key: string, fallback: T): T => {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key: string, value: unknown) => {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 저장이 막힌 브라우저(사생활 보호 모드 등)는 무시
  }
};

export const loadStudentSession = () => {
  const s = read<StudentSession | null>('cp_student', null);
  return s && s.classId && s.sid ? s : null;
};
export const saveStudentSession = (s: StudentSession | null) => write('cp_student', s);

// 학생 기기가 기억하는 학급 코드 (로그아웃해도 남김: 다음 학생이 번호만 고르면 되도록)
export const loadRememberedClass = () => read<{ id: string; name: string } | null>('cp_class', null);
export const saveRememberedClass = (c: { id: string; name: string } | null) => write('cp_class', c);

export const loadTeacherClasses = () => {
  const list = read<{ id: string; name: string }[]>('cp_teacher_classes', []);
  return Array.isArray(list) ? list : [];
};
export const saveTeacherClasses = (list: { id: string; name: string }[]) => write('cp_teacher_classes', list);

export const loadPref = <T,>(key: string, fallback: T) => read<T>('cp_pref_' + key, fallback);
export const savePref = (key: string, value: unknown) => write('cp_pref_' + key, value);

// 주소 만들기
const base = () => `${window.location.origin}${window.location.pathname}`;
export const inviteUrl = (classId: string) => `${base()}?join=${classId}`;
export const tvUrl = (classId: string, token: string) => `${base()}#tv/${classId}/${token}`;
