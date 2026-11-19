/** pdf.js 는 크기가 커서 PDF 를 가져올 때만 내려받는다(동적 import → 평소 앱 용량에 영향 없음). 테스트에서는 이 모듈을 대체한다. */
export async function loadPdfjs(): Promise<any> {
  const pdfjs: any = await import('pdfjs-dist');
  const worker: any = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}
