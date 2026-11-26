# 우리 반 포털

링크·과제·공지를 한 화면에 모으고, 교실 TV(전자칠판)까지 이어 주는 학급용 웹앱입니다.
교사는 링크·과제·공지를 한곳에서 관리하고, 학생은 번호와 PIN 4자리로 들어와 “오늘 우리 반에서 할 일”을 확인합니다.

| 주소 | 누가 | 하는 일 |
|---|---|---|
| `/` | 학생 | 학급 코드(또는 QR) → 번호 → PIN. 지금 열기 링크, 고정 공지, 오늘 할 일, 링크 모음 |
| `#teacher` | 교사 | 학급 개설·열기, 대시보드, 링크·지금 열기, 과제 현황판, 공지(예약·고정·읽음 확인·그림), 학급 관리 |
| `#admin` | 앱 관리자 | 개설 코드 발급·중지·삭제, 코드별 학급 보기, 교사 비밀번호 재설정 코드 |
| `#tv/학급코드/비밀값` | 교실 TV | 시계·고정 공지·과제 완료 인원수·지금 열기 QR (학생 이름 없음) |

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

- Firebase 연결: [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md)
- 개인정보 수집 항목 정리(동의서·심의 자료용): [docs/PRIVACY.md](docs/PRIVACY.md)
