import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { busy, usePending } from "@/shared/ui/form";
import { getStudent, deleteStudent } from "@/entities/student/repo";
import type { Student } from "@/entities/student/model";
import { getSchedule } from "@/entities/schedule/repo";
import { getEvaluations } from "@/entities/evaluation/repo";
import { getExams } from "@/entities/exam-score/repo";
import { summarizeScores } from "@/entities/exam-score/model";
import type { ScheduleSlot } from "@/entities/schedule/model";
import type { Evaluation } from "@/entities/evaluation/model";
import type { Exam } from "@/entities/exam-score/model";
import { ScheduleTable } from "@/widgets/schedule-table/ui";
import { EvaluationHistory } from "@/widgets/evaluation-history/ui";
import { ExamScoreTable } from "@/widgets/exam-score-table/ui";

function SectionCard({
  title, action, children,
}: {
  readonly title: string;
  readonly action?: ReactNode;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <section className="section-card">
      <div className="section-card__head">
        <h2 className="section-card__title">{title}</h2>
        {action}
      </div>
      <div className="section-card__body">{children}</div>
    </section>
  );
}

function MetaItem({ label, value }: { readonly label: string; readonly value: string }): ReactNode {
  return (
    <div className="hero-meta__item">
      <span className="hero-meta__label">{label}</span>
      <span className="hero-meta__value">{value}</span>
    </div>
  );
}

// 표 하단 페이지네이션 (목록 화면의 .pagination 언어 재사용). 표시만.
function TableNav({ total }: { readonly total: number }): ReactNode {
  return (
    <div className="pagination">
      <span className="num">{`전체 ${total}개 중 1–${total}`}</span>
      <nav className="pagination__pages" aria-label="페이지 이동">
        <button className="page-btn" type="button" aria-label="이전 페이지">이전</button>
        <button className="page-btn page-btn--active num" type="button" aria-current="page">1</button>
        <button className="page-btn" type="button" aria-label="다음 페이지">다음</button>
      </nav>
    </div>
  );
}

// 학생 삭제 — 되돌릴 수 없으므로 두 번 눌러 확정(네이티브 dialog 없이).
// 시간표·평가·성적은 FK ON DELETE CASCADE 로 함께 삭제된다.
function DeleteButton({ studentId, studentName }: { readonly studentId: string; readonly studentName: string }): ReactNode {
  const navigate = useNavigate();
  const { pending, run } = usePending();
  const [armed, setArmed] = useState(false);
  const [failed, setFailed] = useState(false);

  // 4초 내 재클릭이 없으면 자동 취소 — 실수로 무장된 채 남아 있지 않게.
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(t);
  }, [armed]);

  function click(): void {
    if (!armed) { setArmed(true); setFailed(false); return; }
    void run(async () => {
      const res = await deleteStudent(studentId);
      if (!res.ok) { setFailed(true); setArmed(false); return; }
      navigate("/students");
    });
  }

  const label = failed ? "삭제 실패 — 다시 시도"
    : armed ? `"${studentName}" 삭제 — 한 번 더`
      : "학생 삭제";

  return (
    <button
      className={armed ? "btn-ghost is-armed" : "btn-ghost"}
      type="button"
      aria-label={`${studentName} 학생 삭제. 한 번 더 누르면 확정됩니다.`}
      onClick={click}
      {...busy(pending)}
    >
      {label}
    </button>
  );
}

function ScoreStat({ label, value }: { readonly label: string; readonly value: string }): ReactNode {
  return (
    <div className="score-summary__item">
      <span className="score-summary__value num">{value}</span>
      <span className="score-summary__label">{label}</span>
    </div>
  );
}

interface DetailData {
  readonly slots: ScheduleSlot[];
  readonly evaluations: Evaluation[];
  readonly exams: Exam[];
}

