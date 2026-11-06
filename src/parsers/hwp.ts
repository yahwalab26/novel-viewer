import type { Block, Parser } from '../core/model';
import { SCENE_RE, splitByPattern } from '../core/chapters';

// HWP 5.x(구형 바이너리) = OLE(CFB) 컨테이너.
//  FileHeader(플래그) · \u0005HwpSummaryInformation(제목/작성자) · BodyText/Section<N>(본문, 대개 raw deflate 압축)
// 본문 스트림은 [헤더 4바이트(태그 10bit·레벨 10bit·크기 12bit)] + 데이터 레코드의 나열.
//  PARA_HEADER(0x42)가 문단 시작, PARA_TEXT(0x43)가 UTF-16LE 텍스트(제어문자 포함).
// 머리말/꼬리말/각주/미주(CTRL_HEADER 아래 하위 레코드)와 이미지는 무시한다. 표·글상자 속 문단은 이어 붙인다.
const TAG_PARA_HEADER = 0x42, TAG_PARA_TEXT = 0x43, TAG_CTRL_HEADER = 0x47;
const id4 = (s: string) => ((s.charCodeAt(0) << 24) | (s.charCodeAt(1) << 16) | (s.charCodeAt(2) << 8) | s.charCodeAt(3)) >>> 0;
const SKIP_CTRL = new Set(['head', 'foot', 'fn  ', 'en  '].map(id4));                 // 머리말·꼬리말·각주·미주
// 제어문자 중 "코드 + 7개 WCHAR 데이터"(총 16바이트)를 차지하는 것들 (HWP 5.0 문서 형식 '표 6')
const WIDE = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]);

export interface HwpRecord { tag: number; level: number; data: Uint8Array }
export function* records(buf: Uint8Array): Generator<HwpRecord> {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  for (let p = 0; p + 4 <= buf.length;) {
    const h = dv.getUint32(p, true); p += 4;
    let size = h >>> 20;
    if (size === 0xfff) { if (p + 4 > buf.length) return; size = dv.getUint32(p, true); p += 4; }
    yield { tag: h & 0x3ff, level: (h >>> 10) & 0x3ff, data: buf.subarray(p, p + size) };
    p += size;
  }
}

export function decodeParaText(d: Uint8Array): string {
  const dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
  let out = '';
  for (let i = 0; i + 1 < d.length;) {
    const c = dv.getUint16(i, true);
    if (c >= 32) { out += String.fromCharCode(c); i += 2; }               // 서로게이트 쌍도 코드유닛 그대로 이어 붙이면 복원됨
    else if (WIDE.has(c)) { if (c === 9) out += '\t'; i += 16; }          // 탭·구역정의·필드·그림/표 위치표시 등
    else { if (c === 10) out += '\n'; else if (c === 30 || c === 31) out += ' '; else if (c === 24) out += '-'; i += 2; }   // 13(문단 끝)은 버림
  }
  return out;
}

/** 한 구역(Section) 스트림 → 문단 텍스트 목록 */
export function sectionParagraphs(sec: Uint8Array): string[] {
  const out: string[] = []; let cur: string | null = null; let skipLevel = -1;
  const flush = () => { if (cur !== null) out.push(cur); cur = null; };
  for (const r of records(sec)) {
    if (skipLevel >= 0) { if (r.level > skipLevel) continue; skipLevel = -1; }
    if (r.tag === TAG_CTRL_HEADER && r.data.length >= 4 && SKIP_CTRL.has(new DataView(r.data.buffer, r.data.byteOffset, 4).getUint32(0, true))) { skipLevel = r.level; continue; }
    if (r.tag === TAG_PARA_HEADER) { flush(); cur = ''; }
    else if (r.tag === TAG_PARA_TEXT && cur !== null) cur += decodeParaText(r.data);
  }
  flush();
  return out;
}

