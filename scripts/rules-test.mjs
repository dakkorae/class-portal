// 보안 규칙(firestore.rules) 자동 시험 — Firestore 에뮬레이터가 필요 (실행 방법은 CLAUDE.md)
// 마지막 줄 "통과 N / 실패 0" 이면 성공
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, writeBatch, collection, query, where, serverTimestamp, increment, deleteField, Timestamp } from 'firebase/firestore';
import fs from 'fs';

const env = await initializeTestEnvironment({
  projectId: 'demo-portal',
  firestore: { rules: fs.readFileSync(process.env.RULES || 'firestore.rules', 'utf8'), host: '127.0.0.1', port: Number(process.env.PORT || 8085) }
});
await env.clearFirestore();
let pass = 0;
let fail = 0;
const t = async (name, p) => {
  try {
    await p;
    pass++;
  } catch (e) {
    fail++;
    console.log('✗', name, '-', String(e.message).split('\n')[0].slice(0, 200));
  }
};
const ok = (n, p) => t(n, assertSucceeds(p));
const no = (n, p) => t(n + ' (막혀야 함)', assertFails(p));

await env.withSecurityRulesDisabled(async (c) => {
  const db = c.firestore();
  await setDoc(doc(db, 'config/admin'), { keyHash: 'ADMIN' });
  await setDoc(doc(db, 'inviteCodes/CODE'), { active: true, usedCount: 0, maxClasses: 2, memo: '', createdAt: 1 });
  await setDoc(doc(db, 'inviteCodes/OFF'), { active: false, usedCount: 0, maxClasses: 5, memo: '', createdAt: 1 });
});

const ctx = (uid) => env.authenticatedContext(uid).firestore();
const T = ctx('teacher');
const T2 = ctx('teacher2');
const A = ctx('devA');
const B = ctx('devB');
const X = ctx('outsider');
const AD = ctx('admin');
const TV = ctx('tv');
const anon = env.unauthenticatedContext().firestore();
const c = (db, p, cid = 'C1') => doc(db, `classes/${cid}` + (p ? '/' + p : ''));

const createClass = (db, uid, cid, invite, extra = {}) => {
  const b = writeBatch(db);
  b.set(c(db, '', cid), { name: '5-3', inviteCode: invite, createdAt: 1, maxStudents: 3, ...extra });
  b.set(c(db, 'secrets/teacher', cid), { keyHash: 'TK' });
  b.set(c(db, 'teachers/' + uid, cid), { keyHash: 'TK' });
  b.set(c(db, 'secrets/tv', cid), { token: 'TVTOKEN-0123456789abcdef' });
  b.set(c(db, 'public/roster', cid), { name: '5-3', maxStudents: 3, claimed: {} });
  b.set(c(db, 'public/live', cid), { now: null, notices: {}, tasks: {}, checks: {}, done: {} });
  b.set(c(db, 'public/links', cid), { items: {} });
  b.update(doc(db, 'inviteCodes/' + invite), { usedCount: 1 });
  return b.commit();
};

// ---------- 1. 관리자 ----------
await no('비로그인 개설 코드 읽기', getDoc(doc(anon, 'inviteCodes/CODE')));
await no('틀린 관리자 키', setDoc(doc(AD, 'admins/admin'), { keyHash: 'WRONG' }));
await no('config 읽기', getDoc(doc(AD, 'config/admin')));
await ok('관리자 로그인', setDoc(doc(AD, 'admins/admin'), { keyHash: 'ADMIN' }));
await no('남의 uid로 관리자 등록', setDoc(doc(X, 'admins/admin'), { keyHash: 'ADMIN' }));
await ok('관리자 코드 목록', getDocs(collection(AD, 'inviteCodes')));
await no('일반 기기 코드 목록', getDocs(collection(X, 'inviteCodes')));
await ok('관리자 코드 만들기', setDoc(doc(AD, 'inviteCodes/NEW1'), { active: true, usedCount: 0, maxClasses: 1, memo: 'x', createdAt: 2 }));
await no('일반 기기 코드 만들기', setDoc(doc(X, 'inviteCodes/HACK'), { active: true, usedCount: 0, maxClasses: 99, memo: '', createdAt: 2 }));

