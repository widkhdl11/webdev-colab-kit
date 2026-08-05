import { useEffect, useState, type ReactNode } from "react";
import { FormNote, NumberInput, busy, useFormNote, usePending } from "@/shared/ui/form";
import { formatWon } from "@/shared/lib/money";
import type { Subject } from "@/entities/subject/model";
import { listSubjects } from "@/entities/subject/repo";
import { listSubjectPrices } from "@/entities/subject/price-repo";
import { pricesForSubject, type SubjectPrice } from "@/entities/subject/price";
import { diffOverrides, MAX_STUDENT_FEE, type StudentSubjectFee } from "@/entities/student/subject-fee";
import { listStudentSubjectFees, saveStudentSubjectFees } from "@/entities/student/subject-fee-repo";

// 학생별 과목 금액 예외 편집 — 형제 감면·개별 할인을 넣는 자리.
// 비워두면 예외 없음(가격표 값을 그대로 씀). 0 을 넣으면 "0원 청구"이며 비운 것과 다르다.
// 위젯인 이유: 학생 수정 폼이 이미 길고, 이 블록은 자기 데이터를 스스로 읽고 저장한다.

// 참고용으로 그 과목의 기본가를 함께 보여준다 — 얼마를 깎는 건지 모르고 숫자만 넣으면 실수한다.
// 고르고 정렬하는 규칙은 entities(pricesForSubject)가 정한다 — 여기선 문장으로 잇기만.
function basePriceHint(prices: readonly SubjectPrice[], subjectId: string): string {
  const forSubject = pricesForSubject(prices, subjectId);
  if (forSubject.length === 0) return "가격표에 등록된 기본가 없음";
  return `기본가 ${forSubject.map((p) => `주${p.sessionsPerWeek}회 ${formatWon(p.monthlyFee)}`).join(" · ")}`;
}

// 저장된 예외 → 입력칸 값. 없는 과목은 빈 문자열("예외 없음")이며 "0"과 구분된다.
function valuesFrom(saved: readonly StudentSubjectFee[], subjects: readonly Subject[]): Record<string, string> {
  const next: Record<string, string> = {};
  for (const s of subjects) {
    const found = saved.find((f) => f.subjectId === s.id);
    next[s.id] = found ? String(found.monthlyFee) : "";
  }
  return next;
}

export function StudentFeeOverrides({ studentId }: { readonly studentId: string }): ReactNode {
  const note = useFormNote();
  const { pending, run } = usePending();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<readonly Subject[]>([]);
  const [prices, setPrices] = useState<readonly SubjectPrice[]>([]);
  const [saved, setSaved] = useState<readonly StudentSubjectFee[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true; // 학생을 빠르게 갈아타면 늦게 온 응답이 새 학생 화면을 덮어쓴다
    void (async () => {
      const [subjectsRes, pricesRes, feesRes] = await Promise.all([
        listSubjects(),
        listSubjectPrices(),
        listStudentSubjectFees(studentId),
      ]);
      if (!alive) return;
      if (!subjectsRes.ok) { setLoadError(subjectsRes.error); setLoading(false); return; }

      const nextSaved = feesRes.ok ? feesRes.value : [];
      setSubjects(subjectsRes.value);
      setPrices(pricesRes.ok ? pricesRes.value : []);
      setSaved(nextSaved);
      setValues(valuesFrom(nextSaved, subjectsRes.value));
      if (!feesRes.ok) note.showError(feesRes.error);
      setLoading(false);
    })();
    return () => { alive = false; };
    // note 의 setter 들은 useCallback 으로 고정돼 있어 의존성에 넣어도 재실행되지 않지만,
    // 의도를 분명히 하려고 studentId 만 둔다 — 학생이 바뀔 때만 다시 읽는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  function save(): void {
    void run(async () => {
      note.clear();
      // 빈칸은 Map 에 넣지 않는다 — "예외 없음"과 "0원 청구"를 구분해야 한다.
      const entered = new Map<string, number>();
      for (const s of subjects) {
        const raw = (values[s.id] ?? "").trim();
        if (raw === "") continue;
        const n = Number(raw);
        if (!Number.isFinite(n)) { note.showError("금액은 숫자로 입력해주세요."); return; }
        entered.set(s.id, n);
      }
      const res = await saveStudentSubjectFees(studentId, diffOverrides(saved, entered));
      if (!res.ok) { note.showError(res.error); return; }
      setSaved(res.value);
      setValues(valuesFrom(res.value, subjects));
      note.showInfo(res.value.length === 0 ? "예외를 모두 지웠습니다." : `예외 ${res.value.length}건을 저장했습니다.`);
    });
  }

  if (loading) return <section className="section-card"><p className="page__desc">불러오는 중…</p></section>;
  if (loadError) return <p className="form-note form-note--error" role="alert">{loadError}</p>;

  return (
    <section className="section-card">
      <h2 className="section-card__title">수강료 예외</h2>
      <p className="page__desc">
        비워두면 가격표의 기본가로 청구됩니다. 이 학생만 다른 금액을 받을 때만 채우세요.{" "}
        0을 넣으면 면제(0원 청구)이며 비워둔 것과 다릅니다.
      </p>
      <div className="table-card">
        <div className="table-scroll">
          <table className="table">
            <caption className="sr-only">과목별 이 학생의 월정액 예외. 과목, 기본가, 예외 금액.</caption>
            <thead>
              <tr>
                <th scope="col">과목</th>
                <th scope="col">가격표 기본가</th>
                <th scope="col">이 학생 금액(원)</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => (
                <tr key={s.id}>
                  <th scope="row">{s.name}</th>
                  <td className="muted-cell">{basePriceHint(prices, s.id)}</td>
                  <td>
                    <NumberInput
                      id={`fee-${s.id}`}
                      value={values[s.id] ?? ""}
                      onChange={(v) => setValues((prev) => ({ ...prev, [s.id]: v }))}
                      min={0}
                      max={MAX_STUDENT_FEE}
                      placeholder="예외 없음"
                      ariaLabel={`${s.name} 이 학생의 월정액`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {subjects.length === 0
        ? <p className="page__desc">등록된 과목이 없습니다. 과목 관리에서 먼저 과목을 등록하세요.</p>
        : (
          <div className="form-actions">
            <button className="btn-primary" type="button" onClick={save} {...busy(pending)}>
              수강료 예외 저장
            </button>
          </div>
        )}
      <FormNote note={note.note} />
    </section>
  );
}
