import { supabase } from "@/shared/api/supabase";
import { ok, err, type Result } from "@/shared/lib/result";
import { parseSubjectFee, validateSubjectFee, type OverrideDiff, type StudentSubjectFee } from "./subject-fee";

// 학생별 과목 금액 예외 데이터 계층. 학원 격리는 서버 RLS 가 강제한다(INV-PN1).
// academy_id 는 서버 기본값(current_academy_id())으로 채워지므로 클라이언트는 보내지 않는다.

const COLUMNS = "id, subject_id, monthly_fee, subject(name)";

function translate(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("duplicate key") || m.includes("unique")) return "이 학생의 해당 과목 금액이 이미 있습니다.";
  if (m.includes("monthly_fee")) return "금액은 0 이상 정수로 입력해주세요.";
  if (m.includes("foreign key") || m.includes("violates")) return "학생 또는 과목을 찾을 수 없습니다.";
  console.error("[student-subject-fee] 미매핑 오류:", message);
  return "요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.";
}

export async function listStudentSubjectFees(studentId: string): Promise<Result<StudentSubjectFee[]>> {
  const { data, error } = await supabase.from("student_subject_fee").select(COLUMNS).eq("student_id", studentId);
  if (error) return err(translate(error.message));
  try {
    return ok((data ?? []).map(parseSubjectFee));
  } catch (e) {
    return err(e instanceof Error ? e.message : "학생 과목 금액 응답을 해석할 수 없습니다.");
  }
}

// 폼 저장 = 차이만 반영. 전부 지우고 다시 넣으면 중간 실패 시 예외가 통째로 사라져
// 청구액이 조용히 올라간다 — 그래서 add/update/remove 를 나눠 보낸다.
// 한 번의 트랜잭션은 아니지만, 부분 실패해도 **남아 있는 예외가 사라지지는 않는** 순서로 돈다
// (추가·갱신 먼저, 삭제 마지막). 실패는 사용자에게 알리고 화면을 다시 읽어 맞춘다.
export async function saveStudentSubjectFees(
  studentId: string,
  diff: OverrideDiff,
): Promise<Result<StudentSubjectFee[]>> {
  for (const a of diff.added) {
    const invalid = validateSubjectFee(a.monthlyFee);
    if (invalid) return err(invalid);
  }
  for (const u of diff.updated) {
    const invalid = validateSubjectFee(u.monthlyFee);
    if (invalid) return err(invalid);
  }

  if (diff.added.length > 0) {
    const rows = diff.added.map((a) => ({
      student_id: studentId,
      subject_id: a.subjectId,
      monthly_fee: a.monthlyFee,
    }));
    const { error } = await supabase.from("student_subject_fee").insert(rows);
    if (error) return err(translate(error.message));
  }

  for (const u of diff.updated) {
    const { error } = await supabase
      .from("student_subject_fee")
      .update({ monthly_fee: u.monthlyFee })
      .eq("id", u.id);
    if (error) return err(translate(error.message));
  }

  if (diff.removed.length > 0) {
    const { error } = await supabase
      .from("student_subject_fee")
      .delete()
      .in("id", diff.removed.map((r) => r.id));
    if (error) return err(translate(error.message));
  }

  // 저장 결과를 서버에서 다시 읽어 돌려준다 — 화면이 추측한 상태가 아니라 실제 상태를 보게 한다.
  return listStudentSubjectFees(studentId);
}
