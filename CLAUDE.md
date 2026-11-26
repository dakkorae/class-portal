# CLAUDE.md — 우리 반 포털 작업 안내서

새 대화에서 이 파일만 읽으면 이어서 작업할 수 있도록 정리했습니다. 사용자(서성민 선생님)는 비개발자 → **설명은 쉬운 한국어로, 용어는 풀어서**.

## 한눈에
- 학급 포털 웹앱. 기획서: 우리 반 학급 포털 PRD (claude.ai 문서). 화면에 쓰는 말: **바로가기**(예전 ‘링크’), **공지 및 미션**(예전 ‘과제’·‘미션’, 따로 있던 ‘공지’ 기능은 없앰). 기능 = 로그인(관리자·교사·학생) + 바로가기·지금 열기 + 공지 및 미션(날짜별, 한 게시물에 공지 글 + 미션 줄, 줄마다 대상 학생·완료 체크) + TV·편의기능 탭(교실 화면: 공지·미션 크게·판서·타이머·번호 뽑기·지각생 하교 타이머) + 나이스 급식·학사일정(시간표는 뺌) + 1인1역(주마다 교사가 직접 배정) + 학급 달력 + 화면 설정(테마 12가지·글꼴 8가지, 기기별).
- 디자인: 기본은 ‘솜사탕 파스텔’ 테마 + 고운돋움 글꼴(시안 6장 중 A-1 선택). 교사 ‘화면 설정’ · 학생 ‘나’에서 기기마다 테마·글꼴을 바꿀 수 있음(`src/ui/skins.ts`). 교실 화면 기본 테마도 ‘솜사탕’(칠판·검정·흰색도 고를 수 있음). 교실 화면도 자체 테마(솜사탕·칠판·검정·흰색).
- React 19 + TypeScript + Vite 6 + Tailwind 4, PWA(`public/sw.js`, `manifest.webmanifest`). 서버는 Firebase Spark(Firestore 서울 + 익명 로그인). Functions·Storage 쓰지 않음.
- Firebase 프로젝트 `uriban-portal`(계정 dakkorae), 배포 주소 https://uriban-portal.web.app 와 Vercel https://potal-sand.vercel.app (GitHub `main` 에 올리면 Vercel이 자동 배포). 저장소 `dakkorae/class-portal` 의 `main` (예전 이름 `potal` 에서 바뀜. 작업이 끝나면 `main` 에 바로 커밋·푸시).
- 배포: Vercel은 푸시만 하면 자동. Firebase Hosting·규칙은 `npm run build && npx firebase-tools deploy --only firestore:rules,auth,hosting` (규칙을 바꾸면 이 명령으로 같이 올라감).
- 주소로 화면 나누기(`src/App.tsx`): `/` 학생, `#teacher`, `#admin`, `#board/학급코드/미션ID?m=모드`(교실 화면: 교사 기기에서 새 창, `openBoard(cid, mid, mode)`, 모드 mission·write·timer·picker·late). 늘 켜 두는 TV(`#tv`)는 사용자 요청으로 없앰(TvApp 삭제). 교사·관리자·교실 화면은 `lazy()` 로 따로 내려받음.
- IB 대시보드(dakkorae/IBL)의 로그인·개설 코드·재설정 코드·규칙 시험 방식을 가져와 고쳐 씀.

