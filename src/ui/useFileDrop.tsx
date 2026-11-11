import { useEffect, useRef, useState } from 'react';

/**
 * 화면 어디에 파일을 놓아도 받는다(목록 밖에 놓으면 브라우저가 파일을 그냥 열어 버리는 문제 방지).
 * 파일이 아닌 드래그(글자 끌기 등)는 무시. enabled=false 이면(읽는 중·창이 열려 있을 때) 아무것도 하지 않는다.
 */
export function useFileDrop(onFiles: (files: File[]) => void, enabled = true): boolean {
  const [dragging, setDragging] = useState(false);
  const cb = useRef(onFiles); cb.current = onFiles;
  useEffect(() => {
    if (!enabled) { setDragging(false); return; }
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');
    const enter = (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); depth++; setDragging(true); };
    const over = (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; };
    const leave = (e: DragEvent) => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (depth === 0) setDragging(false); };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return; e.preventDefault(); depth = 0; setDragging(false);
      const files = Array.from(e.dataTransfer?.files ?? []); if (files.length) cb.current(files);
    };
    const on: [string, (e: DragEvent) => void][] = [['dragenter', enter], ['dragover', over], ['dragleave', leave], ['drop', drop]];
    on.forEach(([n, f]) => window.addEventListener(n, f as EventListener));
    return () => { on.forEach(([n, f]) => window.removeEventListener(n, f as EventListener)); setDragging(false); };
  }, [enabled]);
  return dragging;
}

/** 파일을 끌고 있는 동안 화면 전체에 뜨는 안내 */
export function DropOverlay({ show, children }: { show: boolean; children: string }) {
  if (!show) return null;
  return <div className="drop-overlay" role="status" aria-live="polite"><div className="drop-box"><strong>{children}</strong><span>EPUB, DOCX, HWPX, HWP</span></div></div>;
}
