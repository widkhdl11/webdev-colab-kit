import { el } from "@/shared/lib/dom";
import type { Child } from "@/shared/lib/dom";

// 폼 프리미티브 — 도메인 지식 없는 범용 UI 킷. label-input 연결(for)을 자동으로 건다.
export function field(labelText: string, control: HTMLElement, hint?: Child): HTMLElement {
  const label = el("label", { class: "form-field__label" }, labelText);
  if (control.id) label.setAttribute("for", control.id);
  return el("div", { class: "form-field" }, label, control, hint ?? null);
}

// 읽기 전용 표시 필드(입력 아님) — 작성자처럼 고정된 값.
export function staticField(labelText: string, value: string): HTMLElement {
  return el("div", { class: "form-field" },
    el("span", { class: "form-field__label" }, labelText),
    el("div", { class: "form-static" }, value),
  );
}

export function textInput(id: string, value: string, placeholder = ""): HTMLInputElement {
  return el("input", { id, class: "input input--block", type: "text", value, placeholder });
}

// 타입 지정 입력(email/password/tel 등) + autocomplete 힌트. 값 없이 빈 입력(등록/인증용).
export function inputOf(id: string, type: string, placeholder = "", autocomplete = ""): HTMLInputElement {
  const props: Record<string, unknown> = { id, class: "input input--block", type, placeholder };
  if (autocomplete) props.autocomplete = autocomplete;
  return el("input", props);
}

export function selectInput(id: string, options: readonly string[], selected: string): HTMLSelectElement {
  return el("select", { id, class: "select select--block" },
    ...options.map((o) => el("option", o === selected ? { selected: "" } : {}, o)),
  );
}

export function numberInput(id: string, value: string, min: number, max: number): HTMLInputElement {
  return el("input", {
    id, class: "input input--block", type: "number", value,
    min: String(min), max: String(max), inputmode: "numeric",
  });
}

export function textArea(id: string, value: string, placeholder = "", rows = 6): HTMLTextAreaElement {
  return el("textarea", { id, class: "input input--block textarea", rows: String(rows), placeholder }, value);
}

// 폼 안의 입력 값 읽기. 기본은 trim(공백 방지) — 비밀번호처럼 공백 유의미하면 { trim: false }.
export function fieldValue(form: HTMLFormElement, id: string, opts?: { trim?: boolean }): string {
  const input = form.querySelector<HTMLInputElement>(`#${id}`);
  const value = input ? input.value : "";
  return opts?.trim === false ? value : value.trim();
}

// 비동기 제출 동안 버튼 비활성 + aria-busy, 완료 시 반드시 복구(예외에도).
export async function withPending(button: HTMLButtonElement, run: () => Promise<void>): Promise<void> {
  button.disabled = true;
  button.setAttribute("aria-busy", "true");
  try {
    await run();
  } finally {
    button.disabled = false;
    button.removeAttribute("aria-busy");
  }
}

export interface FormNote {
  readonly node: HTMLElement;
  show(kind: "error" | "info", message: string): void;
  clear(): void;
}

// 폼 상태 알림 슬롯. 노드는 항상 DOM에 상주하는 라이브 리전(비면 CSS `:empty`로 숨김) →
// 숨겼다 꺼내는 방식보다 스크린리더 announce가 안정적. error=assertive(alert), info=polite(status).
export function formNote(): FormNote {
  const node = el("p", { class: "form-note", role: "status", "aria-live": "polite" });
  return {
    node,
    show: (kind, message) => {
      node.className = `form-note form-note--${kind}`;
      node.setAttribute("role", kind === "error" ? "alert" : "status");
      node.setAttribute("aria-live", kind === "error" ? "assertive" : "polite");
      node.textContent = message;
    },
    clear: () => {
      node.textContent = "";
    },
  };
}
