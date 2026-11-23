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
  it('제목은 파일명(확장자 제외) — 파일 속 제목·회차 1개짜리 제목도 파일명', async () => {
    const f = await mk({ 'word/document.xml': `<w:document xmlns:w="x"><w:body>${W('본문만 있음.')}</w:body></w:document>`, 'docProps/core.xml': '<cp:coreProperties xmlns:dc="d"><dc:title>옛 제목</dc:title></cp:coreProperties>' });
    const b = await parseFile(f('[작가] 내 소설.v2.docx'));
    expect(b.title).toBe('[작가] 내 소설.v2'); expect(b.chapters[0].title).toBe('[작가] 내 소설.v2');
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
    expect(b.title).toBe('x'); expect(b.author).toBe('작가');   // 제목은 파일명
    expect(b.chapters.map(c => c.title)).toEqual(['1화', '2화', '3화']);
    expect(b.chapters[0].blocks.map(x => x.type)).toEqual(['p', 'scene', 'p']);
  });
  it('미지원 포맷 안내', async () => {
    await expect(parseFile({ name: 'a.xyz', arrayBuffer: async () => new ArrayBuffer(1) })).rejects.toThrow('지원하지 않는 형식');
  });
});

const PB = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
const docx = (body: string) => mk({ 'word/document.xml': `<w:document xmlns:w="x"><w:body>${body}</w:body></w:document>` });
describe('쪽 나누기 → 회차', () => {
  it('DOCX: 쪽 나누기마다 회차, 제목 패턴 없으면 순번(1화, 2화…)', async () => {
    const f = await docx(`${W('첫 장면.')}${PB}${W('둘째 장면.')}${PB}${W('셋째 장면.')}`);
    const b = await parseFile(f('작품.docx'));
    expect(b.chapters.map(c => c.title)).toEqual(['1화', '2화', '3화']);
    expect(b.chapters[1].blocks).toEqual([{ type: 'p', text: '둘째 장면.' }]);
  });
  it('DOCX: 쪽 첫 줄이 회차 제목·소제목이면 그것이 회차 제목', async () => {
    const f = await docx(`${W('프롤로그')}${W('본문 가.')}${PB}${W('새 이야기', 'Heading1')}${W('본문 나.')}`);
    const b = await parseFile(f('작품.docx'));
    expect(b.chapters.map(c => c.title)).toEqual(['프롤로그', '새 이야기']);
    expect(b.chapters[0].blocks).toHaveLength(1);
  });
  it('DOCX: 문단 중간 쪽 나누기, w:pageBreakBefore, 연속·맨앞 쪽 나누기(빈 쪽 무시)', async () => {
    const mid = '<w:p><w:r><w:t>앞</w:t><w:br w:type="page"/><w:t>뒤</w:t></w:r></w:p>';
    const before = '<w:p><w:pPr><w:pageBreakBefore/></w:pPr><w:r><w:t>다음 쪽</w:t></w:r></w:p>';
    const b = await parseFile((await docx(`${PB}${mid}${PB}${PB}${before}`))('a.docx'));
    expect(b.chapters.map(c => c.blocks.map(x => (x as any).text))).toEqual([['앞'], ['뒤'], ['다음 쪽']]);
  });
  it('DOCX: 제목만 있는 쪽은 다음 쪽 제목이 됨 / 줄바꿈(br)은 \\n 유지', async () => {
    const soft = '<w:p><w:r><w:t>가</w:t><w:br/><w:t>나</w:t></w:r></w:p>';
    const b = await parseFile((await docx(`${W('1화')}${PB}${soft}${PB}${W('둘째.')}`))('a.docx'));
    expect(b.chapters.map(c => c.title)).toEqual(['1화', '2화']);
    expect((b.chapters[0].blocks[0] as any).text).toBe('가\n나');
  });
  it('DOCX: 자동 쪽 나눔 흔적(lastRenderedPageBreak)·쪽 나누기 없음 → 기존 방식 그대로', async () => {
    const auto = '<w:p><w:r><w:lastRenderedPageBreak/><w:t>본문</w:t></w:r></w:p>';
    const b = await parseFile((await docx(`${W('1화')}${auto}${W('2화')}${W('다음.')}`))('a.docx'));
    expect(b.chapters.map(c => c.title)).toEqual(['1화', '2화']);
  });
  it('HWPX: hp:p pageBreak="1" 부터 새 회차', async () => {
    const P = (t: string, pb = 0) => `<hp:p id="1" pageBreak="${pb}"><hp:run><hp:t>${t}</hp:t></hp:run></hp:p>`;
    const f = await mk({ 'Contents/section0.xml': `<hs:sec xmlns:hs="s" xmlns:hp="p">${P('가')}${P('나')}${P('다', 1)}${P('라', 1)}</hs:sec>` });
    const b = await parseFile(f('작품.hwpx'));
    expect(b.chapters.map(c => c.blocks.map(x => (x as any).text))).toEqual([['가', '나'], ['다'], ['라']]);
    expect(b.chapters.map(c => c.title)).toEqual(['1화', '2화', '3화']);
  });
});

