import { supabase } from "@/shared/api/supabase";
import { ok, err, type Result } from "@/shared/lib/result";
import { parseSubject, type Subject } from "./model";

// 과목 데이터 계층. 학원 격리는 서버 RLS 가 강제한다(supabase.md) — 여기 필터는 UX 일 뿐.
// academy_id 는 서버 기본값(current_academy_id())으로 채워지므로 클라이언트는 name 만 보낸다.
// 응답은 신뢰 경계 밖 → parseSubject 로 경계에서 파싱.

// 흔한 제약 위반만 사용자 문구로. 미매핑 오류는 원문 노출 없이 일반 메시지(스키마 누출 방지).
function translate(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("duplicate key") || m.includes("unique")) return "이미 등록된 과목입니다.";
  if (m.includes("check constraint")) return "과목명을 입력하세요.";
  console.error("[subject] 미매핑 오류:", message);
  return "요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.";
}

export async function listSubjects(): Promise<Result<Subject[]>> {
  const { data, error } = await supabase.from("subject").select("id, name").order("created_at");
  if (error) return err(translate(error.message));
  try {
    return ok((data ?? []).map(parseSubject));
  } catch (e) {
    return err(e instanceof Error ? e.message : "과목 응답을 해석할 수 없습니다.");
  }
}

export async function addSubject(name: string): Promise<Result<Subject>> {
  const trimmed = name.trim();
  if (!trimmed) return err("과목명을 입력하세요.");
  const { data, error } = await supabase.from("subject").insert({ name: trimmed }).select("id, name").single();
  if (error) return err(translate(error.message));
  try {
    return ok(parseSubject(data));
  } catch (e) {
    return err(e instanceof Error ? e.message : "과목 응답을 해석할 수 없습니다.");
  }
}

export async function deleteSubject(id: string): Promise<Result<void>> {
  const { error } = await supabase.from("subject").delete().eq("id", id);
  if (error) return err(translate(error.message));
  return ok(undefined);
}
