import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import JSZip from 'jszip';
import { Fragment } from 'react';
import { parseFile } from '../src/parsers';
import { renderSegs } from '../src/viewer/AnnotationUI';
import type { Annotation } from '../src/core/model';

const A = (o: Partial<Annotation>): Annotation => ({ id: 'a', bookId: 'b', authorId: 'me', chapterId: 'c0', blockIndex: 0, start: 0, end: 0, quote: '', color: 'yellow', createdAt: 1, updatedAt: 1, ...o });
const R = (inner: string, rpr = '') => `<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ''}<w:t>${inner}</w:t></w:r>`;
async function docx(body: string) {
  const z = new JSZip(); z.file('word/document.xml', `<w:document xmlns:w="x"><w:body><w:p>${body}</w:p></w:body></w:document>`);
  const buf = await z.generateAsync({ type: 'arraybuffer' });
  return parseFile({ name: 'a.docx', arrayBuffer: async () => buf });
}
const html = (n: unknown) => renderToStaticMarkup(<Fragment>{n as any}</Fragment>);

describe('글자 모양(marks)', () => {
  it('DOCX: 기울임·굵게·밑줄·취소선 구간을 text 위치로 기록, text 는 서식 없는 것과 동일', async () => {
    const b = await docx(`${R('가나', '<w:i/>')}${R('다', '<w:b/><w:u w:val="single"/>')}${R('라', '<w:strike/>')}${R('마')}`);
    const p = b.chapters[0].blocks[0] as any;
    expect(p.text).toBe('가나다라마');
    expect(p.marks).toEqual([{ s: 0, e: 2, i: 1 }, { s: 2, e: 3, b: 1, u: 1 }, { s: 3, e: 4, x: 1 }]);
  });
  it('DOCX: val=0/false/none 은 꺼짐, 같은 서식이 이어지면 합침, 서식 없으면 marks 필드 없음', async () => {
    const b = await docx(`${R('가', '<w:i w:val="0"/><w:u w:val="none"/>')}${R('나', '<w:i/>')}${R('다', '<w:i/>')}`);
    expect((b.chapters[0].blocks[0] as any).marks).toEqual([{ s: 1, e: 3, i: 1 }]);
    const c = await docx(R('서식 없음', '<w:b w:val="false"/>'));
    expect(c.chapters[0].blocks[0]).toEqual({ type: 'p', text: '서식 없음' });
  });
  it('DOCX: 문단 끝 공백 제거 후에도 marks 가 text 길이를 넘지 않음', async () => {
    const b = await docx(`${R('가나', '<w:i/>')}${R('   ', '<w:i/>')}`);
    const p = b.chapters[0].blocks[0] as any;
    expect(p.text).toBe('가나'); expect(p.marks).toEqual([{ s: 0, e: 2, i: 1 }]);
  });
  it('렌더: marks 없으면 이전과 같고, 있으면 em/strong/u/s 로 감쌈(글자 보존)', () => {
    expect(html(renderSegs('가나다'))).toBe('가나다');
    const h = html(renderSegs('가나다라', undefined, 'me', [{ s: 1, e: 3, i: 1, b: 1 }]));
    expect(h).toContain('<em><strong>나다</strong></em>');
    expect(h.replace(/<[^>]+>/g, '')).toBe('가나다라');
  });
  it('렌더: 형광펜과 겹쳐도 글자 보존, 서식은 형광펜 안에서도 유지', () => {
    const h = html(renderSegs('가나다라마', [A({ start: 1, end: 4, quote: '나다라' })], 'me', [{ s: 2, e: 5, i: 1 }]));
    expect(h.replace(/<[^>]+>/g, '')).toBe('가나다라마');
    expect(h).toMatch(/<mark[^>]*>.*<em>다라<\/em>.*<\/mark>/);
    expect(h).toContain('<em>마</em>');
  });
});

