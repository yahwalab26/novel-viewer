import JSZip from 'jszip';
import type { Block, Mark, Parser } from '../core/model';
import { SCENE_RE, addMark, clipMarks, splitByPages, withGap } from '../core/chapters';

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
type Fx = Omit<Mark, 's' | 'e'>;
/** 문단 글자와 글자 모양 구간(marks)을 함께 뽑는다. 글자 모양은 hp:run 의 charPrIDRef → header.xml 의 charPr 로 정해진다. */
function paraText(p: Element, nested: Element[], charFx: Map<string, Fx>): { text: string; marks: Mark[] } {
  let out = ''; const marks: Mark[] = [];
  const walk = (el: Element, fx: Fx) => {
    for (const c of Array.from(el.children)) {
      switch (c.localName) {
        case 't': { const s0 = out.length; out += tText(c); addMark(marks, s0, out.length, fx); break; }
        case 'p': nested.push(c); break;                 // 표/글상자 속 문단
        case 'tab': out += '\t'; break;
        case 'lineBreak': out += '\n'; break;
        case 'ctrl': case 'secPr': case 'linesegarray': break;
        case 'run': walk(c, charFx.get(c.getAttribute('charPrIDRef') ?? '') ?? {}); break;
        default: walk(c, fx);                            // tbl, tr, tc, subList ...
      }
    }
  };
  walk(p, {});
  return { text: out, marks };
}
/** header.xml 의 글자 모양 정의: 기울임·굵게는 자식 요소가 있으면 켜짐, 밑줄 type·취소선 shape 는 NONE(취소선은 3D 도) 이면 꺼짐 */
function charFxMap(header?: string): Map<string, Fx> {
  const map = new Map<string, Fx>();
  if (!header) return map;
  for (const cp of Array.from(XML(header).getElementsByTagName('*')).filter(e => e.localName === 'charPr')) {
    const kid = (n: string) => Array.from(cp.children).find(c => c.localName === n);
    // 한글은 '취소선 없음'을 shape="3D" 로 저장하기도 한다(실제 취소선은 SOLID·DASH 등) → NONE·3D 는 꺼짐
    const on = (e?: Element, attr?: string) => !!e && (!attr || !/^(NONE|3D)$/i.test(e.getAttribute(attr) ?? 'NONE'));
    const fx: Fx = { ...(kid('italic') && { i: 1 as const }), ...(kid('bold') && { b: 1 as const }), ...(on(kid('underline'), 'type') && { u: 1 as const }), ...(on(kid('strikeout'), 'shape') && { x: 1 as const }) };
    if (Object.keys(fx).length) map.set(cp.getAttribute('id') ?? '', fx);
  }
  return map;
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

    const charFx = charFxMap(header);
    let blank = 0;                                       // 엔터만 친 빈 문단 수(다음 블록의 gap)
    const pages: Block[][] = [[]];                        // hp:p pageBreak="1" → 그 문단부터 새 쪽
    const emit = (p: Element) => {
      const nested: Element[] = [];
      if (p.getAttribute('pageBreak') === '1') { pages.push([]); blank = 0; }
      const blocks = pages[pages.length - 1];
      const raw = paraText(p, nested, charFx), text = raw.text.replace(/\s+$/, '');
      if (text.trim()) {
        const style = styles.get(p.getAttribute('styleIDRef') ?? '') ?? '';
        let blk: Block;
        if (SCENE_RE.test(text)) blk = { type: 'scene', text: text.trim() };
        else if (HEADING_STYLE.test(style) && text.trim().length <= 40) blk = { type: 'h', text: text.trim() };
        else { const ms = clipMarks(raw.marks, text.length); blk = ms ? { type: 'p', text, marks: ms } : { type: 'p', text }; }
        blocks.push(withGap(blk, blocks, blank)); blank = 0;
      } else blank++;
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
    return { title, author: author || undefined, format: 'hwpx', parserVersion: 4, chapters: splitByPages(pages, title) };
  },
};
