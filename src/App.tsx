import { Suspense, lazy, useEffect, useState } from 'react';
import StudentApp from './student/StudentApp';
import { Spinner, Toaster } from './ui/kit';

// 교사·관리자·TV 화면은 따로 내려받음 (학생 기기에는 싣지 않음)
const TeacherApp = lazy(() => import('./teacher/TeacherApp'));
const AdminApp = lazy(() => import('./admin/AdminApp'));
const BoardApp = lazy(() => import('./board/BoardApp'));

type Route = { name: 'student' } | { name: 'teacher' } | { name: 'admin' } | { name: 'board'; classId: string; missionId?: string; mode?: string };

// 주소 끝 표시로 화면을 나눔: 기본은 학생, #teacher 교사, #admin 관리자, #board/학급코드/미션ID 교실 화면(교사 기기)
const routeOf = (): Route => {
  const h = location.hash;
  if (h === '#teacher' || h.startsWith('#teacher/')) return { name: 'teacher' };
  if (h === '#admin') return { name: 'admin' };
  if (h.startsWith('#board/')) {
    const [path, q = ''] = h.slice(1).split('?');
    const [, classId = '', missionId = ''] = path.split('/');
    const mode = new URLSearchParams(q).get('m') || undefined;
    return { name: 'board', classId, missionId: missionId || undefined, mode };
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
        {route.name === 'board' && <BoardApp key={route.classId + (route.missionId || '') + (route.mode || '')} classId={route.classId} missionId={route.missionId} initialMode={route.mode} />}
      </Suspense>
      <Toaster />
    </>
  );
}
