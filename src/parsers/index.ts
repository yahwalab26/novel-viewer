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

/** 배포 뒤에도 열려 있던 옛 화면이 사라진 조각 파일(JS)을 불러오려다 실패한 경우인지 */
export const isChunkError = (e: unknown) => /dynamically imported module|Importing a module script failed|Unable to preload CSS/i.test(String((e as Error)?.message ?? e));
/** 옛 앱 껍데기 캐시를 비워 다음 새로고침에서 새 버전을 받게 한다 */
async function refreshShell() {
  try {
    for (const k of await caches.keys()) await caches.delete(k);
    await (await navigator.serviceWorker?.getRegistration())?.update();
  } catch { /* 캐시 API 가 없거나 막힌 환경 */ }
}
export async function parseFile(file: { name: string; arrayBuffer(): Promise<ArrayBuffer> }): Promise<Book> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const parser = PARSERS.find(p => p.extensions.includes(ext));
  if (!parser) throw new Error(`지원하지 않는 형식: .${ext}`);
  const data = await file.arrayBuffer();
  let book;
  try { book = await parser.parse(data, file.name); }
  catch (e) {
    if (!isChunkError(e)) throw e;
    await refreshShell();
    throw new Error('앱이 새 버전으로 바뀌어 필요한 파일을 받지 못했어요. 화면을 새로고침(설치한 앱이면 완전히 닫았다 다시 열기)한 뒤 다시 올려 주세요');
  }
  // 제목 = 파일명(확장자 제외). 파일 속 메타 제목은 쓰지 않는다. 회차가 1개뿐이라 옛 제목을 그대로 쓰던 경우도 함께 맞춘다.
  const title = file.name.replace(/\.[^.\\/]+$/, '').trim() || book.title;
  const chapters = book.chapters.map(c => (c.title === book.title ? { ...c, title } : c));
  return { ...book, title, chapters, id: await fileId(data), addedAt: Date.now() };
}
