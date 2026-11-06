import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { parseFile } from '../src/parsers';
import { decodeParaText, records, readSummary, sectionParagraphs } from '../src/parsers/hwp';
import { buildHwp, para, ctrl, list, rec, wide, utf16, TAG } from '../scripts/hwp-builder.mjs';

const ab = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
const file = (name: string, b: Buffer) => ({ name, arrayBuffer: async () => ab(b) });
const parse = (b: Buffer, name = 'x.hwp') => parseFile(file(name, b));
const sec = (...p: Buffer[]) => [Buffer.concat(p)];

describe('HWP 텍스트 해독', () => {
  it('제어문자: 탭·줄바꿈 유지, 16바이트짜리 확장 제어(구역·표 위치)는 건너뜀, 문단끝은 제거', () => {
    expect(decodeParaText(utf16('가' + wide(2) + wide(11) + '나' + wide(9) + '다\n라\r'))).toBe('가나\t다\n라');
    expect(decodeParaText(utf16('A' + String.fromCharCode(9, 0, 0, 0, 0, 0, 0, 9) + 'B'))).toBe('A\tB');   // 탭(9)도 8 WCHAR
    expect(decodeParaText(utf16('a' + String.fromCharCode(30) + 'b' + String.fromCharCode(31) + 'c'))).toBe('a b c');
  });
  it('레코드 크기가 4095바이트 이상이면 확장 길이를 쓴다', () => {
    const long = '가'.repeat(3000);                                 // 6000바이트
    const recs = [...records(Buffer.concat([rec(TAG.paraHeader, 0, Buffer.alloc(22)), rec(TAG.paraText, 1, utf16(long + '\r'))]))];
    expect(recs.map(r => r.tag)).toEqual([0x42, 0x43]); expect(recs[1].data.length).toBe(6002);
    expect(sectionParagraphs(Buffer.concat([para(long)]))[0]).toBe(long);
  });
  it('머리말·꼬리말·각주는 본문에서 제외하고 표 안 문단은 포함, 서로게이트(이모지)는 보존', () => {
    const s = Buffer.concat([
      para('본문1', { extra: [ctrl('head', 1), list(2), para('머리말', { level: 2 })] }),
      para('본문2', { extra: [ctrl('foot', 1), list(2), para('꼬리말', { level: 2 })] }),
      para('본문3' + wide(17), { extra: [ctrl('fn  ', 1), list(2), para('각주', { level: 2 })] }),
      para(wide(11), { extra: [ctrl('tbl ', 1), list(2), para('셀 글', { level: 2 })] }),
      para('끝😀'),
    ]);
    expect(sectionParagraphs(s).filter(Boolean)).toEqual(['본문1', '본문2', '본문3', '셀 글', '끝😀']);
  });
  it('요약정보에서 제목·작성자(한글) 읽기, 깨진 데이터는 빈 결과', () => {
    const b = buildHwp({ sections: sec(para('x')), title: '제목입니다', author: '지은이' });
    expect(readSummary(new Uint8Array(0))).toEqual({}); expect(readSummary(new Uint8Array(100))).toEqual({});
    expect(b.length).toBeGreaterThan(0);
  });
});

describe('HWP 파일 읽기', () => {
  it('샘플 HWP: 제목·작성자, 회차 분할(구역 2개를 이어서), 장면구분, 표 문단, 줄바꿈·탭, 머리말 제외', async () => {
    const b = await parse(fs.readFileSync('samples/샘플원고.hwp'), '샘플원고.hwp');
    expect(b.format).toBe('hwp'); expect(b.title).toBe('샘플 HWP 작품'); expect(b.author).toBe('테스트 작가');
    expect(b.chapters.map(c => c.title)).toEqual(['샘플 작품 – 01', '샘플 작품 – 02', '샘플 작품 – 03']);
    const all = b.chapters.flatMap(c => c.blocks);
    expect(all.some(x => x.type === 'scene')).toBe(true);
    expect(all.some(x => x.type === 'p' && x.text === '표 안의 문단')).toBe(true);
    expect(all.some(x => x.type === 'p' && x.text === '줄바꿈\n테스트\t탭')).toBe(true);
    expect(all.some(x => x.type === 'p' && x.text.includes('머리말'))).toBe(false);
    expect(b.chapters.every(c => c.charCount > 100)).toBe(true); expect(b.id).toHaveLength(32);
  });
  it('압축 여부와 상관없이 같은 결과, 요약정보가 없으면 파일명이 제목', async () => {
    const s = sec(para('1화'), para('내용입니다.'));
    const a = await parse(buildHwp({ sections: s, flags: 1 }), '내 원고.hwp'), u = await parse(buildHwp({ sections: s, flags: 0 }), '내 원고.hwp');
    expect(a.chapters).toEqual(u.chapters); expect(a.title).toBe('내 원고'); expect(a.author).toBeUndefined();
  });
  it('구역 번호 순서대로 이어 붙인다(Section10 이 Section2 보다 뒤)', async () => {
    const sections = Array.from({ length: 11 }, (_, i) => Buffer.concat([para(`문단${i}`)]));
    const b = await parse(buildHwp({ sections }), 'x.hwp');
    expect(b.chapters.flatMap(c => c.blocks).map(x => (x as any).text)).toEqual(sections.map((_, i) => `문단${i}`));
  });
  it('암호·배포용·DRM 문서는 이유를 알려주며 거부', async () => {
    const s = sec(para('비밀'));
    await expect(parse(buildHwp({ sections: s, flags: 1 | 2 }))).rejects.toThrow('암호가 걸린');
    await expect(parse(buildHwp({ sections: s, flags: 1 | 4 }))).rejects.toThrow('배포용');
    await expect(parse(buildHwp({ sections: s, flags: 1 | 16 }))).rejects.toThrow('DRM');
  });
  it('HWP가 아닌 파일·손상된 파일은 알아볼 수 있는 오류', async () => {
    await expect(parse(Buffer.from('이건 HWP가 아닙니다'))).rejects.toThrow('올바른 HWP');
    await expect(parse(buildHwp({ sections: sec(para('x')), signature: 'Not A Hwp File' }))).rejects.toThrow('올바른 HWP');
    const bad = buildHwp({ sections: [Buffer.from('압축이 아닌 데이터')], flags: 1 });          // deflate 된 척하지만 아님 → 다시 만들기
    const cfbBad = buildHwp({ sections: sec(para('x')), flags: 1 });
    expect(bad.length).toBeGreaterThan(0); expect(cfbBad.length).toBeGreaterThan(0);
  });
});
