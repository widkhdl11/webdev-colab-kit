import type { Subject } from "@/entities/subject/model";
import {
  MAX_SESSIONS_PER_WEEK, MAX_SUBJECT_FEE, parseSubjectFeeInput, sortPrices, type SubjectPrice,
} from "@/entities/subject/price";
import {
  addSubjectPrice,
  deleteSubjectPrice,
  listSubjectPrices,
  updateSubjectPrice,
} from "@/entities/subject/price-repo";
import { addSubject, deleteSubject, listSubjects } from "@/entities/subject/repo";
import { formatWon } from "@/shared/lib/money";
import { Field, FormNote, NumberInput, SelectInput, TextInput, busy, useFormNote, usePending } from "@/shared/ui/form";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";

// 과목 관리 페이지 (학원 단위 설정) — Supabase 에 영구 저장. 격리는 서버 RLS.
// 과목을 엔티티로 관리(추가·삭제). 시간표·평가·성적이 이 과목명을 참조한다.
//
// 과목 목록은 세 곳(과목 표 · 가격 추가 폼의 select · 가격표)이 함께 보는 상태다.
// vanilla 시절엔 세 곳을 손으로 맞춰야 했지만(fillSubjectOptions·row.remove), 이제 상태 하나에서 파생된다.

// 한 과목 행. 삭제는 서버에 반영 후 호출부가 목록에서 뺀다. 실패 시 알리고 행 유지.
function SubjectRow({
  subject, onDeleted, onError,
}: {
  readonly subject: Subject;
  readonly onDeleted: (id: string) => void;
  readonly onError: (message: string) => void;
}): ReactNode {
  const { pending, run } = usePending();
  return (
    <tr>
      <td>{subject.name}</td>
      <td className="col-right">
        <button
          className="btn-ghost btn-ghost--sm"
          type="button"
          onClick={() => void run(async () => {
            const res = await deleteSubject(subject.id);
            if (!res.ok) { onError(res.error); return; }
            onDeleted(subject.id);
          })}
          {...busy(pending)}
        >
          삭제
        </button>
      </td>
    </tr>
  );
}

// 수강료는 해마다 바뀌므로 금액만 그 자리에서 고칠 수 있게 둔다.
// 주 횟수는 못 바꾼다 — 바꾸면 다른 줄과 충돌할 수 있어 지우고 다시 넣는 편이 명확하다.
function PriceRow({
  price, onSaved, onDeleted, onError, onInfo,
}: {
  readonly price: SubjectPrice;
  readonly onSaved: (p: SubjectPrice) => void;
  readonly onDeleted: (id: string) => void;
  readonly onError: (message: string) => void;
  readonly onInfo: (message: string) => void;
}): ReactNode {
  const save = usePending();
  const del = usePending();
  const [amount, setAmount] = useState(String(price.monthlyFee));

  // 서버가 정규화한 값이 진실 — 저장 성공 시 그 값으로 입력칸을 되쓴다.
  useEffect(() => { setAmount(String(price.monthlyFee)); }, [price.monthlyFee]);

  return (
    <tr>
      <th scope="row">{price.subject}</th>
      <td className="tnum">{`주 ${price.sessionsPerWeek}회`}</td>
      <td>
        <NumberInput
          id={`price-${price.id}`}
          value={amount}
          onChange={setAmount}
          min={0}
          max={MAX_SUBJECT_FEE}
          ariaLabel={`${price.subject} 주 ${price.sessionsPerWeek}회 월정액`}
        />
      </td>
      <td className="col-right">
        <button
          className="btn-ghost btn-ghost--sm"
          type="button"
          onClick={() => void save.run(async () => {
            // 빈칸을 0 으로 강등하지 않는다 — 금액칸을 지우고 저장하면 0원으로 덮이던 자리다.
            const parsed = parseSubjectFeeInput(amount);
            if (!parsed.ok) { onError(parsed.error); return; }
            const res = await updateSubjectPrice(price.id, parsed.value);
            if (!res.ok) { onError(res.error); return; }
            onSaved(res.value);
            onInfo(`${price.subject} 주 ${price.sessionsPerWeek}회 = ${formatWon(res.value.monthlyFee)} 로 저장했습니다.`);
          })}
          {...busy(save.pending)}
        >
          저장
        </button>
        <button
          className="btn-ghost btn-ghost--sm"
          type="button"
          onClick={() => void del.run(async () => {
            const res = await deleteSubjectPrice(price.id);
            if (!res.ok) { onError(res.error); return; }
            onDeleted(price.id);
          })}
          {...busy(del.pending)}
        >
          삭제
        </button>
      </td>
    </tr>
  );
}

