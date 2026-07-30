import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// docs/specs/auth-isolation.md 의 불변식(INV-A1~A8)을 실제 Supabase RLS/RPC에 붙어 행동 검증한다.
// 두 학원(A/B) 세션 + 무소속(C) + 비로그인(anon)으로 격리가 "새지 않음"을 증명한다.
// 네트워크 의존 → 기본 게이트에서 분리(vitest.integration.config.ts). 실행: npm run test:integration.

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const PW = "passw0rd123";

const freshClient = (): SupabaseClient =>
  createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });

// 확인된(autoconfirm) 세션을 가진 새 교사 클라이언트. autoconfirm OFF가 아니면 세션이 없어 실패한다.
async function signUpTeacher(): Promise<SupabaseClient> {
  const c = freshClient();
  const email = `t-${crypto.randomUUID()}@example.test`;
  const { data, error } = await c.auth.signUp({ email, password: PW });
  expect(error?.message ?? null).toBeNull();
  expect(data.session, "autoconfirm OFF 필요 — signUp이 세션을 반환해야 함").not.toBeNull();
  return c;
}

const rowOf = (data: unknown): { id: string } => (Array.isArray(data) ? data[0] : data) as { id: string };
const uid = async (c: SupabaseClient): Promise<string> => {
  const { data } = await c.auth.getUser();
  return data.user!.id;
};

let anon: SupabaseClient, A: SupabaseClient, B: SupabaseClient, C: SupabaseClient;
let academyAId: string, academyBId: string, studentAId: string, examAId: string;

beforeAll(async () => {
  if (!url || !anonKey) throw new Error("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 필요 (projects/wama/.env)");
  anon = freshClient();
  [A, B, C] = await Promise.all([signUpTeacher(), signUpTeacher(), signUpTeacher()]);

  const ra = await A.rpc("create_academy_and_join", { academy_name: "학원A", teacher_name: "김A" });
  expect(ra.error?.message ?? null).toBeNull();
  academyAId = rowOf(ra.data).id;

  const sa = await A.from("student").insert({ academy_id: academyAId, name: "학생A" }).select().single();
  expect(sa.error?.message ?? null).toBeNull();
  studentAId = (sa.data as { id: string }).id;

  const rb = await B.rpc("create_academy_and_join", { academy_name: "학원B", teacher_name: "김B" });
  expect(rb.error?.message ?? null).toBeNull();
  academyBId = rowOf(rb.data).id;
});

