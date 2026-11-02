import JSZip from 'jszip';
import type { Block, Chapter, Parser } from '../core/model';
import { SCENE_RE, mkChapter, splitByPattern } from '../core/chapters';

const dirOf = (p: string) => p.slice(0, p.lastIndexOf('/') + 1);
const resolve = (base: string, href: string) => decodeURIComponent(href.split('#')[0]);

function htmlToBlocks(html: string): Block[] {
  const body = new DOMParser().parseFromString(html, 'text/html').body;
  const els = Array.from(body.querySelectorAll('p,h1,h2,h3,h4,h5,h6,hr'));
  const out: Block[] = [];
  if (!els.length) { // 태그 없이 줄바꿈만 있는 경우
    for (const l of (body.textContent ?? '').split('\n')) if (l.trim()) out.push({ type: 'p', text: l.trim() });
    return out;
  }
  for (const e of els) {
    const t = (e.textContent ?? '').trim();
    if (e.tagName === 'HR' || (t && SCENE_RE.test(t))) out.push({ type: 'scene' });
    else if (!t) continue;
    else out.push(/^H\d$/.test(e.tagName) ? { type: 'h', text: t } : { type: 'p', text: t });
  }
  return out;
}

export const epubParser: Parser = {
  format: 'epub', extensions: ['epub'],
  async parse(data, fileName) {
    const zip = await JSZip.loadAsync(data);
    const container = await zip.file('META-INF/container.xml')?.async('string');
    const opfPath = container?.match(/full-path="([^"]+)"/)?.[1];
    if (!opfPath) throw new Error('EPUB: container.xml 오류');
    const opf = new DOMParser().parseFromString(await zip.file(opfPath)!.async('string'), 'text/xml');
    const base = dirOf(opfPath);
    const manifest = new Map<string, string>();
    for (const it of Array.from(opf.getElementsByTagName('item'))) manifest.set(it.getAttribute('id')!, it.getAttribute('href')!);
    const title = opf.getElementsByTagName('dc:title')[0]?.textContent?.trim() || fileName.replace(/\.epub$/i, '');
    const author = opf.getElementsByTagName('dc:creator')[0]?.textContent?.trim();

    const parts: { title?: string; blocks: Block[] }[] = [];
    for (const ref of Array.from(opf.getElementsByTagName('itemref'))) {
      const href = manifest.get(ref.getAttribute('idref')!);
      const f = href && zip.file(base + resolve(base, href));
      if (!f) continue;
      const blocks = htmlToBlocks(await f.async('string'));
      if (!blocks.length) continue;
      const first = blocks[0];
      parts.push({ title: first.type === 'h' ? first.text : undefined, blocks: first.type === 'h' ? blocks.slice(1) : blocks });
    }
    // 파일 1~2개에 통째로 들어간 EPUB은 패턴 분할, 그 외엔 파일(spine) 단위 = 회차
    const chapters: Chapter[] = parts.length <= 2
      ? splitByPattern(parts.flatMap(p => (p.title ? [{ type: 'h', text: p.title } as Block, ...p.blocks] : p.blocks)), title)
      : parts.map((p, i) => mkChapter(i, p.title ?? `${i + 1}`, p.blocks));
    return { title, author, format: 'epub', parserVersion: 1, chapters };
  },
};
