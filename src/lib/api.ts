// 서버와 주고받는 모든 동작 (실제 서버와 체험용이 함께 씀)
//
// 서버 자료 구조 (classes/{학급코드}/…)
//   학급 문서 { name, inviteCode, createdAt, maxStudents, refs:{과제·공지 ID:true} }
//   secrets/teacher·reset·tv   비밀번호·재설정 코드 해시, TV 비밀 값 (teacher·reset 은 아무도 못 읽음)
//   teachers/{기기} members/{기기} screens/{기기}   교사·학생·TV 로 등록된 기기
//   students/{sid} pins/{sid} status/{sid}   학생 명단 · PIN 해시 · 과제 상태와 공지 읽음
//   public/roster { name, maxStudents, claimed:{sid:true} }   학급 이름·정원·번호별 등록 여부 (로그인 화면용, 학생 이름 없음)
//   public/live   '지금 열기' · 공지 목록 요약 · 오늘 과제 요약과 완료 인원수 (학생·TV가 실시간으로 봄)
//   public/links { items:{id:링크} }   링크 모음
//   tasks/{id} notices/{id}   과제 · 공지(그림 포함)
//   private/templates   과제 템플릿 (교사만)
// 최상위: config/admin(관리자 키 해시, 콘솔에서 만듦) · admins/{기기} · inviteCodes/{코드}
import { Data, DEL, NOW, PermissionError, Store, WriteOp, inc, ts } from './store';
import { adminKeyHash, normalizeCode, pinHash, randomCode, randomId, randomToken, resetCodeHash, teacherKeyHash } from './hash';
import {
  ClassInfo,
  InviteCode,
  LinkItem,
  LiveDoc,
  MAX_STUDENTS,
  NAME_CHANGE_DAYS,
  Notice,
  NoticeSummary,
  NowLink,
  Student,
  StudentStatus,
  Task,
  TaskMark,
  TaskState,
  TaskTemplate
} from './types';
import { today } from './dates';

const C = (cid: string, rest = '') => `classes/${cid}${rest ? '/' + rest : ''}`;

export const counted = (s?: TaskState) => s === 'done' || s === 'checked';

const toStudent = (sid: string, d: Data): Student => ({
  sid,
  number: Number(d.number) || Number(sid.slice(1)) || 0,
  name: String(d.name || ''),
  joined: !!d.joined,
  ...(d.nameAt ? { nameAt: Number(d.nameAt) } : {})
});

