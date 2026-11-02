import JSZip from 'jszip';
import type { Block, Parser } from '../core/model';
import { SCENE_RE, splitByPattern } from '../core/chapters';

// HWPX = zip. 본문: Contents/section*.xml (순서는 Contents/content.hpf 의 spine), 스타일 이름: Contents/header.xml
// 문단 구조: hp:p > hp:run > hp:t(텍스트, 안에 hp:tab/hp:lineBreak 가능). 표·글상자 안 문단은 별도 문단으로 이어 붙인다.
// 머리말/꼬리말/각주(hp:ctrl)와 이미지는 무시한다.
const XML = (s: string) => new DOMParser().parseFromString(s, 'text/xml');
const HEADING_STYLE = /^(개요|제목|Title|Heading|Outline)/i;

function tText(t: Element): string {
  let out = '';
  for (const n of Array.from(t.childNodes)) {
    if (n.nodeType === 3 || n.nodeType === 4) out += n.nodeValue ?? '';
    else if (n.nodeType === 1) {
      const name = (n as Element).localName;
      if (name === 'tab') out += '\t'; else if (name === 'lineBreak') out += '\n'; else if (name === 'nbSpace' || name === 'fwSpace') out += ' ';
    }
  }
  return out;
}
function paraText(p: Element, nested: Element[]): string {
  let out = '';
  const walk = (el: Element) => {
    for (const c of Array.from(el.children)) {
      switch (c.localName) {
        case 't': out += tText(c); break;
        case 'p': nested.push(c); break;                 // 표/글상자 속 문단
        case 'tab': out += '\t'; break;
        case 'lineBreak': out += '\n'; break;
        case 'ctrl': case 'secPr': case 'linesegarray': break;
        default: walk(c);                                // run, tbl, tr, tc, subList ...
      }
    }
  };
  walk(p);
  return out;
}

export const hwpxParser: Parser = {
  format: 'hwpx', extensions: ['hwpx'],
  async parse(data, fileName) {
    const zip = await JSZip.loadAsync(data);
    const hpf = await zip.file('Contents/content.hpf')?.async('string');
    // 섹션 순서: spine → 없으면 section*.xml 숫자순
    let paths: string[] = [];
    if (hpf) {
      const d = XML(hpf), items = new Map<string, string>();
      for (const it of Array.from(d.getElementsByTagName('*'))) if (it.localName === 'item') items.set(it.getAttribute('id') ?? '', it.getAttribute('href') ?? '');
      for (const r of Array.from(d.getElementsByTagName('*'))) if (r.localName === 'itemref') { const h = items.get(r.getAttribute('idref') ?? ''); if (h && /section\d+\.xml$/i.test(h)) paths.push(h); }
    }
    if (!paths.length) paths = Object.keys(zip.files).filter(f => /Contents\/section\d+\.xml$/i.test(f)).sort((a, b) => parseInt(a.match(/(\d+)\.xml/)![1]) - parseInt(b.match(/(\d+)\.xml/)![1]));
    if (!paths.length) throw new Error('HWPX: 본문(section)을 찾을 수 없습니다. 암호가 걸렸거나 손상된 파일일 수 있어요');

    const header = await zip.file('Contents/header.xml')?.async('string');
    const styles = new Map<string, string>();
    for (const m of header?.matchAll(/<hh:style\b[^>]*>/g) ?? []) {
      const id = m[0].match(/\bid="(\d+)"/)?.[1], name = m[0].match(/\bname="([^"]*)"/)?.[1];
      if (id && name) styles.set(id, name);
    }

    const blocks: Block[] = [];
    const emit = (p: Element) => {
      const nested: Element[] = [];
      const text = paraText(p, nested).replace(/\s+$/, '');
      if (text.trim()) {
        const style = styles.get(p.getAttribute('styleIDRef') ?? '') ?? '';
        if (SCENE_RE.test(text)) blocks.push({ type: 'scene' });
        else if (HEADING_STYLE.test(style) && text.trim().length <= 40) blocks.push({ type: 'h', text: text.trim() });
        else blocks.push({ type: 'p', text });
      }
      nested.forEach(emit);
    };
    for (const path of paths) {
      const xml = await (zip.file(path) ?? zip.file('Contents/' + path.split('/').pop()))?.async('string');
      if (!xml) continue;
      const root = XML(xml).documentElement;
      for (const c of Array.from(root.children)) if (c.localName === 'p') emit(c);
    }

    const meta = hpf ? XML(hpf) : null;
    const title = (meta && Array.from(meta.getElementsByTagName('*')).find(e => e.localName === 'title')?.textContent?.trim()) || fileName.replace(/\.hwpx$/i, '');
    const author = meta && Array.from(meta.getElementsByTagName('*')).find(e => e.localName === 'meta' && e.getAttribute('name') === 'creator')?.textContent?.trim();
    return { title, author: author || undefined, format: 'hwpx', parserVersion: 1, chapters: splitByPattern(blocks, title) };
  },
};
