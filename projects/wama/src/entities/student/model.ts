// 학생 표시용 읽기 모델. 개인정보 최소 노출 — 나이는 두지 않고 학년(grade)만.
export type EvalStatus = "done" | "waiting";

export interface Student {
  readonly id: string;
  readonly name: string;
  readonly grade: string; // 예: "중3", "고1"
  readonly school: string;
  readonly subject: string; // 담당 과목
  readonly lastEvalMonth: string; // "YYYY.MM"
  readonly evalStatus: EvalStatus;
}

// 학년 사다리 — 인덱스+1 = 학년 번호(초1=1 … 고3=12). 파생·보정·역변환의 단일 기준.
export const GRADE_LADDER = [
  "초1", "초2", "초3", "초4", "초5", "초6", "중1", "중2", "중3", "고1", "고2", "고3",
] as const;
export type Grade = (typeof GRADE_LADDER)[number];

// 등록/수정 폼용 편집 프로필. 목록 read-model(Student)과 분리 — 생년월일은 개인정보라
// 표에 노출하지 않고(privacy) 폼 컨텍스트에서만 다룬다. 저장 기준은 birthDate.
// 학년은 birthDate에서 자동 파생. gradeOffset은 표준 학년으로부터의 보정(유급 -1, 빠른년생/조기입학 +1,
// 표준 0). 오프셋은 상수라 자동 학년이 매년 오르면 보정 학년도 함께 오른다(고정 문자열 저장이 아님).
export interface StudentProfile {
  readonly id: string;
  readonly name: string;
  readonly birthDate: string; // ISO "2011-04-12" — 저장 기준(불변)
  readonly gradeOffset: number; // 0 = 자동(표준), 음수 = 유급, 양수 = 조기/빠른년생
  readonly school: string;
  readonly subject: string;
}

// 만 나이 파생 — 표시 레이어가 아니라 여기(entities)에서 계산한다. today 는 경계에서 주입.
export function ageFromBirthDate(birthDate: string, today: Date): number | null {
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  let age = today.getFullYear() - b.getFullYear();
  const beforeBirthday =
    today.getMonth() < b.getMonth() ||
    (today.getMonth() === b.getMonth() && today.getDate() < b.getDate());
  if (beforeBirthday) age -= 1;
  return age < 0 ? null : age;
}

// 표준 학년 번호 — 한국 학년도(3월 시작) 기준, 출생연도로 결정(2009년 이후 코호트 표준).
// 초1 = 만 7세 되는 학년도이므로 g = 학년도 - 출생연도 - 6. (범위 밖일 수 있음 — 라벨 변환에서 걸러짐)
function baseGradeNumber(birthDate: string, today: Date): number | null {
  const b = new Date(birthDate);
  if (Number.isNaN(b.getTime())) return null;
  const academicYear = today.getMonth() >= 2 ? today.getFullYear() : today.getFullYear() - 1;
  return academicYear - b.getFullYear() - 6;
}

function gradeLabel(gradeNumber: number): string | null {
  return GRADE_LADDER[gradeNumber - 1] ?? null;
}

// 라벨 → 학년 번호 역변환 (폼에서 보정 학년 선택 시 오프셋 계산용). 못 찾으면 null.
export function gradeNumberOf(label: string): number | null {
  const i = GRADE_LADDER.indexOf(label as Grade);
  return i < 0 ? null : i + 1;
}

// 자동 학년(보정 0). 범위 밖(미취학·졸업)은 null → 상위에서 보정 필요.
export function gradeFromBirthDate(birthDate: string, today: Date): string | null {
  const g = baseGradeNumber(birthDate, today);
  return g == null ? null : gradeLabel(g);
}

// 표시용 실효 학년 = 표준 학년 + 보정 오프셋. 오프셋은 상수 → 매년 자동으로 함께 진급.
export function effectiveGrade(birthDate: string, gradeOffset: number, today: Date): string {
  const g = baseGradeNumber(birthDate, today);
  if (g == null) return "미정";
  return gradeLabel(g + gradeOffset) ?? "미정";
}

export interface EvalSummary {
  readonly total: number;
  readonly done: number;
  readonly pct: number;
}

// 평가 완료 요약 — 도메인 파생값은 표시 레이어가 아니라 여기(entities)에서 계산한다.
export function summarizeEvaluations(students: readonly Student[]): EvalSummary {
  const total = students.length;
  const done = students.filter((s) => s.evalStatus === "done").length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return { total, done, pct };
}
