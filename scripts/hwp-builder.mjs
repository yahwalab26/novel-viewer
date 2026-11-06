// 테스트·샘플용 가상 HWP 5.x 생성기 (실제 한글 파일 구조를 최소한으로 흉내냄). 저장소에는 가상 파일만 둔다.
import CFB from 'cfb';
import { deflateRawSync } from 'node:zlib';

const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; };
export const utf16 = s => Buffer.from(s, 'utf16le');
/** 레코드: 헤더(태그10·레벨10·크기12비트, 크기 4095 이상이면 확장) + 데이터 */
export function rec(tag, level, data) {
  const big = data.length >= 0xfff;
  return Buffer.concat([u32((tag & 0x3ff) | ((level & 0x3ff) << 10) | ((big ? 0xfff : data.length) << 20)), big ? u32(data.length) : Buffer.alloc(0), data]);
}
export const TAG = { paraHeader: 0x42, paraText: 0x43, ctrlHeader: 0x47, listHeader: 0x48 };
/** 8 WCHAR(16바이트)를 차지하는 확장/인라인 제어문자 (예: 2=구역정의, 11=표/그림 위치, 9=탭) */
export const wide = code => String.fromCharCode(code, 0, 0, 0, 0, 0, 0, code);
/** 문단 하나: PARA_HEADER + PARA_TEXT(끝에 문단끝 0x0D) + 추가 레코드(컨트롤 등) */
export const para = (text, { level = 0, extra = [] } = {}) =>
  Buffer.concat([rec(TAG.paraHeader, level, Buffer.alloc(22)), rec(TAG.paraText, level + 1, utf16(text + '\r')), ...extra]);
/** 컨트롤 헤더: 4글자 ID는 'head' 같은 이름을 정수로 묶어 little-endian 으로 저장 */
export const ctrl = (id, level) => rec(TAG.ctrlHeader, level, u32(((id.charCodeAt(0) << 24) | (id.charCodeAt(1) << 16) | (id.charCodeAt(2) << 8) | id.charCodeAt(3)) >>> 0));
export const list = level => rec(TAG.listHeader, level, Buffer.alloc(6));

function summary(title, author) {
  const vals = [[2, title], [4, author]].filter(([, v]) => v);
  const head = Buffer.concat([Buffer.from([0xfe, 0xff, 0, 0]), u32(0), Buffer.alloc(16), u32(1), Buffer.alloc(16), u32(48)]);   // 속성집합 헤더 + FMTID + 구역 오프셋(48)
  let off = 8 + vals.length * 8; const table = [], data = [];
  for (const [pid, v] of vals) {
    const s = utf16(v + '\0'), pad = (4 - (s.length % 4)) % 4, body = Buffer.concat([u32(0x1f), u32(v.length + 1), s, Buffer.alloc(pad)]);
    table.push(Buffer.concat([u32(pid), u32(off)])); data.push(body); off += body.length;
  }
  return Buffer.concat([head, u32(off), u32(vals.length), ...table, ...data]);
}

/** sections: 구역별 레코드 Buffer 배열. flags: 1=압축 2=암호 4=배포용 16=DRM */
export function buildHwp({ sections, flags = 1, title, author, signature = 'HWP Document File' }) {
  const fh = Buffer.alloc(256); fh.write(signature, 0, 'ascii'); fh.writeUInt32LE(0x05000300, 32); fh.writeUInt32LE(flags, 36);
  const cfb = CFB.utils.cfb_new();
  CFB.utils.cfb_add(cfb, '/FileHeader', fh);
  if (title || author) CFB.utils.cfb_add(cfb, '/\u0005HwpSummaryInformation', summary(title, author));
  sections.forEach((s, i) => CFB.utils.cfb_add(cfb, `/BodyText/Section${i}`, flags & 1 ? deflateRawSync(s) : s));
  return Buffer.from(CFB.write(cfb, { type: 'buffer' }));
}