// 학생 상세 페이지 조합 (표시만 — 데이터는 repo에서, 판단 로직 없음).
export function StudentDetailPage(): ReactNode {
  const { id = "" } = useParams();
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<Student | null>(null);
  const [data, setData] = useState<DetailData | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const s = await getStudent(id);
      if (!alive) return;
      setStudent(s);
      if (!s) { setLoading(false); return; }
      const [slots, evaluations, exams] = await Promise.all([getSchedule(id), getEvaluations(id), getExams(id)]);
      if (!alive) return;
      setData({ slots, evaluations, exams });
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [id]);

  if (loading) {
    return (
      <main className="container page detail">
        <Link className="back-link" to="/students">← 학원생 목록</Link>
        <p className="page__desc">불러오는 중…</p>
      </main>
    );
  }

  if (!student || !data) {
    return (
      <main className="container page">
        <Link className="back-link" to="/students">← 학원생 목록</Link>
        <div className="empty-state">
          <h1 className="page__title">학생을 찾을 수 없습니다</h1>
          <p className="page__desc">{`요청한 학생(${id})이 존재하지 않거나 접근 권한이 없습니다.`}</p>
        </div>
      </main>
    );
  }

  const { slots, evaluations, exams } = data;
  const scoreSummary = summarizeScores(exams);

  return (
    <main className="container page detail">
      <Link className="back-link" to="/students">← 학원생 목록</Link>

      <section className="student-hero">
        <div className="student-hero__id">
          <span className="student-hero__avatar" aria-hidden="true">{student.name.slice(0, 1)}</span>
          <div>
            <h1 className="student-hero__name">{student.name}</h1>
            <div className="hero-meta">
              <MetaItem label="학년" value={student.grade} />
              <MetaItem label="학교" value={student.school} />
              <MetaItem label="수강 과목" value={student.subjects.join(", ") || "—"} />
            </div>
          </div>
        </div>
        <div className="hero-actions">
          <Link className="btn-ghost" to={`/students/${student.id}/edit`}>정보 수정</Link>
          <DeleteButton studentId={student.id} studentName={student.name} />
          {/* 내보내는 건 평가표가 아니라 시간표·수강료 안내다(PRODUCT 필수기능 교체 2026-08-03). */}
          <Link className="btn-primary" to={`/students/${student.id}/notice`}>
            <span aria-hidden="true">⇩ </span>수강료 안내 이미지
          </Link>
        </div>
      </section>

      <SectionCard
        title="시간표"
        action={<Link className="btn-ghost btn-ghost--sm" to={`/students/${student.id}/schedule`}>시간표 편집</Link>}
      >
        <div className="table-scroll"><ScheduleTable slots={slots} /></div>
        <TableNav total={slots.length} />
      </SectionCard>

      <SectionCard
        title="시험 성적"
        action={
          <div className="section-card__head-actions">
            {exams.length > 0 && (
              <div className="score-summary">
                <ScoreStat label="평균" value={`${scoreSummary.avgPct}%`} />
                <ScoreStat label="최고" value={`${scoreSummary.bestPct}%`} />
                <ScoreStat label="횟수" value={`${scoreSummary.count}회`} />
              </div>
            )}
            <Link className="btn-ghost btn-ghost--sm" to={`/students/${student.id}/score`}>+ 점수 입력</Link>
          </div>
        }
      >
        <div className="table-scroll">
          <ExamScoreTable exams={exams} editPathFor={(xid) => `/students/${student.id}/score/${xid}/edit`} />
        </div>
        <TableNav total={exams.length} />
      </SectionCard>

      <SectionCard
        title="월간 서술 평가 이력"
        action={<Link className="btn-ghost btn-ghost--sm" to={`/students/${student.id}/evaluate`}>+ 평가 작성</Link>}
      >
        <EvaluationHistory
          evaluations={evaluations}
          editPathFor={(eid) => `/students/${student.id}/evaluate/${eid}/edit`}
        />
        <TableNav total={evaluations.length} />
      </SectionCard>
    </main>
  );
}
