import { createClient } from "@supabase/supabase-js";

// 범용 Supabase 연결 어댑터 — 도메인 개념 없음(supabase.md 규칙).
// 브라우저 번들에는 anon(공개) 키만. 서버 전용 시크릿 키는 여기 오지 않는다(INV-A7).
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Supabase 환경변수가 없습니다. projects/wama/.env 에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 를 설정하세요.",
  );
}

export const supabase = createClient(url, anonKey);
