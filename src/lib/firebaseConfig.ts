// 학급 서버(Firebase) 연결 설정
// - 웹 앱용 공개 값이라 저장소에 두어도 됩니다. 누가 무엇을 읽고 쓸 수 있는지는
//   이 값이 아니라 서버의 보안 규칙(firestore.rules)이 지킵니다.
// - 비어 있으면 체험용(이 브라우저 안에서만 동작)으로 켜집니다.
// - .env 의 VITE_FIREBASE_* 값이 이 값보다 우선합니다.
export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  appId: ''
};