export const emptyLive = (): LiveDoc => ({ now: null, notices: {}, tasks: {}, done: {} });
const toLive = (d: Data | null): LiveDoc => ({
  now: (d?.now as NowLink) || null,
  notices: (d?.notices as LiveDoc['notices']) || {},
  tasks: (d?.tasks as LiveDoc['tasks']) || {},
  done: (d?.done as LiveDoc['done']) || {}
});

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
      while (await store.get(C(cid))) cid = randomCode(6);
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
        { type: 'set', path: C(cid, 'public/live'), data: { now: null, notices: {}, tasks: {}, done: {} } },
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

    // ---- 과제 ----
    watchTasks(cid: string, cb: (list: Task[]) => void, onError?: (e: unknown) => void) {
      return store.watchList(
        C(cid, 'tasks'),
        (items) =>
          cb(
            items
              .map((i) => ({ ...(i.data as Omit<Task, 'id'>), id: i.id }) as Task)
              .sort((a, b) => (a.due === b.due ? a.createdAt - b.createdAt : a.due.localeCompare(b.due)))
          ),
        onError
      );
    },
    async saveTask(cid: string, task: Omit<Task, 'id' | 'createdAt'> & { id?: string; createdAt?: number }, total: number) {
      const id = task.id || randomId();
      const data = { ...task, id, createdAt: task.createdAt || Date.now() };
      await store.write([
        { type: 'set', path: C(cid, 'tasks/' + id), data },
        { type: 'update', path: C(cid), data: { ['refs.' + id]: true } },
        { type: 'update', path: C(cid, 'public/live'), data: { ['tasks.' + id]: { title: task.title, due: task.due, total, paper: task.paper } } }
      ]);
      return id;
    },
    async deleteTask(cid: string, id: string) {
      await store.write([
        { type: 'delete', path: C(cid, 'tasks/' + id) },
        { type: 'update', path: C(cid), data: { ['refs.' + id]: DEL } },
        { type: 'update', path: C(cid, 'public/live'), data: { ['tasks.' + id]: DEL, ['done.' + id]: DEL } }
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
    // 교사가 여러 칸의 상태를 한 번에 바꿈 (확인 / 다시 해요 / 미완료)
    async setMarks(cid: string, changes: { sid: string; taskId: string; state: TaskState; note?: string }[]) {
      const ops: WriteOp[] = changes.map((c) => ({
        type: 'set',
        path: C(cid, 'status/' + c.sid),
        data: { tasks: { [c.taskId]: c.state === 'todo' ? DEL : { state: c.state, note: c.note ? c.note : DEL, at: NOW } } },
        merge: true
      }));
      if (ops.length) await store.write(ops);
    },
    watchTemplates(cid: string, cb: (list: TaskTemplate[]) => void, onError?: (e: unknown) => void) {
      return store.watch(C(cid, 'private/templates'), (d) => cb(Object.values((d?.items as Record<string, TaskTemplate>) || {})), onError);
    },
    async saveTemplate(cid: string, t: Omit<TaskTemplate, 'id'>) {
      const id = randomId();
      await store.write([{ type: 'set', path: C(cid, 'private/templates'), data: { items: { [id]: { ...t, id } } }, merge: true }]);
    },
    async deleteTemplate(cid: string, id: string) {
      await store.write([{ type: 'set', path: C(cid, 'private/templates'), data: { items: { [id]: DEL } }, merge: true }]);
    },
    // 교사 화면이 열려 있을 때 실시간 문서의 과제 요약·완료 인원수를 실제 기록으로 바로잡음
    async syncLive(cid: string, live: LiveDoc, tasks: Task[], students: Student[], statuses: Record<string, StudentStatus>) {
      const wantTasks: LiveDoc['tasks'] = {};
      const wantDone: LiveDoc['done'] = {};
      for (const t of tasks) {
        const targets = t.targets ?? students.map((s) => s.sid);
        wantTasks[t.id] = { title: t.title, due: t.due, total: targets.length, paper: !!t.paper };
        wantDone[t.id] = targets.filter((sid) => counted(statuses[sid]?.tasks?.[t.id]?.state)).length;
      }
      const same = (a: unknown, b: unknown) => JSON.stringify(a, Object.keys((a as Data) || {}).sort()) === JSON.stringify(b, Object.keys((b as Data) || {}).sort());
      const tasksSame = Object.keys(wantTasks).length === Object.keys(live.tasks).length && Object.entries(wantTasks).every(([k, v]) => same(v, live.tasks[k]));
      const doneSame = Object.keys(wantDone).length === Object.keys(live.done).length && Object.entries(wantDone).every(([k, v]) => live.done[k] === v);
      if (tasksSame && doneSame) return;
      await store.write([{ type: 'update', path: C(cid, 'public/live'), data: { tasks: wantTasks, done: wantDone } }]);
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
    async renameSelf(cid: string, student: Student, name: string): Promise<'ok' | 'too-soon'> {
      if (student.nameAt && Date.now() < student.nameAt + NAME_CHANGE_DAYS * 86400000) return 'too-soon';
      const ok = await tryWrite([{ type: 'update', path: C(cid, 'students/' + student.sid), data: { name: name.trim(), nameAt: NOW } }]);
      return ok ? 'ok' : 'too-soon';
    },
    watchMyStatus(cid: string, sid: string, cb: (s: StudentStatus) => void, onError?: (e: unknown) => void) {
      return store.watch(C(cid, 'status/' + sid), (d) => cb({ tasks: (d?.tasks as StudentStatus['tasks']) || {}, reads: (d?.reads as StudentStatus['reads']) || {} }), onError);
    },
    // 학생의 '다 했어요' 누르기·되돌리기 + 실시간 완료 인원수 함께 바꾸기
    async markTask(cid: string, sid: string, taskId: string, prev: TaskMark | undefined, done: boolean) {
      if (prev?.state === 'checked') return;
      const before = counted(prev?.state);
      const ops: WriteOp[] = [
        { type: 'set', path: C(cid, 'status/' + sid), data: { tasks: { [taskId]: { state: done ? 'done' : 'todo', at: NOW } }, last: taskId }, merge: true }
      ];
      if (before !== done) ops.push({ type: 'update', path: C(cid, 'public/live'), data: { ['done.' + taskId]: inc(done ? 1 : -1), doneLast: taskId } });
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
