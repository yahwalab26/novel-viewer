// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import { linesToParagraphs, type PdfLine } from '../src/parsers/pdfText';

// 브라우저용 pdf.js(+워커) 대신 Node 용 legacy 빌드를 쓴다
const mockState = vi.hoisted(() => ({ fake: null as any }));
vi.mock('../src/parsers/pdfLoader', () => ({ loadPdfjs: async () => mockState.fake ?? await import('pdfjs-dist/legacy/build/pdf.mjs') }));
import { pdfParser } from '../src/parsers/pdf';

const buf = (f: string) => { const b = fs.readFileSync(f); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; };
const L = (text: string, x: number, y: number, right = 300, size = 10): PdfLine => ({ text, x, y, right, size });

describe('PDF 원고 가져오기 (샘플 PDF: 3쪽, 쪽 번호·쪽 넘김 문단·장면 구분·대화문)', () => {
  it('회차·문단·장면 구분이 원문대로 복원된다', async () => {
    const book = await pdfParser.parse(buf('test/fixtures/sample-ko.pdf'), 'sample-ko.pdf');
    expect(book.format).toBe('pdf'); expect(book.title).toBe('sample-ko');
    expect(book.chapters.map(c => c.title)).toEqual(['제1화 비가 그친 골목', '제2화 두 번째 이야기']);
    const [c1, c2] = book.chapters; const txt = (c: typeof c1) => c.blocks.map(b => (b as any).text);
    expect(txt(c1)[0]).toBe('비가 그친 골목에는 젖은 흙냄새가 남아 있었다. 수호는 대답 대신 우산을 접어 문 옆에 세워 두었다. 창밖으로 가로등이 하나둘 켜지기 시작했다.');
    expect(txt(c1).slice(1, 3)).toEqual(['“늦었네. 오래 기다렸는데.”', '“미안해. 길이 많이 막혀서.”']);
    expect(c1.blocks.map(b => b.type)).toEqual(['p', 'p', 'p', 'p', 'scene', 'p', 'p', 'p']);
    expect(txt(c1)[4]).toBe('***');                                                           // 장면 구분도 원문 그대로
    expect(txt(c1)[5]).toContain('한참을 서 있었다');                                         // 쪽을 넘어가는 문단이 이어 붙는다
    expect(txt(c1)[5]).toContain('지워지지 않았다.');
    expect(c2.blocks.map(b => b.type)).toEqual(['p', 'p', 'p']);
    expect([...txt(c1), ...txt(c2)].some(t => /^\d$/.test(t))).toBe(false);                   // 쪽 번호는 본문에 섞이지 않는다
    expect(book.chapters[0].charCount).toBeGreaterThan(100);
  });
  it('글자가 없는 PDF(스캔본)는 친절한 오류', async () => {
    const page = { getTextContent: async () => ({ items: [] }), cleanup() {} };
    mockState.fake = { getDocument: () => ({ promise: Promise.resolve({ numPages: 1, getPage: async () => page, getMetadata: async () => ({ info: {} }) }), destroy: async () => {} }) };
    try { await expect(pdfParser.parse(buf('test/fixtures/sample-ko.pdf'), 'scan.pdf')).rejects.toThrow('스캔'); } finally { mockState.fake = null; }
  });
});

describe('linesToParagraphs (줄 → 문단 규칙)', () => {
  it('들여쓰기로 시작한 줄은 새 문단, 이어지는 줄은 같은 문단', () => {
    const p = linesToParagraphs([[L('첫 줄이다', 20, 200, 300), L('둘째 줄이다.', 10, 186, 120), L('새 문단이다.', 20, 172, 140)]]);
    expect(p).toEqual(['첫 줄이다 둘째 줄이다.', '새 문단이다.']);
  });
  it('들여쓰기 없는 PDF: 문장이 끝난 짧은 줄 뒤, 또는 문장 끝 뒤 따옴표로 시작하는 줄은 새 문단', () => {
    const p = linesToParagraphs([[L('그는 문을 열었다. 아무도 없었다.', 10, 200, 300), L('“누구 있어요?”', 10, 186, 120), L('대답이 없었다.', 10, 172, 100), L('그가 한 발짝 들어서자 바닥이 삐걱거렸다.', 10, 158, 300)]]);
    expect(p).toEqual(['그는 문을 열었다. 아무도 없었다.', '“누구 있어요?”', '대답이 없었다.', '그가 한 발짝 들어서자 바닥이 삐걱거렸다.']);
  });
  it('줄 간격이 넓으면 새 문단, 쪽 맨 아래 숫자는 쪽 번호로 보고 버린다', () => {
    const p = linesToParagraphs([[L('첫 줄이 이어진다', 10, 200, 300), L('둘째 줄이 이어진다', 10, 186, 300), L('셋째 줄이 끝난다', 10, 172, 300), L('빈 줄 뒤 문단', 10, 122, 300), L('7', 150, 20, 156)]]);
    expect(p).toEqual(['첫 줄이 이어진다 둘째 줄이 이어진다 셋째 줄이 끝난다', '빈 줄 뒤 문단']);
  });
  it('빈 입력', () => { expect(linesToParagraphs([])).toEqual([]); });
});

