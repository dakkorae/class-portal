// 서버와 주고받는 모든 동작 (실제 서버와 체험용이 함께 씀)
//
// 서버 자료 구조 (classes/{학급코드}/…)
//   학급 문서 { name, inviteCode, createdAt, maxStudents, refs:{과제·공지 ID:true} }
//   secrets/teacher·reset·tv   비밀번호·재설정 코드 해시, TV 비밀 값 (teacher·reset 은 아무도 못 읽음)
//   teachers/{기기} members/{기기} screens/{기기}   교사·학생·TV 로 등록된 기기
//   students/{sid} pins/{sid} status/{sid}   학생 명단 · PIN 해시 · 과제 상태와 공지 읽음
//   public/roster { name, maxStudents, claimed:{sid:true} }   학급 이름·정원·번호별 등록 여부 (로그인 화면용, 학생 이름 없음)
//   public/live   '지금 열기' · 공지 목록 요약 · 미션 요약 · 완료 체크 칸 목록(checks)과 칸별 완료 인원수 (학생·TV가 실시간으로 봄)
//   public/links { items:{id:바로가기} }   바로가기 모음
//   public/school · public/roles · public/calendar   학교(나이스) 설정 · 1인1역 · 학급 달력 (교사가 씀, 학생은 읽음)
//   tasks/{id} notices/{id}   미션 · 공지(그림 포함)
//   private/templates   미션 템플릿 (교사만)
// 최상위: config/admin(관리자 키 해시, 콘솔에서 만듦) · admins/{기기} · inviteCodes/{코드}
import { Data, DEL, NOW, PermissionError, Store, WriteOp, inc, ts } from './store';
import { adminKeyHash, normalizeCode, pinHash, randomCode, randomId, randomToken, resetCodeHash, teacherKeyHash } from './hash';
import {
  CalEvent,
  ClassInfo,
  InviteCode,
  LinkItem,
  LiveDoc,
  MAX_STUDENTS,
  Notice,
  NoticeSummary,
  NowLink,
  RolesDoc,
  SchoolInfo,
  Student,
  StudentStatus,
  Task,
  TaskMark,
  TaskTemplate,
  checkItems,
  markKey
} from './types';
import { today } from './dates';

const C = (cid: string, rest = '') => `classes/${cid}${rest ? '/' + rest : ''}`;

export const counted = (s?: string) => s === 'done' || s === 'checked';

const toStudent = (sid: string, d: Data): Student => ({
  sid,
  number: Number(d.number) || Number(sid.slice(1)) || 0,
  name: String(d.name || ''),
  joined: !!d.joined,
  ...(d.nameAt ? { nameAt: Number(d.nameAt) } : {})
});

export const emptyLive = (): LiveDoc => ({ now: null, notices: {}, tasks: {}, checks: {}, done: {} });
const toLive = (d: Data | null): LiveDoc => ({
  now: (d?.now as NowLink) || null,
  notices: (d?.notices as LiveDoc['notices']) || {},
  tasks: (d?.tasks as LiveDoc['tasks']) || {},
  checks: (d?.checks as LiveDoc['checks']) || {},
  done: (d?.done as LiveDoc['done']) || {}
});

