import { useEffect, type RefObject } from 'react';

/** 아이폰 사파리는 키보드가 올라와도 '레이아웃 화면'을 줄이지 않고 보이는 영역(visualViewport)만 줄인다.
 *  그래서 화면 아래에 붙은 패널(메모·검색)이 키보드 뒤로 숨는다. 키보드 높이를 CSS 변수 --kb 로 알려 주어
 *  패널을 키보드 바로 위로 올린다. (--vvh = 키보드 위에 남은 높이) */
export function useKeyboardInset(ref: RefObject<HTMLElement>) {
  useEffect(() => {
    const vv = window.visualViewport; const el = ref.current;
    if (!vv || !el) return;
    const apply = () => {
      const kb = Math.round(window.innerHeight - vv.height - vv.offsetTop);
      const open = kb > 80 && vv.scale <= 1.01;          // 주소창 변화·손가락 확대는 키보드가 아니다
      el.style.setProperty('--kb', open ? `${kb}px` : '0px');
      el.style.setProperty('--vvh', open ? `${Math.round(vv.height)}px` : '100%');
      if (open) el.setAttribute('data-kb', '1'); else el.removeAttribute('data-kb');
    };
    apply(); vv.addEventListener('resize', apply); vv.addEventListener('scroll', apply);
    return () => {
      vv.removeEventListener('resize', apply); vv.removeEventListener('scroll', apply);
      el.style.removeProperty('--kb'); el.style.removeProperty('--vvh'); el.removeAttribute('data-kb');
    };
  }, [ref]);
}
