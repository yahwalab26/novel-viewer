import type { Block, Chapter } from './model';
// 회차 제목 패턴: "작품명 – 01", "12화", "제12화", "EP.12", "Episode 12", "Track 01. 제목", "프롤로그/에필로그/외전"
export const CHAPTER_RE = /^\s*((제\s*)?\d+\s*(화|회|장)(?![가-힣]).*|EP\.?\s*\d+.*|Episode\s*\d+.*|Track\.?\s*\d+.*|Chapter\s*\d+.*|프롤로그.*|에필로그.*|외전.*|.+\s[–—-]\s*\d{1,4})$/i;  // 마지막: "작품명 – 01" 형태
/** 회차 위에 있는 묶음 제목(앨범·부·파트): "SECOND ALBUM <제목>", "PART 2", "제2부" */
export const PART_RE = /^\s*((PART|Part|파트)\s*\d+.*|제\s*\d+\s*부.*|[A-Za-z]+\s+(ALBUM|Album)\s*[<《〈「『\[(].*)$/;
export const countChars = (blocks: Block[]) =>
  blocks.reduce((n, b) => n + (b.type === 'p' || b.type === 'h' ? b.text.replace(/\s/g, '').length : 0), 0);
export const mkChapter = (i: number, title: string, blocks: Block[]): Chapter =>
  ({ id: `c${i}`, title, blocks, charCount: countChars(blocks) });

const isTitle = (b: Block) => (b.type === 'h' || (b.type === 'p' && b.text.length <= 40)) && CHAPTER_RE.test((b as any).text);

/** 하나로 이어진 블록을 회차 제목 패턴으로 분할. 패턴이 없으면 1개 회차. */
export function splitByPattern(blocks: Block[], fallbackTitle: string): Chapter[] {
  const out: Chapter[] = []; let title = fallbackTitle; let cur: Block[] = [];
  const flush = () => { if (cur.length) out.push(mkChapter(out.length, title, cur)); cur = []; };
  for (const b of blocks) {
    if (isTitle(b)) { flush(); title = (b as any).text.trim(); } else cur.push(b);
  }
  flush();
  return out.length ? out : [mkChapter(0, fallbackTitle, [])];
}
/**
 * 쪽 나누기로 나뉜 원고: 쪽 하나 = 회차 하나. (작가마다 회차 나누는 방식이 달라, 쪽 나누기가 있으면 그것을 우선한다)
 * 제목: 쪽 첫 블록이 회차 제목 패턴이거나 소제목(h)이면 그것, 아니면 '1화, 2화 …' 순번.
 * 빈 쪽은 버리고, 제목만 있는 쪽은 제목을 다음 쪽으로 넘긴다. 내용 있는 쪽이 1개 이하면 기존 방식(제목 패턴 분할).
 */
export function splitByPages(pages: Block[][], fallbackTitle: string): Chapter[] {
  const filled = pages.filter(pg => pg.length);
  if (filled.length <= 1) return splitByPattern(filled.flat(), fallbackTitle);
  const out: Chapter[] = []; let carry = '';
  for (const pg of filled) {
    const first = pg[0], hasTitle = isTitle(first) || first.type === 'h';
    const title = hasTitle ? (first as any).text.trim() : carry || `${out.length + 1}화`;
    const body = hasTitle ? pg.slice(1) : pg;
    if (!body.length) { carry = title; continue; }          // 제목만 있는 쪽 → 다음 쪽 제목으로
    out.push(mkChapter(out.length, title, body)); carry = '';
  }
  return out.length ? out : splitByPattern(filled.flat(), fallbackTitle);
}
export const SCENE_RE = /^\s*([*＊◇◆※~\-─—=#]{3,}|\*\s*\*\s*\*)\s*$/;