describe('글자 모양(marks) — HWPX', () => {
  const NS = 'xmlns:hh="h" xmlns:hp="p" xmlns:hs="s"';
  const HEAD = `<hh:head ${NS}><hh:refList><hh:charProperties>`
    + '<hh:charPr id="0" height="1000"><hh:underline type="NONE" shape="SOLID"/><hh:strikeout shape="NONE"/></hh:charPr>'
    + '<hh:charPr id="1"><hh:italic/><hh:underline type="NONE"/><hh:strikeout shape="NONE"/></hh:charPr>'
    + '<hh:charPr id="2"><hh:bold/><hh:underline type="BOTTOM" shape="SOLID"/><hh:strikeout shape="NONE"/></hh:charPr>'
    + '<hh:charPr id="3"><hh:underline type="NONE"/><hh:strikeout shape="SOLID"/></hh:charPr>'
    + '</hh:charProperties></hh:refList></hh:head>';
  const run = (id: number, t: string) => `<hp:run charPrIDRef="${id}"><hp:t>${t}</hp:t></hp:run>`;
  async function hwpx(paras: string, header: string | null = HEAD) {
    const z = new JSZip(); z.file('Contents/section0.xml', `<hs:sec ${NS}>${paras}</hs:sec>`); if (header) z.file('Contents/header.xml', header);
    const buf = await z.generateAsync({ type: 'arraybuffer' });
    return parseFile({ name: 'a.hwpx', arrayBuffer: async () => buf });
  }
  it('기울임·굵게+밑줄·취소선을 charPr 로 판정, NONE 은 꺼짐, 같은 서식 이어지면 합침', async () => {
    const b = await hwpx(`<hp:p>${run(0, '가')}${run(1, '나')}${run(1, '다')}${run(2, '라')}${run(3, '마')}</hp:p>`);
    const p = b.chapters[0].blocks[0] as any;
    expect(p.text).toBe('가나다라마');
    expect(p.marks).toEqual([{ s: 1, e: 3, i: 1 }, { s: 3, e: 4, b: 1, u: 1 }, { s: 4, e: 5, x: 1 }]);
  });
  it('한글이 "없음"으로 저장하는 strikeout shape=3D 는 취소선이 아님(실제 파일 회귀)', async () => {
    const h = `<hh:head ${NS}><hh:refList><hh:charProperties>`
      + '<hh:charPr id="0"><hh:underline type="NONE" shape="SOLID"/><hh:strikeout shape="3D" color="#000000"/></hh:charPr>'
      + '<hh:charPr id="1"><hh:underline type="NONE"/><hh:strikeout shape="SOLID"/></hh:charPr>'
      + '</hh:charProperties></hh:refList></hh:head>';
    const b = await hwpx(`<hp:p>${run(0, '가')}${run(1, '나')}</hp:p>`, h);
    expect((b.chapters[0].blocks[0] as any).marks).toEqual([{ s: 1, e: 2, x: 1 }]);
  });
  it('줄바꿈·탭이 섞여도 위치가 맞고, 문단 끝 공백 제거 뒤 길이를 넘지 않음', async () => {
    const r = '<hp:run charPrIDRef="1"><hp:t>나<hp:lineBreak/>다  </hp:t></hp:run>';
    const b = await hwpx(`<hp:p>${run(0, '가')}${r}</hp:p>`);
    const p = b.chapters[0].blocks[0] as any;
    expect(p.text).toBe('가나\n다'); expect(p.marks).toEqual([{ s: 1, e: 4, i: 1 }]);
  });
  it('header.xml 이 없거나 서식 없는 문단 → marks 필드 없음(옛 원고와 동일)', async () => {
    const a = await hwpx(`<hp:p>${run(1, '가')}</hp:p>`, null);
    expect(a.chapters[0].blocks[0]).toEqual({ type: 'p', text: '가' });
    const b = await hwpx(`<hp:p>${run(0, '가')}</hp:p>`);
    expect(b.chapters[0].blocks[0]).toEqual({ type: 'p', text: '가' });
  });
});

