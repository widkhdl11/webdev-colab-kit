import { el } from "@/shared/lib/dom";
import { field, textInput, textArea, numberInput, formNote, withPending } from "@/shared/lib/form";
import { formatWon } from "@/shared/lib/money";
import { captureToPngBlob, downloadBlob } from "@/shared/lib/capture";
import { getStudentProfile } from "@/entities/student/repo";
import { effectiveGrade } from "@/entities/student/model";
import { getSchedule } from "@/entities/schedule/repo";
import { subjectWeekdays } from "@/entities/schedule/model";
import { listSubjectPrices } from "@/entities/subject/price-repo";
import { listStudentSubjectFees } from "@/entities/student/subject-fee-repo";
import { toOverrideList } from "@/entities/student/subject-fee";
import {
  buildTuition, withAdHocFees, toNoticeStudent, noticeBlockers, MAX_AMOUNT,
} from "@/entities/tuition/model";
import { getPaymentSettings } from "@/entities/academy/repo";
import { renderNoticeTemplate, isAccountComplete } from "@/entities/academy/payment-settings";
import { renderPaymentNoticeCard } from "@/widgets/payment-notice-card/ui";
import { renderHeader } from "@/widgets/header/ui";
import { getSessionHeader, getMyAcademy } from "@/features/auth/api";

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

