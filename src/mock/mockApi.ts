import { mockAuthors, mockBook, mockBooks, mockStates } from './data';

/** 목록 화면 확인용 가짜 Api(서버 호출 없음). empty=true 이면 원고 0개 */
export function createMockApi(opts: { empty?: boolean } = {}): any {
  const list = opts.empty ? [] : mockBooks;
  return {
    books: {
      list: async () => list, authors: async () => mockAuthors, assignments: async () => [], myAssignments: async () => list.map(b => ({ book_id: b.id, allow_copy: false, enabled: true })),
      get: async (id: string) => mockBook(id), assign: async () => {}, updateAssign: async () => {}, unassign: async () => {}, addAuthor: async () => {}, remove: async () => {}, upload: async () => 'x', uploadRevision: async () => 2,
    },
    repo: { listStates: async () => (opts.empty ? [] : mockStates), getState: async () => null, saveState: async () => {}, listAnnotations: async () => [], saveAnnotation: async () => {}, deleteAnnotation: async () => {}, listBookmarks: async () => [], saveBookmark: async () => {}, deleteBookmark: async () => {} },
  };
}
