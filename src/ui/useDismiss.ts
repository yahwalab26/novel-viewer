import { useEffect, type RefObject } from 'react';
/** 열린 팝업 바깥을 누르거나 Esc 를 누르면 닫는다(Esc 시 단추로 초점 복귀) */
export function useDismiss(open: boolean, close: () => void, box: RefObject<HTMLElement | null>, btn?: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) close(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { close(); btn?.current?.focus(); } };
    document.addEventListener('pointerdown', down); document.addEventListener('keydown', key);
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key); };
  }, [open, close, box, btn]);
}
