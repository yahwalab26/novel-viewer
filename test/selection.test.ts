// @vitest-environment jsdom
import { it, expect, beforeEach } from 'vitest';
import { readSelection } from '../src/viewer/selection';

let root: HTMLElement;
beforeEach(() => {
  document.body.innerHTML = '<div id="r"><h2>1화</h2><p data-i="0">가나다라마</p><p data-i="1">바사아자차</p><p data-i="2">카타파하</p></div>';
  root = document.getElementById('r')!;
});
const select = (n1: Node, o1: number, n2: Node, o2: number) => {
  const sl = window.getSelection()!; sl.removeAllRanges(); const r = document.createRange(); r.setStart(n1, o1); r.setEnd(n2, o2); sl.addRange(r); return sl;
};
const t = (i: number) => root.querySelectorAll('p')[i].firstChild!;

it('한 문단 안 드래그', () => {
  const p = readSelection(root, select(t(0), 1, t(0), 3))!;
  expect(p).toMatchObject({ i: 0, start: 1, end: 3, quote: '나다', clamped: false });
});
it('PC 드래그가 다음 문단 시작(오프셋 0)에서 끝나도 첫 문단으로 인식 (이전 버그)', () => {
  const p = readSelection(root, select(t(0), 2, t(1), 0))!;
  expect(p).toMatchObject({ i: 0, start: 2, end: 5, quote: '다라마', clamped: false });
});
it('문단 전체(트리플 클릭) 선택', () => {
  const p = readSelection(root, select(root.querySelectorAll('p')[0], 0, root.querySelectorAll('p')[1], 0))!;
  expect(p).toMatchObject({ i: 0, start: 0, end: 5, clamped: false });
});
it('컨테이너(여백)에서 끝나는 드래그', () => {
  const p = readSelection(root, select(t(1), 2, root, 4))!;
  expect(p).toMatchObject({ i: 1, start: 2, quote: '아자차' });
});
it('여러 문단에 걸치면 첫 문단만, clamped 표시', () => {
  const p = readSelection(root, select(t(0), 3, t(2), 2))!;
  expect(p).toMatchObject({ i: 0, start: 3, end: 5, clamped: true });
});
it('제목만 선택하면 null', () => {
  expect(readSelection(root, select(root.querySelector('h2')!.firstChild!, 0, root.querySelector('h2')!.firstChild!, 2))).toBeNull();
});
