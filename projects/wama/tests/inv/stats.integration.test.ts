import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getAcademyExams } from "@/entities/stats/repo";
import { siteOf, siteRanking } from "@/entities/stats/model";

// docs/specs/stats.md 의 INV-ST1(통계 집계는 요청자 학원 데이터만 포함)을 실제 Supabase RLS 에 붙어 검증한다.
// 통계는 exam/exam_score 를 학원 스코프로 읽는다 — 타 학원 시험/점수가 그 조회에 새지 않음을 증명한다.
// 네트워크 의존 → 기본 게이트에서 분리(vitest.integration.config.ts). 실행: npm run test:integration.

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const PW = "passw0rd123";

const freshClient = (): SupabaseClient =>
  createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

async function signUpTeacher(): Promise<SupabaseClient> {
  const c = freshClient();
  const email = `t-${crypto.randomUUID()}@example.test`;
  const { data, error } = await c.auth.signUp({ email, password: PW });
  expect(error?.message ?? null).toBeNull();
  expect(data.session, "autoconfirm OFF 필요 — signUp이 세션을 반환해야 함").not.toBeNull();
  return c;
}

const rowOf = (data: unknown): { id: string } => (Array.isArray(data) ? data[0] : data) as { id: string };

// 통계가 읽는 것과 동일한 학원 스코프 조회.
const statsSelect = "id, kind, period, student_id, scores:exam_score(subject, score, max_score)";

let A: SupabaseClient, B: SupabaseClient;
let studentAId: string, studentBId: string, examAId: string, examBId: string;

beforeAll(async () => {
  if (!url || !anonKey) throw new Error("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 필요 (projects/wama/.env)");
  [A, B] = await Promise.all([signUpTeacher(), signUpTeacher()]);

  const ra = await A.rpc("create_academy_and_join", { academy_name: "통계학원A", teacher_name: "김A" });
  expect(ra.error?.message ?? null).toBeNull();
  const academyAId = rowOf(ra.data).id;
  const rb = await B.rpc("create_academy_and_join", { academy_name: "통계학원B", teacher_name: "김B" });
  expect(rb.error?.message ?? null).toBeNull();
  const academyBId = rowOf(rb.data).id;

  const sa = await A.from("student").insert({ academy_id: academyAId, name: "학생A" }).select().single();
  expect(sa.error?.message ?? null).toBeNull();
  studentAId = (sa.data as { id: string }).id;
  const sb = await B.from("student").insert({ academy_id: academyBId, name: "학생B" }).select().single();
  expect(sb.error?.message ?? null).toBeNull();
  studentBId = (sb.data as { id: string }).id;

  // 각 학원에 정기시험(중간, 2026 1학기) + 점수 1건.
  const ea = await A.rpc("create_exam_with_scores", {
    p_student_id: studentAId, p_exam_name: "1학기 중간고사", p_kind: "중간", p_period: "2026 1학기",
    p_scores: [{ subject: "수학", score: 80, max: 100 }],
  });
  expect(ea.error?.message ?? null).toBeNull();
  examAId = (ea.data as string);
  const eb = await B.rpc("create_exam_with_scores", {
    p_student_id: studentBId, p_exam_name: "1학기 중간고사", p_kind: "중간", p_period: "2026 1학기",
    p_scores: [{ subject: "수학", score: 30, max: 100 }],
  });
  expect(eb.error?.message ?? null).toBeNull();
  examBId = (eb.data as string);
});

describe("stats INV-ST1 (통계 집계 학원 격리, 실제 Supabase RLS)", () => {
  it("INV-ST1 (S1): A의 통계 조회는 A 시험만 반환하고 B 시험은 안 섞인다", async () => {
    const { data, error } = await A.from("exam").select(statsSelect);
    expect(error?.message ?? null).toBeNull();
    const ids = (data ?? []).map((e) => (e as { id: string }).id);
    expect(ids).toContain(examAId);
    expect(ids).not.toContain(examBId);
  });

  it("INV-ST1: B의 통계 조회에도 A 시험/점수가 안 보인다(양방향)", async () => {
    const { data } = await B.from("exam").select(statsSelect);
    const ids = (data ?? []).map((e) => (e as { id: string }).id);
    expect(ids).toEqual([examBId]); // B 학원엔 B 시험 하나뿐
    expect(ids).not.toContain(examAId);
  });

  it("INV-ST1: 타 학원 점수 행(exam_score)도 조회에 안 새어든다", async () => {
    // A 가 exam_score 를 직접 훑어도 B 점수(30점)는 부모 exam 소속 불일치로 안 보인다.
    const { data } = await A.from("exam_score").select("score, exam:exam(student_id)");
    // 양성 단언(vacuous-pass 방지): A 자신의 점수(80)는 실제로 보인다.
    expect((data ?? []).some((r) => (r as { score: number }).score === 80)).toBe(true);
    const foreign = (data ?? []).some((r) => {
      const parent = (r as { exam?: { student_id?: string } | { student_id?: string }[] }).exam;
      const sid = Array.isArray(parent) ? parent[0]?.student_id : parent?.student_id;
      return sid === studentBId;
    });
    expect(foreign).toBe(false);
  });

  it("INV-ST1: 프로덕션 조회 경로(getAcademyExams)가 A 학원만 반환 — 집계·순위에 B 부재", async () => {
    // 쿼리 문자열 복제가 아니라 실제 repo 를 A 세션으로 구동한다(우회 클라이언트로 바뀌면 여기서 깨진다).
    const res = await getAcademyExams(() => "미정", A);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const exams = res.value;
    // 양성: A 는 자기 시험·점수(80)를 본다.
    const mine = exams.find((e) => e.id === examAId);
    expect(mine, "A는 자기 시험을 본다").toBeTruthy();
    expect(mine?.scores.some((s) => s.score === 80)).toBe(true);
    // 격리: B 시험·B 학생 참조·B 점수(30)가 어디에도 없다.
    expect(exams.some((e) => e.id === examBId)).toBe(false);
    expect(exams.some((e) => e.studentId === studentBId)).toBe(false);
    expect(exams.some((e) => e.scores.some((s) => s.score === 30))).toBe(false);
    // 집계 경로(순위)에도 B 는 안 들어간다.
    const site = siteOf(mine!);
    expect(site).toBeTruthy();
    expect(siteRanking(exams, site!).some((r) => r.studentId === studentBId)).toBe(false);
  });
});
