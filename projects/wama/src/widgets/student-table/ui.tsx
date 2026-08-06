import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { subjectsLabel, type Student, type EvalStatus } from "@/entities/student/model";

const STATUS: Record<EvalStatus, { label: string; cls: string }> = {
  done: { label: "평가완료", cls: "badge badge--done" },
  waiting: { label: "평가대기", cls: "badge badge--wait" },
};

// 학생 목록 표. 표시만 — 정렬/필터/조회 로직은 상위(page/features)에서.
export function StudentTable({ students }: { readonly students: Student[] }): ReactNode {
  return (
    <table className="table table--rows-link">
      <caption className="sr-only">
        담당 학생 목록. 이름, 학년, 학교, 수강 과목, 최근 평가월, 상태. 행을 누르면 상세로 이동합니다.
      </caption>
      <thead>
        <tr>
          <th scope="col">이름</th>
          <th scope="col">학년</th>
          <th scope="col">학교</th>
          <th scope="col">수강 과목</th>
          <th scope="col">최근 평가월</th>
          <th scope="col" className="col-right">상태</th>
        </tr>
      </thead>
      <tbody>
        {students.map((s) => (
          <tr key={s.id}>
            <td><Link to={`/students/${s.id}`} className="student-name">{s.name}</Link></td>
            <td>{s.grade}</td>
            <td>{s.school}</td>
            {/* 접힌 나머지는 title 로 남긴다 — 마우스를 올리면 전체가 보인다. */}
            <td title={s.subjects.length > 0 ? s.subjects.join(", ") : undefined}>
              {subjectsLabel(s.subjects)}
            </td>
            <td className="num">{s.lastEvalMonth}</td>
            <td className="col-right">
              <span className={STATUS[s.evalStatus].cls}>{STATUS[s.evalStatus].label}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
