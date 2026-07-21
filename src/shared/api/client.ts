// Supabase 연결 (anon 키만). env가 없으면 null → 앱은 인메모리 모드로 폴백한다.
// 서버 전용 키(service role)는 절대 여기 두지 않는다(브라우저 번들 = anon 전용).
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const hasSupabase = Boolean(url && anonKey);
export const supabase: SupabaseClient | null = hasSupabase ? createClient(url as string, anonKey as string) : null;
