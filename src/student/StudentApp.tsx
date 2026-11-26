import { useState } from 'react';
import { loadStudentSession, saveStudentSession } from '../lib/cloud';
import { StudentSession } from '../lib/types';
import JoinFlow from './JoinFlow';
import StudentPortal from './StudentPortal';

// 학생 화면: 이 기기에 로그인 정보가 있으면 바로 포털, 없으면 입장 화면
export default function StudentApp() {
  const [session, setSession] = useState<StudentSession | null>(loadStudentSession);
  const [relogin, setRelogin] = useState<number | undefined>(undefined);

  if (!session) {
    return (
      <JoinFlow
        initialNumber={relogin}
        onJoined={(s) => {
          saveStudentSession(s);
          setRelogin(undefined);
          setSession(s);
        }}
      />
    );
  }
  return (
    <StudentPortal
      session={session}
      onSignedOut={(again) => {
        saveStudentSession(null);
        setRelogin(again ? session.number : undefined);
        setSession(null);
      }}
    />
  );
}
