// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Fragment } from 'react';
import { installProtection, filterAnns, isMine } from '../src/viewer/protect';
import { renderSegs, MemoSheet, NotesPanel } from '../src/viewer/AnnotationUI';
import type { Annotation, Book } from '../src/core/model';

const A = (o: Partial<Annotation>): Annotation => ({ id: 'x', bookId: 'b', authorId: 'me', chapterId: 'c0', blockIndex: 0, start: 0, end: 2, quote: '가나', color: 'yellow', createdAt: 1, updatedAt: 1, ...o });

describe('복사 방지', () => {
  it('복사·잘라내기·끌기·우클릭을 막고, 해제하면 원복. 선택(mouseup 등)은 막지 않음', () => {
    const el = document.createElement('div'); document.body.append(el);
    const off = installProtection(el);
    for (const t of ['copy', 'cut', 'dragstart', 'contextmenu']) { const e = new Event(t, { cancelable: true, bubbles: true }); el.dispatchEvent(e); expect(e.defaultPrevented, t).toBe(true); }
    const sel = new Event('selectstart', { cancelable: true, bubbles: true }); el.dispatchEvent(sel); expect(sel.defaultPrevented).toBe(false);   // 형광펜을 위해 선택은 허용
    off(); const e2 = new Event('copy', { cancelable: true, bubbles: true }); el.dispatchEvent(e2); expect(e2.defaultPrevented).toBe(false);
  });
});

describe('내 것 / 다른 작가 것 구분', () => {
  const list = [A({ id: '1', authorId: 'me' }), A({ id: '2', authorId: 'w1' }), A({ id: '3', authorId: 'w2' }), A({ id: '4', authorId: 'local' })];
  it('필터', () => {
    expect(filterAnns(list, 'all', 'me').map(a => a.id)).toEqual(['1', '2', '3', '4']);
    expect(filterAnns(list, 'mine', 'me').map(a => a.id)).toEqual(['1', '4']);
    expect(filterAnns(list, 'w1', 'me').map(a => a.id)).toEqual(['2']);
    expect(isMine(A({ authorId: 'w1' }), undefined)).toBe(true);                      // 로컬 모드(meId 없음)는 모두 내 것
  });
  it('다른 사람의 형광펜에만 other 표시', () => {
    const html = renderToStaticMarkup(<Fragment>{renderSegs('가나다라', [A({ id: 'm', authorId: 'me', start: 0, end: 2 }), A({ id: 'o', authorId: 'w1', start: 2, end: 4, quote: '다라', color: 'pink' })], 'me')}</Fragment>);
    expect(html).toMatch(/data-a="m" class="hl hl-yellow"/); expect(html).toMatch(/data-a="o" class="hl hl-pink other"/);
  });
  it('다른 사람 메모는 읽기 전용(저장·삭제 버튼 없음, 작성자명 표시)', () => {
    const h = renderToStaticMarkup(<MemoSheet ann={A({ authorId: 'w1', memo: '이 장면 수정 필요' })} isNew={false} readOnly authorName="김작가" onSave={() => {}} onDelete={() => {}} onClose={() => {}} />);
    expect(h).toContain('김작가의 메모'); expect(h).toContain('이 장면 수정 필요'); expect(h).not.toContain('저장'); expect(h).not.toContain('삭제'); expect(h).not.toContain('<textarea');
    const mine = renderToStaticMarkup(<MemoSheet ann={A({ memo: 'm' })} isNew={false} onSave={() => {}} onDelete={() => {}} onClose={() => {}} />);
    expect(mine).toContain('<textarea'); expect(mine).toContain('삭제');
  });
  it('메모 목록: 작가가 있으면 보기 필터와 작성자 표시', () => {
    const book: Book = { id: 'b', title: 't', format: 'docx', parserVersion: 1, addedAt: 0, chapters: [{ id: 'c0', title: '1화', blocks: [], charCount: 0 }] };
    const h = renderToStaticMarkup(<NotesPanel book={book} anns={[A({ id: '1' }), A({ id: '2', authorId: 'w1' })]} who="all" onWho={() => {}} meId="me" names={{ w1: '김작가' }} onGo={() => {}} onClose={() => {}} />);
    expect(h).toContain('내 것'); expect(h).toContain('김작가'); expect(h).toContain('byauthor');
    const only = renderToStaticMarkup(<NotesPanel book={book} anns={[A({ id: '1' })]} who="all" onWho={() => {}} meId="me" onGo={() => {}} onClose={() => {}} />);
    expect(only).not.toContain('whobar');                                              // 작가 본인 화면엔 필터 없음
  });
});
