import JSZip from 'jszip';
import type { Block, Mark, Parser } from '../core/model';
import { SCENE_RE, addMark, clipMarks, splitByPages, withGap } from '../core/chapters';

export const docxParser: Parser = {
  format: 'docx', extensions: ['docx'],
  async parse(data, fileName) {
    const zip = await JSZip.loadAsync(data);
    const xml = await zip.file('word/document.xml')?.async('string');
    if (!xml) throw new Error('DOCX: word/document.xml 없음');
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    // 쪽 나누기(w:br type=page · w:pageBreakBefore)마다 새 쪽. 자동 쪽 나눔 흔적(w:lastRenderedPageBreak)은 쓰지 않는다.
    const pages: Block[][] = [[]];
    let blank = 0;                                           // 엔터만 친 빈 문단 수(다음 블록의 gap 이 됨)
    const off = (e?: Element | null) => !!e && /^(0|false|off|none)$/i.test(e.getAttribute('w:val') ?? '');
    // 글자 모양: 이어 붙이는 순간의 위치를 기록(w:rPr 에 직접 지정된 것만. 스타일로 지정된 것은 아직 안 읽음)
    const flags = (t: Element): Omit<Mark, 's' | 'e'> => {
      const rPr = Array.from(t.parentNode ? (t.parentNode as Element).children : []).find(c => c.nodeName === 'w:rPr');
      const on = (...names: string[]) => !!rPr && Array.from(rPr.children).some(c => names.includes(c.nodeName) && !off(c));
      return { ...(on('w:i', 'w:iCs') && { i: 1 as const }), ...(on('w:b') && { b: 1 as const }), ...(on('w:u') && { u: 1 as const }), ...(on('w:strike', 'w:dstrike') && { x: 1 as const }) };
    };
    for (const p of Array.from(doc.getElementsByTagName('w:p'))) {
      const style = p.getElementsByTagName('w:pStyle')[0]?.getAttribute('w:val') ?? '';
      const push = (raw: string, marks: Mark[] = []) => {
        const text = raw.replace(/\s+$/, '');
        if (!text.trim()) { blank++; return; }
        const cur = pages[pages.length - 1];
        let blk: Block;
        if (SCENE_RE.test(text)) blk = { type: 'scene', text: text.trim() };
        else if (/^(heading|제목)\s*\d?/i.test(style) || /^Title$/i.test(style)) blk = { type: 'h', text: text.trim() };
        else { const ms = clipMarks(marks, text.length); blk = ms ? { type: 'p', text, marks: ms } : { type: 'p', text }; }
        cur.push(withGap(blk, cur, blank)); blank = 0;
      };
      const pbb = p.getElementsByTagName('w:pageBreakBefore')[0];
      if (pbb && !off(pbb)) { pages.push([]); blank = 0; }
      let text = '', marks: Mark[] = [];
      for (const n of Array.from(p.getElementsByTagName('*'))) {
        if (n.nodeName === 'w:t') {
          const s0 = text.length, f = flags(n); text += n.textContent ?? '';
          addMark(marks, s0, text.length, f);
        }
        else if (n.nodeName === 'w:tab') text += '\t';
        else if (n.nodeName === 'w:br') {
          const t = n.getAttribute('w:type');
          if (t === 'page') { push(text, marks); text = ''; marks = []; pages.push([]); blank = 0; }   // 문단 중간의 쪽 나누기도 그 자리에서 쪽을 나눔
          else if (!t || t === 'textWrapping') text += '\n';
        }
      }
      push(text, marks);
    }
    const core = await zip.file('docProps/core.xml')?.async('string');
    const meta = (tag: string) => core?.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`))?.[1]?.trim();
    const title = meta('dc:title') || fileName.replace(/\.docx$/i, '');
    return { title, author: meta('dc:creator'), format: 'docx', parserVersion: 4, chapters: splitByPages(pages, title) };
  },
};