describe("auth-isolation 불변식 (실제 Supabase RLS/RPC 통합)", () => {
  it("INV-A1 (S1): 비로그인(anon)은 student 어떤 행도 못 읽는다", async () => {
    const { data, error } = await anon.from("student").select("*");
    expect(error?.message ?? null).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("INV-A2 (S2b): 타 학원 teacher는 필터 없이 조회해도 남의 학생을 못 본다", async () => {
    const { data, error } = await B.from("student").select("*");
    expect(error?.message ?? null).toBeNull();
    expect((data ?? []).some((s) => (s as { id: string }).id === studentAId)).toBe(false);
    expect(data ?? []).toHaveLength(0); // B 학원엔 학생이 없다
  });

  it("INV-A2 (S2): 타 학원 academy 행 자체가 안 보인다", async () => {
    const { data } = await B.from("academy").select("*");
    expect((data ?? []).some((a) => (a as { id: string }).id === academyAId)).toBe(false);
    expect((data ?? []).map((a) => (a as { id: string }).id)).toEqual([academyBId]);
  });

  it("INV-A3 (S3): 위조 academy_id로 student insert는 WITH CHECK로 거부", async () => {
    const { error } = await A.from("student").insert({ academy_id: crypto.randomUUID(), name: "위조" });
    expect(error, "위조 academy_id insert는 거부돼야 함").not.toBeNull();
  });

  it("INV-A5 (S4): teacher.academy_id 임의 변경은 거부되고 값도 그대로", async () => {
    const id = await uid(A);
    const { error } = await A.from("teacher").update({ academy_id: crypto.randomUUID() }).eq("id", id);
    expect(error, "academy_id 변경은 WITH CHECK 위반").not.toBeNull();
    const { data } = await A.from("teacher").select("academy_id").eq("id", id).single();
    expect((data as { academy_id: string }).academy_id).toBe(academyAId);
  });

  it("INV-A6 (S5): 무효 초대코드 참여는 거부되고 소속도 안 생긴다", async () => {
    const { error } = await C.rpc("join_academy", { code: "BADCODE-999999", teacher_name: "김C" });
    expect(error, "무효 코드는 거부").not.toBeNull();
    const { data } = await C.from("academy").select("*");
    expect(data ?? []).toHaveLength(0);
  });

  it("INV-A4 (S6): 소속은 정확히 1개 — 이미 소속이면 재생성 거부", async () => {
    const { error } = await A.rpc("create_academy_and_join", { academy_name: "중복학원", teacher_name: "x" });
    expect(error, "이미 소속 → 거부").not.toBeNull();
    const { data } = await A.from("academy").select("*");
    expect(data ?? []).toHaveLength(1);
  });

  it("INV-A8 (S8): evaluation 작성자는 최초 작성자로 고정 — 위조 update 무효", async () => {
    const authorA = await uid(A);
    const ins = await A.from("evaluation").insert({
      academy_id: academyAId, student_id: studentAId, subject: "미적분", period_month: "2026-07", content: "성실",
    }).select().single();
    expect(ins.error?.message ?? null).toBeNull();
    const evalId = (ins.data as { id: string; author_teacher_id: string }).id;
    expect((ins.data as { author_teacher_id: string }).author_teacher_id).toBe(authorA);

    // author_teacher_id 를 타인(B)으로 위조 시도 → 트리거가 최초 작성자로 되돌린다
    await A.from("evaluation").update({ author_teacher_id: await uid(B) }).eq("id", evalId);
    const { data } = await A.from("evaluation").select("author_teacher_id").eq("id", evalId).single();
    expect((data as { author_teacher_id: string }).author_teacher_id).toBe(authorA);
  });

  // subject 테이블(0005)은 같은 학원격리 패턴을 재사용 → INV-A2/A3 가 그대로 적용됨을 확인.
  it("INV-A3 (subject): academy_id 없이 insert 하면 서버가 요청자 학원으로 채운다", async () => {
    const { data, error } = await A.from("subject").insert({ name: `과목-${crypto.randomUUID()}` }).select().single();
    expect(error?.message ?? null).toBeNull();
    expect((data as { academy_id: string }).academy_id).toBe(academyAId);
  });

  it("INV-A3 (subject): 위조 academy_id 로 subject insert 는 WITH CHECK 로 거부", async () => {
    const { error } = await A.from("subject").insert({ academy_id: academyBId, name: "위조과목" });
    expect(error, "타 학원 academy_id insert 는 거부돼야 함").not.toBeNull();
  });

  it("INV-A2 (subject): 타 학원 teacher 는 필터 없이 조회해도 남의 과목을 못 본다", async () => {
    const name = `격리과목-${crypto.randomUUID()}`;
    const ins = await A.from("subject").insert({ name }).select().single();
    expect(ins.error?.message ?? null).toBeNull();
    const { data } = await B.from("subject").select("*");
    expect((data ?? []).some((s) => (s as { name: string }).name === name)).toBe(false);
  });

  it("INV-A2 (subject): 타 학원 teacher 의 삭제 시도는 무영향 — 원본이 그대로 남는다", async () => {
    const name = `삭제격리-${crypto.randomUUID()}`;
    const ins = await A.from("subject").insert({ name }).select("id").single();
    expect(ins.error?.message ?? null).toBeNull();
    const subId = (ins.data as { id: string }).id;
    // B 가 A 의 과목 삭제 시도 → RLS USING 으로 0행 삭제(에러 없이 무영향)
    await B.from("subject").delete().eq("id", subId);
    // A 세션에서 여전히 존재해야 격리가 지켜진 것
    const { data } = await A.from("subject").select("id").eq("id", subId).maybeSingle();
    expect(data, "타 학원 삭제로 사라지면 격리 위반").not.toBeNull();
  });

  // exam / exam_score(0007) 격리 — exam 은 academy_id 직접 스코프, exam_score 는 부모 exam 소속으로 스코프.
  it("INV-A3 (exam): A 가 RPC 로 시험+점수를 원자적으로 저장한다", async () => {
    const { data, error } = await A.rpc("create_exam_with_scores", {
      p_student_id: studentAId, p_exam_name: "1학기 중간고사", p_kind: "중간", p_period: "2026 1학기",
      p_scores: [{ subject: "미적분", score: 88, max: 100 }],
    });
    expect(error?.message ?? null).toBeNull();
    expect(typeof data).toBe("string");
    examAId = data as string;
    const { data: scores } = await A.from("exam_score").select("subject, score").eq("exam_id", examAId);
    expect(scores ?? []).toHaveLength(1);
  });

  it("INV-A3 (exam): B 가 A 의 학생으로 시험 생성 시도 → student 소속 검증으로 거부(0008)", async () => {
    const { error } = await B.rpc("create_exam_with_scores", {
      p_student_id: studentAId, p_exam_name: "위조시험", p_kind: "중간", p_period: "2026 1학기",
      p_scores: [{ subject: "미적분", score: 100, max: 100 }],
    });
    expect(error, "타 학원 학생으로 시험 생성은 거부돼야 함").not.toBeNull();
  });

  it("INV-A3 (exam_score): B 가 A 의 시험에 점수 직접 끼워넣기 → WITH CHECK 로 거부", async () => {
    const { error } = await B.from("exam_score").insert({ exam_id: examAId, subject: "위조", score: 0, max_score: 100 });
    expect(error, "타 학원 exam 에 점수 insert 는 거부돼야 함").not.toBeNull();
  });

  it("INV-A2 (exam): B 가 A 의 시험을 RPC 로 수정 시도 → A 의 점수는 그대로", async () => {
    await B.rpc("update_exam_with_scores", {
      p_exam_id: examAId, p_exam_name: "탈취", p_kind: "기말", p_period: "2026 2학기",
      p_scores: [{ subject: "탈취과목", score: 0, max: 100 }],
    });
    // A 세션에서 원본이 유지돼야 격리가 지켜진 것
    const { data: exam } = await A.from("exam").select("exam_name").eq("id", examAId).maybeSingle();
    expect((exam as { exam_name: string } | null)?.exam_name).toBe("1학기 중간고사");
    const { data: scores } = await A.from("exam_score").select("subject").eq("exam_id", examAId);
    expect((scores ?? []).map((s) => (s as { subject: string }).subject)).toEqual(["미적분"]);
  });

  it("INV-A7: 클라이언트 env에 서버 시크릿(service_role) 비노출 — anon 키만", () => {
    const env = import.meta.env as unknown as Record<string, unknown>;
    const leaked = Object.keys(env).filter((k) => /service.?role|SUPABASE_SERVICE/i.test(k));
    expect(leaked).toHaveLength(0);
    expect(env.VITE_SUPABASE_ANON_KEY).toBeTruthy();
  });
});
