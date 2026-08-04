import html2canvas from "html2canvas";

// DOM 한 조각을 PNG 로 떨구는 범용 유틸. 도메인 개념 없음(shared 규칙).
//
// 왜 캡처 방식인가: 승인된 시안의 HTML/CSS 를 그대로 그림으로 만들기 위해서다.
// Canvas 로 직접 그리면 시안과 코드가 갈라지고, 그 동기화를 아무도 강제해주지 않는다.

export interface CaptureOptions {
  /** 이미지 배율. 2 면 가로 2160px 로 나온다(고해상도 전송용). */
  readonly scale?: number;
  readonly background?: string;
}

// 웹폰트가 아직 안 붙은 상태로 캡처하면 대체 폰트로 그려진 그림이 나온다.
// document.fonts.ready 는 "현재 필요한 폰트 로드 완료"를 알려주므로 캡처 직전에 기다린다.
async function waitForFonts(): Promise<void> {
  try {
    await document.fonts.ready;
  } catch {
    /* 폰트 API 미지원 브라우저 — 대체 폰트로라도 진행한다 */
  }
}

export async function captureToPngBlob(node: HTMLElement, options: CaptureOptions = {}): Promise<Blob> {
  await waitForFonts();
  const canvas = await html2canvas(node, {
    scale: options.scale ?? 1,
    backgroundColor: options.background ?? "#ffffff",
    useCORS: true, // 외부 리소스(웹폰트 CDN)를 CORS 로 가져온다
    logging: false,
  });
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("이미지를 만들지 못했습니다."))),
      "image/png",
    );
  });
}

// 브라우저 다운로드로 떨군다. 서버에 보관하지 않는다 — 보관하면 그 자체가 새로운 유출 표면이다(스펙 신뢰 경계).
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.append(a);
  a.click();
  a.remove();
  // 즉시 해제하면 다운로드가 시작되기 전에 URL 이 죽는 브라우저가 있어 한 틱 늦춘다.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
