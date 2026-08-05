import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Field, FormNote, SelectInput, StaticField, TextInput, busy, useFormNote, usePending } from "@/shared/ui/form";
import { getStudentProfile, createStudent, updateStudent, type StudentInput } from "@/entities/student/repo";
import {
  ageFromBirthDate, gradeFromBirthDate, gradeOffsetFor, effectiveGrade, GRADE_LADDER,
} from "@/entities/student/model";
import type { StudentProfile } from "@/entities/student/model";
import { StudentFeeOverrides } from "@/widgets/student-fee-overrides/ui";

type Mode = "create" | "edit";

function ageLabel(birthDate: string): string {
  if (!birthDate) return "생년월일을 입력하면 나이가 자동 계산됩니다";
  const age = ageFromBirthDate(birthDate, new Date());
  return age == null ? "날짜를 확인하세요" : `만 ${age}세`;
}

function autoGradeLabel(birthDate: string): string {
  if (!birthDate) return "생년월일을 입력하면 학년이 자동 계산됩니다";
  const g = gradeFromBirthDate(birthDate, new Date());
  return g == null ? "표준 학년 범위를 벗어남 — 직접 지정하세요" : `자동 학년: ${g} (생년월일 기준)`;
}

function backPath(mode: Mode, p: StudentProfile | null): string {
  return mode === "edit" && p ? `/students/${p.id}` : "/students";
}

function StudentForm({ mode, profile }: { readonly mode: Mode; readonly profile: StudentProfile | null }): ReactNode {
  const navigate = useNavigate();
  const note = useFormNote();
  const { pending, run } = usePending();

  const [name, setName] = useState(profile?.name ?? "");
  const [birthDate, setBirthDate] = useState(profile?.birthDate ?? "");
  const [school, setSchool] = useState(profile?.school ?? "");
  const [overrideOn, setOverrideOn] = useState(profile ? profile.gradeOffset !== 0 : false);
  const [grade, setGrade] = useState(
    profile ? effectiveGrade(profile.birthDate, profile.gradeOffset, new Date()) : "중1",
  );

  function submit(e: FormEvent): void {
    e.preventDefault();
    // 보정 규칙은 entities 가 정한다 — 여기서 계산하면 effectiveGrade 와 두 벌이 된다.
    // 직접 지정을 끄면 보정 없음(표준 학년 그대로).
    const input: StudentInput = {
      name,
      birthDate,
      gradeOffset: overrideOn ? gradeOffsetFor(birthDate, grade, new Date()) : 0,
      school,
    };
    void run(async () => {
      note.clear();
      if (mode === "edit" && profile) {
        const res = await updateStudent(profile.id, input);
        if (!res.ok) { note.showError(res.error); return; }
        navigate(`/students/${profile.id}`);
      } else {
        const res = await createStudent(input);
        if (!res.ok) { note.showError(res.error); return; }
        navigate(`/students/${res.value}`);
      }
    });
  }

  return (
    <form className="form-card" noValidate onSubmit={submit}>
      <Field label="이름" htmlFor="f-name">
        <TextInput id="f-name" value={name} onChange={setName} placeholder="학생 이름" />
      </Field>

      {/* 만 나이는 생년월일에서 파생(자동) — 폼 확인용, 목록/상세 표엔 노출하지 않는다(privacy).
          role=status(=aria-live polite): 날짜 입력 후 갱신되는 나이를 스크린리더가 통지한다. */}
      <Field
        label="생년월일"
        htmlFor="f-birth"
        hint={<span className="form-field__hint" id="f-birth-age" role="status">{ageLabel(birthDate)}</span>}
      >
        <input
          id="f-birth"
          className="input input--block"
          type="date"
          value={birthDate}
          aria-describedby="f-birth-age"
          onChange={(e) => setBirthDate(e.target.value)}
        />
      </Field>

      {/* 학년 블록 — 기본은 생년월일 자동. "직접 지정"을 켜면 select 로 보정(유급·조기입학 등).
          보정은 오프셋으로 저장되어 매년 자동 진급하므로, 그 점을 안내한다. */}
      <div className="form-field">
        <span className="form-field__label">학년</span>
        <div className="form-field__hint" id="f-grade-auto" role="status">{autoGradeLabel(birthDate)}</div>
        <label className="checkbox-row">
          <input
            id="f-grade-override"
            type="checkbox"
            checked={overrideOn}
            onChange={(e) => setOverrideOn(e.target.checked)}
          />
          <span>학년 직접 지정 (유급·조기입학·빠른년생 등 예외)</span>
        </label>
        <div className="grade-override" hidden={!overrideOn}>
          <SelectInput
            id="f-grade"
            value={grade}
            onChange={setGrade}
            options={GRADE_LADDER}
            disabled={!overrideOn}
            ariaLabel="직접 지정 학년"
          />
          <span className="form-field__hint">지정한 학년도 매년 한 학년씩 자동으로 올라갑니다.</span>
        </div>
      </div>

      <Field label="학교" htmlFor="f-school">
        <TextInput id="f-school" value={school} onChange={setSchool} placeholder="예: 서일중학교" />
      </Field>

      {/* 과목은 여기서 받지 않는다 — 한 학생이 여러 과목을 과목마다 다른 요일·시간에 듣는다(1:N).
          수강 과목·시간은 시간표 등록에서 관리한다. */}
      <StaticField label="수강 과목" value="등록 후 시간표에서 추가합니다 (과목마다 요일·시간)" />

      <FormNote note={note.note} />
      <div className="form-actions">
        <Link className="btn-ghost" to={backPath(mode, profile)}>취소</Link>
        <button className="btn-primary" type="submit" {...busy(pending)}>
          {mode === "create" ? "학생 등록" : "변경 저장"}
        </button>
      </div>
    </form>
  );
}

