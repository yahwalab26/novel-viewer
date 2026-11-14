import { useLayoutEffect, useState, type RefObject } from 'react';

interface Rect { top: number; bottom: number; left: number; right: number }
/** 메뉴 상자가 화면(브라우저 창) 밖으로 잘리지 않도록 위치를 정한다: 아래에 안 들어가면 위로, 오른쪽으로 넘치면 오른쪽 끝에 맞춤 */
export function placeMenu(btn: Rect, menu: { w: number; h: number }, vp: { w: number; h: number }, gap = 6, edge = 8): { up: boolean; right: boolean } {
  const below = vp.h - btn.bottom - gap - edge, above = btn.top - gap - edge;
  return { up: menu.h > below && above > below, right: btn.left + menu.w > vp.w - edge };
}
export function useMenuPlacement(open: boolean, btn: RefObject<HTMLElement | null>, menu: RefObject<HTMLElement | null>) {
  const [pos, setPos] = useState({ up: false, right: false });
  useLayoutEffect(() => {                         // 그려지기 전에 계산해서 깜빡임 없이 자리 잡는다
    if (!open || !btn.current || !menu.current) return;
    setPos(placeMenu(btn.current.getBoundingClientRect(), { w: menu.current.offsetWidth, h: menu.current.offsetHeight }, { w: window.innerWidth, h: window.innerHeight }));
  }, [open, btn, menu]);
  return pos;
}
