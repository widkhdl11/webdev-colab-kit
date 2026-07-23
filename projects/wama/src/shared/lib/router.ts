// 얇은 해시 라우터 — 외부 의존성 없이 location.hash 로 화면을 고른다.
// 도메인 지식 없는 범용 유틸(어느 프로젝트에 옮겨도 동작). 정적 호스팅 친화(서버 설정 불필요).
export interface RouteDef {
  readonly path: string; // "students" | "students/:id"
  readonly mount: (root: HTMLElement, params: Record<string, string>) => void | Promise<void>;
}

interface Compiled extends RouteDef {
  readonly re: RegExp;
  readonly keys: readonly string[];
}

function compile(path: string): { re: RegExp; keys: string[] } {
  const keys: string[] = [];
  const src = path
    .split("/")
    .map((seg) => {
      if (seg.startsWith(":")) {
        keys.push(seg.slice(1));
        return "([^/]+)";
      }
      return seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return { re: new RegExp(`^${src}$`), keys };
}

export function createRouter(root: HTMLElement, routes: RouteDef[], fallback: string): void {
  const compiled: Compiled[] = routes.map((r) => ({ ...r, ...compile(r.path) }));

  const resolve = (): void => {
    const hash = location.hash.replace(/^#\/?/, "");
    for (const r of compiled) {
      const m = r.re.exec(hash);
      if (m) {
        const params: Record<string, string> = {};
        r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1] ?? "")));
        void r.mount(root, params);
        return;
      }
    }
    location.hash = `#/${fallback}`;
  };

  window.addEventListener("hashchange", resolve);
  resolve();
}
