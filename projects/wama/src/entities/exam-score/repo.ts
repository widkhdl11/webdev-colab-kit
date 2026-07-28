import { supabase } from "@/shared/api/supabase";
import { ok, err, type Result } from "@/shared/lib/result";
import { EXAM_KINDS, type Exam, type ExamKind, type SubjectScore } from "./model";

// 시험 성적 데이터 계층 (Supabase). 시험(부모)+과목 점수(자식) 1:N.
// 격리는 서버 RLS. 시험+점수의 원자적 저장은 서버 RPC(create/update_exam_with_scores)로 — 반쪽 시험 방지.

function toKind(raw: unknown): ExamKind {
  return EXAM_KINDS.includes(raw as ExamKind) ? (raw as ExamKind) : "학원";
}

function asScore(raw: unknown): SubjectScore | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.subject !== "string") return null;
  const score = Number(r.score);
  const max = Number(r.max_score);
  if (!Number.isFinite(score) || !Number.isFinite(max)) return null;
  return { subject: r.subject, score, max };
}

function asExam(raw: unknown): Exam {
  if (typeof raw !== "object" || raw === null) throw new Error("exam 응답이 객체가 아닙니다");
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.exam_name !== "string" || typeof r.period !== "string") {
    throw new Error("exam 응답 형식이 잘못됐습니다");
  }
  const scores = Array.isArray(r.scores)
    ? r.scores.map(asScore).filter((s): s is SubjectScore => s !== null)
    : [];
  return { id: r.id, examName: r.exam_name, kind: toKind(r.kind), period: r.period, scores };
}

export async function getExams(studentId: string): Promise<Exam[]> {
  const { data, error } = await supabase.from("exam")
    .select("id, exam_name, kind, period, scores:exam_score(subject, score, max_score)")
    .eq("student_id", studentId).order("created_at", { ascending: false });
  if (error) { console.error("[exam] getExams:", error.message); return []; }
  const out: Exam[] = [];
  for (const raw of data ?? []) {
    try { out.push(asExam(raw)); } catch (e) { console.error("[exam] 행 파싱:", e instanceof Error ? e.message : e); }
  }
  return out;
}

export async function getExamForEdit(examId: string): Promise<Exam | null> {
  const { data, error } = await supabase.from("exam")
    .select("id, exam_name, kind, period, scores:exam_score(subject, score, max_score)")
    .eq("id", examId).maybeSingle();
  if (error || data == null) {
    if (error) console.error("[exam] getExamForEdit:", error.message);
    return null;
  }
  try { return asExam(data); } catch (e) { console.error("[exam] getExamForEdit 파싱:", e instanceof Error ? e.message : e); return null; }
}

export interface ExamInput {
  readonly examName: string;
  readonly kind: ExamKind;
  readonly period: string;
  readonly scores: readonly SubjectScore[];
}

function validate(input: ExamInput): string | null {
  if (!input.examName.trim()) return "시험명을 입력하세요.";
  if (!input.period.trim()) return "시험 시기를 입력하세요.";
  const valid = input.scores.filter((s) => s.subject.trim() && Number.isFinite(s.score));
  if (valid.length === 0) return "과목 점수를 하나 이상 입력하세요.";
  if (valid.some((s) => !(s.max > 0))) return "만점은 0보다 커야 합니다.";
  return null;
}

// 저장할 점수만 추림(과목 있고 점수 입력됨). max 미입력 시 100 기본.
function scorePayload(input: ExamInput): { subject: string; score: number; max: number }[] {
  return input.scores
    .filter((s) => s.subject.trim() && Number.isFinite(s.score))
    .map((s) => ({ subject: s.subject.trim(), score: s.score, max: s.max > 0 ? s.max : 100 }));
}

export async function createExam(studentId: string, input: ExamInput): Promise<Result<void>> {
  const invalid = validate(input);
  if (invalid) return err(invalid);
  const { error } = await supabase.rpc("create_exam_with_scores", {
    p_student_id: studentId,
    p_exam_name: input.examName.trim(),
    p_kind: input.kind,
    p_period: input.period.trim(),
    p_scores: scorePayload(input),
  });
  if (error) { console.error("[exam] createExam:", error.message); return err("시험 성적을 저장할 수 없습니다. 잠시 후 다시 시도해 주세요."); }
  return ok(undefined);
}

export async function updateExam(examId: string, input: ExamInput): Promise<Result<void>> {
  const invalid = validate(input);
  if (invalid) return err(invalid);
  const { error } = await supabase.rpc("update_exam_with_scores", {
    p_exam_id: examId,
    p_exam_name: input.examName.trim(),
    p_kind: input.kind,
    p_period: input.period.trim(),
    p_scores: scorePayload(input),
  });
  if (error) { console.error("[exam] updateExam:", error.message); return err("시험 성적을 저장할 수 없습니다. 잠시 후 다시 시도해 주세요."); }
  return ok(undefined);
}
