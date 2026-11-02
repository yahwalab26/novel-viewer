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

// HWPX (가상): 한컴 구조를 흉내낸 최소 파일. 표 속 문단, 줄바꿈, 개요 스타일, "– 01" 제목 포함
const HP = (t, style = 0) => `<hp:p id="0" paraPrIDRef="0" styleIDRef="${style}"><hp:run charPrIDRef="0"><hp:t>${esc(t)}</hp:t></hp:run><hp:linesegarray><hp:lineseg textpos="0"/></hp:linesegarray></hp:p>`;
let h = `<hp:p id="0" paraPrIDRef="0" styleIDRef="0"><hp:run charPrIDRef="0"><hp:secPr/><hp:ctrl><hp:colPr/></hp:ctrl></hp:run></hp:p>`;
[['샘플 작품 – 01', 12], ['샘플 작품 – 02', 15], ['샘플 작품 – 03', 13]].forEach(([t, n], k) => {
  h += HP(t) + HP('') + HP('');
  body(n).forEach((p, i) => { h += p === null ? HP('***') : HP(p); if (i % 2) h += HP(''); });
  if (k === 0) h += `<hp:p id="0" styleIDRef="0"><hp:run><hp:tbl><hp:tr><hp:tc><hp:subList>${HP('표 안의 문단')}</hp:subList></hp:tc></hp:tr></hp:tbl></hp:run></hp:p>`;
  if (k === 1) h += `<hp:p id="0" styleIDRef="0"><hp:run><hp:t>줄바꿈<hp:lineBreak/>테스트</hp:t></hp:run></hp:p>`;
});
const NS = 'xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:opf="http://www.idpf.org/2007/opf/"';
const xz = new JSZip(); xz.file('mimetype', 'application/hwp+zip', { compression: 'STORE' });
xz.file('Contents/content.hpf', `<?xml version="1.0"?><opf:package ${NS}><opf:metadata><opf:title>샘플 HWPX 작품</opf:title><opf:meta name="creator" content="text">테스트 작가</opf:meta></opf:metadata><opf:manifest><opf:item id="header" href="Contents/header.xml" media-type="application/xml"/><opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/></opf:manifest><opf:spine><opf:itemref idref="header"/><opf:itemref idref="section0"/></opf:spine></opf:package>`);
xz.file('Contents/header.xml', `<?xml version="1.0"?><hh:head ${NS}><hh:styles><hh:style id="0" type="PARA" name="바탕글"/><hh:style id="2" type="PARA" name="개요 1"/></hh:styles></hh:head>`);
xz.file('Contents/section0.xml', `<?xml version="1.0" encoding="UTF-8"?><hs:sec ${NS}>${h}</hs:sec>`);
fs.writeFileSync('samples/샘플원고.hwpx', await xz.generateAsync({ type: 'nodebuffer' }));
