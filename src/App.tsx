import { Suspense, lazy, useEffect, useState } from 'react';
import StudentApp from './student/StudentApp';
import { Spinner, Toaster } from './ui/kit';

// 교사·관리자·TV 화면은 따로 내려받음 (학생 기기에는 싣지 않음)
const TeacherApp = lazy(() => import('./teacher/TeacherApp'));
const AdminApp = lazy(() => import('./admin/AdminApp'));
const TvApp = lazy(() => import('./tv/TvApp'));
const BoardApp = lazy(() => import('./board/BoardApp'));

type Route = { name: 'student' } | { name: 'teacher' } | { name: 'admin' } | { name: 'tv'; classId: string; token: string } | { name: 'board'; classId: string; missionId?: string };

// 주소 끝 표시로 화면을 나눔: 기본은 학생, #teacher 교사, #admin 관리자, #tv/학급코드/비밀값 TV, #board/학급코드/미션ID 교실 화면(교사 기기)
const routeOf = (): Route => {
  const h = location.hash;
  if (h === '#teacher' || h.startsWith('#teacher/')) return { name: 'teacher' };
  if (h === '#admin') return { name: 'admin' };
  if (h.startsWith('#tv/')) {
    const [, classId = '', token = ''] = h.slice(1).split('/');
    return { name: 'tv', classId, token };
  }
  if (h.startsWith('#board/')) {
    const [, classId = '', missionId = ''] = h.slice(1).split('/');
    return { name: 'board', classId, missionId: missionId || undefined };
  }
  return { name: 'student' };
};

export default function App() {
  const [route, setRoute] = useState(routeOf);
  useEffect(() => {
    const onHash = () => setRoute(routeOf());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return (
    <>
      <Suspense fallback={<Spinner />}>
        {route.name === 'student' && <StudentApp />}
        {route.name === 'teacher' && <TeacherApp />}
        {route.name === 'admin' && <AdminApp />}
        {route.name === 'tv' && <TvApp classId={route.classId} token={route.token} />}
        {route.name === 'board' && <BoardApp key={route.classId} classId={route.classId} missionId={route.missionId} />}
      </Suspense>
      <Toaster />
    </>
  );
}
