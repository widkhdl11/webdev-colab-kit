import { supabase } from "@/shared/api/supabase";
import { ok, err, type Result } from "@/shared/lib/result";
import { effectiveGrade, type Student, type StudentProfile } from "./model";

// 학생 데이터 계층 (Supabase). 학원 격리는 서버 RLS 가 강제한다(supabase.md).
// academy_id 는 서버 기본값(current_academy_id())으로 채워지므로 클라이언트는 업무 필드만 보낸다.
//
// 읽기(list/get)는 도메인 타입을 반환하고 실패 시 빈 결과로 저하(console.error) — 읽기 페이지의
// 해피패스를 단순하게 유지. 쓰기(create/update/delete)는 Result 로 실패를 폼에 표면화한다.
//
// 표시용 파생 필드(학년·수강과목·평가상태)는 학생 단일 행이 아니라 다른 표에서 파생한다:
//   · grade        ← birth_date + grade_offset (effectiveGrade)
//   · subjects     ← 시간표(schedule)의 distinct subject
//   · lastEvalMonth / evalStatus ← 평가(evaluation)의 period_month

interface StudentRow {
  readonly id: string;
  readonly name: string;
  readonly birth_date: string | null;
  readonly grade_offset: number;
  readonly school: string | null;
}

function asRow(raw: unknown): StudentRow {
  if (typeof raw !== "object" || raw === null) throw new Error("student 응답이 객체가 아닙니다");
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.name !== "string") {
    throw new Error("student 응답에 id/name 이 없거나 형식이 잘못됐습니다");
  }
  return {
    id: r.id,
    name: r.name,
    birth_date: typeof r.birth_date === "string" ? r.birth_date : null,
    grade_offset: typeof r.grade_offset === "number" ? r.grade_offset : 0,
    school: typeof r.school === "string" ? r.school : null,
  };
}

