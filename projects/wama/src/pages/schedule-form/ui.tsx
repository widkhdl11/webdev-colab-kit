import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { Field, FormNote, SelectInput, TextInput, busy, useFormNote, usePending } from "@/shared/ui/form";
import { getStudent } from "@/entities/student/repo";
import type { Student } from "@/entities/student/model";
import { getSchedule, createSlot, deleteSlot } from "@/entities/schedule/repo";
import { groupSlots, type ScheduleGroup, type ScheduleSlot, type Weekday } from "@/entities/schedule/model";
import { listSubjects } from "@/entities/subject/repo";

const WEEKDAYS: readonly Weekday[] = ["월", "화", "수", "목", "금", "토", "일"];

// 같은 과목·시간·담당을 한 줄로 묶어 요일 칩 여러 개로 보여준다(승인 시안의 표시 언어).
// DB 는 요일당 1행이므로 한 묶음 = 여러 slot id. 삭제는 그 묶음의 slot 을 모두 지운다.
function GroupRow({
  group, onDelete,
}: {
  readonly group: ScheduleGroup;
  readonly onDelete: (g: ScheduleGroup) => Promise<void>;
}): ReactNode {
  const { pending, run } = usePending();
  return (
    <tr>
      <td>{group.subject}</td>
      <td>
        <div className="day-cell">
          {group.days.map((d) => <span key={d.id} className="day-chip">{d.weekday}</span>)}
        </div>
      </td>
      <td className="num">{`${group.start}–${group.end}`}</td>
      <td>{group.teacher || "미정"}</td>
      <td className="col-right">
        <button
          className="btn-ghost btn-ghost--sm"
          type="button"
          aria-label={`${group.subject} ${group.days.map((d) => d.weekday).join("·")} 슬롯 삭제`}
          onClick={() => void run(() => onDelete(group))}
          {...busy(pending)}
        >
          삭제
        </button>
      </td>
    </tr>
  );
}