// ---------- 2. 학급 개설 ----------
await no('사용 중지된 코드로 개설', createClass(X, 'outsider', 'C9', 'OFF'));
{
  const b = writeBatch(X);
  b.set(c(X, '', 'C8'), { name: 'x', inviteCode: 'CODE', createdAt: 1, maxStudents: 3 });
  b.set(c(X, 'secrets/teacher', 'C8'), { keyHash: 'K' });
  b.set(c(X, 'teachers/outsider', 'C8'), { keyHash: 'K' });
  await no('사용 횟수를 안 올리고 개설', b.commit());
}
await no('정원 41명 학급', createClass(X, 'outsider', 'C7', 'CODE', { maxStudents: 41 }));
await ok('학급 개설', createClass(T, 'teacher', 'C1', 'CODE'));
await no('이미 있는 학급 덮어쓰기', createClass(X, 'outsider', 'C1', 'CODE'));
await no('교사 아닌 기기가 학급 문서 읽기(개설 코드 보호)', getDoc(c(X)));
await ok('교사가 학급 문서 읽기', getDoc(c(T)));
await ok('누구나 학급 이름(roster) 읽기', getDoc(c(X, 'public/roster')));
await no('교사 비밀번호 해시 읽기', getDoc(c(T, 'secrets/teacher')));
await ok('교사가 TV 비밀 값 읽기', getDoc(c(T, 'secrets/tv')));
await no('남이 TV 비밀 값 읽기', getDoc(c(X, 'secrets/tv')));

// ---------- 3. 교사 로그인 ----------
await no('틀린 교사 비밀번호', setDoc(c(T2, 'teachers/teacher2'), { keyHash: 'WRONG' }));
await ok('교사 비밀번호로 두 번째 기기 등록', setDoc(c(T2, 'teachers/teacher2'), { keyHash: 'TK' }));
await ok('두 번째 기기 로그아웃', deleteDoc(c(T2, 'teachers/teacher2')));
await no('로그아웃 뒤 학생 명단 보기', getDocs(collection(T2, 'classes/C1/students')));
await ok('교사가 학급 이름 바꾸기', updateDoc(c(T), { name: '5학년 3반' }));
await no('교사가 개설 코드 바꾸기', updateDoc(c(T), { inviteCode: 'OFF' }));
await no('남이 학급 이름 바꾸기', updateDoc(c(X), { name: 'hack' }));

// ---------- 4. 학생 명단 (교사가 미리) ----------
await ok('교사가 명단 넣기', setDoc(c(T, 'students/s1'), { number: 1, name: '김하늘', joined: false }));
await no('정원 밖 번호 명단', setDoc(c(T, 'students/s4'), { number: 4, name: '넷', joined: false }));
await no('번호와 문서 ID 불일치', setDoc(c(T, 'students/s2'), { number: 3, name: '셋', joined: false }));
await no('외부인이 명단 목록 보기', getDocs(collection(X, 'classes/C1/students')));

// ---------- 5. 학생 처음 참여 ----------
const register = (db, uid, sid, pin) => {
  const b = writeBatch(db);
  b.set(c(db, 'pins/' + sid), { pinHash: pin });
  b.set(c(db, 'members/' + uid), { sid, pinHash: pin });
  b.update(c(db, 'public/roster'), { ['claimed.' + sid]: true });
  return b.commit();
};
await no('PIN만 만들기(등록 표시 없이)', setDoc(c(A, 'pins/s1'), { pinHash: 'PA' }));
await no('정원 밖 번호로 등록', register(A, 'devA', 's4', 'PA'));
await ok('A가 1번으로 등록', register(A, 'devA', 's1', 'PA'));
await no('B가 1번 빼앗기', register(B, 'devB', 's1', 'PB'));
await no('PIN 해시 읽기', getDoc(c(A, 'pins/s1')));
await no('B가 틀린 PIN으로 1번 로그인', setDoc(c(B, 'members/devB'), { sid: 's1', pinHash: 'WRONG' }));
await ok('A가 교사가 넣은 이름 읽기', getDoc(c(A, 'students/s1')));
await no('A가 교사가 넣은 이름을 바꿔서 확인', setDoc(c(A, 'students/s1'), { number: 1, name: '하늘', joined: true }, { merge: true }));
await ok('A 이름 확인(처음 참여, 교사가 넣은 이름 그대로)', setDoc(c(A, 'students/s1'), { number: 1, name: '김하늘', joined: true }, { merge: true }));
await no('A 이름 확인 또 하기(이름 바꾸기 우회)', setDoc(c(A, 'students/s1'), { number: 1, name: '바다', joined: true }, { merge: true }));
await ok('B가 2번으로 등록', register(B, 'devB', 's2', 'PB'));
await no('B가 A 이름 읽기', getDoc(c(B, 'students/s1')));
await no('B가 A 이름 바꾸기', updateDoc(c(B, 'students/s1'), { name: '바보', nameAt: serverTimestamp() }));
await ok('B 이름 정하기(교사가 안 넣은 번호, 처음)', setDoc(c(B, 'students/s2'), { number: 2, name: '구름', joined: true }, { merge: true }));
await no('B가 스스로 이름 바꾸기', updateDoc(c(B, 'students/s2'), { name: '뭉게구름', nameAt: serverTimestamp() }));
await no('B가 이름만 바꾸기', updateDoc(c(B, 'students/s2'), { name: '먹구름' }));
await ok('교사는 이름 언제든 고치기', setDoc(c(T, 'students/s2'), { number: 2, name: '구름', }, { merge: true }));
await no('학생이 다른 학생 등록 표시 지우기', updateDoc(c(A, 'public/roster'), { 'claimed.s2': deleteField() }));
await no('학생이 학급 이름 바꾸기(roster)', updateDoc(c(A, 'public/roster'), { name: 'hack' }));

