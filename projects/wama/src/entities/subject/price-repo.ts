import { supabase } from "@/shared/api/supabase";
import { ok, err, type Result } from "@/shared/lib/result";
import { parseSubjectPrice, sortPrices, validateSubjectPrice, type SubjectPrice } from "./price";

// 과목 가격표 데이터 계층. 학원 격리는 서버 RLS 가 강제한다(INV-PN1) — 여기 필터는 UX 일 뿐.
// academy_id 는 서버 기본값(current_academy_id())으로 채워지므로 클라이언트는 보내지 않는다.
// 과목명은 subject 조인으로 가져온다(가격표는 이름이 아니라 subject_id 를 참조).
// 조인은 힌트 없이 `subject(name)` — 0010 의 FK 가 (subject_id, academy_id) 복합이라
// `subject:subject_id(...)` 같은 단일 컬럼 힌트로는 관계를 못 찾는다(400, 실측 확인 2026-08-04).

const COLUMNS = "id, subject_id, sessions_per_week, monthly_fee, subject(name)";

function translate(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("duplicate key") || m.includes("unique")) {
    return "이미 같은 과목·주 횟수의 가격이 있습니다. 기존 값을 수정하세요.";
  }
  if (m.includes("sessions_per_week")) return "주 횟수는 1~7회로 입력해주세요.";
  if (m.includes("monthly_fee")) return "금액은 0 이상 정수로 입력해주세요.";
  // 복합 FK 위반 — 다른 학원 과목을 참조하려 한 경우(정상 사용에서는 도달하지 않는다).
  if (m.includes("foreign key") || m.includes("violates")) return "해당 과목을 찾을 수 없습니다.";
  console.error("[subject-price] 미매핑 오류:", message);
  return "요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.";
}

function parseAll(data: unknown): Result<SubjectPrice[]> {
  try {
    return ok(sortPrices((data as unknown[] ?? []).map(parseSubjectPrice)));
  } catch (e) {
    return err(e instanceof Error ? e.message : "과목 가격 응답을 해석할 수 없습니다.");
  }
}

export async function listSubjectPrices(): Promise<Result<SubjectPrice[]>> {
  const { data, error } = await supabase.from("subject_price").select(COLUMNS);
  if (error) return err(translate(error.message));
  return parseAll(data);
}

export async function addSubjectPrice(
  subjectId: string,
  sessionsPerWeek: number,
  monthlyFee: number,
): Promise<Result<SubjectPrice>> {
  // 화면을 우회한 호출도 여기서 걸린다(신뢰 경계). DB CHECK 가 최종 방어선.
  const firstError = Object.values(validateSubjectPrice({ sessionsPerWeek, monthlyFee }))[0];
  if (firstError) return err(firstError);

  const { data, error } = await supabase
    .from("subject_price")
    .insert({ subject_id: subjectId, sessions_per_week: sessionsPerWeek, monthly_fee: monthlyFee })
    .select(COLUMNS)
    .single();
  if (error) return err(translate(error.message));
  try {
    return ok(parseSubjectPrice(data));
  } catch (e) {
    return err(e instanceof Error ? e.message : "과목 가격 응답을 해석할 수 없습니다.");
  }
}

export async function updateSubjectPrice(id: string, monthlyFee: number): Promise<Result<SubjectPrice>> {
  // 주 횟수는 바꾸지 않는다 — 바꾸면 다른 가격 줄과 충돌할 수 있어, 지우고 다시 추가하는 편이 명확하다.
  const firstError = Object.values(validateSubjectPrice({ sessionsPerWeek: 1, monthlyFee }))[0];
  if (firstError) return err(firstError);

  const { data, error } = await supabase
    .from("subject_price")
    .update({ monthly_fee: monthlyFee })
    .eq("id", id)
    .select(COLUMNS)
    .single();
  if (error) return err(translate(error.message));
  try {
    return ok(parseSubjectPrice(data));
  } catch (e) {
    return err(e instanceof Error ? e.message : "과목 가격 응답을 해석할 수 없습니다.");
  }
}

export async function deleteSubjectPrice(id: string): Promise<Result<void>> {
  const { error } = await supabase.from("subject_price").delete().eq("id", id);
  if (error) return err(translate(error.message));
  return ok(undefined);
}
