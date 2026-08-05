import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Field, FormNote, SelectInput, StaticField, TextInput, busy, useFormNote, usePending } from "@/shared/ui/form";
import { getStudent } from "@/entities/student/repo";
import type { Student } from "@/entities/student/model";
import {
  EXAM_KINDS, isIrregularKind,
  formatRegularPeriod, formatRegularExamName, parseRegularPeriod,
  formatIrregularPeriod, parseIrregularPeriod,
  type Exam, type ExamKind, type SubjectScore,
} from "@/entities/exam-score/model";
import { createExam, updateExam, getExamForEdit, type ExamInput } from "@/entities/exam-score/repo";
import { listSubjects } from "@/entities/subject/repo";

const YEARS = ["2026", "2025", "2024"];
const SEMESTERS = ["1학기", "2학기"];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 점수 행. fixedSubject 가 있으면 과목은 라벨(고정), 없으면 select 로 고른다("+ 과목 추가").
interface ScoreRow {
  readonly key: string;
  readonly fixedSubject: string | null;
  readonly subject: string;
  readonly score: string;
  readonly max: string;
}

// 수정 시 기존 시험 식별값을 폼 필드로 되돌린다. 형식 해석은 entities(exam-score)가 한다.
function prefill(existing: Exam | null): { year: string; semester: string; name: string; date: string } {
  const empty = { year: "2026", semester: "1학기", name: "", date: todayISO() };
  if (!existing) return empty;
  if (isIrregularKind(existing.kind)) {
    return { ...empty, name: existing.examName, date: parseIrregularPeriod(existing.period) };
  }
  // 형식이 어긋난 옛 데이터는 기본값으로 — 화면이 빈칸으로 뜨는 편이 잘못 해석하는 것보다 낫다.
  return { ...empty, ...(parseRegularPeriod(existing.period) ?? {}) };
}

function initialRows(student: Student, subjectNames: string[], existing: Exam | null): ScoreRow[] {
  if (existing && existing.scores.length > 0) {
    return existing.scores.map((s: SubjectScore, i) => ({
      key: `fixed-${i}`, fixedSubject: s.subject, subject: s.subject, score: String(s.score), max: String(s.max),
    }));
  }
  const base = student.subjects.length > 0 ? student.subjects : subjectNames.slice(0, 1);
  return base.map((s, i) => ({ key: `fixed-${i}`, fixedSubject: s, subject: s, score: "", max: "100" }));
}

