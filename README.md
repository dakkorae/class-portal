# 우리 반 포털

바로가기와 공지 및 미션을 한 화면에 모으고, 교실 TV(전자칠판)까지 이어 주는 학급용 웹앱입니다.
교사는 바로가기·공지 및 미션·1인1역·달력을 한곳에서 관리하고, 학생은 번호와 PIN 4자리로 들어와 “오늘 우리 반에서 할 일”을 확인합니다.

| 주소 | 누가 | 하는 일 |
|---|---|---|
| `/` | 학생 | 학급 코드(또는 QR) → 번호 → PIN. 홈(그날 공지 글 → 해야 할 일 완료 체크, 날짜 이동, 급식·다가오는 일정, 이번 주 내 역할, 지금 열기), 바로가기 모음, 학급 달력, 나(화면 설정) |
| `#teacher` | 교사 | 학급 개설·열기, 대시보드, 공지 및 미션(날짜별, 공지 글 + 미션 줄, 줄마다 대상 학생, 글 꾸미기, 완료 현황표), 바로가기·지금 열기, TV·편의기능, 1인1역(주마다 직접 배정), 학급 달력, 학급 관리(명단 일괄 저장·우리 학교 설정·CSV), 화면 설정 |
| `#board/학급코드` | 교사 기기의 새 창 | ‘TV·편의기능’에서 엶: 공지·미션 크게(완료 인원)·판서·타이머·번호 뽑기·지각생 하교 타이머 |
| `#admin` | 앱 관리자 | 개설 코드 발급·중지·삭제, 코드별 학급 보기, 교사 비밀번호 재설정 코드 |

급식·학사일정은 나이스 교육정보 개방 포털(open.neis.go.kr)에서 브라우저가 바로 가져옵니다.
테마 12가지·글꼴 8가지 중에서 기기마다 고를 수 있습니다(기본: 솜사탕 파스텔 + 고운돋움).

## 기술

React 19 + TypeScript + Vite + Tailwind 4, PWA. 서버는 Firebase 무료 요금제(Spark): Firestore(서울 리전) + 익명 로그인.
Cloud Functions·Storage는 쓰지 않습니다(결제 정보 불필요). 누가 무엇을 읽고 쓰는지는 [`firestore.rules`](firestore.rules)가 서버에서 검사합니다.

## 바로 해 보기

```bash
npm ci
npm run dev          # http://localhost:3000  (Firebase 설정이 비어 있으면 체험용으로 켜짐)
```

체험용은 이 브라우저 안에서만 동작합니다. 개설 코드 `DEMO-2026`, 관리자 키 `demo-admin`.

## 배포

- 주소: https://uriban-portal.web.app (Firebase Hosting) · https://potal-sand.vercel.app (Vercel, `main` 에 올리면 자동)
- Firebase 배포: `npm run build && npx firebase-tools deploy --only firestore:rules,auth,hosting`
- Firebase 연결: [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md)
- 개인정보 수집 항목 정리(동의서·심의 자료용): [docs/PRIVACY.md](docs/PRIVACY.md)
