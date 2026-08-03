import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// docs/specs/payment-notice-export.md 의 INV-PN1 을 실제 Supabase RLS 에 붙어 검증한다.
// 수강료 안내 이미지가 읽는 네 갈래 — 학생·시간표·과목 가격표·학생별 과목 예외, 그리고 학원 계좌 정보 —
// 전부가 요청자 학원으로 스코프되는지 본다. 하나라도 새면 타 학원 미성년자 정보·계좌가 이미지로 나간다.
//
// ⚠️ 이 테스트는 마이그레이션(subject_price · student_subject_fee · academy 계좌 컬럼) 전까지 red 다.
//    스펙 승인(2026-08-03) 직후 작성 — 구현이 이 테스트를 green 으로 만들어야 한다 (rules/tdd.md).
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

let A: SupabaseClient, B: SupabaseClient;
let academyAId: string;
let studentAId: string;
let priceAId: string;
let feeAId: string;

beforeAll(async () => {
  if (!url || !anonKey) throw new Error("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 필요 (projects/wama/.env)");
  [A, B] = await Promise.all([signUpTeacher(), signUpTeacher()]);

  const ra = await A.rpc("create_academy_and_join", { academy_name: "수강료학원A", teacher_name: "김A" });
  expect(ra.error?.message ?? null).toBeNull();
  academyAId = rowOf(ra.data).id;

  const rb = await B.rpc("create_academy_and_join", { academy_name: "수강료학원B", teacher_name: "김B" });
  expect(rb.error?.message ?? null).toBeNull();

  // A 학원: 학생 + 시간표(수학 주2회) + 가격표(수학 주2회 18만) + 학생별 예외(수학 15만)
  const sa = await A.from("student").insert({ academy_id: academyAId, name: "학생A" }).select().single();
  expect(sa.error?.message ?? null).toBeNull();
  studentAId = (sa.data as { id: string }).id;

  const sch = await A.from("schedule")
    .insert([
      { academy_id: academyAId, student_id: studentAId, subject: "수학", weekday: "월", start_time: "17:00", end_time: "18:30" },
      { academy_id: academyAId, student_id: studentAId, subject: "수학", weekday: "수", start_time: "17:00", end_time: "18:30" },
    ])
    .select();
  expect(sch.error?.message ?? null).toBeNull();

  const sp = await A.from("subject_price")
    .insert({ academy_id: academyAId, subject: "수학", sessions_per_week: 2, monthly_fee: 180000 })
    .select()
    .single();
  expect(sp.error?.message ?? null).toBeNull();
  priceAId = (sp.data as { id: string }).id;

  const ssf = await A.from("student_subject_fee")
    .insert({ academy_id: academyAId, student_id: studentAId, subject: "수학", monthly_fee: 150000 })
    .select()
    .single();
  expect(ssf.error?.message ?? null).toBeNull();
  feeAId = (ssf.data as { id: string }).id;

  // A 학원 입금 계좌 — 이미지 하단에 그대로 박히는 값이라 유출되면 곧바로 사고다.
  const acc = await A.from("academy")
    .update({ bank_name: "국민은행", account_number: "123456-01-234567", account_holder: "수강료학원A" })
    .eq("id", academyAId)
    .select()
    .single();
  expect(acc.error?.message ?? null).toBeNull();
});

describe("INV-PN1 — 안내 이미지가 읽는 모든 데이터는 요청자 학원 스코프", () => {
  it("B 는 A 의 과목 가격표를 볼 수 없다 (id 를 직접 지정해도)", async () => {
    const all = await B.from("subject_price").select("id, subject, monthly_fee");
    expect(all.error?.message ?? null).toBeNull();
    expect(all.data ?? []).toHaveLength(0);

    const direct = await B.from("subject_price").select("id").eq("id", priceAId);
    expect(direct.data ?? []).toHaveLength(0);
  });

  it("B 는 A 의 학생별 과목 예외(할인 금액)를 볼 수 없다", async () => {
    const direct = await B.from("student_subject_fee").select("id, monthly_fee").eq("id", feeAId);
    expect(direct.error?.message ?? null).toBeNull();
    expect(direct.data ?? []).toHaveLength(0);
  });

  it("B 는 A 의 학생·시간표를 볼 수 없다 — 이미지의 시간표 블록이 새지 않는다", async () => {
    const st = await B.from("student").select("id").eq("id", studentAId);
    expect(st.data ?? []).toHaveLength(0);

    const sch = await B.from("schedule").select("id").eq("student_id", studentAId);
    expect(sch.data ?? []).toHaveLength(0);
  });

  it("B 는 A 의 입금 계좌 정보를 볼 수 없다", async () => {
    const acc = await B.from("academy").select("id, bank_name, account_number, account_holder").eq("id", academyAId);
    expect(acc.error?.message ?? null).toBeNull();
    expect(acc.data ?? []).toHaveLength(0);
  });

  it("B 는 A 학원 밑에 가격표를 심을 수 없다 (WITH CHECK — 쓰기 방향 격리)", async () => {
    const res = await B.from("subject_price")
      .insert({ academy_id: academyAId, subject: "침투", sessions_per_week: 1, monthly_fee: 1 })
      .select();
    expect(res.error, "타 학원 academy_id 로의 삽입은 거부돼야 한다").not.toBeNull();
  });

  it("A 는 자기 데이터를 정상적으로 읽는다 (격리가 과잉이 아님을 확인)", async () => {
    const price = await A.from("subject_price").select("monthly_fee").eq("id", priceAId).single();
    expect(price.error?.message ?? null).toBeNull();
    expect((price.data as { monthly_fee: number }).monthly_fee).toBe(180000);

    const acc = await A.from("academy").select("account_number").eq("id", academyAId).single();
    expect((acc.data as { account_number: string }).account_number).toBe("123456-01-234567");
  });
});