// ---------- 6. TV ----------
await no('틀린 비밀 값으로 TV 등록', setDoc(c(TV, 'screens/tv'), { token: 'WRONG-0123456789abcdef' }));
await ok('TV 등록', setDoc(c(TV, 'screens/tv'), { token: 'TVTOKEN-0123456789abcdef' }));
await ok('TV가 실시간 문서 읽기', getDoc(c(TV, 'public/live')));
await no('TV가 학생 명단 보기', getDocs(collection(TV, 'classes/C1/students')));
await no('TV가 링크 쓰기', updateDoc(c(TV, 'public/live'), { now: { title: 'x' } }));
await no('외부인이 실시간 문서 읽기', getDoc(c(X, 'public/live')));
await ok('교사가 TV 주소 바꾸기', setDoc(c(T, 'secrets/tv'), { token: 'NEWTOKEN-0123456789abcdef' }));
await no('예전 주소 TV가 실시간 문서 읽기', getDoc(c(TV, 'public/live')));
await no('짧은 TV 비밀 값', setDoc(c(T, 'secrets/tv'), { token: 'short' }));

// ---------- 7. 링크·지금 열기 ----------
await ok('교사가 링크 추가', updateDoc(c(T, 'public/links'), { 'items.l1': { id: 'l1', title: '클래스카드', url: 'https://classcard.net', category: '국어', icon: '', order: 0, pinned: true, hidden: false } }));
await no('학생이 링크 추가', updateDoc(c(A, 'public/links'), { 'items.l2': { id: 'l2', title: 'bad', url: 'https://bad' } }));
await ok('학생이 링크 읽기', getDoc(c(A, 'public/links')));
await ok('교사가 지금 열기 보내기', updateDoc(c(T, 'public/live'), { now: { title: '클래스카드', url: 'https://classcard.net', icon: '', day: '2026-11-26', at: 1 } }));
await no('학생이 지금 열기 바꾸기', updateDoc(c(A, 'public/live'), { now: { title: 'game', url: 'https://game' } }));
await ok('학생이 실시간 문서 읽기', getDoc(c(A, 'public/live')));