export async function mountPaymentNoticePage(root: HTMLElement, studentId: string): Promise<void> {
  const note = formNote();
  const hdr = await getSessionHeader();

  const [profile, slots, pricesRes, feesRes, settingsRes, academyRes] = await Promise.all([
    getStudentProfile(studentId),
    getSchedule(studentId),
    listSubjectPrices(),
    listStudentSubjectFees(studentId),
    getPaymentSettings(),
    getMyAcademy(),
  ]);

  if (!profile) {
    root.replaceChildren(
      renderHeader(hdr.academyName, { name: hdr.teacherName }),
      el("main", { class: "container page" },
        el("a", { class: "back-link", href: "#/students" }, "← 학원생 목록"),
        el("div", { class: "empty-state" }, el("p", { class: "page__desc" }, "학생을 찾을 수 없습니다."))),
    );
    return;
  }

  const prices = pricesRes.ok ? pricesRes.value : [];
  const overrides = feesRes.ok ? toOverrideList(feesRes.value) : [];
  const settings = settingsRes.ok
    ? settingsRes.value
    : { bankName: "", accountNumber: "", accountHolder: "", noticeTemplate: "" };
  const academy = academyRes.ok ? academyRes.value : null;

  const today = new Date();
  const student = toNoticeStudent({
    name: profile.name,
    school: profile.school,
    birthDate: profile.birthDate,
    grade: effectiveGrade(profile.birthDate, profile.gradeOffset, today),
  });
  const timetable = subjectWeekdays(slots);
  const base = buildTuition(slots, prices, overrides);

  // ── 입력 ──────────────────────────────────────────────────────────────────
  const fMonth = textInput("pn-month", currentMonthKst(), "2026.08");
  const fExtra = textArea("pn-extra", "", "예: 8월 15일(광복절)은 휴원입니다.", 3);
  const fNotice = textArea("pn-notice", settings.noticeTemplate, "", 4);

  // 과목별 금액 — 가격표에 없는 조합은 빈칸으로 열어 이 자리에서 채운다(INV-PN6).
  const feeInputs = new Map<string, HTMLInputElement>();
  const feeRows = base.lines.map((line) => {
    const input = numberInput(`pn-fee-${line.subject}`, line.monthlyFee === null ? "" : String(line.monthlyFee), 0, MAX_AMOUNT);
    input.setAttribute("aria-label", `${line.subject} 금액`);
    if (line.monthlyFee === null) input.placeholder = "가격표에 없음 — 직접 입력";
    input.addEventListener("input", refresh);
    feeInputs.set(line.subject, input);
    return el("tr", {},
      el("th", { scope: "row" }, line.subject),
      el("td", { class: "muted-cell" }, `주 ${line.sessionsPerWeek}회`),
      el("td", { class: "muted-cell" },
        line.source === "override" ? "학생별 예외" : line.source === "unpriced" ? "가격 없음" : "가격표"),
      el("td", {}, input),
    );
  });

  const totalCell = el("strong", { class: "tnum" }, "—");
  const previewHost = el("div", { class: "pnc-preview" });
  const blockerList = el("ul", { class: "page__desc" });
  const submit = el("button", { class: "btn-primary", type: "button" }, "PNG 저장") as HTMLButtonElement;

  // 캡처는 미리보기(축소)가 아니라 원본 크기 노드로 한다 — 화면 밖에 같은 카드를 하나 더 둔다.
  const captureHost = el("div", { class: "pnc-offscreen", "aria-hidden": "true" });

  function currentBreakdown() {
    const edits = new Map<string, number>();
    for (const [subject, input] of feeInputs) {
      const raw = input.value.trim();
      if (raw !== "") edits.set(subject, Number(raw));
    }
    return withAdHocFees(base, edits);
  }

  function cardProps(total: number) {
    return {
      academyName: academy?.name ?? hdr.academyName,
      branch: academy?.branch ?? null,
      phone: academy?.phone ?? null,
      targetMonth: fMonth.value.trim(),
      student,
      timetable,
      totalFee: total,
      noticeText: renderNoticeTemplate(fNotice.value, {
        학생명: student.name,
        월: fMonth.value.trim().split(".")[1] ? `${Number(fMonth.value.trim().split(".")[1])}월` : fMonth.value.trim(),
        금액: total.toLocaleString("ko-KR"),
      }),
      extraNote: fExtra.value,
      bankName: settings.bankName,
      accountNumber: settings.accountNumber,
      accountHolder: settings.accountHolder,
    };
  }

  function refresh(): void {
    const b = currentBreakdown();
    totalCell.textContent = b.total === null ? "미확정" : formatWon(b.total);

    const blockers = [...noticeBlockers({
      studentName: student.name,
      targetMonth: fMonth.value.trim(),
      total: b.total,
    })];
    // 계좌는 이 화면에서 못 고치므로 저장값이 근거고, 문구는 여기서 고칠 수 있으므로 입력칸이 근거다.
    if (!isAccountComplete(settings)) {
      blockers.push("입금 계좌가 학원 설정에 없습니다 (학원 설정에서 먼저 등록하세요)");
    }
    if (fNotice.value.trim() === "") {
      blockers.push("안내 문구를 입력해주세요");
    }
    blockerList.replaceChildren(...blockers.map((b2) => el("li", {}, b2)));
    blockerList.hidden = blockers.length === 0;
    submit.disabled = blockers.length > 0;

    const props = cardProps(b.total ?? 0);
    previewHost.replaceChildren(renderPaymentNoticeCard(props));
    captureHost.replaceChildren(renderPaymentNoticeCard(props));
  }

  fMonth.addEventListener("input", refresh);
  fNotice.addEventListener("input", refresh);
  fExtra.addEventListener("input", refresh);

  submit.addEventListener("click", () => {
    void withPending(submit, async () => {
      note.clear();
      const card = captureHost.firstElementChild as HTMLElement | null;
      if (!card) { note.show("error", "미리보기를 만들지 못했습니다."); return; }
      try {
        const blob = await captureToPngBlob(card, { scale: 1 });
        // 파일명에 학생명·월을 넣는다 — 카톡에서 보낼 때 누구 것인지 먼저 보여 오발송을 막는다.
        downloadBlob(blob, `${student.name}_${fMonth.value.trim().replace(".", "-")}_수강료안내.png`);
        note.show("info", "이미지를 저장했습니다.");
      } catch (e) {
        note.show("error", e instanceof Error ? e.message : "이미지를 만들지 못했습니다.");
      }
    });
  });

  if (!settingsRes.ok) note.show("error", settingsRes.error);
  refresh();

  root.replaceChildren(
    renderHeader(hdr.academyName, { name: hdr.teacherName }),
    el("main", { class: "container page form-page" },
      el("a", { class: "back-link", href: `#/students/${studentId}` }, "← 학생 상세"),
      el("div", {},
        el("h1", { class: "page__title" }, "수강료 안내 이미지"),
        el("p", { class: "page__desc" },
          "학부모에게 보낼 시간표·수강료 안내를 PNG 로 만듭니다. ",
          "여기서 고친 값은 이번 이미지에만 적용되고 저장되지 않습니다."),
      ),
      el("form", { class: "form-card", novalidate: "" },
        field("대상 월", fMonth, "YYYY.MM 형식입니다."),
        el("h2", { class: "section-card__title" }, "과목별 금액"),
        el("div", { class: "table-card" },
          el("div", { class: "table-scroll" },
            el("table", { class: "table" },
              el("caption", { class: "sr-only" }, "과목별 이번 달 금액. 과목, 주 횟수, 출처, 금액."),
              el("thead", {},
                el("tr", {},
                  el("th", { scope: "col" }, "과목"),
                  el("th", { scope: "col" }, "주 횟수"),
                  el("th", { scope: "col" }, "출처"),
                  el("th", { scope: "col" }, "금액(원)"),
                ),
              ),
              el("tbody", {}, ...feeRows),
            ),
          ),
        ),
        el("p", { class: "page__desc" }, "합계 ", totalCell),
        field("안내 문구", fNotice, "{학생명} {월} {금액} 이 실제 값으로 바뀝니다."),
        field("추가 문구", fExtra, "이번 이미지에만 들어갑니다."),
        blockerList,
        note.node,
        el("div", { class: "form-actions" }, submit),
      ),
      el("h2", { class: "section-card__title" }, "미리보기"),
      el("div", { class: "pnc-preview-frame" }, previewHost),
      captureHost,
    ),
  );
}
