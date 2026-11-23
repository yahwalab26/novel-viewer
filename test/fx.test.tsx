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
