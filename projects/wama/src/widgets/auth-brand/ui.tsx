import type { ReactNode } from "react";

// 로그인 전 중앙 브랜드 마크 (로고 사각형 + 학원명). 앱 헤더와 별개 — 표시만.
export function AuthBrand({ academyName }: { readonly academyName: string }): ReactNode {
  return (
    <div className="auth-brand">
      <span className="auth-brand__logo" aria-hidden="true">{academyName.slice(0, 1)}</span>
      <span className="auth-brand__name">{academyName}</span>
    </div>
  );
}
