import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { listStudents } from "@/entities/student/repo";
import { summarizeEvaluations } from "@/entities/student/model";
import type { Student } from "@/entities/student/model";
import { StudentTable } from "@/widgets/student-table/ui";

function StatCard({
  label, children, extra,
}: {
  readonly label: string;
  readonly children: ReactNode;
  readonly extra?: ReactNode;
}): ReactNode {
  return (
    <div className="stat">
      <div className="stat__label">{label}</div>
      {children}
      {extra}
    </div>
  );
}

// 요약 지표. 집계는 entities(summarizeEvaluations)가 한다 — 화면은 표시만.
function Stats({ students }: { readonly students: Student[] }): ReactNode {
  const { total, done, pct } = summarizeEvaluations(students);
  return (
    <section className="stats" aria-label="요약 지표">
      <StatCard label="총 담당 학생">
        <div className="stat__value"><span className="num">{total}</span><small> 명</small></div>
      </StatCard>
      <StatCard
        label="이번 달 평가 완료"
        extra={
          <div
            className="progress"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`이번 달 평가 완료율 ${pct}%`}
          >
            <div className="progress__bar" style={{ width: `${pct}%` }} />
          </div>
        }
      >
        <div className="stat__value"><span className="num">{done}</span><small>{` / ${total}명`}</small></div>
      </StatCard>
      {/* 다가오는 시험은 아직 데이터 소스가 없다 — 시안의 고정 문구 그대로(비범위). */}
      <StatCard label="다가오는 시험" extra={<div className="stat__note">대상 중3 · 대비반 24명</div>}>
        <div className="stat__value stat__value--sm">7월 모의고사 <small>· D-5 (7/26 토)</small></div>
      </StatCard>
    </section>
  );
}

// 검색·필터는 아직 동작하지 않는다(시안의 자리만). 붙일 때 상위에서 상태를 내려준다.
function Toolbar(): ReactNode {
  return (
    <section className="toolbar">
      <div className="toolbar__filters">
        <label className="field">
          <span className="sr-only">학생 이름 검색</span>
          <input type="search" className="input" placeholder="이름으로 검색" />
        </label>
        <label>
          <span className="sr-only">학년 필터</span>
          <select className="select" defaultValue="전체 학년">
            {["전체 학년", "중1", "중2", "중3", "고1", "고2", "고3"].map((g) => <option key={g}>{g}</option>)}
          </select>
        </label>
        <label>
          <span className="sr-only">과목 필터</span>
          <select className="select" defaultValue="전체 과목">
            {["전체 과목", "수학(공통)", "미적분", "확률과 통계", "기하"].map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
      </div>
      <Link className="btn-primary" to="/students/new">+ 학생 등록</Link>
    </section>
  );
}

function Pagination({ total }: { readonly total: number }): ReactNode {
  return (
    <div className="pagination">
      <span className="num">{`전체 ${total}명 중 1–${total}`}</span>
      <nav className="pagination__pages" aria-label="페이지 이동">
        <button className="page-btn" type="button" aria-label="이전 페이지">이전</button>
        <button className="page-btn page-btn--active num" type="button" aria-current="page">1</button>
        <button className="page-btn" type="button" aria-label="다음 페이지">다음</button>
      </nav>
    </div>
  );
}

// 학원생 목록 페이지 조합 (표시만 — 데이터는 repo에서, 판단 로직 없음).
export function StudentsPage(): ReactNode {
  const [students, setStudents] = useState<Student[] | null>(null);

  useEffect(() => {
    let alive = true;
    void listStudents().then((v) => { if (alive) setStudents(v); });
    return () => { alive = false; };
  }, []);

  return (
    <main className="container page">
      <div className="page-head">
        <div>
          <h1 className="page__title">학원생 목록</h1>
          <p className="page__desc">담당 학생을 훑어보고, 이름을 눌러 상세로 이동하세요.</p>
        </div>
        <div className="page-head__actions">
          <Link className="btn-ghost btn-ghost--sm" to="/stats">성적 통계</Link>
          <Link className="btn-ghost btn-ghost--sm" to="/subjects">과목 관리</Link>
          <Link className="btn-ghost btn-ghost--sm" to="/settings">학원 설정</Link>
        </div>
      </div>
      {students === null
        ? <p className="page__desc">불러오는 중…</p>
        : (
          <>
            <Stats students={students} />
            <Toolbar />
            <div className="table-card">
              <StudentTable students={students} />
              <Pagination total={students.length} />
            </div>
          </>
        )}
    </main>
  );
}
