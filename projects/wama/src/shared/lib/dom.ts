// 프레임워크 없는 작은 DOM 헬퍼 — el(tag, props, ...children)로 선언적으로 엘리먼트를 만든다.
export type Child = Node | string | null | undefined | false;
export type Props = Record<string, unknown>;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = String(value);
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else {
      node.setAttribute(key, String(value));
    }
  }
  for (const child of children) {
    if (child == null || child === false) continue;
    node.append(child);
  }
  return node;
}

// SVG 엘리먼트용 — createElement 는 SVG 네임스페이스를 모른다(HTML 로 만들어져 렌더 안 됨).
// 차트 등 벡터 그래픽을 innerHTML 없이 선언적으로 만들 때 쓴다. on* 이벤트·class 처리는 el 과 동일.
const SVG_NS = "http://www.w3.org/2000/svg";
export function svgEl(tag: string, props: Props = {}, ...children: Child[]): SVGElement {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === "class") node.setAttribute("class", String(value));
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else {
      node.setAttribute(key, String(value));
    }
  }
  for (const child of children) {
    if (child == null || child === false) continue;
    node.append(child);
  }
  return node;
}
