import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { parseFile } from '../src/parsers';

const W = (t: string) => `<w:p>${t ? `<w:r><w:t>${t}</w:t></w:r>` : ''}</w:p>`;
const PB = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
async function docx(body: string) {
  const z = new JSZip(); z.file('word/document.xml', `<w:document xmlns:w="x"><w:body>${body}</w:body></w:document>`);
  const buf = await z.generateAsync({ type: 'arraybuffer' });
  return parseFile({ name: 'a.docx', arrayBuffer: async () => buf });
}
const gaps = (b: Awaited<ReturnType<typeof docx>>) => b.chapters.map(c => c.blocks.map(x => (x as any).gap ?? 0));

describe('엔터만 친 빈 줄 → 블록 앞 gap', () => {
  it('DOCX: 빈 문단 개수만큼 gap, 맨 앞·맨 끝 빈 줄은 무시', async () => {
    const b = await docx(`${W('')}${W('가')}${W('')}${W('나')}${W('')}${W('')}${W('다')}${W('')}`);
    expect(gaps(b)).toEqual([[0, 1, 2]]);
  });
  it('DOCX: 쪽 나누기 앞뒤의 빈 줄은 회차 맨 앞/끝이라 무시, 쪽 안의 빈 줄은 유지', async () => {
    const b = await docx(`${W('가')}${W('')}${PB}${W('')}${W('나')}${W('')}${W('다')}`);
    expect(b.chapters.map(c => c.blocks.length)).toEqual([1, 2]);
    expect(gaps(b)).toEqual([[0], [0, 1]]);
  });
  it('DOCX: 제목 패턴으로 나뉘는 회차의 첫 블록 앞 빈 줄은 제거', async () => {
    const b = await docx(`${W('1화')}${W('가')}${W('')}${W('')}${W('2화')}${W('')}${W('나')}`);
    expect(b.chapters.map(c => c.title)).toEqual(['1화', '2화']);
    expect(gaps(b)).toEqual([[0], [0]]);
  });
  it('DOCX: 빈 줄이 아주 많아도 최대 5줄까지만', async () => {
    const b = await docx(`${W('가')}${W('').repeat(30)}${W('나')}`);
    expect(gaps(b)).toEqual([[0, 5]]);
  });
  it('DOCX: 빈 줄이 없으면 gap 필드 자체가 없음(옛 원고와 동일 구조)', async () => {
    const b = await docx(`${W('가')}${W('나')}`);
    expect(b.chapters[0].blocks).toEqual([{ type: 'p', text: '가' }, { type: 'p', text: '나' }]);
  });
  it('HWPX: 빈 문단 → gap, pageBreak 직후 빈 줄은 무시', async () => {
    const NS = 'xmlns:hp="p" xmlns:hs="s"';
    const P = (t: string, pb = 0) => `<hp:p pageBreak="${pb}"><hp:run><hp:t>${t}</hp:t></hp:run></hp:p>`;
    const z = new JSZip(); z.file('Contents/section0.xml', `<hs:sec ${NS}>${P('가')}${P('')}${P('')}${P('나')}${P('', 1)}${P('다')}</hs:sec>`);
    const buf = await z.generateAsync({ type: 'arraybuffer' });
    const b = await parseFile({ name: 'a.hwpx', arrayBuffer: async () => buf });
    expect(gaps(b as any)).toEqual([[0, 2], [0]]);
  });
});
