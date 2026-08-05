import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";

export interface TeacherInfo {
  readonly name: string;
  readonly role?: string; // 데이터 모델에 역할이 없어 선택적 — 없으면 중립 라벨.
}

// 상단 헤더: 좌측 로고+학원명, 우측 내 계정. 표시만 — 로직 없음.
export function Header({
  academyName,
  teacher,
}: {
  readonly academyName: string;
  readonly teacher: TeacherInfo;
}): ReactNode {
  const navigate = useNavigate();
  const role = teacher.role ?? "선생님";
  return (
    <header className="app-header">
      <div className="container app-header__inner">
        <Link to="/students" className="brand-mark" aria-label={`${academyName} 홈`}>
          <span className="brand-logo" aria-hidden="true">{academyName.slice(0, 1)}</span>
          <span className="brand-name">{academyName}</span>
        </Link>
        <button
          className="account"
          type="button"
          title="로그아웃"
          aria-label={`${teacher.name} · 로그아웃`}
          onClick={() => navigate("/logout")}
        >
          <span className="account__meta">
            <span className="account__name">{teacher.name}</span>
            <span className="account__sub">{role}</span>
          </span>
          <span className="avatar" aria-hidden="true">{teacher.name.slice(0, 1)}</span>
        </button>
      </div>
    </header>
  );
}
