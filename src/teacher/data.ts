import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Api, emptyLive } from '../lib/api';
import { errorMessage } from '../lib/cloud';
import { CalEvent, ClassInfo, LinkItem, LiveDoc, Notice, RolesDoc, SchoolInfo, Student, StudentStatus, Task, TaskTemplate } from '../lib/types';

export interface ClassData {
  api: Api;
  classId: string;
  info: ClassInfo | null;
  live: LiveDoc;
  links: LinkItem[];
  tasks: Task[];
  statuses: Record<string, StudentStatus>;
  students: Student[];
  claimed: Record<string, boolean>;
  notices: Notice[];
  templates: TaskTemplate[];
  school: SchoolInfo | null;
  roles: RolesDoc | null;
  events: CalEvent[];
  error: string;
  ready: boolean;
  privacy: boolean;
  // 가림 모드일 때 이름 대신 번호
  nameOf: (sid: string) => string;
}

// 교사 화면 전체가 함께 쓰는 학급 자료 (서버와 실시간으로 맞춰짐)
export function useClassData(api: Api, classId: string, privacy: boolean): ClassData {
  const [info, setInfo] = useState<ClassInfo | null>(null);
  const [live, setLive] = useState<LiveDoc>(emptyLive);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [statuses, setStatuses] = useState<Record<string, StudentStatus>>({});
  const [students, setStudents] = useState<Student[]>([]);
  const [claimed, setClaimed] = useState<Record<string, boolean>>({});
  const [notices, setNotices] = useState<Notice[]>([]);
  const [templates, setTemplates] = useState<TaskTemplate[]>([]);
  const [school, setSchool] = useState<SchoolInfo | null>(null);
  const [roles, setRoles] = useState<RolesDoc | null>(null);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const onErr = (e: unknown) => setError(errorMessage(e));
    const mark = (k: string) => setLoaded((m) => (m[k] ? m : { ...m, [k]: true }));
    const stops = [
      api.watchClass(classId, (c) => (setInfo(c), mark('info')), onErr),
      api.watchLive(classId, (l) => (setLive(l), mark('live')), onErr),
      api.watchLinks(classId, setLinks, onErr),
      api.watchTasks(classId, (t) => (setTasks(t), mark('tasks')), onErr),
      api.watchStatuses(classId, (s) => (setStatuses(s), mark('status')), onErr),
      api.watchStudents(classId, (s) => (setStudents(s), mark('students')), onErr),
      api.watchRoster(classId, setClaimed, onErr),
      api.watchNotices(classId, setNotices, onErr),
      api.watchTemplates(classId, setTemplates, onErr),
      api.watchSchool(classId, setSchool, onErr),
      api.watchRoles(classId, setRoles, onErr),
      api.watchCalendar(classId, setEvents, onErr)
    ];
    return () => stops.forEach((s) => s());
  }, [api, classId]);

  const ready = ['info', 'live', 'tasks', 'status', 'students'].every((k) => loaded[k]);

  // 학생들이 누른 완료 인원수를 실제 기록으로 바로잡음 (잠깐 기다렸다가 한 번에)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!ready) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      api.syncLive(classId, live, tasks, students, statuses).catch(() => undefined);
    }, 1200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [ready, api, classId, live, tasks, students, statuses]);

  const byId = new Map(students.map((s) => [s.sid, s]));
  const nameOf = (sid: string) => {
    const s = byId.get(sid);
    const n = Number(sid.slice(1));
    if (privacy || !s?.name) return `${n}번`;
    return s.name;
  };

  return { api, classId, info, live, links, tasks, statuses, students, claimed, notices, templates, school, roles, events, error, ready, privacy, nameOf };
}

export const DataContext = createContext<ClassData | null>(null);
export const useData = () => {
  const d = useContext(DataContext);
  if (!d) throw new Error('학급 자료가 없어요.');
  return d;
};
