import type { Block, Chapter } from './model';
// 회차 제목 패턴: "12화", "제12화", "EP.12", "Episode 12", "프롤로그/에필로그/외전"
export const CHAPTER_RE = /^\s*((제\s*)?\d+\s*(화|회|장)(?![가-힣]).*|EP\.?\s*\d+.*|Episode\s*\d+.*|프롤로그.*|에필로그.*|외전.*)$/i;
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
export const SCENE_RE = /^\s*([*＊◇◆※~\-─—=#]{3,}|\*\s*\*\s*\*)\s*$/;