// ---------- 8. 미션 ----------
const K = 't1_i1'; // 완료 체크 칸 (미션ID_줄ID)
await ok('교사가 미션 만들기', (() => {
  const b = writeBatch(T);
  const items = [{ id: 'i1', text: '독서', check: true, sub: false }, { id: 'i2', text: '우유 배달', check: false, sub: false }];
  b.set(c(T, 'tasks/t1'), { id: 't1', title: '아침 미션', items, due: '2026-11-27', targets: null, linkUrl: '', createdAt: 1 });
  b.update(c(T), { 'refs.t1': true });
  b.update(c(T, 'public/live'), { 'tasks.t1': { title: '아침 미션', due: '2026-11-27', total: 2, items, targets: null }, ['checks.' + K]: true });
  return b.commit();
})());
await no('학생이 미션 만들기', setDoc(c(A, 'tasks/t2'), { title: 'x' }));
await ok('학생이 미션 목록 읽기', getDocs(collection(A, 'classes/C1/tasks')));
const markDone = (db, sid, key, state, delta) => {
  const b = writeBatch(db);
  b.set(c(db, 'status/' + sid), { tasks: { [key]: { state, at: serverTimestamp() } }, last: key }, { merge: true });
  if (delta) b.update(c(db, 'public/live'), { ['done.' + key]: increment(delta), doneLast: key });
  return b.commit();
};
await ok('A 완료 체크', markDone(A, 's1', K, 'done', 1));
await no('A가 이상한 상태 쓰기', markDone(A, 's1', K, 'checked', 0));
await no('A가 B 기록 쓰기', markDone(A, 's2', K, 'done', 0));
await no('A가 B 기록 읽기', getDoc(c(A, 'status/s2')));
await ok('A가 자기 기록 읽기', getDoc(c(A, 'status/s1')));
await no('완료 인원수 한 번에 +5', updateDoc(c(A, 'public/live'), { ['done.' + K]: increment(5), doneLast: K }));
await no('완료 체크 칸이 아닌 줄의 인원수', updateDoc(c(A, 'public/live'), { 'done.t1_i2': increment(1), doneLast: 't1_i2' }));
await no('미션 이름으로 인원수 바꾸기', updateDoc(c(A, 'public/live'), { 'done.t1': increment(1), doneLast: 't1' }));
await no('학생이 완료 칸 목록 바꾸기', updateDoc(c(A, 'public/live'), { 'checks.zz': true }));
await ok('A 되돌리기', markDone(A, 's1', K, 'todo', -1));
await ok('A 다시 완료', markDone(A, 's1', K, 'done', 1));
await no('학생이 기록에 메모 넣기', setDoc(c(A, 'status/s1'), { tasks: { [K]: { state: 'done', note: 'x', at: serverTimestamp() } }, last: K }, { merge: true }));
await no('한 번에 두 칸 체크', setDoc(c(A, 'status/s1'), { tasks: { a_1: { state: 'done', at: serverTimestamp() }, a_2: { state: 'done', at: serverTimestamp() } }, last: 'a_1' }, { merge: true }));
await ok('교사가 기록 목록 보기', getDocs(collection(T, 'classes/C1/status')));
await ok('교사가 템플릿 저장', setDoc(c(T, 'private/templates'), { items: { a: { id: 'a', title: '아침 미션', items: [] } } }, { merge: true }));
await no('학생이 템플릿 읽기', getDoc(c(A, 'private/templates')));

// ---------- 8-2. 학교(나이스) · 1인1역 · 학급 달력 ----------
await ok('TV 새 주소로 다시 등록', setDoc(c(TV, 'screens/tv'), { token: 'NEWTOKEN-0123456789abcdef' }));
for (const doc of ['school', 'roles', 'calendar']) {
  await ok(`교사가 ${doc} 쓰기`, setDoc(c(T, 'public/' + doc), { items: {}, v: 1 }, { merge: true }));
  await ok(`학생이 ${doc} 읽기`, getDoc(c(A, 'public/' + doc)));
  await ok(`TV가 ${doc} 읽기`, getDoc(c(TV, 'public/' + doc)));
  await no(`학생이 ${doc} 쓰기`, setDoc(c(A, 'public/' + doc), { v: 2 }, { merge: true }));
  await no(`외부인이 ${doc} 읽기`, getDoc(c(X, 'public/' + doc)));
}
await no('교사가 정해지지 않은 public 문서 쓰기', setDoc(c(T, 'public/other'), { v: 1 }));
await no('학생이 정해지지 않은 public 문서 읽기', getDoc(c(A, 'public/other')));

// ---------- 9. 공지 ----------
const future = Timestamp.fromMillis(Date.now() + 86400000);
const past = Timestamp.fromMillis(Date.now() - 1000);
await ok('교사가 공지 쓰기', setDoc(c(T, 'notices/n1'), { id: 'n1', title: '체육복', body: '내일', tag: '준비물', pinned: true, publishAt: past, expireAt: null, imageData: [], snippet: '', images: 0, at: 1 }));
await ok('교사가 예약 공지 쓰기', setDoc(c(T, 'notices/n2'), { id: 'n2', title: '예약', body: '비밀', tag: '안내', pinned: false, publishAt: future, expireAt: null, imageData: [], snippet: '', images: 0, at: 1 }));
await no('게시 시각이 숫자인 공지', setDoc(c(T, 'notices/n3'), { title: 'x', publishAt: 1 }));
await no('학생이 공지 쓰기', setDoc(c(A, 'notices/n9'), { title: 'x', publishAt: past }));
await ok('학생이 게시된 공지 읽기', getDoc(c(A, 'notices/n1')));
await no('학생이 예약 공지 미리 읽기', getDoc(c(A, 'notices/n2')));
await no('학생이 공지 목록 통째로 읽기', getDocs(collection(A, 'classes/C1/notices')));
await ok('학생이 읽음 표시', setDoc(c(A, 'status/s1'), { reads: { n1: serverTimestamp() } }, { merge: true }));
await no('학생이 기록에 다른 칸 넣기', setDoc(c(A, 'status/s1'), { score: 100 }, { merge: true }));

