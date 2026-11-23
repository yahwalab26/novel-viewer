import JSZip from 'jszip';
import type { Block, Parser } from '../core/model';
import { SCENE_RE, splitByPages } from '../core/chapters';

export const docxParser: Parser = {
  format: 'docx', extensions: ['docx'],
  async parse(data, fileName) {
    const zip = await JSZip.loadAsync(data);
    const xml = await zip.file('word/document.xml')?.async('string');
    if (!xml) throw new Error('DOCX: word/document.xml 없음');
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    // 쪽 나누기(w:br type=page · w:pageBreakBefore)마다 새 쪽. 자동 쪽 나눔 흔적(w:lastRenderedPageBreak)은 쓰지 않는다.
    const pages: Block[][] = [[]];
    const off = (e?: Element | null) => !!e && /^(0|false|off)$/i.test(e.getAttribute('w:val') ?? '');
    for (const p of Array.from(doc.getElementsByTagName('w:p'))) {
      const style = p.getElementsByTagName('w:pStyle')[0]?.getAttribute('w:val') ?? '';
      const push = (raw: string) => {
        const text = raw.replace(/\s+$/, '');
        if (!text.trim()) return;                              // 빈 문단은 무시
        const cur = pages[pages.length - 1];
        if (SCENE_RE.test(text)) cur.push({ type: 'scene', text: text.trim() });
        else if (/^(heading|제목)\s*\d?/i.test(style) || /^Title$/i.test(style)) cur.push({ type: 'h', text: text.trim() });
        else cur.push({ type: 'p', text });
      };
      const pbb = p.getElementsByTagName('w:pageBreakBefore')[0];
      if (pbb && !off(pbb)) pages.push([]);
      let text = '';
      for (const n of Array.from(p.getElementsByTagName('*'))) {
        if (n.nodeName === 'w:t') text += n.textContent ?? '';
        else if (n.nodeName === 'w:tab') text += '\t';
        else if (n.nodeName === 'w:br') {
          const t = n.getAttribute('w:type');
          if (t === 'page') { push(text); text = ''; pages.push([]); }   // 문단 중간의 쪽 나누기도 그 자리에서 쪽을 나눔
          else if (!t || t === 'textWrapping') text += '\n';
        }
      }
      push(text);
    }
    const core = await zip.file('docProps/core.xml')?.async('string');
    const meta = (tag: string) => core?.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`))?.[1]?.trim();
    const title = meta('dc:title') || fileName.replace(/\.docx$/i, '');
    return { title, author: meta('dc:creator'), format: 'docx', parserVersion: 2, chapters: splitByPages(pages, title) };
  },
};