// 예전 ‘과제’(설명·종이 과제)로 만든 자료는 설명 줄 + ‘다 했어요’ 체크 한 줄로 바꿔 보여 줌
const legacyItems = (d: Data): Task['items'] => [
  ...String(d.desc || '')
    .split(/\r?\n/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((text, i) => ({ id: 'd' + i, text, check: false, sub: false })),
  { id: 'main', text: '다 했어요', check: !d.paper, sub: false }
];

const toTask = (id: string, d: Data): Task => ({
  id,
  title: String(d.title || ''),
  items: Array.isArray(d.items) ? (d.items as Task['items']) : legacyItems(d),
  due: String(d.due || ''),
  targets: (d.targets as string[] | null) ?? null,
  linkUrl: String(d.linkUrl || ''),
  createdAt: Number(d.createdAt) || 0
});

// 미션의 실시간 요약 (학생·TV·교실 화면이 씀)
const liveTaskOf = (t: Pick<Task, 'title' | 'due' | 'items' | 'targets'>, total: number) => ({ title: t.title, due: t.due, total, items: t.items, targets: t.targets });

export function createApi(store: Store) {
  const demo = store.kind === 'demo';
  // 체험용은 보안 규칙이 없으므로 비밀번호 확인을 여기서 대신 함
  const demoMatch = async (path: string, field: string, value: string) => {
    if (!demo) return true;
    const d = await store.get(path);
    return !!d && d[field] === value;
  };
  // 쓰기가 규칙에 막히면 false
  const tryWrite = async (ops: WriteOp[]) => {
    try {
      await store.write(ops);
      return true;
    } catch (e) {
      if (e instanceof PermissionError) return false;
      throw e;
    }
  };

  // 학급의 모든 자료 지우기 (교사의 학급 삭제, 관리자의 개설 코드 삭제)
  const wipeClass = async (cid: string, keepTeacher?: string) => {
    const info = await store.get(C(cid));
    if (!info) return;
    const max = Number(info.maxStudents) || MAX_STUDENTS;
    const refs = Object.keys((info.refs as Data) || {});
    const paths: string[] = [];
    for (let n = 1; n <= max; n++) for (const col of ['students', 'pins', 'status']) paths.push(C(cid, `${col}/s${n}`));
    for (const id of refs) paths.push(C(cid, `tasks/${id}`), C(cid, `notices/${id}`));
    for (const col of ['members', 'screens']) (await store.list(C(cid, col))).forEach((d) => paths.push(C(cid, `${col}/${d.id}`)));
    (await store.list(C(cid, 'teachers'))).filter((d) => d.id !== keepTeacher).forEach((d) => paths.push(C(cid, `teachers/${d.id}`)));
    paths.push(
      C(cid, 'public/roster'),
      C(cid, 'public/live'),
      C(cid, 'public/links'),
      C(cid, 'public/school'),
      C(cid, 'public/roles'),
      C(cid, 'public/calendar'),
      C(cid, 'private/templates'),
      C(cid, 'secrets/reset'),
      C(cid, 'secrets/tv'),
      C(cid, 'secrets/teacher'),
      C(cid)
    );
    for (let i = 0; i < paths.length; i += 10) await store.write(paths.slice(i, i + 10).map((path) => ({ type: 'delete' as const, path })));
  };

  return {
    kind: store.kind,
    uid: () => store.uid(),

    // ================= 관리자 =================
    async adminLogin(key: string) {
      const id = await store.uid();
      const keyHash = await adminKeyHash(key);
      if (demo && key.trim() !== 'demo-admin') return false;
      return tryWrite([{ type: 'set', path: `admins/${id}`, data: { keyHash } }]);
    },
    async isAdmin() {
      const id = await store.uid();
      return !!(await store.get(`admins/${id}`));
    },
    async adminLogout() {
      const id = await store.uid();
      await store.write([{ type: 'delete', path: `admins/${id}` }]);
    },
    async listInviteCodes(): Promise<InviteCode[]> {
      const list = await store.list('inviteCodes');
      return list.map((d) => ({ code: d.id, ...(d.data as Omit<InviteCode, 'code'>) })).sort((a, b) => b.createdAt - a.createdAt);
    },
    async createInviteCode(maxClasses: number, memo: string): Promise<InviteCode> {
      const code = `${randomCode(4)}-${randomCode(4)}`;
      const data = { maxClasses, usedCount: 0, active: true, memo: memo.trim(), createdAt: Date.now() };
      await store.write([{ type: 'set', path: `inviteCodes/${code}`, data }]);
      return { code, ...data };
    },
    async setInviteActive(code: string, active: boolean) {
      await store.write([{ type: 'update', path: `inviteCodes/${code}`, data: { active } }]);
    },
    async listClassesByInvite(code: string) {
      const list = await store.list('classes', { field: 'inviteCode', value: code });
      return list
        .map((d) => ({ id: d.id, name: String(d.data.name || ''), createdAt: Number(d.data.createdAt) || 0 }))
        .sort((a, b) => a.createdAt - b.createdAt);
    },
    async deleteInviteCode(code: string) {
      const classes = await store.list('classes', { field: 'inviteCode', value: code });
      for (const c of classes) await wipeClass(c.id);
      await store.write([{ type: 'delete', path: `inviteCodes/${code}` }]);
      return classes.length;
    },
    async createResetCode(cid: string) {
      const code = `${randomCode(4)}-${randomCode(4)}-${randomCode(2)}`;
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
      await store.write([{ type: 'set', path: C(cid, 'secrets/reset'), data: { codeHash: await resetCodeHash(cid, code), expiresAt: ts(expiresAt) } }]);
      return { code, expiresAt };
    },

    // ================= 교사 =================
    async createClass(input: { inviteCode: string; name: string; maxStudents: number; password: string }): Promise<ClassInfo> {
      const id = await store.uid();
      const code = input.inviteCode.trim().toUpperCase();
      const inv = code ? await store.get(`inviteCodes/${code}`) : null;
      if (!inv || !inv.active || Number(inv.usedCount) >= Number(inv.maxClasses)) {
        throw new Error('개설 코드가 올바르지 않거나 이미 모두 사용되었어요.');
      }
      let cid = randomCode(6);
      // 학급 코드가 겹치는지는 누구나 읽을 수 있는 public/roster 로 확인 (학급 문서는 교사·관리자만 읽음)
      while (await store.get(C(cid, 'public/roster'))) cid = randomCode(6);
      const keyHash = await teacherKeyHash(cid, input.password);
      const max = Math.min(MAX_STUDENTS, Math.max(1, Math.round(input.maxStudents) || 30));
      const info = { name: input.name.trim(), inviteCode: code, createdAt: Date.now(), maxStudents: max };
      // 학급 문서 + 교사 비밀번호 + 이 기기를 교사로 등록 + 기본 문서 + 개설 코드 사용 횟수 올리기를 한 번에
      const ok = await tryWrite([
        { type: 'set', path: C(cid), data: info },
        { type: 'set', path: C(cid, 'secrets/teacher'), data: { keyHash } },
        { type: 'set', path: C(cid, 'teachers/' + id), data: { keyHash } },
        { type: 'set', path: C(cid, 'secrets/tv'), data: { token: randomToken() } },
        { type: 'set', path: C(cid, 'public/roster'), data: { name: info.name, maxStudents: max, claimed: {} } },
        { type: 'set', path: C(cid, 'public/live'), data: { now: null, notices: {}, tasks: {}, checks: {}, done: {} } },
        { type: 'set', path: C(cid, 'public/links'), data: { items: {} } },
        { type: 'update', path: `inviteCodes/${code}`, data: { usedCount: Number(inv.usedCount) + 1 } }
      ]);
      if (!ok) throw new Error('개설 코드를 확인하지 못했어요. 다시 시도해 주세요.');
      return { id: cid, name: info.name, maxStudents: max, createdAt: info.createdAt };
    },
    async teacherLogin(cid: string, password: string) {
      const id = await store.uid();
      const keyHash = await teacherKeyHash(cid, password);
      if (!(await demoMatch(C(cid, 'secrets/teacher'), 'keyHash', keyHash))) return false;
      return tryWrite([{ type: 'set', path: C(cid, 'teachers/' + id), data: { keyHash } }]);
    },
    async resetTeacherPassword(cid: string, code: string, newPassword: string) {
      const id = await store.uid();
      const keyHash = await teacherKeyHash(cid, newPassword);
      const resetHash = await resetCodeHash(cid, code);
      if (demo) {
        const r = await store.get(C(cid, 'secrets/reset'));
        const t = await store.get(C(cid, 'secrets/teacher'));
        if (!r || r.codeHash !== resetHash || Number(r.expiresAt) < Date.now() || t?.resetHash === resetHash) return false;
      }
      return tryWrite([
        { type: 'set', path: C(cid, 'secrets/teacher'), data: { keyHash, resetHash } },
        { type: 'set', path: C(cid, 'teachers/' + id), data: { keyHash } }
      ]);
    },
    async isTeacher(cid: string) {
      const id = await store.uid();
      try {
        return !!(await store.get(C(cid, 'teachers/' + id)));
      } catch {
        return false;
      }
    },
    async teacherLogout(cids: string[]) {
      const id = await store.uid();
      await Promise.all(cids.map((cid) => store.write([{ type: 'delete', path: C(cid, 'teachers/' + id) }]).catch(() => undefined)));
    },
    async renameClass(cid: string, name: string) {
      await store.write([
        { type: 'update', path: C(cid), data: { name: name.trim() } },
        { type: 'update', path: C(cid, 'public/roster'), data: { name: name.trim() } }
      ]);
    },
    async deleteClass(cid: string) {
      const id = await store.uid();
      await wipeClass(cid, id);
      await store.write([{ type: 'delete', path: C(cid, 'teachers/' + id) }]);
    },

    // ---- 학생 명단 (교사) ----
    watchStudents(cid: string, cb: (list: Student[]) => void, onError?: (e: unknown) => void) {
      return store.watchList(C(cid, 'students'), (items) => cb(items.map((i) => toStudent(i.id, i.data)).sort((a, b) => a.number - b.number)), onError);
    },
    // 붙여넣은 명단(번호·이름)으로 학생 문서를 만들거나 이름을 고침
    async upsertStudents(cid: string, rows: { number: number; name: string }[], existing: Student[]) {
      const have = new Map(existing.map((s) => [s.sid, s]));
      const ops: WriteOp[] = rows.map((r) => {
        const sid = 's' + r.number;
        return have.has(sid)
          ? { type: 'update', path: C(cid, 'students/' + sid), data: { name: r.name } }
          : { type: 'set', path: C(cid, 'students/' + sid), data: { number: r.number, name: r.name, joined: false } };
      });
      if (ops.length) await store.write(ops);
    },
    async renameStudent(cid: string, sid: string, name: string) {
      await store.write([{ type: 'set', path: C(cid, 'students/' + sid), data: { number: Number(sid.slice(1)), name: name.trim() }, merge: true }]);
    },
    // PIN 초기화: PIN 해시를 지우면 그 번호로 등록된 기기도 모두 효력을 잃음 → 학생이 다음 로그인 때 새 PIN을 정함
    async resetPin(cid: string, sid: string) {
      await store.write([
        { type: 'delete', path: C(cid, 'pins/' + sid) },
        { type: 'update', path: C(cid, 'public/roster'), data: { ['claimed.' + sid]: DEL } }
      ]);
    },
    async removeStudent(cid: string, sid: string) {
      await store.write([
        { type: 'delete', path: C(cid, 'pins/' + sid) },
        { type: 'delete', path: C(cid, 'status/' + sid) },
        { type: 'delete', path: C(cid, 'students/' + sid) },
        { type: 'update', path: C(cid, 'public/roster'), data: { ['claimed.' + sid]: DEL } }
      ]);
    },
    async setMaxStudents(cid: string, max: number) {
      const n = Math.min(MAX_STUDENTS, Math.max(1, Math.round(max)));
      await store.write([
        { type: 'update', path: C(cid), data: { maxStudents: n } },
        { type: 'update', path: C(cid, 'public/roster'), data: { maxStudents: n } }
      ]);
    },

    // ---- TV 화면 ----
    async getTvToken(cid: string) {
      const d = await store.get(C(cid, 'secrets/tv'));
      if (d?.token) return String(d.token);
      const token = randomToken();
      await store.write([{ type: 'set', path: C(cid, 'secrets/tv'), data: { token } }]);
      return token;
    },
    // 새 주소를 만들면 예전 주소로 연 TV는 더 이상 내용을 받지 못함
    async rotateTvToken(cid: string) {
      const token = randomToken();
      await store.write([{ type: 'set', path: C(cid, 'secrets/tv'), data: { token } }]);
      return token;
    },
    async screenLogin(cid: string, token: string) {
      const id = await store.uid();
      if (!(await demoMatch(C(cid, 'secrets/tv'), 'token', token))) return false;
      return tryWrite([{ type: 'set', path: C(cid, 'screens/' + id), data: { token } }]);
    },

    // ---- 공통: 학급·실시간 문서 ----
    // 학급 이름·정원은 public/roster 에서 읽음 (학급 문서는 교사·관리자만 읽을 수 있음: 개설 코드가 들어 있어서)
    async getClass(classId: string): Promise<ClassInfo | null> {
      const cid = normalizeCode(classId);
      if (!cid) return null;
      const d = await store.get(C(cid, 'public/roster'));
      if (!d) return null;
      return { id: cid, name: String(d.name || ''), maxStudents: Number(d.maxStudents) || 30, createdAt: 0 };
    },
    watchClass(cid: string, cb: (c: ClassInfo | null) => void, onError?: (e: unknown) => void) {
      return store.watch(C(cid, 'public/roster'), (d) => cb(d ? { id: cid, name: String(d.name || ''), maxStudents: Number(d.maxStudents) || 30, createdAt: 0 } : null), onError);
    },
    watchLive(cid: string, cb: (l: LiveDoc) => void, onError?: (e: unknown) => void) {
      return store.watch(C(cid, 'public/live'), (d) => cb(toLive(d)), onError);
    },
    watchRoster(cid: string, cb: (claimed: Record<string, boolean>) => void, onError?: (e: unknown) => void) {
      return store.watch(C(cid, 'public/roster'), (d) => cb(((d?.claimed as Record<string, boolean>) || {}) as Record<string, boolean>), onError);
    },

    // ---- 링크 ----
    watchLinks(cid: string, cb: (list: LinkItem[]) => void, onError?: (e: unknown) => void) {
      return store.watch(
        C(cid, 'public/links'),
        (d) => cb(Object.values((d?.items as Record<string, LinkItem>) || {}).sort((a, b) => a.order - b.order)),
        onError
      );
    },
    async saveLink(cid: string, link: Omit<LinkItem, 'id'> & { id?: string }) {
      const id = link.id || randomId();
      await store.write([{ type: 'update', path: C(cid, 'public/links'), data: { ['items.' + id]: { ...link, id } } }]);
      return id;
    },
    async deleteLink(cid: string, id: string) {
      await store.write([{ type: 'update', path: C(cid, 'public/links'), data: { ['items.' + id]: DEL } }]);
    },
    async reorderLinks(cid: string, ids: string[]) {
      const data: Data = {};
      ids.forEach((id, i) => (data[`items.${id}.order`] = i));
      await store.write([{ type: 'update', path: C(cid, 'public/links'), data }]);
    },
    async patchLink(cid: string, id: string, patch: Partial<Pick<LinkItem, 'pinned' | 'hidden'>>) {
      const data: Data = {};
      for (const [k, v] of Object.entries(patch)) data[`items.${id}.${k}`] = v;
      await store.write([{ type: 'update', path: C(cid, 'public/links'), data }]);
    },
    // '지금 열기' 보내기 (null 이면 끝내기)
    async sendNow(cid: string, link: { title: string; url: string; icon: string } | null) {
      const now: NowLink | null = link ? { ...link, day: today(), at: Date.now() } : null;
      await store.write([{ type: 'update', path: C(cid, 'public/live'), data: { now } }]);
    },

    // ---- 미션 ----
    watchTasks(cid: string, cb: (list: Task[]) => void, onError?: (e: unknown) => void) {
      return store.watchList(
        C(cid, 'tasks'),
        (items) => cb(items.map((i) => toTask(i.id, i.data)).sort((a, b) => (a.due === b.due ? a.createdAt - b.createdAt : a.due.localeCompare(b.due)))),
        onError
      );
    },
    // 미션 저장 + 실시간 요약과 완료 체크 칸 목록을 함께 바꿈 (prev: 고치기 전 미션, 없어진 칸을 지우려고)
    async saveTask(cid: string, task: Omit<Task, 'id' | 'createdAt'> & { id?: string; createdAt?: number }, total: number, prev?: Task) {
      const id = task.id || randomId();
      const data = { title: task.title, items: task.items, due: task.due, targets: task.targets, linkUrl: task.linkUrl, id, createdAt: task.createdAt || Date.now() };
      const live: Data = { ['tasks.' + id]: liveTaskOf(task, total) };
      const keep = new Set(checkItems(task).map((i) => i.id));
      for (const i of checkItems(task)) live['checks.' + markKey(id, i.id)] = true;
      for (const i of prev ? checkItems(prev) : []) if (!keep.has(i.id)) (live['checks.' + markKey(id, i.id)] = DEL), (live['done.' + markKey(id, i.id)] = DEL);
      await store.write([
        { type: 'set', path: C(cid, 'tasks/' + id), data },
        { type: 'update', path: C(cid), data: { ['refs.' + id]: true } },
        { type: 'update', path: C(cid, 'public/live'), data: live }
      ]);
      return id;
    },
    async deleteTask(cid: string, task: Task) {
      const live: Data = { ['tasks.' + task.id]: DEL };
      for (const i of checkItems(task)) (live['checks.' + markKey(task.id, i.id)] = DEL), (live['done.' + markKey(task.id, i.id)] = DEL);
      await store.write([
        { type: 'delete', path: C(cid, 'tasks/' + task.id) },
        { type: 'update', path: C(cid), data: { ['refs.' + task.id]: DEL } },
        { type: 'update', path: C(cid, 'public/live'), data: live }
      ]);
    },
    watchStatuses(cid: string, cb: (map: Record<string, StudentStatus>) => void, onError?: (e: unknown) => void) {
      return store.watchList(
        C(cid, 'status'),
        (items) => {
          const out: Record<string, StudentStatus> = {};
          items.forEach((i) => (out[i.id] = { tasks: (i.data.tasks as StudentStatus['tasks']) || {}, reads: (i.data.reads as StudentStatus['reads']) || {} }));
          cb(out);
        },
        onError
      );
    },
    watchTemplates(cid: string, cb: (list: TaskTemplate[]) => void, onError?: (e: unknown) => void) {
      return store.watch(
        C(cid, 'private/templates'),
        (d) => cb(Object.values((d?.items as Record<string, TaskTemplate>) || {}).map((t) => ({ ...t, items: Array.isArray(t.items) ? t.items : [] }))),
        onError
      );
    },
    async saveTemplate(cid: string, t: Omit<TaskTemplate, 'id'>) {
      const id = randomId();
      await store.write([{ type: 'set', path: C(cid, 'private/templates'), data: { items: { [id]: { ...t, id } } }, merge: true }]);
    },
    async deleteTemplate(cid: string, id: string) {
      await store.write([{ type: 'set', path: C(cid, 'private/templates'), data: { items: { [id]: DEL } }, merge: true }]);
    },
    // 교사 화면이 열려 있을 때 실시간 문서의 미션 요약·완료 칸·완료 인원수를 실제 기록으로 바로잡음
    async syncLive(cid: string, live: LiveDoc, tasks: Task[], students: Student[], statuses: Record<string, StudentStatus>) {
      const wantTasks: LiveDoc['tasks'] = {};
      const wantChecks: LiveDoc['checks'] = {};
      const wantDone: LiveDoc['done'] = {};
      for (const t of tasks) {
        const targets = t.targets ?? students.map((s) => s.sid);
        wantTasks[t.id] = liveTaskOf(t, targets.length);
        for (const i of checkItems(t)) {
          const k = markKey(t.id, i.id);
          wantChecks[k] = true;
          wantDone[k] = targets.filter((sid) => counted(statuses[sid]?.tasks?.[k]?.state)).length;
        }
      }
      const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
      const tasksSame = Object.keys(wantTasks).length === Object.keys(live.tasks).length && Object.entries(wantTasks).every(([k, v]) => same(v, liveTaskOf(live.tasks[k] || { title: '', due: '', items: [], targets: null }, live.tasks[k]?.total ?? -1)));
      const checksSame = Object.keys(wantChecks).length === Object.keys(live.checks).length && Object.keys(wantChecks).every((k) => live.checks[k]);
      const doneSame = Object.keys(wantDone).length === Object.keys(live.done).length && Object.entries(wantDone).every(([k, v]) => live.done[k] === v);
      if (tasksSame && checksSame && doneSame) return;
      await store.write([{ type: 'update', path: C(cid, 'public/live'), data: { tasks: wantTasks, checks: wantChecks, done: wantDone } }]);
    },

    // ---- 2차: 학교(나이스) · 1인1역 · 학급 달력 ----
    watchSchool(cid: string, cb: (s: SchoolInfo | null) => void, onError?: (e: unknown) => void) {
      return store.watch(C(cid, 'public/school'), (d) => cb(d && d.code ? (d as unknown as SchoolInfo) : null), onError);
    },
    async saveSchool(cid: string, school: SchoolInfo | null) {
      await store.write([school ? { type: 'set', path: C(cid, 'public/school'), data: { ...school } } : { type: 'delete', path: C(cid, 'public/school') }]);
    },
    watchRoles(cid: string, cb: (r: RolesDoc | null) => void, onError?: (e: unknown) => void) {
      return store.watch(
        C(cid, 'public/roles'),
        (d) => cb(d ? { items: (d.items as RolesDoc['items']) || [], weeks: (d.weeks as RolesDoc['weeks']) || {} } : null),
        onError
      );
    },
    async saveRoles(cid: string, roles: RolesDoc) {
      await store.write([{ type: 'set', path: C(cid, 'public/roles'), data: { ...roles } }]);
    },
    watchCalendar(cid: string, cb: (list: CalEvent[]) => void, onError?: (e: unknown) => void) {
      return store.watch(
        C(cid, 'public/calendar'),
        (d) => cb(Object.values((d?.items as Record<string, CalEvent>) || {}).sort((a, b) => a.date.localeCompare(b.date))),
        onError
      );
    },
    async saveEvent(cid: string, e: Omit<CalEvent, 'id'> & { id?: string }) {
      const id = e.id || randomId();
      await store.write([{ type: 'set', path: C(cid, 'public/calendar'), data: { items: { [id]: { ...e, id } } }, merge: true }]);
      return id;
    },
    async deleteEvent(cid: string, id: string) {
      await store.write([{ type: 'set', path: C(cid, 'public/calendar'), data: { items: { [id]: DEL } }, merge: true }]);
    },

    // ---- 공지 ----
    watchNotices(cid: string, cb: (list: Notice[]) => void, onError?: (e: unknown) => void) {
      return store.watchList(C(cid, 'notices'), (items) => cb(items.map((i) => ({ ...(i.data as Omit<Notice, 'id'>), id: i.id }) as Notice).sort((a, b) => b.publishAt - a.publishAt)), onError);
    },
    async getNotice(cid: string, id: string): Promise<Notice | null> {
      try {
        const d = await store.get(C(cid, 'notices/' + id));
        return d ? ({ ...(d as unknown as Notice), id } as Notice) : null;
      } catch (e) {
        if (e instanceof PermissionError) return null;
        throw e;
      }
    },
    async saveNotice(cid: string, n: Omit<Notice, 'id' | 'snippet' | 'images' | 'at'> & { id?: string }) {
      const id = n.id || randomId();
      const summary: NoticeSummary = {
        id,
        title: n.title,
        tag: n.tag,
        pinned: n.pinned,
        publishAt: n.publishAt,
        expireAt: n.expireAt,
        snippet: n.body.replace(/\s+/g, ' ').trim().slice(0, 80),
        images: n.imageData.length,
        at: Date.now()
      };
      await store.write([
        { type: 'set', path: C(cid, 'notices/' + id), data: { ...summary, body: n.body, imageData: n.imageData, publishAt: ts(n.publishAt) } },
        { type: 'update', path: C(cid), data: { ['refs.' + id]: true } },
        { type: 'update', path: C(cid, 'public/live'), data: { ['notices.' + id]: summary } }
      ]);
      return id;
    },
    async deleteNotice(cid: string, id: string) {
      await store.write([
        { type: 'delete', path: C(cid, 'notices/' + id) },
        { type: 'update', path: C(cid), data: { ['refs.' + id]: DEL } },
        { type: 'update', path: C(cid, 'public/live'), data: { ['notices.' + id]: DEL } }
      ]);
    },
    async setNoticePinned(cid: string, id: string, pinned: boolean) {
      await store.write([
        { type: 'update', path: C(cid, 'notices/' + id), data: { pinned } },
        { type: 'update', path: C(cid, 'public/live'), data: { [`notices.${id}.pinned`]: pinned } }
      ]);
    },

    // ================= 학생 =================
    // 처음 참여: 이 번호의 PIN을 정하고 이 기기를 그 번호로 등록
    async registerStudent(cid: string, number: number, pin: string): Promise<'ok' | 'taken'> {
      const id = await store.uid();
      const sid = 's' + number;
      const hash = await pinHash(cid, sid, pin);
      if (demo && (await store.get(C(cid, 'pins/' + sid)))) return 'taken';
      const ok = await tryWrite([
        { type: 'set', path: C(cid, 'pins/' + sid), data: { pinHash: hash } },
        { type: 'set', path: C(cid, 'members/' + id), data: { sid, pinHash: hash } },
        { type: 'update', path: C(cid, 'public/roster'), data: { ['claimed.' + sid]: true } }
      ]);
      return ok ? 'ok' : 'taken';
    },
    async loginStudent(cid: string, number: number, pin: string) {
      const id = await store.uid();
      const sid = 's' + number;
      const hash = await pinHash(cid, sid, pin);
      if (!(await demoMatch(C(cid, 'pins/' + sid), 'pinHash', hash))) return false;
      return tryWrite([{ type: 'set', path: C(cid, 'members/' + id), data: { sid, pinHash: hash } }]);
    },
    // 이 기기가 아직 이 학생으로 인정되는지 (교사가 PIN을 초기화했으면 false)
    async checkMember(cid: string, sid: string) {
      const id = await store.uid();
      try {
        const m = await store.get(C(cid, 'members/' + id));
        if (!m || m.sid !== sid) return false;
        if (demo) return await demoMatch(C(cid, 'pins/' + sid), 'pinHash', String(m.pinHash));
        await store.get(C(cid, 'status/' + sid)); // 규칙이 PIN이 맞는지 검사함
        return true;
      } catch {
        return false;
      }
    },
    async getStudent(cid: string, sid: string) {
      const d = await store.get(C(cid, 'students/' + sid));
      return d ? toStudent(sid, d) : null;
    },
    watchStudent(cid: string, sid: string, cb: (s: Student | null) => void, onError?: (e: unknown) => void) {
      return store.watch(C(cid, 'students/' + sid), (d) => cb(d ? toStudent(sid, d) : null), onError);
    },
    // 처음 참여 때 이름 확인 (교사가 넣어 둔 이름을 그대로 쓰거나 고침)
    async confirmName(cid: string, sid: string, name: string) {
      await store.write([{ type: 'set', path: C(cid, 'students/' + sid), data: { number: Number(sid.slice(1)), name: name.trim(), joined: true }, merge: true }]);
    },
    watchMyStatus(cid: string, sid: string, cb: (s: StudentStatus) => void, onError?: (e: unknown) => void) {
      return store.watch(C(cid, 'status/' + sid), (d) => cb({ tasks: (d?.tasks as StudentStatus['tasks']) || {}, reads: (d?.reads as StudentStatus['reads']) || {} }), onError);
    },
    // 학생이 완료 체크 칸 하나를 누르거나 되돌림 + 실시간 완료 인원수 함께 바꾸기 (key = 미션ID_줄ID)
    async markTask(cid: string, sid: string, key: string, prev: TaskMark | undefined, done: boolean) {
      const before = counted(prev?.state);
      const ops: WriteOp[] = [
        { type: 'set', path: C(cid, 'status/' + sid), data: { tasks: { [key]: { state: done ? 'done' : 'todo', at: NOW } }, last: key }, merge: true }
      ];
      if (before !== done) ops.push({ type: 'update', path: C(cid, 'public/live'), data: { ['done.' + key]: inc(done ? 1 : -1), doneLast: key } });
      await store.write(ops);
    },
    async markRead(cid: string, sid: string, noticeId: string) {
      await store.write([{ type: 'set', path: C(cid, 'status/' + sid), data: { reads: { [noticeId]: NOW } }, merge: true }]);
    },
    // 로그아웃: 이 기기의 등록만 지움 (학생 기록은 그대로)
    async leaveClass(cid: string) {
      const id = await store.uid();
      await store.write([{ type: 'delete', path: C(cid, 'members/' + id) }]).catch(() => undefined);
    }
  };
}

export type Api = ReturnType<typeof createApi>;