// ---------- 10. PIN 초기화 ----------
await ok('교사가 1번 PIN 초기화', (() => {
  const b = writeBatch(T);
  b.delete(c(T, 'pins/s1'));
  b.update(c(T, 'public/roster'), { 'claimed.s1': deleteField() });
  return b.commit();
})());
await no('초기화 뒤 A가 실시간 문서 읽기', getDoc(c(A, 'public/live')));
await no('초기화 뒤 A가 자기 기록 읽기', getDoc(c(A, 'status/s1')));
await ok('A가 새 PIN으로 다시 등록', register(A, 'devA', 's1', 'PA2'));
await ok('다시 등록 뒤 기록 읽기', getDoc(c(A, 'status/s1')));
await no('학생이 PIN 지우기', deleteDoc(c(B, 'pins/s2')));
await ok('학생 로그아웃(기기 등록 지우기)', deleteDoc(c(B, 'members/devB')));
await no('로그아웃 뒤 실시간 문서', getDoc(c(B, 'public/live')));
await ok('B가 맞는 PIN으로 다시 로그인', setDoc(c(B, 'members/devB'), { sid: 's2', pinHash: 'PB' }));

// ---------- 11. 교사 비밀번호 재설정 ----------
await no('학생이 재설정 코드 발급', setDoc(c(A, 'secrets/reset'), { codeHash: 'R', expiresAt: future }));
await no('관리자가 3일짜리 재설정 코드', setDoc(c(AD, 'secrets/reset'), { codeHash: 'R', expiresAt: Timestamp.fromMillis(Date.now() + 3 * 86400000) }));
await ok('관리자가 재설정 코드 발급', setDoc(c(AD, 'secrets/reset'), { codeHash: 'R', expiresAt: future }));
await no('틀린 재설정 코드', setDoc(c(X, 'secrets/teacher'), { keyHash: 'NEW', resetHash: 'WRONG' }));
await ok('재설정 코드로 새 비밀번호', (() => {
  const b = writeBatch(X);
  b.set(c(X, 'secrets/teacher'), { keyHash: 'NEW', resetHash: 'R' });
  b.set(c(X, 'teachers/outsider'), { keyHash: 'NEW' });
  return b.commit();
})());
await no('같은 재설정 코드 다시 쓰기', setDoc(c(T2, 'secrets/teacher'), { keyHash: 'NEW2', resetHash: 'R' }));
await no('예전 비밀번호로 로그인', setDoc(c(T2, 'teachers/teacher2'), { keyHash: 'TK' }));
await ok('기존 교사 기기는 그대로', getDocs(collection(T, 'classes/C1/students')));
await no('관리자가 학생 명단 읽기', getDocs(collection(AD, 'classes/C1/students')));
await no('관리자가 공지 읽기', getDoc(c(AD, 'notices/n1')));
await no('관리자가 과제 기록 읽기', getDocs(collection(AD, 'classes/C1/status')));
await ok('관리자가 코드별 학급 보기', getDocs(query(collection(AD, 'classes'), where('inviteCode', '==', 'CODE'))));

// ---------- 12. 학급 삭제 (관리자) ----------
const wipe = async (db) => {
  const paths = [];
  for (let n = 1; n <= 3; n++) for (const col of ['students', 'pins', 'status']) paths.push(`${col}/s${n}`);
  paths.push('tasks/t1', 'notices/n1', 'notices/n2', 'public/school', 'public/roles', 'public/calendar');
  for (const col of ['members', 'screens', 'teachers']) (await getDocs(collection(db, `classes/C1/${col}`))).docs.forEach((d) => paths.push(`${col}/${d.id}`));
  paths.push('public/roster', 'public/live', 'public/links', 'private/templates', 'secrets/reset', 'secrets/tv', 'secrets/teacher');
  for (let i = 0; i < paths.length; i += 10) {
    const b = writeBatch(db);
    paths.slice(i, i + 10).forEach((p) => b.delete(c(db, p)));
    await b.commit();
  }
  await deleteDoc(c(db));
};
await no('학생이 학급 지우기', deleteDoc(c(A)));
await ok('관리자가 학급 통째로 지우기', wipe(AD));
await env.withSecurityRulesDisabled(async (ctx2) => {
  const left = await getDocs(collection(ctx2.firestore(), 'classes/C1/students'));
  if (left.size) throw new Error('남은 문서');
});

console.log(`통과 ${pass} / 실패 ${fail}`);
await env.cleanup();
process.exit(fail ? 1 : 0);
