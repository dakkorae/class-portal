import '@fontsource/gowun-dodum';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { applyAppearance, loadAppearance } from './ui/skins';

// 이 기기에서 고른 테마·글꼴을 먼저 입힘 (화면이 깜빡이지 않게)
const look = loadAppearance();
applyAppearance(look.skin, look.font);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// 홈 화면에 설치(PWA)할 수 있도록 서비스 워커 등록 (개발 서버에서는 하지 않음)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}
