export interface Picked { i: number; start: number; end: number; quote: string; clamped: boolean }
const textLen = (p: HTMLElement, node: Node, off: number) => {
  const r = document.createRange(); r.selectNodeContents(p); r.setEnd(node, off); return r.toString().length;
};
/**
 * 선택 영역을 '첫 문단 안의 구간'으로 변환.
 * - PC 드래그는 끝점이 다음 문단 시작(오프셋 0)·빈 여백에 걸리는 일이 흔하므로, 실제로 글자가 선택된 문단만 인정한다.
 * - 여러 문단에 걸치면 첫 문단 부분만 사용하고 clamped=true.
 */
export function readSelection(root: HTMLElement, sl: Selection | null): Picked | null {
  if (!sl || sl.isCollapsed || !sl.rangeCount) return null;
  const r = sl.getRangeAt(0);
  if (!root.contains(r.commonAncestorContainer)) return null;
  const parts: { p: HTMLElement; s: number; e: number }[] = [];
  for (const p of Array.from(root.querySelectorAll<HTMLElement>('p[data-i]'))) {
    if (!r.intersectsNode(p)) continue;
    const s = p.contains(r.startContainer) ? textLen(p, r.startContainer, r.startOffset) : 0;
    const e = p.contains(r.endContainer) ? textLen(p, r.endContainer, r.endOffset) : (p.textContent ?? '').length;
    if (e > s && (p.textContent ?? '').slice(s, e).trim()) parts.push({ p, s, e });
  }
  if (!parts.length) return null;
  const { p, s, e } = parts[0];
  return { i: Number(p.dataset.i), start: s, end: e, quote: (p.textContent ?? '').slice(s, e), clamped: parts.length > 1 };
}