function ScoreForm({
  student, mode, subjectNames, existing,
}: {
  readonly student: Student;
  readonly mode: "create" | "edit";
  readonly subjectNames: string[];
  readonly existing: Exam | null;
}): ReactNode {
  const navigate = useNavigate();
  const note = useFormNote();
  const { pending, run } = usePending();
  const isEdit = mode === "edit";
  const pre = prefill(existing);

  const [kind, setKind] = useState<string>(existing?.kind ?? "중간");
  const [year, setYear] = useState(pre.year);
  const [semester, setSemester] = useState(pre.semester);
  const [examName, setExamName] = useState(pre.name);
  const [date, setDate] = useState(pre.date);
  const [rows, setRows] = useState<ScoreRow[]>(() => initialRows(student, subjectNames, existing));
  const [nextKey, setNextKey] = useState(0);

  const irregular = isIrregularKind(kind);

  function setRow(key: string, patch: Partial<ScoreRow>): void {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function addRow(): void {
    setRows((prev) => [...prev, {
      key: `added-${nextKey}`,
      fixedSubject: null,
      subject: subjectNames[0] ?? "",
      score: "",
      max: "100",
    }]);
    setNextKey((n) => n + 1);
  }

  function submit(e: FormEvent): void {
    e.preventDefault();
    // 식별 문자열 조립은 entities 몫이다 — 화면이 만들고 stats 가 파싱하면 같은 진실이 두 벌이 된다.
    const k = kind as ExamKind;
    const name = irregular ? examName.trim() : formatRegularExamName(semester, k);
    const period = irregular ? formatIrregularPeriod(date) : formatRegularPeriod(year, semester);
    // 빈 점수는 NaN 으로 보내 repo 필터(Number.isFinite)가 미응시 행을 실제로 걸러내게 한다.
    // (Number("")===0 이면 0점이 저장돼 통계 평균을 오염시킨다.)
    const scores: SubjectScore[] = rows.map((r) => ({
      subject: r.subject,
      score: r.score.trim() === "" ? NaN : Number(r.score),
      max: Number(r.max) || 100,
    }));
    const input: ExamInput = { examName: name, kind: k, period, scores };

    void run(async () => {
      note.clear();
      const res = isEdit && existing ? await updateExam(existing.id, input) : await createExam(student.id, input);
      if (!res.ok) { note.showError(res.error); return; }
      navigate(`/students/${student.id}`);
    });
  }

  return (
    <form className="form-card" noValidate onSubmit={submit}>
      <StaticField label="학생" value={`${student.name} · ${student.grade}`} />
      <Field label="시험 종류" htmlFor="f-kind">
        <SelectInput id="f-kind" value={kind} onChange={setKind} options={EXAM_KINDS} />
      </Field>

      {/* 정기고사는 연도·학기로, 비정기는 시험명·날짜로 식별한다 — 종류에 따라 한쪽만 보인다.
          감싸는 div 로 숨기지 않는다 — .form-card 의 flex gap 이 래퍼에만 붙어 안쪽 간격이 사라진다. */}
      <Field label="년도" htmlFor="f-year" hidden={irregular}>
        <SelectInput id="f-year" value={year} onChange={setYear} options={YEARS} />
      </Field>
      <Field label="학기" htmlFor="f-sem" hidden={irregular}>
        <SelectInput id="f-sem" value={semester} onChange={setSemester} options={SEMESTERS} />
      </Field>
      <Field label="시험명" htmlFor="f-exam" hidden={!irregular}>
        <TextInput id="f-exam" value={examName} onChange={setExamName} placeholder="예: 7월 학원 모의고사" />
      </Field>
      <Field label="시기" htmlFor="f-date" hidden={!irregular}>
        <input id="f-date" className="input input--block" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>

      <div className="form-field">
        <span className="form-field__label">과목별 점수</span>
        <div className="score-grid">
          <div className="score-grid__head">
            <span>과목</span><span>점수</span><span>만점</span>
          </div>
          {rows.map((r, i) => (
            <div className="score-grid__row" key={r.key}>
              {r.fixedSubject != null
                ? <span className="score-grid__subject">{r.fixedSubject}</span>
                : (
                  <SelectInput
                    id={`f-subj-${i}`}
                    value={r.subject}
                    onChange={(v) => setRow(r.key, { subject: v })}
                    options={subjectNames.length > 0 ? subjectNames : [""]}
                    ariaLabel="추가 과목"
                    block={false}
                  />
                )}
              <input
                className="input" type="number" min={0} max={1000} inputMode="numeric"
                value={r.score} placeholder="점수"
                aria-label={`${r.fixedSubject ?? "추가 과목"} 점수`}
                onChange={(e) => setRow(r.key, { score: e.target.value })}
              />
              <input
                className="input" type="number" min={0} max={1000} inputMode="numeric"
                value={r.max} placeholder="만점"
                aria-label={`${r.fixedSubject ?? "추가 과목"} 만점`}
                onChange={(e) => setRow(r.key, { max: e.target.value })}
              />
            </div>
          ))}
        </div>
        <button className="btn-ghost btn-ghost--sm" type="button" onClick={addRow}>+ 과목 추가</button>
      </div>

      <FormNote note={note.note} />
      <div className="form-actions">
        <Link className="btn-ghost" to={`/students/${student.id}`}>취소</Link>
        <button className="btn-primary" type="submit" {...busy(pending)}>
          {isEdit ? "변경 저장" : "점수 저장"}
        </button>
      </div>
    </form>
  );
}

// 시험 점수 입력/수정 페이지 — Supabase 에 영구 저장(시험+점수 원자적 RPC).
export function ScoreFormPage({ mode = "create" }: { readonly mode?: "create" | "edit" }): ReactNode {
  const { id = "", examId } = useParams();
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<Student | null>(null);
  const [subjectNames, setSubjectNames] = useState<string[]>([]);
  const [existing, setExisting] = useState<Exam | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [s, subjRes, ex] = await Promise.all([
        getStudent(id),
        listSubjects(),
        mode === "edit" && examId ? getExamForEdit(examId) : Promise.resolve(null),
      ]);
      if (!alive) return;
      setStudent(s);
      setSubjectNames(subjRes.ok ? subjRes.value.map((x) => x.name) : []);
      setExisting(ex);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [id, examId, mode]);

  return (
    <main className="container page form-page">
      <Link className="back-link" to={student ? `/students/${student.id}` : "/students"}>← 돌아가기</Link>
      <div>
        <h1 className="page__title">{mode === "edit" ? "시험 점수 수정" : "시험 점수 입력"}</h1>
        <p className="page__desc">
          {mode === "edit" ? "이 시험의 과목별 점수를 수정합니다." : "한 시험의 과목별 점수를 한 번에 입력합니다."}
        </p>
      </div>
      {loading && <p className="page__desc">불러오는 중…</p>}
      {!loading && !student && (
        <div className="empty-state"><p className="page__desc">{`학생(${id})을 찾을 수 없습니다.`}</p></div>
      )}
      {/* 수정 대상이 없는데 폼을 띄우면 "변경 저장"이 새 시험을 하나 더 만든다(시험엔 중복을 막는 제약이 없다).
          제목·버튼은 "수정"인데 결과는 생성 — 그래서 폼 자체를 띄우지 않는다. */}
      {!loading && student && mode === "edit" && !existing && (
        <div className="empty-state">
          <p className="page__desc">수정할 시험을 찾을 수 없습니다. 목록에서 다시 선택해 주세요.</p>
        </div>
      )}
      {!loading && student && !(mode === "edit" && !existing) && (
        <ScoreForm student={student} mode={mode} subjectNames={subjectNames} existing={existing} />
      )}
    </main>
  );
}