export function ScheduleFormPage(): ReactNode {
  const { id = "" } = useParams();
  const note = useFormNote();
  const { pending, run } = usePending();

  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<Student | null>(null);
  const [slots, setSlots] = useState<ScheduleSlot[]>([]);
  const [subjectNames, setSubjectNames] = useState<string[]>([]);

  const [subject, setSubject] = useState("");
  const [days, setDays] = useState<readonly Weekday[]>([]);
  const [start, setStart] = useState("17:00");
  const [end, setEnd] = useState("18:30");
  const [teacher, setTeacher] = useState("");

  useEffect(() => {
    let alive = true;
    void (async () => {
      const s = await getStudent(id);
      if (!alive) return;
      setStudent(s);
      if (!s) { setLoading(false); return; }
      const [initialSlots, subjRes] = await Promise.all([getSchedule(id), listSubjects()]);
      if (!alive) return;
      const dbNames = subjRes.ok ? subjRes.value.map((x) => x.name) : [];
      // 과목 옵션: 학원 과목 전체 + 학생이 이미 듣는 과목(합집합) — 새 과목을 붙이는 화면이므로.
      const opts = [...new Set([...dbNames, ...s.subjects])];
      setSlots([...initialSlots]);
      setSubjectNames(opts);
      setSubject(opts[0] ?? "");
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [id]);

  async function removeGroup(g: ScheduleGroup): Promise<void> {
    note.clear();
    const removed: string[] = [];
    const failed: string[] = [];
    for (const d of g.days) {
      const res = await deleteSlot(d.id);
      if (res.ok) removed.push(d.id);
      else failed.push(res.error);
    }
    if (removed.length > 0) setSlots((prev) => prev.filter((s) => !removed.includes(s.id)));
    if (failed.length > 0) note.showError(failed[0] ?? "삭제 실패");
  }

  function toggleDay(d: Weekday): void {
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  function submit(e: FormEvent): void {
    e.preventDefault();
    if (days.length === 0) { note.showError("요일을 하나 이상 선택하세요."); return; }
    if (end <= start) { note.showError("종료 시간이 시작 시간보다 늦어야 합니다."); return; }
    void run(async () => {
      note.clear();
      // 선택한 요일마다 slot 1개씩 저장. 성공한 요일은 즉시 선택 해제 → 부분 실패 후 재제출 중복 방지.
      const created: ScheduleSlot[] = [];
      const done: Weekday[] = [];
      const failures: string[] = [];
      for (const d of days) {
        const res = await createSlot(id, { subject, weekday: d, start, end, teacher });
        if (res.ok) { created.push(res.value); done.push(d); }
        else failures.push(`${d}: ${res.error}`);
      }
      if (created.length > 0) setSlots((prev) => [...prev, ...created]);
      setDays((prev) => prev.filter((d) => !done.includes(d)));
      if (failures.length > 0) { note.showError(failures.join(" / ")); return; }
      setTeacher("");
    });
  }

  if (loading) {
    return (
      <main className="container page detail">
        <Link className="back-link" to="/students">← 학원생 목록</Link>
        <p className="page__desc">불러오는 중…</p>
      </main>
    );
  }

  if (!student) {
    return (
      <main className="container page">
        <Link className="back-link" to="/students">← 학원생 목록</Link>
        <div className="empty-state"><p className="page__desc">{`학생(${id})을 찾을 수 없습니다.`}</p></div>
      </main>
    );
  }

  const backPath = `/students/${student.id}`;
  const hasSubjects = subjectNames.length > 0;

  return (
    <main className="container page detail">
      <Link className="back-link" to={backPath}>← 돌아가기</Link>
      <div>
        <h1 className="page__title">시간표 관리</h1>
        <p className="page__desc">{`${student.name} · ${student.grade} — 수강 과목·시간을 여기서 관리합니다.`}</p>
      </div>

      <div className="table-card">
        <div className="table-scroll">
          <table className="table">
            <caption className="sr-only">시간표 슬롯. 과목, 요일, 시간, 담당, 삭제.</caption>
            <thead>
              <tr>
                <th scope="col">과목</th>
                <th scope="col">요일</th>
                <th scope="col">시간</th>
                <th scope="col">담당</th>
                <th scope="col" className="col-right">삭제</th>
              </tr>
            </thead>
            <tbody>
              {groupSlots(slots).map((g) => (
                <GroupRow key={g.days.map((d) => d.id).join("|")} group={g} onDelete={removeGroup} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <h2 className="section-card__title schedule-add__title">슬롯 추가</h2>
      <form className="form-card" noValidate onSubmit={submit}>
        <Field
          label="과목"
          htmlFor="sl-subj"
          hint={hasSubjects ? undefined : (
            <span className="form-field__hint">
              먼저 <Link to="/subjects">과목 관리</Link>에서 과목을 등록하세요.
            </span>
          )}
        >
          <SelectInput id="sl-subj" value={subject} onChange={setSubject} options={subjectNames} />
        </Field>

        <div className="form-field">
          <span className="form-field__label">요일 (여러 개 선택 가능)</span>
          <div className="day-checks">
            {WEEKDAYS.map((d) => (
              <label className="day-check" key={d}>
                <input type="checkbox" value={d} checked={days.includes(d)} onChange={() => toggleDay(d)} />
                <span>{d}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="form-row">
          <Field label="시작" htmlFor="sl-start">
            <input id="sl-start" className="input input--block" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="종료" htmlFor="sl-end">
            <input id="sl-end" className="input input--block" type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </Field>
        </div>

        <Field label="담당 선생님" htmlFor="sl-teacher">
          <TextInput id="sl-teacher" value={teacher} onChange={setTeacher} placeholder="담당 선생님" />
        </Field>

        <FormNote note={note.note} />
        <div className="form-actions">
          <button className="btn-primary" type="submit" disabled={pending || !hasSubjects} aria-busy={pending}>
            슬롯 추가
          </button>
        </div>
      </form>

      <div className="form-actions">
        <Link className="btn-ghost" to={backPath}>완료</Link>
      </div>
    </main>
  );
}
