import type { Book, Parser } from '../core/model';
import { fileId } from '../core/hash';
import { docxParser } from './docx';
import { epubParser } from './epub';
import { hwpxParser } from './hwpx';
import { hwpParser } from './hwp';

// 포맷 추가 = 파서 구현 후 이 배열에 1줄 추가 
const PARSERS: Parser[] = [epubParser, docxParser, hwpxParser, hwpParser];
export const SUPPORTED = ['epub', 'docx', 'hwpx', 'hwp'];

export async function parseFile(file: { name: string; arrayBuffer(): Promise<ArrayBuffer> }): Promise<Book> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const parser = PARSERS.find(p => p.extensions.includes(ext));
  if (!parser) throw new Error(`지원하지 않는 형식: .${ext}`);
  const data = await file.arrayBuffer();
  return { ...(await parser.parse(data, file.name)), id: await fileId(data), addedAt: Date.now() };
}
