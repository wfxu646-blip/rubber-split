// 手机版：在画布上画老挝文单子（文字由系统字体排版），再拼成 A4 PDF。
// 手机浏览器的"打印"不可靠，所以自己生成 PDF。
(function () {
  'use strict';
  const C = window.Calc, Core = window.Core, L = Core.L;
  const W = 1240, H = 1754, M = 72;           // A4，150 dpi
  const CW = W - 2 * M;
  const FONT = '"Lao Sangam MN", "Lao MN", "Noto Sans Lao", "Phetsarath OT", "PingFang SC", "Helvetica Neue", sans-serif';

  function Doc() {
    this.pages = [];
    this.newPage();
  }
  Doc.prototype.newPage = function () {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    g.textBaseline = 'middle';
    this.pages.push(c);
    this.g = g;
    this.y = M;
  };
  Doc.prototype.ensure = function (h) { if (this.y + h > H - M - 30) this.newPage(); };
  Doc.prototype.font = function (size, bold) { this.g.font = `${bold ? 'bold ' : ''}${size}px ${FONT}`; };
  /** 写一段字，align: left/center/right；太长就截断加省略号。 */
  Doc.prototype.text = function (s, x, y, opts = {}) {
    const g = this.g;
    this.font(opts.size || 24, opts.bold);
    g.fillStyle = opts.color || '#000';
    g.textAlign = opts.align || 'left';
    let t = String(s);
    if (opts.max) {
      if (g.measureText(t).width > opts.max) {
        while (t.length > 1 && g.measureText(t + '…').width > opts.max) t = t.slice(0, -1);
        t += '…';
      }
    }
    g.fillText(t, x, y);
  };
  /** 自动换行写一段，返回用掉的高度。 */
  Doc.prototype.para = function (s, opts = {}) {
    const size = opts.size || 22, lh = Math.round(size * 1.6);
    this.font(size, opts.bold);
    const words = String(s).split(' ');
    const lines = []; let cur = '';
    for (const w of words) {
      const next = cur ? cur + ' ' + w : w;
      if (this.g.measureText(next).width > CW && cur) { lines.push(cur); cur = w; } else cur = next;
    }
    if (cur) lines.push(cur);
    for (const line of lines) {
      this.ensure(lh);
      this.text(line, M, this.y + lh / 2, opts);
      this.y += lh;
    }
  };
  Doc.prototype.rect = function (x, y, w, h, fill, stroke, lw) {
    const g = this.g;
    if (fill) { g.fillStyle = fill; g.fillRect(x, y, w, h); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 1.5; g.strokeRect(x + .5, y + .5, w, h); }
  };
  Doc.prototype.heading = function (s) {
    this.ensure(70);
    this.y += 18;
    this.text(s, M, this.y + 20, { size: 28, bold: true });
    this.y += 44;
    this.g.fillStyle = '#000'; this.g.fillRect(M, this.y, CW, 2.5);
    this.y += 12;
  };
  /** 表格。cols: [{t:'表头\n第二行', w, a:'l'|'c'|'r'}]；rows: 每行是字符串数组；foot: 合计行。 */
  Doc.prototype.table = function (cols, rows, foot) {
    const rh = 44, head = cols.some(c => c.t.includes('\n')) ? 70 : 48;
    const drawHead = () => {
      this.ensure(head + rh);
      let x = M;
      for (const c of cols) {
        this.rect(x, this.y, c.w, head, '#e9e9e9', '#555');
        const parts = c.t.split('\n');
        parts.forEach((p, i) => this.text(p, x + c.w / 2, this.y + head / 2 + (i - (parts.length - 1) / 2) * 26,
          { size: 20, bold: true, align: 'center', max: c.w - 8 }));
        x += c.w;
      }
      this.y += head;
    };
    const drawRow = (cells, opts = {}) => {
      if (this.y + rh > H - M - 30) { this.newPage(); drawHead(); }
      let x = M;
      cells.forEach((v, i) => {
        const c = cols[i];
        this.rect(x, this.y, c.w, rh, opts.fill || null, '#555');
        const a = c.a || 'l';
        const tx = a === 'r' ? x + c.w - 10 : a === 'c' ? x + c.w / 2 : x + 10;
        this.text(v, tx, this.y + rh / 2 + 1, { size: 22, bold: opts.bold || (c.bold && !!v), align: a === 'r' ? 'right' : a === 'c' ? 'center' : 'left', max: c.w - 16 });
        x += c.w;
      });
      this.y += rh;
    };
    drawHead();
    rows.forEach(r => drawRow(r));
    if (foot) drawRow(foot, { bold: true, fill: '#f2f2f2' });
  };
  Doc.prototype.boxes = function (items) {
    this.ensure(110);
    const gap = 14, w = (CW - gap * (items.length - 1)) / items.length;
    items.forEach(([k, v], i) => {
      const x = M + i * (w + gap);
      this.g.strokeStyle = '#000'; this.g.lineWidth = 2;
      roundRect(this.g, x, this.y, w, 96, 10); this.g.stroke();
      this.text(k, x + 16, this.y + 28, { size: 19, max: w - 30 });
      this.text(v, x + 16, this.y + 66, { size: 32, bold: true, max: w - 30 });
    });
    this.y += 112;
  };
  Doc.prototype.title = function (state, title, sub) {
    this.text(title, W / 2, this.y + 26, { size: 40, bold: true, align: 'center', max: CW });
    this.y += 62;
    if (state.settings.place) { this.text(state.settings.place, W / 2, this.y + 14, { size: 24, align: 'center', max: CW }); this.y += 38; }
    this.text(sub, W / 2, this.y + 14, { size: 24, align: 'center', max: CW });
    this.y += 46;
  };
  Doc.prototype.finish = function () {
    const n = this.pages.length;
    this.pages.forEach((c, i) => {
      const g = c.getContext('2d');
      g.font = `18px ${FONT}`; g.fillStyle = '#666'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(`${L.page} ${i + 1} / ${n}`, W / 2, H - M / 2);
    });
    return this.pages;
  };
  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  /** 一次卖胶的单子 */
  function saleSheet(state, sale) {
    const d = new Doc();
    const res = C.saleResult(sale);
    const owner = state.settings.ownerLabel || Core.DEFAULT_SETTINGS.ownerLabel;
    const name = l => Core.famName(state, l.familyId, l.name);
    d.title(state, state.settings.title || Core.DEFAULT_SETTINGS.title,
      `${L.date} ${C.fmtDate(sale.date)}  ·  ${L.saleNo} ${Core.saleNo(state, sale)} / ${String(sale.date).slice(0, 4)}  ·  ${L.price} ${C.fmtKip(sale.price)} ${L.perKg}`);
    d.boxes([
      [L.totalWeight, C.fmtKg(res.weightC) + ' kg'],
      [`${L.totalMoney} (${C.fmtKg(res.weightC)} × ${C.fmtKip(sale.price)})`, C.fmtKip(res.buyerMoney) + ' ' + L.kip],
      [L.families, String(res.used.length)],
    ]);
    d.heading(L.summary);
    d.table([
      { t: L.no, w: 64, a: 'c' }, { t: L.name, w: 210 }, { t: L.times, w: 96, a: 'c' }, { t: L.weight, w: 146, a: 'r' },
      { t: L.money, w: 156, a: 'r' }, { t: `${L.share} %\n${owner} / ${L.family}`, w: 160, a: 'c' },
      { t: `${owner}\n(${L.kip})`, w: 132, a: 'r' }, { t: `${L.family}\n(${L.kip})`, w: CW - 964, a: 'r', bold: true },
    ], res.used.map(({ line, r }, i) => [String(i + 1), name(line), String(r.count), C.fmtKg(r.weightC), C.fmtKip(r.money),
      `${C.fmtPct(r.ownerBp)} / ${C.fmtPct(r.familyBp)}`, C.fmtKip(r.ownerShare), C.fmtKip(r.familyShare)]),
    ['', L.total, String(res.count), C.fmtKg(res.weightC), C.fmtKip(res.money), '', C.fmtKip(res.ownerShare), C.fmtKip(res.familyShare)]);
    if (sale.note) { d.y += 12; d.para(`${L.note}: ${sale.note}`, { size: 22 }); }
    d.heading(L.detail);
    const perRow = 6, cw = (CW - 24) / perRow, ch = 40;
    res.used.forEach(({ line, r }, i) => {
      const rows = Math.ceil(line.weights.length / perRow);
      const h = 50 + rows * ch + 84;
      d.ensure(h + 12);
      const top = d.y;
      d.g.strokeStyle = '#555'; d.g.lineWidth = 1.5; roundRect(d.g, M, top, CW, h, 8); d.g.stroke();
      d.text(`${i + 1}. ${name(line)}`, M + 14, top + 26, { size: 24, bold: true, max: CW - 260 });
      d.text(`${L.times}: ${r.count}`, M + CW - 14, top + 26, { size: 22, bold: true, align: 'right' });
      line.weights.forEach((w, j) => {
        const x = M + 12 + (j % perRow) * cw, y = top + 50 + Math.floor(j / perRow) * ch;
        d.rect(x, y, cw, ch, null, '#999', 1);
        d.text(String(j + 1), x + 8, y + ch / 2, { size: 16, color: '#666' });
        d.text(C.fmtKg(w), x + cw - 10, y + ch / 2, { size: 22, align: 'right' });
      });
      const ly = top + 50 + rows * ch + 24;
      d.text(`${L.totalWeight} ${C.fmtKg(r.weightC)} kg × ${C.fmtKip(sale.price)} = ${C.fmtKip(r.money)} ${L.kip}`, M + 14, ly, { size: 21, bold: true, max: CW - 28 });
      d.text(`${L.family} ${C.fmtPct(r.familyBp)}% = ${C.fmtKip(r.familyShare)} ${L.kip}   ·   ${owner} ${C.fmtPct(r.ownerBp)}% = ${C.fmtKip(r.ownerShare)} ${L.kip}`,
        M + 14, ly + 34, { size: 21, max: CW - 28 });
      d.y = top + h + 12;
    });
    d.y += 8;
    d.g.fillStyle = '#999'; d.g.fillRect(M, d.y, CW, 1.5); d.y += 8;
    d.para(L.check, { size: 19 });
    return d.finish();
  }

  /** 全年汇总 */
  function yearSheet(state, year) {
    const d = new Doc();
    const y = C.yearSummary(state, year, (id, fb) => Core.famName(state, id, fb));
    const owner = state.settings.ownerLabel || Core.DEFAULT_SETTINGS.ownerLabel;
    d.title(state, `${L.yearTitle} ${year}`, `${L.printed} ${C.fmtDate(Core.today())}`);
    d.boxes([[L.salesCount, String(y.salesCount)], [L.totalWeight, C.fmtKg(y.weightC) + ' kg'], [L.totalMoney, C.fmtKip(y.buyerMoney) + ' ' + L.kip]]);
    d.heading(L.summary);
    d.table([
      { t: L.no, w: 64, a: 'c' }, { t: L.name, w: 266 }, { t: L.sales, w: 100, a: 'c' }, { t: L.weight, w: 160, a: 'r' },
      { t: L.money, w: 176, a: 'r' }, { t: `${owner}\n(${L.kip})`, w: 166, a: 'r' }, { t: `${L.family}\n(${L.kip})`, w: CW - 932, a: 'r', bold: true },
    ], y.families.map((f, i) => [String(i + 1), f.name, String(f.sales), C.fmtKg(f.weightC), C.fmtKip(f.money), C.fmtKip(f.ownerShare), C.fmtKip(f.familyShare)]),
    ['', L.total, '', C.fmtKg(y.weightC), C.fmtKip(y.money), C.fmtKip(y.ownerShare), C.fmtKip(y.familyShare)]);
    d.heading(L.eachSale);
    d.table([
      { t: L.no, w: 64, a: 'c' }, { t: L.date, w: 150, a: 'c' }, { t: `${L.price}\n(${L.perKg})`, w: 130, a: 'r' }, { t: L.families, w: 110, a: 'c' },
      { t: L.weight, w: 150, a: 'r' }, { t: L.money, w: 166, a: 'r' }, { t: `${owner}\n(${L.kip})`, w: 150, a: 'r' }, { t: `${L.family}\n(${L.kip})`, w: CW - 920, a: 'r' },
    ], y.saleRows.map(({ sale, res }, i) => [String(i + 1), C.fmtDate(sale.date), C.fmtKip(sale.price), String(res.used.length),
      C.fmtKg(res.weightC), C.fmtKip(res.buyerMoney), C.fmtKip(res.ownerShare), C.fmtKip(res.familyShare)]));
    return d.finish();
  }

  // ---------- 拼 PDF：每页一张 JPEG ----------
  function dataURLBytes(url) {
    const bin = atob(url.split(',')[1]);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function toPDF(pages) {
    const enc = new TextEncoder();
    const chunks = []; let length = 0; const offsets = [];
    const push = b => { if (typeof b === 'string') b = enc.encode(b); chunks.push(b); length += b.length; };
    const obj = (n, body) => { offsets[n] = length; push(`${n} 0 obj\n`); body(); push('\nendobj\n'); };
    const PW = 595.28, PH = 841.89;
    const n = pages.length;
    const pageObj = i => 3 + i * 3;
    push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    obj(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
    obj(2, () => push(`<< /Type /Pages /Count ${n} /Kids [${pages.map((_, i) => `${pageObj(i)} 0 R`).join(' ')}] >>`));
    pages.forEach((canvas, i) => {
      const jpg = dataURLBytes(canvas.toDataURL('image/jpeg', 0.88));
      const p = pageObj(i), content = p + 1, img = p + 2;
      const draw = `q ${PW} 0 0 ${PH} 0 0 cm /Im0 Do Q`;
      obj(p, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im0 ${img} 0 R >> >> /Contents ${content} 0 R >>`));
      obj(content, () => push(`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`));
      obj(img, () => {
        push(`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`);
        push(jpg); push('\nendstream');
      });
    });
    const total = 3 + n * 3;
    const xref = length;
    push(`xref\n0 ${total}\n0000000000 65535 f \n`);
    for (let i = 1; i < total; i++) push(String(offsets[i]).padStart(10, '0') + ' 00000 n \n');
    push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    return new Blob(chunks, { type: 'application/pdf' });
  }

  window.RubberPDF = { saleSheet, yearSheet, toPDF };
})();
