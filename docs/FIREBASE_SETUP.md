# 학급 서버(Firebase) 연결 방법

무료 요금제(Spark)로 충분하고, 결제 정보를 넣을 필요가 없습니다.

## 1. Firebase 프로젝트 (한 번만)

1. <https://console.firebase.google.com> → 프로젝트 추가 (애널리틱스는 꺼도 됨)
2. **Firestore Database → 데이터베이스 만들기** → 위치 `asia-northeast3 (서울)`, 프로덕션 모드
   - 위치는 만든 뒤 바꿀 수 없습니다.
3. **Authentication → 시작하기 → 로그인 방법 → 익명** 사용 설정
4. **프로젝트 설정 → 내 앱 → 웹 앱 추가** → 나온 `apiKey`, `authDomain`, `projectId`, `appId` 를
   `src/lib/firebaseConfig.ts` 에 넣습니다 (또는 `.env` / Vercel 환경 변수 `VITE_FIREBASE_*`).

## 2. 보안 규칙

`firestore.rules` 를 바꿀 때마다 다시 올려야 새 기능이 동작합니다. 둘 중 하나:

- 콘솔: **Firestore Database → 규칙** 탭에 파일 내용을 그대로 붙여 넣고 **게시**
- 명령: `npx firebase-tools deploy --only firestore:rules`

## 3. 관리자 키 등록 (한 번만)

1. 배포된 주소 끝에 `#admin` 을 붙여 엽니다.
2. ‘처음 설정할 때’ 칸에 관리자 키를 넣고 **등록값 만들기**.
3. 콘솔 → Firestore → **컬렉션 시작**: 컬렉션 `config` / 문서 `admin` / 필드 `keyHash`(string) = 등록값
4. `#admin` 에서 같은 키로 들어가 개설 코드를 만듭니다.

관리자 키를 잊으면 새 키의 등록값을 만들어 3번을 다시 하면 됩니다.

## 4. 사용 흐름

| 누가 | 어디서 | 무엇을 |
|---|---|---|
| 앱 관리자 | `#admin` | 개설 코드를 만들어 선생님께 전달 |
| 교사 | `#teacher` | 개설 코드로 학급 개설 → 학급 코드·비밀번호 기록 → 명단 붙여넣기(선택) → 초대 QR |
| 학생 | 기본 주소 | 학급 코드(또는 QR) → 번호 → PIN 4자리 → 이름 확인 |
| 교실 TV | 교사 화면 ‘학급 관리 → TV 화면 주소’ | 전자칠판 브라우저에 열어 두기 |

## 5. 배포 (호스팅)

- **Firebase Hosting**: `npm run build && npx firebase-tools deploy --only hosting`
- **Vercel**: GitHub 저장소를 연결하면 `main` 에 올릴 때마다 자동 배포 (`vercel.json` 포함)

## 6. 도입 전 확인

학교 망에서 `firestore.googleapis.com`, `identitytoolkit.googleapis.com`, 배포 주소가 열리는지 교실 기기로 먼저 접속해 봅니다.
