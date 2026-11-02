import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { parseFile } from '../src/parsers';

const W = (t: string, style = '') => `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ''}<w:r><w:t>${t}</w:t></w:r></w:p>`;
async function mk(files: Record<string, string>) {
  const z = new JSZip(); for (const [k, v] of Object.entries(files)) z.file(k, v);
  const buf = await z.generateAsync({ type: 'arraybuffer' });
  return (name: string) => ({ name, arrayBuffer: async () => buf });
}

describe('docx', () => {
  it('회차 패턴 분할, 장면 구분, 빈 문단 무시', async () => {
    const f = await mk({ 'word/document.xml': `<w:document xmlns:w="x"><w:body>${W('1화')}${W('첫 문장.')}${W('')}${W('***')}${W('둘째.')}${W('2화')}${W('다음 회차.')}</w:body></w:document>` });
    const b = await parseFile(f('테스트.docx'));
    expect(b.chapters.map(c => c.title)).toEqual(['1화', '2화']);
    expect(b.chapters[0].blocks.map(x => x.type)).toEqual(['p', 'scene', 'p']);
    expect(b.chapters[1].charCount).toBe(5);
    expect(b.id).toHaveLength(32);
  });
});
describe('epub', () => {
  it('spine 단위 회차 + 제목 추출', async () => {
    const page = (h: string, p: string) => `<html><body><h2>${h}</h2><p>${p}</p><hr/><p>끝</p></body></html>`;
    const f = await mk({
      'META-INF/container.xml': '<container><rootfiles><rootfile full-path="OEBPS/c.opf"/></rootfiles></container>',
      'OEBPS/c.opf': `<package xmlns="http://www.idpf.org/2007/opf"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>작품</dc:title><dc:creator>작가</dc:creator></metadata><manifest><item id="a" href="a.xhtml"/><item id="b" href="b.xhtml"/><item id="c" href="c.xhtml"/></manifest><spine><itemref idref="a"/><itemref idref="b"/><itemref idref="c"/></spine></package>`,
      'OEBPS/a.xhtml': page('1화', '가'), 'OEBPS/b.xhtml': page('2화', '나'), 'OEBPS/c.xhtml': page('3화', '다'),
    });
    const b = await parseFile(f('x.epub'));
    expect(b.title).toBe('작품'); expect(b.author).toBe('작가');
    expect(b.chapters.map(c => c.title)).toEqual(['1화', '2화', '3화']);
    expect(b.chapters[0].blocks.map(x => x.type)).toEqual(['p', 'scene', 'p']);
  });
  it('미지원 포맷 안내', async () => {
    await expect(parseFile({ name: 'a.hwp', arrayBuffer: async () => new ArrayBuffer(1) })).rejects.toThrow('준비 중');
  });
});
