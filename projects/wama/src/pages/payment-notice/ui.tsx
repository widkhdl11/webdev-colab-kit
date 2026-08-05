import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { Field, FormNote, NumberInput, TextArea, TextInput, busy, useFormNote, usePending } from "@/shared/ui/form";
import { formatWon } from "@/shared/lib/money";
import { captureToPngBlob, downloadBlob } from "@/shared/lib/capture";
import { getStudentProfile } from "@/entities/student/repo";
import { effectiveGrade } from "@/entities/student/model";
import { getSchedule } from "@/entities/schedule/repo";
import { subjectWeekdays, type SubjectWeekdays } from "@/entities/schedule/model";
import { listSubjectPrices } from "@/entities/subject/price-repo";
import { listStudentSubjectFees } from "@/entities/student/subject-fee-repo";
import { toOverrideList } from "@/entities/student/subject-fee";
import {
  buildTuition, withAdHocFees, parseFeeEdits, toNoticeStudent, noticeBlockers, MAX_AMOUNT,
  type NoticeStudent,
} from "@/entities/tuition/model";
import { getPaymentSettings } from "@/entities/academy/repo";
import { renderNoticeTemplate, isAccountComplete, type PaymentSettings } from "@/entities/academy/payment-settings";
import { PaymentNoticeCard, type PaymentNoticeCardProps } from "@/widgets/payment-notice-card/ui";
import { getMyAcademy } from "@/features/auth/api";

// 수강료 안내 이미지 내보내기. 스펙: docs/specs/payment-notice-export.md (approved, 봉인 INV-PN1~PN7).
// 이 화면의 수정은 전부 **이번 건 한정**이다 — 저장값(가격표·학생별 예외·학원 문구)을 바꾸지 않는다(INV-PN5).

// 대상 월 기본값 = 이번 달(Asia/Seoul). 사용자의 브라우저 시간대가 달라도 학원 기준은 한국이다.
function currentMonthKst(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  return `${year}.${month}`;
}

const EMPTY_SETTINGS: PaymentSettings = {
  bankName: "", accountNumber: "", accountHolder: "", noticeTemplate: "",
};

interface Loaded {
  readonly student: NoticeStudent;
  readonly timetable: readonly SubjectWeekdays[];
  readonly base: ReturnType<typeof buildTuition>;
  readonly settings: PaymentSettings;
  readonly academyName: string;
  readonly branch: string | null;
  readonly phone: string | null;
  readonly settingsError: string | null;
}

