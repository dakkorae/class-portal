# CLAUDE.md — 우리 반 포털 작업 안내서

새 대화에서 이 파일만 읽으면 이어서 작업할 수 있도록 정리했습니다. 사용자(서성민 선생님)는 비개발자 → **설명은 쉬운 한국어로, 용어는 풀어서**.

## 한눈에
- 학급 포털 웹앱. 기획서: 우리 반 학급 포털 PRD (claude.ai 문서). MVP = 로그인(관리자·교사·학생) + 링크·지금 열기 + 과제 체크 + 공지 + TV 화면.
- React 19 + TypeScript + Vite 6 + Tailwind 4, PWA(`public/sw.js`, `manifest.webmanifest`). 서버는 Firebase Spark(Firestore 서울 + 익명 로그인). Functions·Storage 쓰지 않음.
- 주소로 화면 나누기(`src/App.tsx`): `/` 학생, `#teacher`, `#admin`, `#tv/학급코드/비밀값`. 교사·관리자·TV 화면은 `lazy()` 로 따로 내려받음.
- IB 대시보드(dakkorae/IBL)의 로그인·개설 코드·재설정 코드·규칙 시험 방식을 가져와 고쳐 씀.

## 구조
| 위치 | 내용 |
|---|---|
| `src/lib/store.ts` | 저장소 모양(`Store`): get/list/write(묶음)/watch. 특별한 값 `NOW`·`inc()`·`DEL`·`ts()` |
| `src/lib/firestoreStore.ts` · `localStore.ts` | 실제 서버 / 체험용(localStorage, BroadcastChannel로 다른 탭에 반영). **둘 다 같은 쓰기 의미**(set·set merge·점 경로 update) |
| `src/lib/api.ts` | 모든 동작 (한 곳). 체험용은 규칙이 없으므로 비밀번호 확인을 `demoMatch` 로 대신 |
| `src/lib/cloud.ts` | 서버 고르기(`cloudMode`), 기기 저장 키(`cp_` 로 시작), 초대·TV 주소 |
| `src/lib/visible.ts` | 보이는 공지(예약·내림), 오늘의 지금 열기, 과제 대상 |
| `src/student/*` | JoinFlow(코드→번호→PIN→이름), StudentPortal(홈·링크·공지·나), PinPad |
| `src/teacher/*` | TeacherApp(열기·개설·재설정·기록 안내), Workspace(메뉴·가림 모드), data.ts(실시간 구독 + `syncLive`), Dashboard, LinksPanel, TasksPanel(현황판), NoticesPanel, ClassPanel(명단·TV 주소·CSV·삭제) |
| `src/admin/AdminApp.tsx` · `src/tv/TvApp.tsx` | 관리자 / TV |
| `src/ui/kit.tsx` | 버튼·카드·입력·모달·토스트 등. 색은 이름 붙은 토큰(`bg-surface`, `text-ink-3`, `bg-brand` …)만 씀 → 어두운 화면 자동 |
| `firestore.rules` · `scripts/rules-test.mjs` | 보안 규칙 · 자동 시험(117가지) |

## 서버 자료 (`classes/{학급코드}/…`)
학급 문서 `{name, inviteCode, createdAt, maxStudents, refs}`(교사·관리자만 읽음) · `public/roster {name, maxStudents, claimed}`(누구나: 입장 화면) · `public/live {now, notices(요약), tasks(요약), done(완료 인원)}`(학생·TV·교사) · `public/links {items}` · `tasks/{id}` · `notices/{id}`(그림 data URL 포함, 학생은 게시 시각 지난 것만) · `status/{sid} {tasks, reads, last}` · `students/{sid}`(본인·교사) · `pins/{sid}`·`secrets/teacher·reset`(읽기 불가) · `secrets/tv`(교사) · `teachers|members|screens/{기기}` · `private/templates`. 최상위 `config/admin`, `admins`, `inviteCodes`.

## 원칙
- 학생 이름은 본인·교사만. TV·로그인 번호 버튼에는 이름 없음. 교사 화면 가림 모드(`.privacy .pii` 흐림).
- 학생은 자기 기록만 쓰고 ‘다 했어요’/되돌리기만. ‘확인’·‘다시 해요’는 교사만. 학생이 완료 인원수를 ±1 하면 교사 화면이 열려 있을 때 `syncLive` 가 실제 기록으로 바로잡음.
- 묶음 쓰기로 “자기 것 하나만 바꿨는지” 규칙이 검사(`last`, `doneLast` 표시 칸). 서버 동작을 바꾸면 **규칙과 시험 스크립트도 같이** 고침.
- 학급 삭제는 10개씩 묶어 지움(규칙 호출 한도).
- 규칙을 바꾸면 사용자에게 콘솔 게시(또는 `firebase deploy --only firestore:rules`)를 안내.

## 확인 방법
```bash
npm ci
npx tsc --noEmit && npm run build
npm run build:demo && (cd dist-demo && python3 -m http.server 4173)   # 체험용: 개설 코드 DEMO-2026, 관리자 키 demo-admin
```
규칙 시험(저장소 밖 임시 폴더):
```bash
mkdir -p $TMP/emu && cd $TMP/emu && npm init -y && npm i --legacy-peer-deps firebase-tools @firebase/rules-unit-testing firebase@13
cp /home/user/class-portal/scripts/rules-test.mjs .
echo '{"firestore":{"rules":"/home/user/class-portal/firestore.rules"},"emulators":{"firestore":{"port":8085,"host":"127.0.0.1"},"ui":{"enabled":false}}}' > firebase.json
npx firebase emulators:exec --only firestore --project demo-portal "node rules-test.mjs"   # 마지막 줄 "통과 N / 실패 0"
```
화면은 체험용 빌드를 Playwright로 눌러 확인(폭 320~1920 넘침 점검). 커밋 메시지는 한국어 `feat(범위): …`.

## 다음 (2차, PRD 4-5)
나이스 급식·시간표(브라우저 호출), 타이머·번호 뽑기(TV), 1인1역 주간 순환, 학급 달력. 보상 기능은 보류.
