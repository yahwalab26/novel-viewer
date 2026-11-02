import JSZip from 'jszip'; import fs from 'fs';
const S = ['비가 그친 골목에는 젖은 흙냄새가 남아 있었다.', '"늦었네. 오래 기다렸는데."', '수호는 대답 대신 우산을 접어 문 옆에 세워 두었다.', '창밖으로 가로등이 하나둘 켜지기 시작했다. 어디선가 낮은 종소리가 들렸다.', '"괜찮아. 이야기는 천천히 해도 되니까."', '그는 잠시 숨을 고르고 오래 묵혀 둔 말을 꺼내기 시작했다.', '찻잔에서 올라온 김이 둘 사이에서 천천히 흩어졌다.'];
const chapters = [['1화 첫 만남', 14], ['2화 어긋난 약속', 18], ['3화 비 오는 밤', 16]];
const body = n => Array.from({ length: n }, (_, i) => (i === 7 ? null : S[i % S.length] + (i % 3 === 0 ? ' 그리고 그 순간, 모든 것이 조용해졌다.' : '')));
const esc = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
// DOCX
const W = t => `<w:p><w:r><w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`;
let d = ''; for (const [t, n] of chapters) { d += W(t); for (const p of body(n)) d += p === null ? W('***') : W(p); }
const dz = new JSZip();
dz.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
dz.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
dz.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${d}</w:body></w:document>`);
fs.writeFileSync('samples/샘플원고.docx', await dz.generateAsync({ type: 'nodebuffer' }));
// EPUB
const ez = new JSZip(); ez.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
ez.file('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
let man = '', spine = '';
chapters.forEach(([t, n], i) => {
  ez.file(`OEBPS/c${i}.xhtml`, `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${t}</title></head><body><h2>${t}</h2>${body(n).map(p => p === null ? '<hr/>' : `<p>${esc(p)}</p>`).join('')}</body></html>`);
  man += `<item id="c${i}" href="c${i}.xhtml" media-type="application/xhtml+xml"/>`; spine += `<itemref idref="c${i}"/>`;
});
ez.file('OEBPS/content.opf', `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="2.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>샘플 작품</dc:title><dc:creator>테스트 작가</dc:creator><dc:identifier id="id">sample-1</dc:identifier><dc:language>ko</dc:language></metadata><manifest>${man}</manifest><spine>${spine}</spine></package>`);
fs.writeFileSync('samples/샘플작품.epub', await ez.generateAsync({ type: 'nodebuffer' }));