export function PaymentNoticePage(): ReactNode {
  const { id: studentId = "" } = useParams();
  const note = useFormNote();
  const { pending, run } = usePending();
  const captureRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Loaded | null>(null);

  const [month, setMonth] = useState(currentMonthKst());
  const [extra, setExtra] = useState("");
  const [noticeText, setNoticeText] = useState("");
  // 과목별 금액 — 가격표에 없는 조합은 빈칸으로 열어 이 자리에서 채운다(INV-PN6).
  const [fees, setFees] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [profile, slots, pricesRes, feesRes, settingsRes, academyRes] = await Promise.all([
        getStudentProfile(studentId),
        getSchedule(studentId),
        listSubjectPrices(),
        listStudentSubjectFees(studentId),
        getPaymentSettings(),
        getMyAcademy(),
      ]);
      if (!alive) return;
      if (!profile) { setLoading(false); return; }

      const prices = pricesRes.ok ? pricesRes.value : [];
      const overrides = feesRes.ok ? toOverrideList(feesRes.value) : [];
      const settings = settingsRes.ok ? settingsRes.value : EMPTY_SETTINGS;
      const academy = academyRes.ok ? academyRes.value : null;
      const today = new Date();
      const base = buildTuition(slots, prices, overrides);

      setData({
        student: toNoticeStudent({
          name: profile.name,
          school: profile.school,
          birthDate: profile.birthDate,
          grade: effectiveGrade(profile.birthDate, profile.gradeOffset, today),
        }),
        timetable: subjectWeekdays(slots),
        base,
        settings,
        academyName: academy?.name ?? "학원",
        branch: academy?.branch ?? null,
        phone: academy?.phone ?? null,
        settingsError: settingsRes.ok ? null : settingsRes.error,
      });
      setNoticeText(settings.noticeTemplate);
      setFees(Object.fromEntries(
        base.lines.map((l) => [l.subject, l.monthlyFee === null ? "" : String(l.monthlyFee)]),
      ));
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [studentId]);

  useEffect(() => {
    if (data?.settingsError) note.showError(data.settingsError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.settingsError]);

  if (loading) {
    return (
      <main className="container page form-page">
        <Link className="back-link" to="/students">← 학원생 목록</Link>
        <p className="page__desc">불러오는 중…</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="container page">
        <Link className="back-link" to="/students">← 학원생 목록</Link>
        <div className="empty-state"><p className="page__desc">학생을 찾을 수 없습니다.</p></div>
      </main>
    );
  }

  const { student, timetable, base, settings } = data;
  const targetMonth = month.trim();

  // 이번 건 한정 수정분을 얹은 최종 내역 — 저장값은 그대로 둔다(INV-PN5).
  // 무효 금액은 버리지 않고 invalid 로 받아 생성을 막는다 — 전에는 조용히 무시돼
  // 입력칸의 값과 다른 금액(가격표 값)으로 이미지가 나갔다(INV-PN2 / 스펙 S2).
  const { edits, invalid } = parseFeeEdits(fees);
  const breakdown = withAdHocFees(base, edits);

  const blockers = [...noticeBlockers({ studentName: student.name, targetMonth, total: breakdown.total })];
  for (const subject of invalid) {
    blockers.push(`${subject} 금액은 0 이상 정수로 입력해주세요`);
  }
  // 계좌는 이 화면에서 못 고치므로 저장값이 근거고, 문구는 여기서 고칠 수 있으므로 입력칸이 근거다.
  if (!isAccountComplete(settings)) {
    blockers.push("입금 계좌가 학원 설정에 없습니다 (학원 설정에서 먼저 등록하세요)");
  }
  if (noticeText.trim() === "") blockers.push("안내 문구를 입력해주세요");

  const total = breakdown.total ?? 0;
  const monthPart = targetMonth.split(".")[1];
  const cardProps: PaymentNoticeCardProps = {
    academyName: data.academyName,
    branch: data.branch,
    phone: data.phone,
    targetMonth,
    student,
    timetable,
    totalFee: total,
    noticeText: renderNoticeTemplate(noticeText, {
      학생명: student.name,
      월: monthPart ? `${Number(monthPart)}월` : targetMonth,
      금액: total.toLocaleString("ko-KR"),
    }),
    extraNote: extra,
    bankName: settings.bankName,
    accountNumber: settings.accountNumber,
    accountHolder: settings.accountHolder,
  };

  function save(): void {
    void run(async () => {
      note.clear();
      const card = captureRef.current;
      if (!card) { note.showError("미리보기를 만들지 못했습니다."); return; }
      try {
        const blob = await captureToPngBlob(card, { scale: 1 });
        // 파일명에 학생명·월을 넣는다 — 카톡에서 보낼 때 누구 것인지 먼저 보여 오발송을 막는다.
        downloadBlob(blob, `${student.name}_${targetMonth.replace(".", "-")}_수강료안내.png`);
        note.showInfo("이미지를 저장했습니다.");
      } catch (e) {
        note.showError(e instanceof Error ? e.message : "이미지를 만들지 못했습니다.");
      }
    });
  }

  return (
    <main className="container page form-page">
      <Link className="back-link" to={`/students/${studentId}`}>← 학생 상세</Link>
      <div>
        <h1 className="page__title">수강료 안내 이미지</h1>
        <p className="page__desc">
          학부모에게 보낼 시간표·수강료 안내를 PNG 로 만듭니다.{" "}
          여기서 고친 값은 이번 이미지에만 적용되고 저장되지 않습니다.
        </p>
      </div>

      <form className="form-card" noValidate onSubmit={(e) => e.preventDefault()}>
        <Field label="대상 월" htmlFor="pn-month" hint={<span className="form-field__hint">YYYY.MM 형식입니다.</span>}>
          <TextInput id="pn-month" value={month} onChange={setMonth} placeholder="2026.08" />
        </Field>

        <h2 className="section-card__title">과목별 금액</h2>
        <div className="table-card">
          <div className="table-scroll">
            <table className="table">
              <caption className="sr-only">과목별 이번 달 금액. 과목, 주 횟수, 출처, 금액.</caption>
              <thead>
                <tr>
                  <th scope="col">과목</th>
                  <th scope="col">주 횟수</th>
                  <th scope="col">출처</th>
                  <th scope="col">금액(원)</th>
                </tr>
              </thead>
              <tbody>
                {base.lines.map((line) => (
                  <tr key={line.subject}>
                    <th scope="row">{line.subject}</th>
                    <td className="muted-cell">{`주 ${line.sessionsPerWeek}회`}</td>
                    <td className="muted-cell">
                      {line.source === "override" ? "학생별 예외" : line.source === "unpriced" ? "가격 없음" : "가격표"}
                    </td>
                    <td>
                      <NumberInput
                        id={`pn-fee-${line.subject}`}
                        value={fees[line.subject] ?? ""}
                        onChange={(v) => setFees((prev) => ({ ...prev, [line.subject]: v }))}
                        min={0}
                        max={MAX_AMOUNT}
                        placeholder={line.monthlyFee === null ? "가격표에 없음 — 직접 입력" : ""}
                        ariaLabel={`${line.subject} 금액`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="page__desc">
          합계 <strong className="tnum">{breakdown.total === null ? "미확정" : formatWon(breakdown.total)}</strong>
        </p>

        <Field label="안내 문구" htmlFor="pn-notice" hint={<span className="form-field__hint">{"{학생명} {월} {금액} 이 실제 값으로 바뀝니다."}</span>}>
          <TextArea id="pn-notice" value={noticeText} onChange={setNoticeText} rows={4} />
        </Field>
        <Field label="추가 문구" htmlFor="pn-extra" hint={<span className="form-field__hint">이번 이미지에만 들어갑니다.</span>}>
          <TextArea id="pn-extra" value={extra} onChange={setExtra} placeholder="예: 8월 15일(광복절)은 휴원입니다." rows={3} />
        </Field>

        <ul className="page__desc" hidden={blockers.length === 0}>
          {blockers.map((b) => <li key={b}>{b}</li>)}
        </ul>
        <FormNote note={note.note} />
        <div className="form-actions">
          <button
            className="btn-primary"
            type="button"
            onClick={save}
            disabled={pending || blockers.length > 0}
            aria-busy={pending}
          >
            PNG 저장
          </button>
        </div>
      </form>

      <h2 className="section-card__title">미리보기</h2>
      <div className="pnc-preview-frame">
        <div className="pnc-preview"><PaymentNoticeCard {...cardProps} /></div>
      </div>

      {/* 캡처는 미리보기(축소)가 아니라 원본 크기 노드로 한다 — 화면 밖에 같은 카드를 하나 더 둔다. */}
      <div className="pnc-offscreen" aria-hidden="true">
        <PaymentNoticeCard {...cardProps} ref={captureRef} />
      </div>
    </main>
  );
}
