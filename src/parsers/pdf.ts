import type { Block, Parser } from '../core/model';
import { SCENE_RE, splitByPattern } from '../core/chapters';
import { loadPdfjs } from './pdfLoader';
import { itemsToLines, linesToParagraphs, type PdfLine } from './pdfText';

/** PDF 원고 → 글자만 뽑아 문단·회차로 다시 구성(다른 형식과 똑같이 읽는다). 스캔·이미지 PDF 는 글자가 없어 읽을 수 없다. */
export const pdfParser: Parser = {
  format: 'pdf', extensions: ['pdf'],
  async parse(data, fileName) {
    const pdfjs = await loadPdfjs();
    let doc: any; const task = pdfjs.getDocument({ data: new Uint8Array(data.slice(0)), isEvalSupported: false, disableFontFace: true, verbosity: 0 });   // 복사본을 넘긴다(워커로 넘어가면 원본 버퍼가 비워져 해시 계산이 깨짐)
    try { doc = await task.promise; }
    catch (e: any) { throw new Error(e?.name === 'PasswordException' ? 'PDF: 암호가 걸려 있어 열 수 없어요' : `PDF: 파일을 열 수 없어요 (${e?.message ?? e})`); }
    const pages: PdfLine[][] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n); const tc = await page.getTextContent();
      pages.push(itemsToLines(tc.items)); page.cleanup();
    }
    const paras = linesToParagraphs(pages);
    if (paras.join('').replace(/\s/g, '').length < 20) throw new Error('PDF: 읽을 수 있는 글자가 없어요 (스캔·이미지 PDF는 지원하지 않아요)');
    const blocks: Block[] = paras.map(t => SCENE_RE.test(t) ? { type: 'scene', text: t } : { type: 'p', text: t });
    const info = (await doc.getMetadata().catch(() => null))?.info ?? {};
    const clean = (s: unknown) => typeof s === 'string' && s.trim() && !/^(untitled|무제)/i.test(s.trim()) ? s.trim() : undefined;
    const title = clean(info.Title) || fileName.replace(/\.pdf$/i, '');
    await task.destroy?.();
    return { title, author: clean(info.Author), format: 'pdf', parserVersion: 1, chapters: splitByPattern(blocks, title) };
  },
};
