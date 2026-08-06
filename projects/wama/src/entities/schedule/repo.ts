import { supabase } from "@/shared/api/supabase";
import { ok, err, type Result } from "@/shared/lib/result";
import type { ScheduleSlot, Weekday } from "./model";

// 시간표 데이터 계층 (Supabase). 학원 격리는 서버 RLS. academy_id 는 서버 기본값.
// DB 는 요일을 smallint(0=일 … 6=토)로, 시간을 time("17:00:00")으로 저장 → 경계에서 도메인 표현으로 변환.

const NUM_TO_WEEKDAY: readonly Weekday[] = ["일", "월", "화", "수", "목", "금", "토"];
const WEEKDAY_TO_NUM: Record<Weekday, number> = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };

// "17:00:00" → "17:00". 시간은 선택 입력이라 null 을 그대로 통과시킨다(0013).
const hhmm = (t: unknown): string | null => (typeof t === "string" ? t.slice(0, 5) : null);

function asSlot(raw: unknown): ScheduleSlot {
  if (typeof raw !== "object" || raw === null) throw new Error("schedule 응답이 객체가 아닙니다");
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.subject !== "string" || typeof r.weekday !== "number") {
    throw new Error("schedule 응답 형식이 잘못됐습니다");
  }
  // 한쪽만 온 행은 DB CHECK(schedule_time_pair)가 막지만, 들어와도 반쪽으로 그리지 않는다.
  const start = hhmm(r.start_time);
  const end = hhmm(r.end_time);
  const paired = start !== null && end !== null;
  return {
    id: r.id,
    subject: r.subject,
    weekday: NUM_TO_WEEKDAY[r.weekday] ?? "월",
    start: paired ? start : null,
    end: paired ? end : null,
    teacher: typeof r.teacher === "string" ? r.teacher : "",
  };
}

export async function getSchedule(studentId: string): Promise<ScheduleSlot[]> {
  const { data, error } = await supabase
    .from("schedule").select("id, subject, weekday, start_time, end_time, teacher")
    .eq("student_id", studentId).order("weekday").order("start_time");
  if (error) { console.error("[schedule] getSchedule:", error.message); return []; }
  const out: ScheduleSlot[] = [];
  for (const raw of data ?? []) {
    try { out.push(asSlot(raw)); } catch (e) { console.error("[schedule] 행 파싱:", e instanceof Error ? e.message : e); }
  }
  return out;
}

export interface SlotInput {
  readonly subject: string;
  readonly weekday: Weekday;
  readonly start: string | null; // "17:00" | null(미정)
  readonly end: string | null;   // "18:30" | null(미정)
  readonly teacher: string;
}

// 한 슬롯(요일 1개) 추가. 폼이 여러 요일을 고르면 상위에서 요일마다 이 함수를 호출한다.
export async function createSlot(studentId: string, input: SlotInput): Promise<Result<ScheduleSlot>> {
  if (!input.subject.trim()) return err("과목을 선택하세요.");
  // 시간은 안 넣어도 된다. 넣으려면 둘 다 — 반쪽 입력은 화면마다 분기를 낳는다(DB CHECK 와 같은 규칙).
  const hasStart = Boolean(input.start);
  const hasEnd = Boolean(input.end);
  if (hasStart !== hasEnd) return err("시작·종료 시간은 둘 다 넣거나 둘 다 비워 주세요.");
  if (hasStart && hasEnd && input.end! <= input.start!) {
    return err("종료 시간이 시작 시간보다 늦어야 합니다.");
  }
  const { data, error } = await supabase.from("schedule").insert({
    student_id: studentId,
    subject: input.subject,
    weekday: WEEKDAY_TO_NUM[input.weekday],
    start_time: input.start || null,
    end_time: input.end || null,
    teacher: input.teacher.trim() || null,
  }).select("id, subject, weekday, start_time, end_time, teacher").single();
  if (error) { console.error("[schedule] createSlot:", error.message); return err("시간표를 저장할 수 없습니다. 잠시 후 다시 시도해 주세요."); }
  try {
    return ok(asSlot(data));
  } catch (e) {
    return err(e instanceof Error ? e.message : "시간표 응답을 해석할 수 없습니다.");
  }
}

export async function deleteSlot(id: string): Promise<Result<void>> {
  const { error } = await supabase.from("schedule").delete().eq("id", id);
  if (error) { console.error("[schedule] deleteSlot:", error.message); return err("시간표를 삭제할 수 없습니다. 잠시 후 다시 시도해 주세요."); }
  return ok(undefined);
}
