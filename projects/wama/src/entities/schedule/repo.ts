import type { ScheduleSlot } from "./model";

// 임시 목업. 데이터 계층(Supabase) 연결 시 getSchedule 구현만 교체한다.
// 학원 격리·인증은 서버(RLS) 책임 — 여기선 표시용 읽기만 한다.
const DEFAULT_SCHEDULE: readonly ScheduleSlot[] = [
  { id: "sc1", subject: "수학(공통)", weekday: "월", start: "17:00", end: "18:30", teacher: "김지현" },
  { id: "sc2", subject: "수학(공통)", weekday: "수", start: "17:00", end: "18:30", teacher: "김지현" },
  { id: "sc3", subject: "심화 문제풀이", weekday: "금", start: "18:40", end: "20:10", teacher: "박선우" },
  { id: "sc4", subject: "주말 클리닉", weekday: "토", start: "10:00", end: "11:30", teacher: "김지현" },
];

const BY_STUDENT: Record<string, readonly ScheduleSlot[]> = {
  s03: [
    { id: "sc1", subject: "미적분", weekday: "화", start: "19:00", end: "20:30", teacher: "박선우" },
    { id: "sc2", subject: "미적분", weekday: "목", start: "19:00", end: "20:30", teacher: "박선우" },
    { id: "sc3", subject: "주말 클리닉", weekday: "일", start: "14:00", end: "15:30", teacher: "박선우" },
  ],
};

export function getSchedule(studentId: string): Promise<ScheduleSlot[]> {
  return Promise.resolve([...(BY_STUDENT[studentId] ?? DEFAULT_SCHEDULE)]);
}
