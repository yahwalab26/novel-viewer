// PDF 글자 조각(pdf.js textContent) → 줄 → 문단. PDF 는 '문단'이 없고 줄만 있어서 위치·들여쓰기·간격으로 문단을 다시 만든다.
// 한계: 한 단 편집 문서 기준(다단·표·이미지 PDF 는 순서가 어긋날 수 있음), 스캔본은 글자가 없어 불가.
import { CHAPTER_RE, SCENE_RE } from '../core/chapters';

export type RawItem = { str: string; transform: number[]; width: number; height: number };
export type PdfLine = { text: string; x: number; y: number; right: number; size: number };

const median = (a: number[]) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const END_RE = /[.!?…。？！)」』”’"'\]]$/;          // 문장이 끝난 줄
const OPEN_RE = /^[“‘"'「『(\[―—–-]/;             // 대화·따옴표로 시작하는 줄

/** 같은 기준선(y)의 조각을 한 줄로 묶고, 위에서 아래로 정렬 */
export function itemsToLines(items: RawItem[]): PdfLine[] {
  const its = items.filter(i => i.str.length > 0 && Array.isArray(i.transform)).map(i => {
    const size = Math.hypot(i.transform[2], i.transform[3]) || i.height || 10;
    return { str: i.str, x: i.transform[4], y: i.transform[5], w: i.width, size };
  }).sort((a, b) => (Math.abs(b.y - a.y) < Math.min(a.size, b.size) * 0.5 ? a.x - b.x : b.y - a.y));
  const lines: PdfLine[] = []; let cur: PdfLine | null = null;
  for (const it of its) {
    if (cur && Math.abs(cur.y - it.y) < Math.min(cur.size, it.size) * 0.5) {
      const gap = it.x - cur.right;
      if (gap > it.size * 0.15 && !/\s$/.test(cur.text) && !/^\s/.test(it.str)) cur.text += ' ';
      cur.text += it.str; cur.right = Math.max(cur.right, it.x + it.w); cur.size = Math.max(cur.size, it.size);
    } else { if (cur) lines.push(cur); cur = { text: it.str, x: it.x, y: it.y, right: it.x + it.w, size: it.size }; }
  }
  if (cur) lines.push(cur);
  return lines.map(l => ({ ...l, text: l.text.replace(/\s+$/, '') })).filter(l => l.text.trim());
}

const isPageNo = (t: string) => /^[-–—\s]*\d{1,4}[-–—\s]*$/.test(t.trim());
const norm = (t: string) => t.replace(/\d+/g, '#').trim();

/** 쪽 번호·반복되는 머리말/꼬리말(쪽 맨 위·맨 아래 줄) 제거 */
export function stripPageFurniture(pages: PdfLine[][]): PdfLine[][] {
  const edge = (p: PdfLine[]) => [p[0], p[p.length - 1]].filter(Boolean);
  const freq = new Map<string, number>();
  for (const p of pages) for (const l of new Set(edge(p).map(l => norm(l.text)))) freq.set(l, (freq.get(l) ?? 0) + 1);
  const repeated = (t: string) => pages.length >= 3 && (freq.get(norm(t)) ?? 0) >= Math.ceil(pages.length * 0.6);
  return pages.map(p => p.filter((l, i) => !((i === 0 || i === p.length - 1) && (isPageNo(l.text) || repeated(l.text)))));
}

/** 줄들 → 문단. 새 문단 조건: 들여쓰기 · 줄 간격이 넓음 · 문장이 끝난 짧은 줄 뒤 · 문장 끝 뒤 따옴표로 시작 · 제목/장면 구분 줄 */
export function linesToParagraphs(rawPages: PdfLine[][]): string[] {
  const pages = stripPageFurniture(rawPages);
  const all = pages.flatMap((p, pi) => p.map(l => ({ ...l, pi })));
  if (!all.length) return [];
  const bucket = (x: number) => Math.round(x / 2) * 2;
  const counts = new Map<number, number>(); for (const l of all) counts.set(bucket(l.x), (counts.get(bucket(l.x)) ?? 0) + 1);
  const L = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];                 // 본문 왼쪽 기준선(가장 흔한 x)
  const S = median(all.map(l => l.size)) || 10;
  const rights = all.map(l => l.right).sort((a, b) => a - b), R = rights[Math.floor(rights.length * 0.95)] ?? rights[rights.length - 1];
  const pitches: number[] = []; for (let i = 1; i < all.length; i++) if (all[i].pi === all[i - 1].pi) { const g = all[i - 1].y - all[i].y; if (g > 0) pitches.push(g); }
  const P = median(pitches) || S * 1.5;
  const standalone = (l: { text: string; size: number }) => SCENE_RE.test(l.text) || (l.text.length <= 40 && CHAPTER_RE.test(l.text)) || l.size > S * 1.25;

  const out: string[] = []; let cur = '';
  all.forEach((l, i) => {
    const prev = all[i - 1];
    const startsNew = !prev || standalone(l) || standalone(prev)
      || l.x - L > S * 0.6
      || (prev.pi === l.pi && prev.y - l.y > P * 1.45)
      || (END_RE.test(prev.text) && (prev.right < R - S * 2.5 || OPEN_RE.test(l.text)));
    if (startsNew) { if (cur) out.push(cur); cur = l.text.trim(); }
    else cur += (/\s$/.test(cur) ? '' : ' ') + l.text.trim();
  });
  if (cur) out.push(cur);
  return out.map(t => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
}
