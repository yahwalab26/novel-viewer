import type { Annotation } from '../core/model';
/** 저장된 위치가 현재 문단과 맞으면 그대로, 원고가 개정돼 어긋났으면 quote로 재탐색. 못 찾으면 null(고아). */
export function resolve(text: string, a: Pick<Annotation, 'start' | 'end' | 'quote'>): [number, number] | null {
  if (text.slice(a.start, a.end) === a.quote) return [a.start, a.end];
  const i = a.quote ? text.indexOf(a.quote) : -1;
  return i >= 0 ? [i, i + a.quote.length] : null;
}
export interface Seg { text: string; ann?: Annotation }
/** 문단을 형광펜 구간으로 분할. 겹치면 나중에 만든 것이 위. */
export function segments(text: string, anns: Annotation[] = []): Seg[] {
  const rs = anns.map(a => ({ a, r: resolve(text, a) })).filter((x): x is { a: Annotation; r: [number, number] } => !!x.r)
    .sort((x, y) => x.a.createdAt - y.a.createdAt);
  const cuts = Array.from(new Set([0, text.length, ...rs.flatMap(x => x.r)])).sort((p, q) => p - q);
  const out: Seg[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const [x, y] = [cuts[i], cuts[i + 1]]; if (x === y) continue;
    const top = rs.filter(z => z.r[0] <= x && z.r[1] >= y).pop();
    const last = out[out.length - 1];
    if (last && last.ann?.id === top?.a.id) last.text += text.slice(x, y); else out.push({ text: text.slice(x, y), ann: top?.a });
  }
  return out;
}
