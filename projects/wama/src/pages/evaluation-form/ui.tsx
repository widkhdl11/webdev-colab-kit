import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Field, FormNote, SelectInput, StaticField, TextArea, busy, useFormNote, usePending } from "@/shared/ui/form";
import { getStudent } from "@/entities/student/repo";
import type { Student } from "@/entities/student/model";
import {
  createEvaluation, updateEvaluation, getEvaluationForEdit,
  type EvaluationInput, type EvaluationEdit,
} from "@/entities/evaluation/repo";

// 이번 달(YYYY-MM) — month 입력 기본값.
function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function EvaluationForm({
  student, mode, existing,
}: {
  readonly student: Student;
  readonly mode: "create" | "edit";
  readonly existing: EvaluationEdit | null;
}): ReactNode {
  const navigate = useNavigate();
  const note = useFormNote();
  const { pending, run } = usePending();
  const isEdit = mode === "edit";

  // 평가는 그 학생이 수강 중인 과목(시간표 파생)만 대상으로 한다.
  // 수정 시 기존 평가의 과목이 이제 수강 목록에 없어도(시간표 변경) 옵션에 포함해 조용한 재할당을 막는다.
  const selectedSubject = existing?.subject ?? student.subjects[0] ?? "";
  const subjectOptions = [...new Set([selectedSubject, ...student.subjects].filter(Boolean))];
  const hasSubjects = subjectOptions.length > 0;

  const [subject, setSubject] = useState(selectedSubject);
  const [month, setMonth] = useState(existing?.month ?? currentMonth());
  const [body, setBody] = useState(existing?.body ?? "");

  function submit(e: FormEvent): void {
    e.preventDefault();
    const input: EvaluationInput = { subject, month, body };
    void run(async () => {
      note.clear();
      const res = isEdit && existing
        ? await updateEvaluation(existing.id, input)
        : await createEvaluation(student.id, input);
      if (!res.ok) { note.showError(res.error); return; }
      navigate(`/students/${student.id}`);
    });
  }

  return (
    <form className="form-card" noValidate onSubmit={submit}>
      <StaticField label="학생" value={`${student.name} · ${student.grade}`} />
      <Field
        label="과목"
        htmlFor="f-subject"
        hint={hasSubjects ? undefined : (
          <span className="form-field__hint">
            먼저 <Link to={`/students/${student.id}/schedule`}>시간표</Link>에서 수강 과목을 등록하세요.
          </span>
        )}
      >
        <SelectInput id="f-subject" value={subject} onChange={setSubject} options={subjectOptions} />
      </Field>
      <Field label="평가 월" htmlFor="f-month">
        <input
          id="f-month"
          className="input input--block"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </Field>
      <StaticField label="작성 선생님" value="김지현 선생님" />
      <Field label="월간 서술 평가" htmlFor="f-body">
        <TextArea
          id="f-body"
          value={body}
          onChange={setBody}
          placeholder="학습 태도·성취·다음 달 계획을 서술하세요"
          rows={8}
        />
      </Field>
      <FormNote note={note.note} />
      <div className="form-actions">
        <Link className="btn-ghost" to={`/students/${student.id}`}>취소</Link>
        <button className="btn-primary" type="submit" disabled={pending || !hasSubjects} aria-busy={pending}>
          {isEdit ? "변경 저장" : "평가 저장"}
        </button>
      </div>
    </form>
  );
}

// 월간 서술 평가 입력/수정 페이지 — Supabase 에 영구 저장.
export function EvaluationFormPage({ mode = "create" }: { readonly mode?: "create" | "edit" }): ReactNode {
  const { id = "", evalId } = useParams();
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<Student | null>(null);
  const [existing, setExisting] = useState<EvaluationEdit | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [s, e] = await Promise.all([
        getStudent(id),
        mode === "edit" && evalId ? getEvaluationForEdit(evalId) : Promise.resolve(null),
      ]);
      if (!alive) return;
      setStudent(s);
      setExisting(e);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [id, evalId, mode]);

  return (
    <main className="container page form-page">
      <Link className="back-link" to={student ? `/students/${student.id}` : "/students"}>← 돌아가기</Link>
      <div>
        <h1 className="page__title">{mode === "edit" ? "월간 서술 평가 수정" : "월간 서술 평가 작성"}</h1>
        <p className="page__desc">
          선생님들이 학원 안에서 공유하는 월간 서술 평가입니다. 학부모에게 나가는 이미지에는 포함되지 않습니다.
        </p>
      </div>
      {loading && <p className="page__desc">불러오는 중…</p>}
      {!loading && !student && (
        <div className="empty-state"><p className="page__desc">{`학생(${id})을 찾을 수 없습니다.`}</p></div>
      )}
      {/* 수정 대상이 없는데 폼을 띄우면 "변경 저장"이 새 평가를 만든다.
          여기선 (학생·과목·월) 유니크 제약에 걸려 "이미 있습니다" 오류로 끝나지만,
          사용자에게는 원인 모를 오류다 — 애초에 폼을 띄우지 않는 편이 정직하다. */}
      {!loading && student && mode === "edit" && !existing && (
        <div className="empty-state">
          <p className="page__desc">수정할 평가를 찾을 수 없습니다. 목록에서 다시 선택해 주세요.</p>
        </div>
      )}
      {!loading && student && !(mode === "edit" && !existing) && (
        <EvaluationForm student={student} mode={mode} existing={existing} />
      )}
    </main>
  );
}
