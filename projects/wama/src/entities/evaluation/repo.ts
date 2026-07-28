import { supabase } from "@/shared/api/supabase";
import { ok, err, type Result } from "@/shared/lib/result";
import type { Evaluation } from "./model";

// 평가 데이터 계층 (Supabase). 학원 격리·작성자(author)·academy_id 는 서버(RLS + evaluation_guard 트리거)가 강제.
// DB period_month 는 "YYYY-MM"(regex 제약). 표시 모델 month 는 "YYYY.MM". content↔body.
// 작성 선생님 이름은 author_teacher_id → teacher(name) 임베드로 가져온다.

// 임베드는 버전에 따라 객체 또는 1요소 배열로 올 수 있어 양쪽을 흡수.
function teacherName(raw: unknown): string {
  const t = Array.isArray(raw) ? raw[0] : raw;
  if (t && typeof t === "object" && typeof (t as { name?: unknown }).name === "string") {
    return (t as { name: string }).name;
  }
  return "";
}

function asEvaluation(raw: unknown): Evaluation {
  if (typeof raw !== "object" || raw === null) throw new Error("evaluation 응답이 객체가 아닙니다");
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.subject !== "string" || typeof r.period_month !== "string") {
    throw new Error("evaluation 응답 형식이 잘못됐습니다");
  }
  return {
    id: r.id,
    month: r.period_month.replace("-", "."),
    subject: r.subject,
    teacher: teacherName(r.teacher),
    body: typeof r.content === "string" ? r.content : "",
  };
}

export async function getEvaluations(studentId: string): Promise<Evaluation[]> {
  const { data, error } = await supabase.from("evaluation")
    .select("id, subject, period_month, content, teacher:author_teacher_id(name)")
    .eq("student_id", studentId).order("period_month", { ascending: false });
  if (error) { console.error("[evaluation] getEvaluations:", error.message); return []; }
  const out: Evaluation[] = [];
  for (const raw of data ?? []) {
    try { out.push(asEvaluation(raw)); } catch (e) { console.error("[evaluation] 행 파싱:", e instanceof Error ? e.message : e); }
  }
  return out;
}

// 수정 폼 프리필용 — month 는 <input type=month> 값 형식("YYYY-MM")으로 반환.
export interface EvaluationEdit {
  readonly id: string;
  readonly subject: string;
  readonly month: string; // "YYYY-MM"
  readonly body: string;
}

export async function getEvaluationForEdit(id: string): Promise<EvaluationEdit | null> {
  const { data, error } = await supabase.from("evaluation")
    .select("id, subject, period_month, content").eq("id", id).maybeSingle();
  if (error || data == null) {
    if (error) console.error("[evaluation] getEvaluationForEdit:", error.message);
    return null;
  }
  const r = data as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.subject !== "string" || typeof r.period_month !== "string") return null;
  return { id: r.id, subject: r.subject, month: r.period_month, body: typeof r.content === "string" ? r.content : "" };
}

export interface EvaluationInput {
  readonly subject: string;
  readonly month: string; // "YYYY-MM"
  readonly body: string;
}

function validate(input: EvaluationInput): string | null {
  if (!input.subject.trim()) return "과목을 선택하세요.";
  if (!/^\d{4}-\d{2}$/.test(input.month)) return "평가 월을 선택하세요.";
  if (!input.body.trim()) return "평가 내용을 입력하세요.";
  return null;
}

function mapError(message: string): string {
  if (message.toLowerCase().includes("duplicate") || message.toLowerCase().includes("unique")) {
    return "이 학생·과목·월의 평가가 이미 있습니다. 기존 평가를 수정하세요.";
  }
  return "평가를 저장할 수 없습니다. 잠시 후 다시 시도해 주세요.";
}

export async function createEvaluation(studentId: string, input: EvaluationInput): Promise<Result<void>> {
  const invalid = validate(input);
  if (invalid) return err(invalid);
  const { error } = await supabase.from("evaluation").insert({
    student_id: studentId, subject: input.subject, period_month: input.month, content: input.body.trim(),
  });
  if (error) { console.error("[evaluation] createEvaluation:", error.message); return err(mapError(error.message)); }
  return ok(undefined);
}

export async function updateEvaluation(id: string, input: EvaluationInput): Promise<Result<void>> {
  const invalid = validate(input);
  if (invalid) return err(invalid);
  const { error } = await supabase.from("evaluation")
    .update({ subject: input.subject, period_month: input.month, content: input.body.trim() }).eq("id", id);
  if (error) { console.error("[evaluation] updateEvaluation:", error.message); return err(mapError(error.message)); }
  return ok(undefined);
}
