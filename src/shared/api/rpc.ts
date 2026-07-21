// 범용 RPC/조회 어댑터. 도메인 개념 없음 — 호출·경계 검증만. (rules/supabase.md)
import { supabase } from "./client";

export interface RpcEnvelope {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

// RPC 응답은 신뢰 경계 밖 → {ok,error} 봉투 형태를 확인해 통과시킨다.
export async function callRpc(name: string, args: Record<string, unknown>): Promise<RpcEnvelope> {
  if (!supabase) return { ok: false, error: "Supabase가 설정되지 않았어요" };
  const { data, error } = await supabase.rpc(name, args);
  if (error) return { ok: false, error: error.message };
  if (data && typeof data === "object" && "ok" in (data as object)) return data as RpcEnvelope;
  return { ok: true }; // 반환값 없는 RPC(void)
}

export async function selectRows<T>(table: string): Promise<T[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from(table).select("*");
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}
