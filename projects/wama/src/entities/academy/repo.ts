import { supabase } from "@/shared/api/supabase";
import { ok, err, type Result } from "@/shared/lib/result";
import { parsePaymentSettings, validatePaymentSettings, type PaymentSettings } from "./payment-settings";

// 학원 결제 안내 설정 데이터 계층. 학원 격리는 서버 RLS 가 강제한다(INV-PN1) —
// academy 조회는 요청자 학원으로 스코프되므로 id 를 클라이언트가 지정하지 않는다.
// 응답은 신뢰 경계 밖 → parsePaymentSettings 로 경계에서 1회 파싱.

const COLUMNS = "bank_name, account_number, account_holder, notice_template";

function translate(message: string): string {
  const m = message.toLowerCase();
  // 0009 의 CHECK 제약 — 앱 검증을 우회해 들어온 값이 DB 에서 걸린 경우.
  if (m.includes("academy_account_number_format")) return "계좌번호는 숫자와 하이픈만 8~20자로 입력해주세요.";
  if (m.includes("academy_notice_template_len")) return "안내 문구를 1~500자로 입력해주세요.";
  console.error("[academy] 미매핑 오류:", message);
  return "요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.";
}

// 미설정 학원은 전 컬럼이 null → 빈 문자열 4개로 정규화돼 돌아온다(폼이 null 을 다루지 않게).
export async function getPaymentSettings(): Promise<Result<PaymentSettings>> {
  const { data, error } = await supabase.from("academy").select(COLUMNS).limit(1).maybeSingle();
  if (error) return err(translate(error.message));
  if (!data) return err("소속된 학원이 없습니다.");
  try {
    return ok(parsePaymentSettings(data));
  } catch (e) {
    return err(e instanceof Error ? e.message : "학원 설정 응답을 해석할 수 없습니다.");
  }
}

// 저장 전 도메인 검증을 한 번 더 돌린다 — 화면을 우회한 호출도 여기서 걸린다(신뢰 경계).
export async function savePaymentSettings(settings: PaymentSettings): Promise<Result<PaymentSettings>> {
  const errors = validatePaymentSettings(settings);
  const firstError = Object.values(errors)[0];
  if (firstError) return err(firstError);

  // 갱신 대상은 RLS 가 보여주는 내 학원 1행뿐이다. id 를 클라이언트가 보내지 않으므로
  // 다른 학원 행을 지목할 수단이 없다 — 격리는 서버가, 여기서는 조건 없는 update 로 충분.
  const { data, error } = await supabase
    .from("academy")
    .update({
      bank_name: settings.bankName.trim(),
      account_number: settings.accountNumber.trim(),
      account_holder: settings.accountHolder.trim(),
      notice_template: settings.noticeTemplate.trim(),
    })
    .not("id", "is", null)
    .select(COLUMNS)
    .maybeSingle();

  if (error) return err(translate(error.message));
  if (!data) return err("소속된 학원이 없습니다.");
  try {
    return ok(parsePaymentSettings(data));
  } catch (e) {
    return err(e instanceof Error ? e.message : "학원 설정 응답을 해석할 수 없습니다.");
  }
}