describe('줄바꿈 자리 공백 (글자 단위 줄바꿈 PDF) · 회차/묶음 제목', () => {
  const SENT = ['영원은 도현의 어깨를 흔들었다.', '도현이 눈꺼풀을 천천히 들어 올렸다.', '촬영장에는 이미 사람들이 가득 모여 있었다.', '메이크업을 받는 내내 졸았다고 말했다.', '긴 팔다리 때문에 소파가 불편해 보였다.', '정작 본인은 아무렇지도 않은 모양이었다.'];
  const paras = Array.from({ length: 40 }, (_, i) => [0, 1, 2].map(k => SENT[(i + k * 2) % SENT.length]).join(' '));
  const lay = (wrap: (t: string) => string[]): PdfLine[][] => {           // 문단들을 줄로 펼친다(첫 줄 들여쓰기 10)
    let y = 800; const lines: PdfLine[] = [];
    for (const p of paras) { wrap(p).forEach((t, k) => { lines.push({ text: t, x: k === 0 ? 20 : 10, y, right: 210, size: 10 }); y -= 14; }); y -= 14; }
    return [lines];
  };
  it('글자 단위로 줄이 끊긴 PDF: 단어 중간의 공백이 생기지 않는다', () => {
    const chars = (t: string) => { const out: string[] = []; for (let i = 0; i < t.length; i += 14) out.push(t.slice(i, i + 14).replace(/^\s+/, '')); return out; };
    const got = linesToParagraphs(lay(chars));
    const exact = got.filter((g, i) => g === paras[i]).length;
    expect(got.length).toBe(paras.length); expect(exact / paras.length).toBeGreaterThanOrEqual(0.8);
    expect(got.join('\n')).not.toContain('팔다 리'); expect(got.join('\n')).not.toContain('메이크 업');
  });
  it('낱말 단위로 줄이 바뀌는 PDF: 줄 사이에는 지금처럼 공백', () => {
    const words = (t: string) => { const out: string[] = []; let cur = ''; for (const w of t.split(' ')) { if ((cur + ' ' + w).trim().length > 14 && cur) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); } if (cur) out.push(cur); return out; };
    expect(linesToParagraphs(lay(words))).toEqual(paras);
  });
  it('Track 회차 제목 + ALBUM 묶음 제목은 그 회차의 첫 줄(소제목)로', async () => {
    const mk = (str: string, x: number, y: number) => ({ str, transform: [1, 0, 0, 10, x, y], width: str.length * 10, height: 10 });
    const body = (y: number, a: string) => [mk(a, 95, y), mk('두 번째 줄은 들여쓰기 없이 이어진다.', 85, y - 14)];
    const items = [mk('Track 08. Back to You', 95, 700), ...body(660, '여덟 번째 트랙의 본문이 여기에서 시작되었다.'), mk('SECOND ALBUM <Us, as Usual>', 95, 600), mk('Track 09. 174', 95, 570), ...body(530, '아홉 번째 트랙의 본문이 여기에서 시작되었다.')];
    const page = { getTextContent: async () => ({ items }), cleanup() {} };
    mockState.fake = { getDocument: () => ({ promise: Promise.resolve({ numPages: 1, getPage: async () => page, getMetadata: async () => ({ info: {} }) }), destroy: async () => {} }) };
    try {
      const book = await pdfParser.parse(buf('test/fixtures/sample-ko.pdf'), 'x.pdf');
      expect(book.chapters.map(c => c.title)).toEqual(['Track 08. Back to You', 'Track 09. 174']);
      expect(book.chapters[1].blocks[0]).toEqual({ type: 'h', text: 'SECOND ALBUM <Us, as Usual>' });
      expect(book.chapters[0].blocks.some(b => (b as any).text?.includes('ALBUM'))).toBe(false);
      expect(book.parserVersion).toBe(2);
    } finally { mockState.fake = null; }
  });
});
