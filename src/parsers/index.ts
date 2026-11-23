import type { Book, Parser } from '../core/model';
import { fileId } from '../core/hash';
import { docxParser } from './docx';
import { epubParser } from './epub';
import { hwpxParser } from './hwpx';
import { hwpParser } from './hwp';
import { pdfParser } from './pdf';

// 포맷 추가 = 파서 구현 후 이 배열에 1줄 추가 
const PARSERS: Parser[] = [epubParser, docxParser, hwpxParser, hwpParser, pdfParser];
export const SUPPORTED = ['epub', 'docx', 'hwpx', 'hwp', 'pdf'];

export async function parseFile(file: { name: string; arrayBuffer(): Promise<ArrayBuffer> }): Promise<Book> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const parser = PARSERS.find(p => p.extensions.includes(ext));
  if (!parser) throw new Error(`지원하지 않는 형식: .${ext}`);
  const data = await file.arrayBuffer();
  const book = await parser.parse(data, file.name);
  // 제목 = 파일명(확장자 제외). 파일 속 메타 제목은 쓰지 않는다. 회차가 1개뿐이라 옛 제목을 그대로 쓰던 경우도 함께 맞춘다.
  const title = file.name.replace(/\.[^.\\/]+$/, '').trim() || book.title;
  const chapters = book.chapters.map(c => (c.title === book.title ? { ...c, title } : c));
  return { ...book, title, chapters, id: await fileId(data), addedAt: Date.now() };
}
