// 성공/실패를 값으로 나르는 범용 타입 — 예외 대신 UI가 분기하기 쉽게.
// 도메인 지식 없음(어느 프로젝트에나 옮겨도 동작).
export type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const err = (error: string): Result<never> => ({ ok: false, error });