## 구조
| 위치 | 내용 |
|---|---|
| `src/lib/store.ts` | 저장소 모양(`Store`): get/list/write(묶음)/watch. 특별한 값 `NOW`·`inc()`·`DEL`·`ts()` |
| `src/lib/firestoreStore.ts` · `localStore.ts` | 실제 서버 / 체험용(localStorage, BroadcastChannel로 다른 탭에 반영). **둘 다 같은 쓰기 의미**(set·set merge·점 경로 update) |
| `src/lib/api.ts` | 모든 동작 (한 곳). 체험용은 규칙이 없으므로 비밀번호 확인을 `demoMatch` 로 대신 |
| `src/lib/cloud.ts` | 서버 고르기(`cloudMode`), 기기 저장 키(`cp_` 로 시작), 초대·TV 주소 |
| `src/lib/visible.ts` | 보이는 공지(예약·내림), 오늘의 지금 열기, 미션 대상 |
| `src/lib/mission.ts` | 미션 줄 붙여넣기 해석(`(체크)`·들여쓰기), 학생별 진행(`progressOf`) |
| `src/lib/neis.ts` · `src/ui/school.tsx` | 나이스 호출(학교 찾기·급식·학사일정, 브라우저에서 바로, 6시간 기억) · 오늘 급식 카드. 시간표는 사용자 요청으로 뺌 |
| `src/lib/roles.ts` | 1인1역: `mondayOf`, `weekOf(doc, 월요일)` → {역할ID: sid[]}, `rolesOfStudent` (자동 순환 없음, 교사가 주마다 배정) |
| `src/ui/skins.ts` · `src/ui/ThemePicker.tsx` | 테마 12가지(동화 3·모던 3·색깔 6)와 글꼴 8가지. `applyAppearance` 가 `<html>` 에 색 토큰·모서리·그림자·버튼 모양 변수를 넣음. 글꼴은 고른 것만 내려받음(동적 import). 기본 글꼴 고운돋움은 늘 포함 |
| `src/ui/DateNav.tsx` | 날짜 이동(‹ 날짜 › · 달력 팝업 · 오늘로). 미션은 교사·학생 모두 이것으로 날짜별로 봄. 학생 홈의 급식 카드도 고른 날짜를 따라감(`SchoolToday day`) |
| `src/ui/tiles.ts` · `index.css .tile3d` | 바로가기 3D 타일 아이콘. 분류 11개(국어·수학·사회·과학·영어·도덕·체육·음악·미술·실과·기타) × 그림 16개, 분류 색 |
| `src/ui/calendar.tsx` | 달력 칸(MonthGrid), 일정 펼치기 |
| `src/board/BoardApp.tsx` · `LateTimer.tsx` | 교실 화면(‘TV 화면 열기’): 미션 크게(완료 인원) · 판서(펜·지우개·되돌리기) · 타이머 · 번호 뽑기 · 지각생 하교 타이머(사용자가 준 HTML을 React로 옮겨 교실 화면 테마 색 `--b-*` 에 맞춤, 종소리는 Web Audio 도·미·솔 5번, 서버 저장 없음), 솜사탕/칠판/검정/흰색 테마. 1인1역은 교실 화면에서 뺌 |
| `src/student/*` | JoinFlow(코드→번호→PIN→이름), StudentPortal(홈·링크·공지·나), PinPad |
| `src/teacher/*` | TeacherApp(열기·개설·재설정·기록 안내), Workspace(메뉴·가림 모드), data.ts(실시간 구독 + `syncLive`), Dashboard, LinksPanel(바로가기), MissionsPanel(미션 카드·완료 현황표(보기 전용)·편집기·템플릿), NoticesPanel, RolesPanel, CalendarPanel, ClassPanel(명단 일괄 저장·학교 설정·TV 주소·CSV·삭제) |
| `src/admin/AdminApp.tsx` | 관리자 |
| `src/teacher/TvToolsPanel.tsx` | ‘TV·편의기능’ 탭: 교실 화면 모드별 ‘띄우기’ 카드와 쓰는 법 |
| `src/ui/kit.tsx` | 버튼(둥근 알약 모양, 주 버튼은 분홍→보라 그라데이션)·카드(2px 분홍 테두리)·입력·모달·토스트 등. 색은 이름 붙은 토큰(`bg-surface`, `text-ink-3`, `bg-brand` …)만 씀 → 어두운 화면 자동 |
| `src/index.css` | **디자인 테마 ‘솜사탕 파스텔’**(사용자가 시안 A-1 선택): 글꼴 고운돋움(`@fontsource/gowun-dodum`, 앱에 함께 묶어 배포), `:root` 색 토큰(분홍 brand #df5f9f, 글자 보라빛 #4e3e5e), 어두운 화면은 짙은 자두색, 모서리 반경 키움(`--radius-*`), `.bg-aurora`(무지개 파스텔 번짐), `.bg-brand-gradient`, `.bg-rainbow`(진행 막대) |
| `firestore.rules` · `scripts/rules-test.mjs` | 보안 규칙 · 자동 시험(134가지) |

## 서버 자료 (`classes/{학급코드}/…`)
학급 문서 `{name, inviteCode, createdAt, maxStudents, refs}`(교사·관리자만 읽음) · `public/roster {name, maxStudents, claimed}`(누구나: 입장 화면) · `public/live {now, notices(요약), tasks(미션 요약: title·due·total·items·targets), checks{완료칸:true}, done{완료칸:인원}}`(학생·TV·교사) · `public/links {items}` · `public/school`(나이스 학교·학년·반·인증키) · `public/roles {items, weeks:{월요일:{역할ID:[sid]}}}` · `public/calendar {items}` · `tasks/{id} {title, notice(공지 글), items:[{id,text,check,sub,targets?}], due(=날짜), targets(예전 자료용, 새로는 null), linkUrl}` · `notices/{id}`(그림 data URL 포함, 학생은 게시 시각 지난 것만) · `status/{sid} {tasks:{미션ID_줄ID:{state,at}}, reads, last}` · `students/{sid}`(본인·교사) · `pins/{sid}`·`secrets/teacher·reset`(읽기 불가) · `secrets/tv`(교사) · `teachers|members|screens/{기기}` · `private/templates`. 최상위 `config/admin`, `admins`, `inviteCodes`.

## 원칙
- 학생 이름은 **교사만 바꿈**(학생은 처음 참여 때 교사가 넣은 이름을 확인만, 교사가 비워 둔 번호만 한 번 직접 씀 — 규칙이 막음). 학생 이름은 본인·교사만 봄. TV·로그인 번호 버튼에는 이름 없음. 교사 화면 가림 모드(`.privacy .pii` 흐림).
- 완료 칸 이름은 `미션ID_줄ID`(`markKey`). 학생은 자기 기록의 칸 하나만 done/todo 로 바꾸고, `public/live.done` 을 그 칸만 ±1 (`checks` 에 있는 칸만). 선생님은 현황을 **보기만**(확인·다시 해요 없음). 교사 화면이 열려 있으면 `syncLive` 가 요약·칸 목록·인원수를 실제 기록으로 바로잡음.
- 줄마다 대상 학생(`MissionItem.targets`, `itemFor`). 학생 화면은 `itemsFor` 로 자기 줄만, 진행은 `progressOf(t, st, sid)`. 학생 홈은 그날 공지 글을 먼저, 그다음 ‘해야 할 일’.
- 예전 ‘공지’ 자료(`notices/…`, `public/live.notices`)는 화면에서 안 씀(지우지는 않음, 학급 삭제 때 함께 지워짐).
- 예전 ‘과제’ 자료(설명·종이 과제, items 없음)는 `legacyItems` 로 설명 줄 + ‘다 했어요’ 체크 한 줄로 보여 줌(사용자 학급 MYEQZ6 에 예전 과제 1개 있음).
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

9. (11/26 오후) 사용자 요청 10가지 반영: ‘링크’→‘바로가기’, ‘과제’→‘미션’, 명단 일괄 저장, 바로가기 3D 타일 아이콘·분류(전체/국어/수학/사회/과학/도덕/미술/실과/기타, 예전 분류는 기타로), 공지 읽어 주기 삭제, 교사 확인 기능 삭제(현황만), 미션에 완료 체크 줄 따로 고르기(붙여넣기 `(체크)`·들여쓰기 지원), ‘TV 화면 열기’ = 새 창 교실 화면(미션 크게·판서). 2차까지: 나이스 급식·시간표·학사일정(학급 관리 → 우리 학교, 인증키 없으면 시간표 5교시까지), 타이머·번호 뽑기(교실 화면), 1인1역 주간 순환, 학급 달력. 규칙 134가지 통과·배포, 휴대폰 360/414·태블릿 768/1024·크롬북 1366·PC 1920에서 가로 넘침 없음 확인, 실제 서버 시험 후 시험 학급·시험 개설 코드(TEST-E2E2) 지움.

10. (11/26 저녁) 디자인 시안 6장(`mock.html` 로 그린 학생 휴대폰 홈 + 교사 대시보드)을 보여 드리고, 사용자가 **A-1 솜사탕 파스텔** 선택 → 앱 전체에 적용(Pretendard 대신 고운돋움, 색·모서리·버튼·진행 막대·배경, 교실 화면 ‘솜사탕’ 테마 기본값, 앱 아이콘 색 theme-color #f7b6d2).

11. (11/26 밤) 요청 반영: 시간표 삭제 · 미션 날짜별 보기(DateNav, 지난 미션은 오늘 화면에 안 나옴, 기간별 보기 삭제) · 바로가기 분류 11개(영어·체육·음악 추가)와 아이콘 · 화면 설정(테마 12·글꼴 8, 교사 ‘화면 설정’/학생 ‘나’) · 1인1역 자동 순환 → 주마다 직접 배정(지난주 배정 가져오기·비우기·역할 전체 삭제) · 대시보드에서 ‘미션 남은 체크’·‘참여한 학생’ 삭제 · 학생 이름 바꾸기 삭제(규칙도) · TV 화면 열기 크롬 문제 수정(`openBoard` 가 새 창을 연 직후 `location.hash` 를 다시 바꿔 크롬에서 빈 창이 되던 것 → 바꾸지 않음, 팝업이 막히면 링크 누르기로 새 탭). 규칙 134가지 통과·배포, 실제 서버 시험 후 시험 자료 지움.

12. (11/26 밤) 학생 홈 날짜 이동 시 그날 급식 · 교실 화면에서 1인1역 빼기 · 지각생 하교 타이머 추가(학생 추가→일괄/개별 시작→종소리 5초→‘확인 완료(하교)’, 다른 메뉴로 가도 계속 잼, 머리글에 진행 인원 표시).

13. (11/26 밤) 공지 기능 삭제(교사 ‘공지’ 메뉴·학생 ‘공지’ 탭·대시보드 공지) · ‘미션’→‘공지 및 미션’(한 게시물에 공지 글+미션 줄, 미션 줄마다 ‘전체/○명’ 대상 고르기) · ‘TV·편의기능’ 탭 신설(공지·미션 크게·판서(키보드로 크게 쓰기+펜)·타이머·번호 뽑기·지각생 타이머, 미션 카드의 ‘TV로 크게 보기’ 버튼은 뺌) · 학급 관리의 늘 켜 두는 TV 화면 삭제 · 학생 홈: 공지 먼저, 없으면 해야 할 일만. 실제 서버 시험 후 시험 자료 지움.

## 작업 환경 메모 (클라우드 세션)
- 이 저장소 전용 클라우드 환경 `class-portal`(Firebase 주소들 + `open.neis.go.kr` 허용). `web.app`·`vercel.app` 주소와 글꼴 CDN은 열리지 않음 → 실제 서버 시험은 `npm run build` 후 `dist` 를 `python3 -m http.server` 로 띄워 Playwright로(서버는 진짜 Firebase에 연결됨). Playwright 는 `chromium.launch({ proxy: { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } })` + `ignoreHTTPSErrors` 로 띄워야 나이스·Firebase 에 닿음.
- 시험용 개설 코드는 소유자 토큰 REST 로 `inviteCodes/TEST-…` 를 만들고, 끝나면 지움. **사용자의 학급(MYEQZ6)·개설 코드(N35Q-RJ8W)는 건드리지 않음.**
- Firebase CLI 로그인은 세션마다 다시 필요할 수 있음: `firebase login --no-localhost` 링크를 사용자에게 주고(세션 ID 확인 안내) 받은 코드로 `firebase login <코드>`.
- 소유자 권한으로 Firestore 문서를 직접 고칠 때는 CLI 로그인 토큰으로 REST 호출(관리자 키 등록 등). 시험용 자료는 반드시 지움.
- 사용자는 한국어 설명을 원함(계속 한국어로).

## 다음
2차(PRD 4-5)까지 끝. 보상 기능은 보류. 사용자 피드백을 받아 다듬기.
