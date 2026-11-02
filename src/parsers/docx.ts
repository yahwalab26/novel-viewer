import JSZip from 'jszip';
import type { Block, Parser } from '../core/model';
import { SCENE_RE, splitByPattern } from '../core/chapters';

export const docxParser: Parser = {
  format: 'docx', extensions: ['docx'],
  async parse(data, fileName) {
    const zip = await JSZip.loadAsync(data);
    const xml = await zip.file('word/document.xml')?.async('string');
    if (!xml) throw new Error('DOCX: word/document.xml 없음');
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const blocks: Block[] = [];
    for (const p of Array.from(doc.getElementsByTagName('w:p'))) {
      let text = '';
      for (const n of Array.from(p.getElementsByTagName('*'))) {
        if (n.nodeName === 'w:t') text += n.textContent ?? '';
        else if (n.nodeName === 'w:tab') text += '\t';
        else if (n.nodeName === 'w:br') text += '\n';
      }
      text = text.replace(/\s+$/, '');
      if (!text.trim()) continue;                              // 빈 문단은 무시
      const style = p.getElementsByTagName('w:pStyle')[0]?.getAttribute('w:val') ?? '';
      if (SCENE_RE.test(text)) blocks.push({ type: 'scene' });
      else if (/^(heading|제목)\s*\d?/i.test(style) || /^Title$/i.test(style)) blocks.push({ type: 'h', text: text.trim() });
      else blocks.push({ type: 'p', text });
    }
    const core = await zip.file('docProps/core.xml')?.async('string');
    const meta = (tag: string) => core?.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`))?.[1]?.trim();
    const title = meta('dc:title') || fileName.replace(/\.docx$/i, '');
    return { title, author: meta('dc:creator'), format: 'docx', parserVersion: 1, chapters: splitByPattern(blocks, title) };
  },
};
