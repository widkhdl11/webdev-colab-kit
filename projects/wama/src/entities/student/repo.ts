import type { Student, StudentProfile } from "./model";
import { effectiveGrade } from "./model";

// 임시 목업 데이터. 데이터 계층(Supabase) 연결 시 이 레코드 소스만 교체한다.
// 학원 격리·인증은 서버(RLS) 책임 — 여기선 표시용 읽기만 한다.
// 학년은 저장하지 않는다 — birthDate + gradeOffset(표준 0, 유급 -1, 조기 +1)에서 파생(매년 자동 진급).
interface StudentRecord {
  readonly id: string;
  readonly name: string;
  readonly birthDate: string;
  readonly gradeOffset: number;
  readonly school: string;
  readonly subject: string;
  readonly lastEvalMonth: string;
  readonly evalStatus: Student["evalStatus"];
}

const RECORDS: readonly StudentRecord[] = [
  { id: "s01", name: "강서준", birthDate: "2011-04-12", gradeOffset: 0, school: "서일중학교", subject: "수학(공통)", lastEvalMonth: "2026.07", evalStatus: "done" },
  { id: "s02", name: "김하윤", birthDate: "2012-09-30", gradeOffset: 0, school: "면목중학교", subject: "수학(공통)", lastEvalMonth: "2026.07", evalStatus: "done" },
  { id: "s03", name: "박도윤", birthDate: "2010-02-18", gradeOffset: 0, school: "중랑고등학교", subject: "미적분", lastEvalMonth: "2026.06", evalStatus: "waiting" },
  { id: "s04", name: "이서연", birthDate: "2009-06-05", gradeOffset: 0, school: "태릉고등학교", subject: "확률과 통계", lastEvalMonth: "2026.07", evalStatus: "done" },
  { id: "s05", name: "정우진", birthDate: "2011-11-22", gradeOffset: 0, school: "서일중학교", subject: "수학(공통)", lastEvalMonth: "2026.07", evalStatus: "done" },
  { id: "s06", name: "최유나", birthDate: "2008-03-14", gradeOffset: 0, school: "태릉고등학교", subject: "기하", lastEvalMonth: "2026.06", evalStatus: "waiting" },
  { id: "s07", name: "한지호", birthDate: "2013-07-08", gradeOffset: 0, school: "묵동중학교", subject: "수학(공통)", lastEvalMonth: "2026.07", evalStatus: "done" },
  { id: "s08", name: "윤채원", birthDate: "2010-12-01", gradeOffset: 0, school: "중랑고등학교", subject: "미적분", lastEvalMonth: "2026.07", evalStatus: "done" },
  { id: "s09", name: "임건우", birthDate: "2012-05-19", gradeOffset: 0, school: "면목중학교", subject: "수학(공통)", lastEvalMonth: "2026.05", evalStatus: "waiting" },
  { id: "s10", name: "오지안", birthDate: "2009-10-27", gradeOffset: 0, school: "태릉고등학교", subject: "확률과 통계", lastEvalMonth: "2026.07", evalStatus: "done" },
  // 초등부
  { id: "s11", name: "김서아", birthDate: "2016-05-10", gradeOffset: 0, school: "온마음초등학교", subject: "초등 수학", lastEvalMonth: "2026.07", evalStatus: "done" },
  // 유급 예시: 표준(생년월일)으로는 초5지만 한 학년 낮게 다님 → gradeOffset -1 (매년 함께 진급)
  { id: "s12", name: "이준서", birthDate: "2015-03-03", gradeOffset: -1, school: "면목초등학교", subject: "초등 수학", lastEvalMonth: "2026.06", evalStatus: "waiting" },
];

function toStudent(r: StudentRecord, today: Date): Student {
  return {
    id: r.id,
    name: r.name,
    grade: effectiveGrade(r.birthDate, r.gradeOffset, today),
    school: r.school,
    subject: r.subject,
    lastEvalMonth: r.lastEvalMonth,
    evalStatus: r.evalStatus,
  };
}

export function listStudents(): Promise<Student[]> {
  const today = new Date();
  return Promise.resolve(RECORDS.map((r) => toStudent(r, today)));
}

export function getStudent(id: string): Promise<Student | null> {
  const r = RECORDS.find((x) => x.id === id);
  return Promise.resolve(r ? toStudent(r, new Date()) : null);
}

export function getStudentProfile(id: string): Promise<StudentProfile | null> {
  const r = RECORDS.find((x) => x.id === id);
  if (!r) return Promise.resolve(null);
  return Promise.resolve({
    id: r.id,
    name: r.name,
    birthDate: r.birthDate,
    gradeOffset: r.gradeOffset,
    school: r.school,
    subject: r.subject,
  });
}