export function SubjectsPage(): ReactNode {
  const note = useFormNote();
  const priceNote = useFormNote();
  const addSubjectPending = usePending();
  const addPricePending = usePending();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [prices, setPrices] = useState<SubjectPrice[]>([]);
  const [newName, setNewName] = useState("");
  const [pSubject, setPSubject] = useState("");
  const [pSessions, setPSessions] = useState("1");
  const [pFee, setPFee] = useState("");

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [subjRes, priceRes] = await Promise.all([listSubjects(), listSubjectPrices()]);
      if (!alive) return;
      if (subjRes.ok) {
        setSubjects([...subjRes.value]);
        setPSubject(subjRes.value[0]?.id ?? "");
      } else note.showError(subjRes.error);
      if (priceRes.ok) setPrices([...priceRes.value]);
      else priceNote.showError(priceRes.error);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 과목이 사라지면 그 과목의 가격 행도 DB 에서 cascade 로 함께 사라진다(0010).
  // 화면에 남겨두면 존재하지 않는 가격을 보고 있는 셈이라 같이 지운다.
  function removeSubject(id: string): void {
    setSubjects((prev) => prev.filter((s) => s.id !== id));
    setPrices((prev) => prev.filter((p) => p.subjectId !== id));
    setPSubject((cur) => (cur === id ? "" : cur));
  }

  function submitSubject(e: FormEvent): void {
    e.preventDefault();
    const v = newName.trim();
    if (!v) { note.showError("과목명을 입력하세요."); return; }
    void addSubjectPending.run(async () => {
      note.clear();
      const res = await addSubject(v);
      if (!res.ok) { note.showError(res.error); return; }
      setSubjects((prev) => [...prev, res.value]);
      // 방금 만든 과목에 바로 가격을 넣을 수 있어야 한다.
      setPSubject((cur) => cur || res.value.id);
      setNewName("");
    });
  }

  function submitPrice(e: FormEvent): void {
    e.preventDefault();
    if (!pSubject) { priceNote.showError("먼저 과목을 등록하세요."); return; }
    // 금액칸이 비면 Number("")===0 으로 0원 가격이 조용히 등록되던 자리다(INV-PN2/PN6).
    const parsed = parseSubjectFeeInput(pFee);
    if (!parsed.ok) { priceNote.showError(parsed.error); return; }
    void addPricePending.run(async () => {
      priceNote.clear();
      const res = await addSubjectPrice(pSubject, Number(pSessions), parsed.value);
      if (!res.ok) { priceNote.showError(res.error); return; }
      setPrices((prev) => [...prev, res.value]);
      setPFee("");
    });
  }

  // 표시 순서는 entities(sortPrices)가 정한다 — 추가된 줄도 제자리에 들어간다.
  const sorted = sortPrices(prices);
  const hasSubjects = subjects.length > 0;

  return (
    <main className="container page form-page">
      <Link className="back-link" to="/students">← 학원생 목록</Link>
      <div>
        <h1 className="page__title">과목 관리</h1>
        <p className="page__desc">학원이 가르치는 과목을 관리합니다. 시간표·평가·성적에서 이 과목들을 사용합니다.</p>
      </div>

      <div className="table-card">
        <div className="table-scroll">
          <table className="table">
            <caption className="sr-only">학원 과목 목록. 과목명, 삭제.</caption>
            <thead>
              <tr>
                <th scope="col">과목명</th>
                <th scope="col" className="col-right">삭제</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => (
                <SubjectRow key={s.id} subject={s} onDeleted={removeSubject} onError={note.showError} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="page__desc" hidden={hasSubjects}>아직 등록된 과목이 없습니다. 아래에서 추가하세요.</p>

      <h2 className="section-card__title schedule-add__title">과목 추가</h2>
      <form className="form-card" noValidate onSubmit={submitSubject}>
        <Field label="과목명" htmlFor="subj-name">
          <TextInput id="subj-name" value={newName} onChange={setNewName} placeholder="예: 초등 수학" />
        </Field>
        <FormNote note={note.note} />
        <div className="form-actions">
          <button className="btn-primary" type="submit" {...busy(addSubjectPending.pending)}>과목 추가</button>
        </div>
      </form>

      {/* ── 수강료 가격표 ─────────────────────────────────────────────────────
          (과목 × 주 횟수) → 월정액. 학생 청구액이 여기서 나온다(스펙 payment-notice-export.md).
          가격이 없는 조합은 청구서에서 빈칸이 되고 이미지 생성이 막힌다(INV-PN6) — 그래서 여기서 채워둔다. */}
      <h2 className="section-card__title schedule-add__title">수강료 가격표</h2>
      <p className="page__desc">
        학생 청구액은 이 표에서 자동으로 계산됩니다 — 듣는 과목들의 월정액 합입니다.{" "}
        가격이 없는 조합은 안내 이미지에서 빈칸이 되어 생성이 막힙니다.
      </p>

      <div className="table-card">
        <div className="table-scroll">
          <table className="table">
            <caption className="sr-only">과목별 주 횟수당 월 수강료. 과목, 주 횟수, 월정액, 저장·삭제.</caption>
            <thead>
              <tr>
                <th scope="col">과목</th>
                <th scope="col">주 횟수</th>
                <th scope="col">월정액(원)</th>
                <th scope="col" className="col-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <PriceRow
                  key={p.id}
                  price={p}
                  onSaved={(next) => setPrices((prev) => prev.map((x) => (x.id === next.id ? next : x)))}
                  onDeleted={(pid) => setPrices((prev) => prev.filter((x) => x.id !== pid))}
                  onError={priceNote.showError}
                  onInfo={priceNote.showInfo}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="page__desc" hidden={sorted.length > 0}>
        아직 등록된 가격이 없습니다. 과목마다 주 횟수별 월정액을 등록하세요.
      </p>

      <form className="form-card" noValidate onSubmit={submitPrice}>
        {/* 과목 select 는 등록된 과목에서만 고르게 한다 — 자유 입력이면 오타가 곧 "가격 없는 과목"이 된다. */}
        <Field label="과목" htmlFor="price-subject">
          <SelectInput
            id="price-subject"
            value={pSubject}
            onChange={setPSubject}
            options={subjects.map((s) => [s.id, s.name] as const)}
            disabled={!hasSubjects}
          />
        </Field>
        <Field label="주 횟수" htmlFor="price-sessions" hint={<span className="form-field__hint">같은 과목이라도 주 몇 회 오느냐에 따라 금액이 다릅니다.</span>}>
          <NumberInput id="price-sessions" value={pSessions} onChange={setPSessions} min={1} max={MAX_SESSIONS_PER_WEEK} />
        </Field>
        <Field label="월정액(원)" htmlFor="price-fee" hint={<span className="form-field__hint">원 단위 정수로 입력합니다. 4주인 달과 5주인 달의 금액은 같습니다.</span>}>
          <NumberInput id="price-fee" value={pFee} onChange={setPFee} min={0} max={MAX_SUBJECT_FEE} />
        </Field>
        <FormNote note={priceNote.note} />
        <div className="form-actions">
          <button className="btn-primary" type="submit" {...busy(addPricePending.pending)}>가격 추가</button>
        </div>
      </form>
    </main>
  );
}
