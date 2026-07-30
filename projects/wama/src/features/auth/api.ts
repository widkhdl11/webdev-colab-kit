import { supabase } from "@/shared/api/supabase";
import { ok, err, type Result } from "@/shared/lib/result";
import { parseAcademy, type Academy } from "@/entities/academy/model";

// 인증·학원 격리의 클라이언트 유스케이스 (docs/specs/auth-isolation.md).
// 신뢰 경계: 여기서 서버로 보내는 값은 UX용일 뿐, 인가는 서버 RLS/RPC가 강제한다.
// 학원 생성·참여는 다단계 write를 클라이언트에서 흉내내지 않고 서버 RPC로만 한다(INV-A4/A5/A6).

// 흔한 서버 메시지만 사용자 문구로. 미매핑 오류는 원문을 노출하지 않는다(스키마·내부구조 누출 방지).
function translate(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "이메일 또는 비밀번호가 올바르지 않습니다.";
  if (m.includes("email not confirmed")) return "이메일 인증이 필요합니다. 확인 메일의 링크로 인증한 뒤 로그인해 주세요.";
  if (m.includes("already registered") || m.includes("already been registered")) return "이미 가입된 이메일입니다.";
  if (m.includes("invalid join code")) return "유효하지 않은 초대코드입니다.";
  if (m.includes("already belongs to an academy")) return "이미 소속된 학원이 있습니다.";
  if (m.includes("password should be")) return "비밀번호는 6자 이상이어야 합니다.";
  if (m.includes("unable to validate email")) return "이메일 형식을 확인해 주세요.";
  if (m.includes("rate limit")) return "요청이 많습니다. 잠시 후 다시 시도해 주세요.";
  console.error("[auth] 미매핑 오류:", message);
  return "요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.";
}

// rpc(returns 단일 composite)는 객체 또는 1요소 배열로 올 수 있어 양쪽을 흡수.
function firstRow(data: unknown): unknown {
  return Array.isArray(data) ? data[0] : data;
}

// 내 학원은 세션 내 거의 불변 → 세션 단위 메모이즈(라우트마다 왕복 방지). 소속이 바뀌는 지점에서 무효화.
// undefined = 미조회 / null = 조회했고 소속 없음 / Academy = 소속.
let academyCache: Academy | null | undefined;
function invalidateAcademyCache(): void {
  academyCache = undefined;
}

export interface SignUpOutcome {
  readonly needsConfirm: boolean; // 이메일 확인이 켜져 있으면 session 없음 → 확인 링크 필요
}

export async function signUp(email: string, password: string, name: string): Promise<Result<SignUpOutcome>> {
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
  if (error) return err(translate(error.message));
  invalidateAcademyCache();
  return ok({ needsConfirm: data.session === null });
}

export async function signIn(email: string, password: string): Promise<Result<void>> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return err(translate(error.message));
  invalidateAcademyCache();
  return ok(undefined);
}

export async function signOut(): Promise<void> {
  invalidateAcademyCache();
  await supabase.auth.signOut();
}

// 새 학원 생성 + 본인 소속 (원자적 RPC). branch/phone 은 표시 필드(선택).
export async function createAcademy(
  name: string, teacherName: string, branch: string, phone: string,
): Promise<Result<Academy>> {
  const { data, error } = await supabase.rpc("create_academy_and_join", {
    academy_name: name,
    teacher_name: teacherName || null,
    branch: branch || null,
    phone: phone || null,
  });
  if (error) return err(translate(error.message));
  try {
    const academy = parseAcademy(firstRow(data));
    academyCache = academy;
    return ok(academy);
  } catch (e) {
    return err(e instanceof Error ? e.message : "학원 생성 응답을 해석할 수 없습니다.");
  }
}

// 초대코드로 기존 학원 참여 (코드 검증은 서버 RPC에서만: INV-A6).
export async function joinAcademy(code: string, teacherName: string): Promise<Result<Academy>> {
  const { data, error } = await supabase.rpc("join_academy", { code, teacher_name: teacherName || null });
  if (error) return err(translate(error.message));
  try {
    const academy = parseAcademy(firstRow(data));
    academyCache = academy;
    return ok(academy);
  } catch (e) {
    return err(e instanceof Error ? e.message : "학원 참여 응답을 해석할 수 없습니다.");
  }
}

export async function hasSession(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return data.session !== null;
}

// 내 학원. 3-state Result: ok+Academy=소속 / ok+null=소속 없음 / err=확인 실패(네트워크·파싱).
// "확인 실패"와 "소속 없음"을 구분해야 일시 오류로 온보딩에 잘못 튕기지 않는다.
// RLS가 요청자 academy_id로 스코프 → 소속 없으면 0행(null).
export async function getMyAcademy(): Promise<Result<Academy | null>> {
  if (academyCache !== undefined) return ok(academyCache);
  const { data, error } = await supabase.from("academy").select("*").limit(1).maybeSingle();
  if (error) return err(translate(error.message));
  if (data == null) {
    academyCache = null;
    return ok(null);
  }
  try {
    const academy = parseAcademy(data);
    academyCache = academy;
    return ok(academy);
  } catch (e) {
    return err(e instanceof Error ? e.message : "학원 응답을 해석할 수 없습니다.");
  }
}

export interface SessionHeader {
  readonly academyName: string;
  readonly teacherName: string;
}

// 상단 헤더 표시용 — 현재 세션의 학원명 + 교사 이름(회원가입 시 user_metadata.name).
// 표시 전용이라 실패해도 화면은 떠야 하므로 안전한 기본값으로 저하한다.
export async function getSessionHeader(): Promise<SessionHeader> {
  const [academy, user] = await Promise.all([getMyAcademy(), supabase.auth.getUser()]);
  const academyName = academy.ok && academy.value ? academy.value.name : "학원";
  const meta = user.data.user?.user_metadata as { name?: unknown } | undefined;
  const teacherName = typeof meta?.name === "string" && meta.name.trim() ? meta.name : "선생님";
  return { academyName, teacherName };
}