// 학생 등록/수정 폼 페이지 조합 (표시만 — 데이터는 repo에서, 저장 로직 없음).
export function StudentFormPage({ mode }: { readonly mode: Mode }): ReactNode {
  const { id } = useParams();
  const [loading, setLoading] = useState(mode === "edit");
  const [profile, setProfile] = useState<StudentProfile | null>(null);

  useEffect(() => {
    if (mode !== "edit" || !id) { setProfile(null); setLoading(false); return; }
    let alive = true;
    setLoading(true);
    void getStudentProfile(id).then((p) => {
      if (!alive) return;
      setProfile(p);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [mode, id]);

  const isMissing = mode === "edit" && !loading && !profile;
  const title = mode === "create" ? "학생 등록" : "학생 정보 수정";
  const desc = mode === "create"
    ? "새 학생을 학원에 등록합니다. 나이·학년은 생년월일에서 자동 계산됩니다."
    : "학생의 기본 정보를 수정합니다.";

  return (
    <main className="container page form-page">
      <Link className="back-link" to={backPath(mode, profile)}>← 돌아가기</Link>
      <div>
        <h1 className="page__title">{title}</h1>
        <p className="page__desc">{desc}</p>
      </div>

      {loading && <p className="page__desc">불러오는 중…</p>}
      {isMissing && (
        <div className="empty-state"><p className="page__desc">{`학생(${id ?? ""})을 찾을 수 없습니다.`}</p></div>
      )}
      {/* key: 수정 대상이 바뀌면 폼 상태(useState 초기값)를 새로 잡는다 — 이전 학생 값이 남지 않게. */}
      {!loading && !isMissing && <StudentForm key={profile?.id ?? "new"} mode={mode} profile={profile} />}

      {/* 수강료 예외는 학생이 존재해야 붙는다 — 등록 화면에는 아직 학생 id 가 없다.
          등록 직후 수정 화면으로 오면 그때 편집한다. */}
      {mode === "edit" && profile && <StudentFeeOverrides studentId={profile.id} />}
    </main>
  );
}