/** OLE 속성집합(HwpSummaryInformation)에서 제목·작성자 */
export function readSummary(buf: Uint8Array): { title?: string; author?: string } {
  try {
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const sec = dv.getUint32(44, true), count = dv.getUint32(sec + 4, true), res: Record<number, string> = {};
    for (let k = 0; k < count; k++) {
      const pid = dv.getUint32(sec + 8 + k * 8, true), off = sec + dv.getUint32(sec + 12 + k * 8, true);
      const type = dv.getUint32(off, true), len = dv.getUint32(off + 4, true);
      if (type === 0x1f) res[pid] = new TextDecoder('utf-16le').decode(buf.subarray(off + 8, off + 8 + len * 2)).replace(/\0+$/, '');
      else if (type === 0x1e) res[pid] = new TextDecoder('euc-kr').decode(buf.subarray(off + 8, off + 8 + len)).replace(/\0+$/, '');
    }
    return { title: res[2]?.trim() || undefined, author: res[4]?.trim() || undefined };
  } catch { return {}; }
}

/** cfb 라이브러리는 환경에 따라 content 를 Uint8Array 또는 일반 배열로 돌려준다 */
const bytesOf = (x: unknown): Uint8Array | undefined => (x == null ? undefined : x instanceof Uint8Array ? x : Uint8Array.from(x as ArrayLike<number>));

export const hwpParser: Parser = {
  format: 'hwp', extensions: ['hwp'],
  async parse(data, fileName) {
    const [CFB, { inflateSync }] = await Promise.all([import('cfb'), import('fflate')]);   // HWP를 쓸 때만 내려받는다
    let cfb;
    try { cfb = CFB.read(new Uint8Array(data), { type: 'array' }); } catch { throw new Error('HWP: 올바른 HWP 5.x 파일이 아닙니다(구버전 HWP 3.0/97 또는 손상된 파일일 수 있어요)'); }
    const fh = bytesOf(CFB.find(cfb, '/FileHeader')?.content);
    if (!fh || fh.length < 40 || new TextDecoder().decode(fh.subarray(0, 17)) !== 'HWP Document File') throw new Error('HWP: 올바른 HWP 5.x 파일이 아닙니다');
    const flags = new DataView(fh.buffer, fh.byteOffset, fh.byteLength).getUint32(36, true);
    if (flags & 0x2) throw new Error('HWP: 암호가 걸린 문서입니다. 암호를 해제하고 저장한 뒤 다시 올려주세요');
    if (flags & 0x4) throw new Error('HWP: 배포용(복사 제한) 문서는 읽을 수 없습니다. 한글에서 일반 문서로 저장하거나 HWPX로 저장해 주세요');
    if (flags & 0x10) throw new Error('HWP: DRM이 적용된 문서는 읽을 수 없습니다');
    const compressed = !!(flags & 0x1);

    const names = cfb.FullPaths.filter((p: string) => /^(Root Entry)?\/BodyText\/Section\d+$/i.test(p)).sort((a: string, b: string) => parseInt(a.match(/(\d+)$/)![1]) - parseInt(b.match(/(\d+)$/)![1]));
    if (!names.length) throw new Error('HWP: 본문(BodyText)을 찾을 수 없습니다');

    const blocks: Block[] = [];
    for (const n of names) {
      let bytes = bytesOf(CFB.find(cfb, n.replace(/^Root Entry/, ''))?.content); if (!bytes) continue;
      if (compressed) { try { bytes = inflateSync(bytes); } catch { throw new Error('HWP: 본문 압축을 해제하지 못했습니다(손상된 파일일 수 있어요)'); } }
      for (const raw of sectionParagraphs(bytes)) {
        const text = raw.replace(/\s+$/, '');
        if (!text.trim()) continue;
        blocks.push(SCENE_RE.test(text) ? { type: 'scene' } : { type: 'p', text });
      }
    }
    const sum = readSummary(bytesOf(CFB.find(cfb, '/\u0005HwpSummaryInformation')?.content) ?? new Uint8Array(0));
    const title = sum.title || fileName.replace(/\.hwp$/i, '');
    return { title, author: sum.author, format: 'hwp', parserVersion: 1, chapters: splitByPattern(blocks, title) };
  },
};