function monthKey(today: Date): string {
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

function toStudent(
  row: StudentRow,
  subjects: string[],               // 수강 중인 과목(시간표 파생)
  evalMonths: string[],             // 이 학생의 평가 period_month("YYYY-MM") 목록 (lastEvalMonth 용)
  evaluatedThisMonth: Set<string>,  // 이번 달 평가가 완료된 과목 집합
  today: Date,
): Student {
  const sortedMonths = [...evalMonths].sort().reverse();
  const latest = sortedMonths[0];
  // 평가 완료 = 수강 중인 모든 과목이 이번 달 평가를 마쳤을 때. 수강 과목이 없으면 완료 아님(설정 필요).
  const done = subjects.length > 0 && subjects.every((s) => evaluatedThisMonth.has(s));
  return {
    id: row.id,
    name: row.name,
    grade: row.birth_date ? effectiveGrade(row.birth_date, row.grade_offset, today) : "미정",
    school: row.school ?? "",
    subjects,
    lastEvalMonth: latest ? latest.replace("-", ".") : "—",
    evalStatus: done ? "done" : "waiting",
  };
}

export async function listStudents(): Promise<Student[]> {
  const today = new Date();
  const [students, schedules, evals] = await Promise.all([
    supabase.from("student").select("id, name, birth_date, grade_offset, school"),
    supabase.from("schedule").select("student_id, subject"),
    supabase.from("evaluation").select("student_id, subject, period_month"),
  ]);
  if (students.error) { console.error("[student] listStudents:", students.error.message); return []; }
  // 보조 쿼리 실패는 치명적이지 않지만 조용히 틀린 파생값(과목 없음·전원 waiting)이 나오므로 로그로 남긴다.
  if (schedules.error) console.error("[student] listStudents schedules:", schedules.error.message);
  if (evals.error) console.error("[student] listStudents evals:", evals.error.message);

  // 학생별 수강 과목(중복 제거)·평가 월을 그룹핑 — N+1 없이 학원 단위 3쿼리로.
  const subjectsByStudent = new Map<string, Set<string>>();
  for (const s of schedules.data ?? []) {
    const r = s as { student_id?: unknown; subject?: unknown };
    if (typeof r.student_id === "string" && typeof r.subject === "string") {
      (subjectsByStudent.get(r.student_id) ?? subjectsByStudent.set(r.student_id, new Set()).get(r.student_id)!).add(r.subject);
    }
  }
  const cm = monthKey(today);
  const monthsByStudent = new Map<string, string[]>();
  const evaluatedThisMonthByStudent = new Map<string, Set<string>>(); // 이번 달 평가 완료된 과목
  for (const e of evals.data ?? []) {
    const r = e as { student_id?: unknown; subject?: unknown; period_month?: unknown };
    if (typeof r.student_id === "string" && typeof r.period_month === "string") {
      (monthsByStudent.get(r.student_id) ?? monthsByStudent.set(r.student_id, []).get(r.student_id)!).push(r.period_month);
      if (r.period_month === cm && typeof r.subject === "string") {
        (evaluatedThisMonthByStudent.get(r.student_id) ?? evaluatedThisMonthByStudent.set(r.student_id, new Set()).get(r.student_id)!).add(r.subject);
      }
    }
  }

  const out: Student[] = [];
  for (const raw of students.data ?? []) {
    try {
      const row = asRow(raw);
      out.push(toStudent(
        row,
        [...(subjectsByStudent.get(row.id) ?? [])],
        monthsByStudent.get(row.id) ?? [],
        evaluatedThisMonthByStudent.get(row.id) ?? new Set(),
        today,
      ));
    } catch (e) {
      console.error("[student] 행 파싱 실패:", e instanceof Error ? e.message : e);
    }
  }
  return out;
}

export async function getStudent(id: string): Promise<Student | null> {
  const today = new Date();
  const [student, schedules, evals] = await Promise.all([
    supabase.from("student").select("id, name, birth_date, grade_offset, school").eq("id", id).maybeSingle(),
    supabase.from("schedule").select("subject").eq("student_id", id),
    supabase.from("evaluation").select("subject, period_month").eq("student_id", id),
  ]);
  if (student.error || student.data == null) {
    if (student.error) console.error("[student] getStudent:", student.error.message);
    return null;
  }
  if (schedules.error) console.error("[student] getStudent schedules:", schedules.error.message);
  if (evals.error) console.error("[student] getStudent evals:", evals.error.message);
  try {
    const row = asRow(student.data);
    const subjects = [...new Set((schedules.data ?? []).map((s) => (s as { subject: string }).subject))];
    const evalRows = (evals.data ?? []) as { subject: string; period_month: string }[];
    const months = evalRows.map((e) => e.period_month);
    const cm = monthKey(today);
    const evaluatedThisMonth = new Set(evalRows.filter((e) => e.period_month === cm).map((e) => e.subject));
    return toStudent(row, subjects, months, evaluatedThisMonth, today);
  } catch (e) {
    console.error("[student] getStudent 파싱:", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function getStudentProfile(id: string): Promise<StudentProfile | null> {
  const { data, error } = await supabase
    .from("student").select("id, name, birth_date, grade_offset, school").eq("id", id).maybeSingle();
  if (error || data == null) {
    if (error) console.error("[student] getStudentProfile:", error.message);
    return null;
  }
  try {
    const row = asRow(data);
    return {
      id: row.id,
      name: row.name,
      birthDate: row.birth_date ?? "",
      gradeOffset: row.grade_offset,
      school: row.school ?? "",
    };
  } catch (e) {
    console.error("[student] getStudentProfile 파싱:", e instanceof Error ? e.message : e);
    return null;
  }
}

export interface StudentInput {
  readonly name: string;
  readonly birthDate: string; // ISO "YYYY-MM-DD"
  readonly gradeOffset: number;
  readonly school: string;
}

function validate(input: StudentInput): string | null {
  if (!input.name.trim()) return "학생 이름을 입력하세요.";
  if (!input.birthDate) return "생년월일을 입력하세요.";
  return null;
}

function toColumns(input: StudentInput): Record<string, unknown> {
  return {
    name: input.name.trim(),
    birth_date: input.birthDate,
    grade_offset: input.gradeOffset,
    school: input.school.trim() || null,
  };
}

export async function createStudent(input: StudentInput): Promise<Result<string>> {
  const invalid = validate(input);
  if (invalid) return err(invalid);
  const { data, error } = await supabase.from("student").insert(toColumns(input)).select("id").single();
  if (error) { console.error("[student] createStudent:", error.message); return err("학생을 저장할 수 없습니다. 잠시 후 다시 시도해 주세요."); }
  return ok((data as { id: string }).id);
}

export async function updateStudent(id: string, input: StudentInput): Promise<Result<void>> {
  const invalid = validate(input);
  if (invalid) return err(invalid);
  const { error } = await supabase.from("student").update(toColumns(input)).eq("id", id);
  if (error) { console.error("[student] updateStudent:", error.message); return err("학생 정보를 저장할 수 없습니다. 잠시 후 다시 시도해 주세요."); }
  return ok(undefined);
}

export async function deleteStudent(id: string): Promise<Result<void>> {
  const { error } = await supabase.from("student").delete().eq("id", id);
  if (error) { console.error("[student] deleteStudent:", error.message); return err("학생을 삭제할 수 없습니다. 잠시 후 다시 시도해 주세요."); }
  return ok(undefined);
}
