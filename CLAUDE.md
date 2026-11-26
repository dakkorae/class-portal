# CLAUDE.md — 우리 반 포털 작업 안내서

새 대화에서 이 파일만 읽으면 이어서 작업할 수 있도록 정리했습니다. 사용자(서성민 선생님)는 비개발자 → **설명은 쉬운 한국어로, 용어는 풀어서**.

## 한눈에
- 학급 포털 웹앱. 기획서: 우리 반 학급 포털 PRD (claude.ai 문서). MVP = 로그인(관리자·교사·학생) + 링크·지금 열기 + 과제 체크 + 공지 + TV 화면.
- React 19 + TypeScript + Vite 6 + Tailwind 4, PWA(`public/sw.js`, `manifest.webmanifest`). 서버는 Firebase Spark(Firestore 서울 + 익명 로그인). Functions·Storage 쓰지 않음.
- Firebase 프로젝트 `uriban-portal`(계정 dakkorae), 배포 주소 https://uriban-portal.web.app 와 Vercel https://potal-sand.vercel.app (GitHub `main` 에 올리면 Vercel이 자동 배포). 저장소 `dakkorae/class-portal` 의 `main` (예전 이름 `potal` 에서 바뀜. 작업이 끝나면 `main` 에 바로 커밋·푸시).
- 배포: Vercel은 푸시만 하면 자동. Firebase Hosting·규칙은 `npm run build && npx firebase-tools deploy --only firestore:rules,auth,hosting` (규칙을 바꾸면 이 명령으로 같이 올라감).
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
- 학급 문서는 교사·관리자만 읽음 → 학급이 있는지 확인·이름 읽기는 `public/roster` 로. (규칙 시험만으로는 못 잡는 앱 쪽 실수가 있으므로 실제 서버 시험도 함께: 시험용 개설 코드를 만들어 눌러 보고 학급 삭제로 정리)
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

## 지금까지 (작업 기록)
1. (11/26) PRD(claude.ai 문서 “우리 반 학급 포털 PRD”)를 읽고 MVP 1·2단계 전체 구현: 3단계 로그인, 링크·지금 열기, 과제 체크·현황판·템플릿, 공지(말머리·고정·예약·내림·그림 2장·읽음 확인·읽어 주기), TV 화면, 학급 관리(명단 붙여넣기·PIN 초기화·초대 QR·TV 주소·CSV·삭제), 가림 모드, PWA. 디자인: 인디고·바이올렛 그라데이션, Pretendard, 다크 모드 자동, TV는 늘 어두운 화면.
2. PRD와 다르게 한 점: 학생 입장 순서 번호→PIN→이름(PIN 맞히기 전엔 이름 안 보이게) · 학급 이름·정원은 `public/roster`(학급 문서엔 개설 코드가 있어 교사·관리자만) · 링크는 문서 하나(`public/links`)에 모음(읽기 횟수 절약) · 호스팅은 Firebase Hosting(Vercel 설정 `vercel.json` 도 있음). 남은 작은 한계: 예약 공지의 **제목**은 `public/live` 요약에 들어 있어 개발자 도구로는 미리 보일 수 있음(본문·그림은 규칙이 막음).
3. 보안 규칙 117가지 에뮬레이터 시험 통과. 규칙 경로는 `cls(cid, '모음', id)` 처럼 **조각을 나눠** 써야 함(`'teachers/' + uid` 한 문자열은 한 조각으로 취급돼 전부 실패했었음).
4. Firebase 연결: CLI 로그인(플러그인 로그인 링크는 “Unable to verify client” 오류 → `firebase login --no-localhost` 로 받은 링크는 정상). 프로젝트 `uriban-portal` 생성(표시 이름에 한글 불가 → “Class Portal”), Firestore API 켜고 서울 리전 DB, 웹 앱, 익명 로그인(`firebase.json` 의 `auth` 항목으로 배포. Identity Platform 초기화는 유료라 쓰지 않음), 규칙·호스팅 배포.
5. 실제 서버 시험(교사·학생·학생2·TV를 서로 다른 기기로)에서 학급 개설이 “권한이 없어요”로 막히던 문제 발견 → 학급 코드 중복 확인을 `public/roster` 로 바꿔 해결. 같은 브라우저 여러 탭(교사+TV)용 `persistentMultipleTabManager` 적용. 시험 자료는 모두 지움(데이터베이스 빈 상태에서 시작).
6. 저장소 이름 `potal` → `class-portal` 로 바뀜(사용자가 GitHub에서 변경). 원격 주소 갱신.
7. 관리자 키 등록값(`config/admin.keyHash`)을 사용자가 준 값으로 넣음(관리자 키 원문은 받지 않음). 맞는 값 통과·틀린 값 거부 확인. 다음 단계는 사용자가 `#admin` 에서 개설 코드 → `#teacher` 에서 학급 개설.

8. 사용자가 Vercel 계정에 GitHub 저장소를 직접 연결 → https://potal-sand.vercel.app (`vercel.json` 그대로, 환경 변수 없음). 두 주소 모두 같은 Firebase 자료를 쓰지만 기기 로그인 정보는 주소마다 따로라 학생 안내 주소는 하나로.

## 작업 환경 메모 (클라우드 세션)
- `web.app`·`vercel.app` 주소와 글꼴 CDN은 이 작업 환경에서 열리지 않음 → 실제 서버 시험은 `npm run build` 후 `dist` 를 `python3 -m http.server` 로 띄워 Playwright로(서버는 진짜 Firebase에 연결됨).
- Firebase CLI 로그인은 세션마다 다시 필요할 수 있음: `firebase login --no-localhost` 링크를 사용자에게 주고(세션 ID 확인 안내) 받은 코드로 `firebase login <코드>`.
- 소유자 권한으로 Firestore 문서를 직접 고칠 때는 CLI 로그인 토큰으로 REST 호출(관리자 키 등록 등). 시험용 자료는 반드시 지움.
- 사용자는 한국어 설명을 원함(계속 한국어로).

## 다음 (2차, PRD 4-5)
나이스 급식·시간표(브라우저 호출), 타이머·번호 뽑기(TV), 1인1역 주간 순환, 학급 달력. 보상 기능은 보류.
