import { useCallback, useState, type ReactNode, type ChangeEvent } from "react";

// 폼 프리미티브 — 도메인 지식 없는 범용 UI 킷(shared 규칙).
// 클래스명을 여기 한 벌만 두는 게 목적이다. 화면마다 <input className="input input--block"> 를
// 손으로 적으면 design-rules 와 조용히 갈라진다.

// ── 필드 껍데기 ──────────────────────────────────────────────────────────────
// label-input 연결(htmlFor)을 강제한다 — 연결이 없으면 스크린리더가 라벨을 못 읽는다(ui-layers 접근성).
// hidden 은 이 껍데기에 건다 — 감싸는 div 를 하나 더 두면 .form-card 의 flex gap 이
// 그 래퍼에만 붙어 안쪽 필드끼리 간격이 사라진다(실제로 score-form 에서 그렇게 깨졌다).
export function Field({
  label,
  htmlFor,
  hint,
  hidden,
  children,
}: {
  readonly label: string;
  readonly htmlFor: string;
  readonly hint?: ReactNode;
  readonly hidden?: boolean;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <div className="form-field" hidden={hidden}>
      <label className="form-field__label" htmlFor={htmlFor}>{label}</label>
      {children}
      {hint}
    </div>
  );
}

// 읽기 전용 표시 필드(입력 아님) — 작성자처럼 고정된 값.
// label 이 아니라 span 이다: 연결할 폼 컨트롤이 없는데 label 을 쓰면 빈 for 가 된다.
export function StaticField({ label, value }: { readonly label: string; readonly value: string }): ReactNode {
  return (
    <div className="form-field">
      <span className="form-field__label">{label}</span>
      <div className="form-static">{value}</div>
    </div>
  );
}

// ── 입력 프리미티브 ──────────────────────────────────────────────────────────
// 값은 전부 제어 컴포넌트(controlled)로 받는다. vanilla 시절엔 DOM 이 값의 주인이라
// form.querySelector 로 긁어왔는데(fieldValue), 그 방식은 화면 상태와 DOM 이 갈라질 수 있었다.

interface TextInputProps {
  readonly id: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly type?: string;
  readonly autoComplete?: string;
  readonly ariaLabel?: string;
  readonly disabled?: boolean;
}

export function TextInput({
  id, value, onChange, placeholder = "", type = "text", autoComplete, ariaLabel, disabled,
}: TextInputProps): ReactNode {
  return (
    <input
      id={id}
      className="input input--block"
      type={type}
      value={value}
      placeholder={placeholder}
      autoComplete={autoComplete}
      aria-label={ariaLabel}
      disabled={disabled}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
    />
  );
}

// 숫자 입력. 값을 string 으로 다루는 건 의도다 — number 로 받으면 빈칸("")을 표현할 수 없고,
// "예외 없음(빈칸)"과 "0원"의 구분이 무너진다(student-fee-overrides 가 실제로 그 구분에 의존).
export function NumberInput({
  id, value, onChange, min, max, ariaLabel, placeholder = "", disabled,
}: {
  readonly id: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly min: number;
  readonly max: number;
  readonly ariaLabel?: string;
  readonly placeholder?: string;
  readonly disabled?: boolean;
}): ReactNode {
  return (
    <input
      id={id}
      className="input input--block"
      type="number"
      inputMode="numeric"
      value={value}
      min={min}
      max={max}
      placeholder={placeholder}
      aria-label={ariaLabel}
      disabled={disabled}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
    />
  );
}

export function SelectInput({
  id, value, onChange, options, disabled, ariaLabel, block = true,
}: {
  readonly id: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** [값, 표시문구] — 값과 문구가 같으면 문자열만 줘도 된다. */
  readonly options: readonly (string | readonly [string, string])[];
  readonly disabled?: boolean;
  readonly ariaLabel?: string;
  readonly block?: boolean;
}): ReactNode {
  return (
    <select
      id={id}
      className={block ? "select select--block" : "select"}
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
    >
      {options.map((o) => {
        const [v, text] = typeof o === "string" ? [o, o] : o;
        return <option key={v} value={v}>{text}</option>;
      })}
    </select>
  );
}

export function TextArea({
  id, value, onChange, placeholder = "", rows = 6,
}: {
  readonly id: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly rows?: number;
}): ReactNode {
  return (
    <textarea
      id={id}
      className="input input--block textarea"
      rows={rows}
      value={value}
      placeholder={placeholder}
      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
    />
  );
}

// ── 제출 중 상태 ─────────────────────────────────────────────────────────────
// 비동기 제출 동안 버튼 비활성 + aria-busy, 완료 시 반드시 복구(예외에도 — finally).
export function usePending(): {
  readonly pending: boolean;
  readonly run: (fn: () => Promise<void>) => Promise<void>;
} {
  const [pending, setPending] = useState(false);
  const run = useCallback(async (fn: () => Promise<void>) => {
    setPending(true);
    try {
      await fn();
    } finally {
      setPending(false);
    }
  }, []);
  return { pending, run };
}

// 버튼에 그대로 스프레드한다: <button {...busy(pending)}>. 두 속성을 따로 적다 보면 한쪽을 빠뜨린다.
export function busy(pending: boolean): { disabled: boolean; "aria-busy": boolean } {
  return { disabled: pending, "aria-busy": pending };
}

// ── 폼 알림 ──────────────────────────────────────────────────────────────────
export type NoteKind = "error" | "info";
export interface Note {
  readonly kind: NoteKind;
  readonly message: string;
}

export function useFormNote(): {
  readonly note: Note | null;
  readonly showError: (message: string) => void;
  readonly showInfo: (message: string) => void;
  readonly clear: () => void;
} {
  const [note, setNote] = useState<Note | null>(null);
  return {
    note,
    showError: useCallback((message: string) => setNote({ kind: "error", message }), []),
    showInfo: useCallback((message: string) => setNote({ kind: "info", message }), []),
    clear: useCallback(() => setNote(null), []),
  };
}

// 노드는 항상 DOM 에 상주하는 라이브 리전(비면 CSS `:empty` 로 숨김) →
// 숨겼다 꺼내는 방식보다 스크린리더 announce 가 안정적. error=assertive(alert), info=polite(status).
// 조건부 렌더(`{note && <p>}`)로 바꾸지 말 것 — 리전이 새로 생기면 announce 를 놓친다.
export function FormNote({ note }: { readonly note: Note | null }): ReactNode {
  const isError = note?.kind === "error";
  return (
    <p
      className={note ? `form-note form-note--${note.kind}` : "form-note"}
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
    >
      {note?.message ?? ""}
    </p>
  );
}
