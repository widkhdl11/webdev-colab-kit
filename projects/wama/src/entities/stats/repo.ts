import { supabase } from "@/shared/api/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ok, err, type Result } from "@/shared/lib/result";
import type { StatExam, StatScore } from "./model";

// 통계 원천 데이터 계층 — 학원 전체 시험+점수를 읽는다.
// INV-ST1: 격리는 서버 RLS 가 강제한다. anon 세션 클라이언트로만 조회(관리 키 미사용) →
//   exam/exam_score 정책이 current_academy_id() 로 스코프하므로 타 학원 데이터는 애초에 안 온다.
// 읽기 전용. 학년은 페이지가 student read-model 에서 주입한다(FSD: 슬라이스 자족 — 타 엔티티 import 안 함).

// 결측(null·빈문자)은 NaN 으로 보존한다 — model(validScores)이 미응시로 제외하게 하기 위함.
// Number(null)===0 으로 강등하면 미응시가 0점이 되어 INV-ST4 를 우회한다(0 강등 금지).
const num = (v: unknown): number => (v == null || v === "" ? Number.NaN : Number(v));

const toScore = (raw: unknown): StatScore | null => {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.subject !== "string") return null;
  return { subject: r.subject, score: num(r.score), max: num(r.max_score) };
};

function toStatExam(raw: unknown, gradeOf: (studentId: string) => string): StatExam | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.student_id !== "string" || typeof r.period !== "string") return null;
  const scores = Array.isArray(r.scores)
    ? r.scores.map(toScore).filter((s): s is StatScore => s !== null)
    : [];
  return {
    id: r.id,
    kind: typeof r.kind === "string" ? r.kind : "",
    period: r.period,
    studentId: r.student_id,
    grade: gradeOf(r.student_id),
    scores,
  };
}

// 학원 전체 시험을 통계 입력 형태로 반환. RLS 가 학원 스코프를 강제(INV-ST1).
// Result 로 "로드 실패"와 "데이터 없음(빈 배열)"을 구분한다 — 스펙: 장애를 빈 상태로 위장 금지.
// gradeOf: 학생 id → 현재 학년(페이지가 student read-model 로 구성해 주입).
// client: 기본은 앱 anon 세션. 테스트가 특정 세션으로 실제 조회 경로를 구동할 때 주입한다.
export async function getAcademyExams(
  gradeOf: (studentId: string) => string,
  client: SupabaseClient = supabase,
): Promise<Result<StatExam[]>> {
  const { data, error } = await client
    .from("exam")
    .select("id, kind, period, student_id, scores:exam_score(subject, score, max_score)");
  if (error) {
    console.error("[stats] getAcademyExams:", error.message);
    return err("성적 통계를 불러올 수 없습니다. 잠시 후 다시 시도해 주세요.");
  }
  const out: StatExam[] = [];
  for (const raw of data ?? []) {
    const e = toStatExam(raw, gradeOf);
    if (e) out.push(e);
  }
  return ok(out);
}
