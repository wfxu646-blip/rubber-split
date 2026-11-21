// 胶园分账 手机版：数据只存在这部手机里，可以导出给 Mac 合并。
(function () {
  'use strict';
  const C = window.Calc, Core = window.Core;
  const KEY = 'rubber-split-mobile-v1';
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let state;
  const ui = { tab: 'sales', saleId: null, famId: null, year: new Date().getFullYear(), entry: '', editIdx: null, focusKey: null };

  // ---------- 存取 ----------
  function load() {
    try { state = Core.normalize(JSON.parse(localStorage.getItem(KEY) || 'null')); }
    catch (e) { state = Core.emptyState(); }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { toast('保存失败！请马上到「更多」导出数据', true); }
  }
  const touch = sale => { sale.updatedAt = Date.now(); };

  let toastTimer;
  function toast(msg, bad) {
    const el = $('#toast');
    el.textContent = msg; el.className = 'show' + (bad ? ' bad' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.className = ''; }, bad ? 3500 : 2000);
  }

  const famById = id => state.families.find(f => f.id === id);
  const famName = (id, fb) => Core.famName(state, id, fb) || '（没名字）';
  const saleById = id => state.sales.find(s => s.id === id);
  const sortedSales = () => state.sales.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0)));
  const curSale = () => (ui.saleId ? saleById(ui.saleId) : null);
  const curLine = sale => sale && sale.lines.find(l => l.familyId === ui.famId);

  // ---------- 渲染 ----------
  function bar(title, left, right) {
    return `<header class="bar"><div class="side">${left || ''}</div><h1>${title}</h1><div class="side r">${right || ''}</div></header>`;
  }
  const backBtn = (act, label) => `<button data-act="${act}">‹ ${label || '返回'}</button>`;

  function render() {
    const active = document.activeElement;
    const keep = ui.focusKey || (active && active.dataset && active.dataset.key) || null;
    ui.focusKey = null;
    const sale = curSale();
    let html, showTabs = true;
    if (ui.tab === 'sales' && sale && ui.famId && curLine(sale)) { html = renderWeigh(sale); showTabs = false; }
    else if (ui.tab === 'sales' && sale) { html = renderSale(sale); showTabs = false; }
    else if (ui.tab === 'sales') html = renderSales();
    else if (ui.tab === 'families') html = renderFamilies();
    else if (ui.tab === 'year') html = renderYear();
    else html = renderMore();
    const tabs = [['sales', '⚖︎', '卖胶'], ['families', '☘︎', '家庭'], ['year', '▤', '汇总'], ['more', '⋯', '更多']];
    $('#app').innerHTML = html + (showTabs ? `<nav class="tabbar">${tabs.map(([k, ic, t]) =>
      `<button data-act="tab" data-tab="${k}" class="${ui.tab === k ? 'on' : ''}"><span class="ic">${ic}</span>${t}</button>`).join('')}</nav>` : '');
    if (keep) {
      const el = document.querySelector(`[data-key="${CSS.escape(keep)}"]`);
      if (el) el.focus();
    }
    const list = $('.wlist');
    if (list && ui.scrollList === 'bottom') list.scrollTop = list.scrollHeight;
    ui.scrollList = null;
  }

  function renderSales() {
    const sales = sortedSales();
    const body = !state.families.length
      ? `<div class="card empty">还没有家庭。<br>先到「家庭」把各家加进去，<br>或者到「更多」导入 Mac 的数据。<br><br>
          <button class="btn primary" data-act="tab" data-tab="families">去添加家庭</button></div>`
      : !sales.length ? `<div class="card empty">还没有卖胶记录。<br>点右上角「＋ 新建」开始。</div>`
      : `<div class="card">${sales.map(s => {
          const r = C.saleResult(s);
          return `<div class="row" data-act="open-sale" data-id="${s.id}"><div class="main">
              <div class="t">${C.fmtDate(s.date)} <span class="muted" style="font-weight:400">· 第 ${Core.saleNo(state, s)} 次</span></div>
              <div class="s">${r.used.length} 家 · ${C.fmtKg(r.weightC)} kg · ${s.price ? C.fmtKip(s.price) + ' kip/公斤' : '<span class="warn">未填胶价</span>'}</div></div>
            <div class="r"><b>${C.fmtKip(r.buyerMoney)}</b><span class="muted" style="font-size:12px">kip</span></div><span class="chev">›</span></div>`;
        }).join('')}</div>`;
    return bar('卖胶记录', '', '<button data-act="new-sale">＋ 新建</button>') + `<main class="content">${body}</main>`;
  }

  function renderSale(sale) {
    const res = C.saleResult(sale);
    const missing = state.families.filter(f => !sale.lines.some(l => l.familyId === f.id));
    const rows = sale.lines.map((l, i) => {
      const r = C.lineResult(l, sale.price);
      return `<div class="row ${r.count ? 'done' : 'zero'}" data-act="open-fam" data-id="${esc(l.familyId)}">
        <span class="idx">${i + 1}</span><div class="main"><div class="t">${esc(famName(l.familyId, l.name))}</div>
        <div class="s">${r.count ? `${r.count} 次 · ${C.fmtKg(r.weightC)} kg · ${C.fmtPct(r.familyBp)}%` : '还没称'}</div></div>
        <div class="r">${r.count ? `<b>${C.fmtKip(r.familyShare)}</b><span class="muted" style="font-size:12px">他们分</span>` : ''}</div><span class="chev">›</span></div>`;
    }).join('');
    const canPdf = sale.price > 0 && res.used.length > 0;
    return bar(`第 ${Core.saleNo(state, sale)} 次卖胶`, backBtn('close-sale', '列表'), '') + `<main class="content">
      <div class="card pad">
        <div class="grid2">
          <label class="f"><span>日期</span><input class="field" type="date" data-key="date" data-act="sale-date" value="${esc(sale.date)}"></label>
          <label class="f"><span>胶价 kip/公斤</span><input class="field" data-key="price" data-act="sale-price" inputmode="numeric" placeholder="18,000"
            value="${sale.price ? C.fmtKip(sale.price) : ''}" style="text-align:right;font-weight:700"></label>
        </div>
        <label class="f" style="margin-top:10px"><span>备注（可不填）</span><input class="field" data-key="note" data-act="sale-note" value="${esc(sale.note)}"></label>
      </div>
      <div class="stats">
        <div><div class="k">总重</div><div class="v">${C.fmtKg(res.weightC)}<small>kg</small></div></div>
        <div><div class="k">买胶人应付</div><div class="v">${C.fmtKip(res.buyerMoney)}</div></div>
        <div><div class="k">我们合计</div><div class="v">${C.fmtKip(res.ownerShare)}</div></div>
        <div><div class="k">他们合计</div><div class="v">${C.fmtKip(res.familyShare)}</div></div>
      </div>
      ${sale.price ? '' : '<p class="note warn">先填胶价，才能算钱。</p>'}
      ${res.roundingDiff ? `<p class="note">各家分开算相加是 ${C.fmtKip(res.money)}，和买胶人应付差 ${C.fmtKip(res.roundingDiff)} kip（四舍五入）。</p>` : ''}
      <div class="sec-title">各家称重 · 点一家进去称</div>
      <div class="card">${rows || '<div class="empty">这次没有家庭</div>'}</div>
      ${missing.length ? `<select class="field" data-act="add-line" style="margin-bottom:12px"><option value="">＋ 加入其他家庭…</option>
        ${missing.map(f => `<option value="${esc(f.id)}">${esc(f.name || '（没名字）')}${f.active ? '' : '（不在管胶）'}</option>`).join('')}</select>` : ''}
      <button class="btn primary block" data-act="sale-pdf" ${canPdf ? '' : 'disabled'}>导出 PDF（老挝文）</button>
      <div style="height:10px"></div>
      <button class="btn danger block" data-act="del-sale">删除这次卖胶</button>
    </main>`;
  }

  function renderWeigh(sale) {
    const line = curLine(sale);
    const r = C.lineResult(line, sale.price);
    const i = sale.lines.indexOf(line);
    const editing = ui.editIdx !== null && ui.editIdx < line.weights.length;
    if (!editing) ui.editIdx = null;
    const chips = line.weights.map((w, j) => `<div class="wchip ${j === ui.editIdx ? 'sel' : ''}" data-act="pick-w" data-i="${j}"><i>第 ${j + 1} 次</i><b>${C.fmtKg(w)}</b></div>`).join('');
    const last = i >= sale.lines.length - 1;
    return bar(esc(famName(line.familyId, line.name)), backBtn('close-fam', '全部'), `<span style="font-size:14px;opacity:.85">${i + 1} / ${sale.lines.length}</span>`) + `
      <div class="weigh-wrap">
        <div class="weigh-top">
          <div class="ratio">分成：我们 <input class="field" data-key="pct" data-act="line-pct" inputmode="decimal" value="${C.fmtPct(r.ownerBp)}"> %
            · 他们 <b style="color:var(--ink)">${C.fmtPct(r.familyBp)}</b> %
            <span style="flex:1"></span><button class="mini danger" data-act="remove-line">这次不算这家</button></div>
          <div class="tot"><span>${r.count} 次 · <b>${C.fmtKg(r.weightC)}</b> kg</span>
            <span>胶钱 <b>${C.fmtKip(r.money)}</b></span></div>
          <div class="tot muted" style="margin-top:2px"><span>我们 ${C.fmtKip(r.ownerShare)}</span><span>他们 <b style="color:var(--green-dark)">${C.fmtKip(r.familyShare)}</b></span></div>
        </div>
        <div class="wlist">${chips || '<div class="none">还没有称重。用下面的键盘输入重量，按「添加」。</div>'}</div>
        <div class="pad-area">
          <div class="display" id="display"><span class="lab">${editing ? `改第 ${ui.editIdx + 1} 次` : `第 ${line.weights.length + 1} 次`}</span>
            <span class="val" id="dval"></span><span class="unit">kg</span></div>
          <div class="keys">
            <button data-k="7">7</button><button data-k="8">8</button><button data-k="9">9</button><button class="fn" data-k="back">⌫</button>
            <button data-k="4">4</button><button data-k="5">5</button><button data-k="6">6</button>
              ${editing ? '<button class="fn" data-k="cancel">取消</button>' : '<button class="fn" data-k="clear">清空</button>'}
            <button data-k="1">1</button><button data-k="2">2</button><button data-k="3">3</button>
              ${editing ? '<button class="del" data-k="delete">删除</button>' : `<button class="next" data-k="next">${last ? '完成' : '下一家 →'}</button>`}
            <button data-k=".">.</button><button data-k="0">0</button><button class="go" data-k="go">${editing ? '保存' : '添加'}</button>
          </div>
        </div>
      </div>`;
  }

  function paintDisplay() {
    const v = $('#dval'); if (!v) return;
    v.textContent = ui.entry || '0.00';
    v.classList.toggle('ph', !ui.entry);
    $('#display').classList.remove('err');
  }

  function renderFamilies() {
    const n = state.families.length;
    const cards = state.families.map((f, i) => {
      const inSale = state.sales.some(s => s.lines.some(l => l.familyId === f.id));
      return `<div class="card fam-card ${f.active ? '' : 'off'}">
        <div class="line1"><span class="idx">${i + 1}</span>
          <input class="field" data-key="fname-${f.id}" data-act="fam-name" data-id="${f.id}" value="${esc(f.name)}" placeholder="家庭名字"></div>
        <div class="line2">我们 <input class="field pct" data-key="fpct-${f.id}" data-act="fam-pct" data-id="${f.id}" inputmode="decimal" value="${C.fmtPct(f.ownerBp)}"> %
          · 他们 <b style="color:var(--ink)">${C.fmtPct(10000 - f.ownerBp)}</b> %
          <span style="flex:1"></span>
          <label class="switch"><input type="checkbox" data-act="fam-active" data-id="${f.id}" ${f.active ? 'checked' : ''}> 在管胶</label></div>
        <div class="line2">
          <button class="mini" data-act="fam-move" data-i="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''}>↑ 上移</button>
          <button class="mini" data-act="fam-move" data-i="${i}" data-d="1" ${i === n - 1 ? 'disabled' : ''}>↓ 下移</button>
          <span style="flex:1"></span>
          ${inSale ? '<span style="font-size:12px">有记录，不能删</span>' : `<button class="mini danger" data-act="fam-del" data-id="${f.id}">删除</button>`}
        </div></div>`;
    }).join('');
    return bar('家庭', '', '<button data-act="fam-add">＋ 添加</button>') + `<main class="content">
      ${cards || '<div class="card empty">还没有家庭，点右上角「＋ 添加」。</div>'}
      <p class="note">· 名字写老挝文、中文都可以，会原样印在 PDF 上。<br>· 改比例只影响以后新建的卖胶；某一次的比例在那次称重页里改。<br>
        · 不在管胶的家庭关掉「在管胶」，新建卖胶时就不会出现。</p></main>`;
  }

  function renderYear() {
    const y = C.yearSummary(state, ui.year, (id, fb) => famName(id, fb));
    const years = new Set(state.sales.map(s => Number(String(s.date).slice(0, 4))).filter(Boolean));
    years.add(new Date().getFullYear()); years.add(ui.year);
    const famRows = y.families.map(f => `<tr><td>${esc(f.name)}<div class="muted" style="font-size:12px">${f.sales} 次</div></td>
        <td class="r">${C.fmtKg(f.weightC)}</td><td class="r">${C.fmtKip(f.money)}</td><td class="r"><b>${C.fmtKip(f.familyShare)}</b></td></tr>`).join('');
    const saleRows = y.saleRows.map(({ sale, res }) => `<div class="row" data-act="open-sale" data-id="${sale.id}"><div class="main">
        <div class="t">${C.fmtDate(sale.date)}</div><div class="s">${res.used.length} 家 · ${C.fmtKg(res.weightC)} kg · ${C.fmtKip(sale.price)}/公斤</div></div>
        <div class="r"><b>${C.fmtKip(res.buyerMoney)}</b></div><span class="chev">›</span></div>`).join('');
    return bar('年度汇总') + `<main class="content">
      <select class="field" data-act="year" style="margin-bottom:12px">${[...years].sort((a, b) => b - a).map(v => `<option ${v === ui.year ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <div class="stats">
        <div><div class="k">卖胶次数</div><div class="v">${y.salesCount}<small>次</small></div></div>
        <div><div class="k">全年总重</div><div class="v">${C.fmtKg(y.weightC)}<small>kg</small></div></div>
        <div><div class="k">我们分</div><div class="v">${C.fmtKip(y.ownerShare)}</div></div>
        <div><div class="k">他们分</div><div class="v">${C.fmtKip(y.familyShare)}</div></div>
      </div>
      ${!y.salesCount ? `<div class="card empty">${ui.year} 年还没有卖胶记录。</div>` : `
      <div class="sec-title">每家全年</div>
      <div class="card"><table class="t"><thead><tr><th>家庭</th><th class="r">kg</th><th class="r">胶钱</th><th class="r">他们分</th></tr></thead>
        <tbody>${famRows}</tbody><tfoot><tr><td>合计</td><td class="r">${C.fmtKg(y.weightC)}</td><td class="r">${C.fmtKip(y.money)}</td><td class="r">${C.fmtKip(y.familyShare)}</td></tr></tfoot></table></div>
      <div class="sec-title">每次卖胶</div><div class="card">${saleRows}</div>
      <button class="btn primary block" data-act="year-pdf">导出全年 PDF（老挝文）</button>`}
      <p class="note">如果这部手机只记了一部分卖胶，全年汇总以 Mac 上合并后的为准。</p></main>`;
  }

  function renderMore() {
    const s = state.settings;
    return bar('更多') + `<main class="content">
      <div class="sec-title">和 Mac 交换数据</div>
      <div class="card pad">
        <button class="btn primary block" data-act="export">导出数据给 Mac</button>
        <p class="note">卖完胶点这里，用微信、LINE 或 AirDrop 把文件发给 Mac，在 Mac 版「设置与备份 → 导入手机数据」合并。重复的记录不会算两次。</p>
        <button class="btn block" data-act="import">导入数据…</button>
        <p class="note">把 Mac 导出的备份或别的手机导出的数据合并进来。第一次用时导入 Mac 的备份，家庭名单就有了。</p>
        <p class="note">这部手机现在有 ${state.families.length} 个家庭、${state.sales.length} 次卖胶。</p>
      </div>
      <div class="sec-title">PDF 上的老挝文</div>
      <div class="card pad">
        <label class="f"><span>PDF 标题</span><input class="field" data-key="s-title" data-act="set" data-k="title" value="${esc(s.title)}"></label>
        <label class="f" style="margin-top:10px"><span>我们这一方的称呼</span><input class="field" data-key="s-owner" data-act="set" data-k="ownerLabel" value="${esc(s.ownerLabel)}"></label>
        <label class="f" style="margin-top:10px"><span>胶园名称或地点（可不填）</span><input class="field" data-key="s-place" data-act="set" data-k="place" value="${esc(s.place)}"></label>
        <label class="f" style="margin-top:10px"><span>新家庭默认比例：我们 %</span><input class="field" data-key="s-pct" data-act="set-pct" inputmode="decimal" value="${C.fmtPct(s.defaultOwnerBp)}" style="width:100px"></label>
      </div>
      <div class="sec-title">放到主屏幕</div>
      <div class="card pad"><p class="note" style="margin:0">iPhone：用 Safari 打开 → 点下面的「分享」按钮 → 「添加到主屏幕」。<br>
        安卓：用 Chrome 打开 → 右上角菜单 → 「添加到主屏幕」/「安装应用」。<br>
        放到主屏幕后，没网也能用。数据只存在这部手机里，删掉这个图标或清除 Safari 数据会把数据删掉，记得常导出。</p></div>
    </main>`;
  }

  // ---------- 动作 ----------
  function newSale() {
    if (!state.families.some(f => f.active)) { ui.tab = 'families'; render(); toast('请先添加家庭', true); return; }
    const last = sortedSales()[0];
    const sale = { id: Core.uid(), date: Core.today(), price: last ? last.price : 0, note: '', createdAt: Date.now(), updatedAt: Date.now(),
      lines: state.families.filter(f => f.active).map(f => ({ familyId: f.id, name: f.name, ownerBp: f.ownerBp, weights: [] })) };
    state.sales.push(sale); save();
    ui.saleId = sale.id; ui.famId = null;
    render();
    if (!sale.price) toast('先填今天的胶价');
  }

  function openFam(id) { ui.famId = id; ui.entry = ''; ui.editIdx = null; ui.scrollList = 'bottom'; render(); paintDisplay(); }

  function key(k) {
    const sale = curSale(), line = curLine(sale);
    if (!line) return;
    const e = ui.entry;
    if (/^\d$/.test(k)) {
      const [i, f] = e.split('.');
      if (f !== undefined) { if (f.length >= 2) return; ui.entry = e + k; }
      else if (i === '0') ui.entry = k;
      else if (i.length >= 5) return;
      else ui.entry = e + k;
    } else if (k === '.') { if (!e.includes('.')) ui.entry = (e || '0') + '.'; }
    else if (k === 'back') ui.entry = e.slice(0, -1);
    else if (k === 'clear') ui.entry = '';
    else if (k === 'cancel') { ui.editIdx = null; ui.entry = ''; render(); paintDisplay(); return; }
    else if (k === 'delete') {
      line.weights.splice(ui.editIdx, 1); touch(sale); save();
      ui.editIdx = null; ui.entry = ''; render(); paintDisplay(); toast('已删除'); return;
    } else if (k === 'next') {
      if (ui.entry && !commit(sale, line)) return;
      const i = sale.lines.indexOf(line) + 1;
      if (sale.lines[i]) openFam(sale.lines[i].familyId); else { ui.famId = null; render(); }
      return;
    } else if (k === 'go') { if (commit(sale, line)) { render(); paintDisplay(); } return; }
    paintDisplay();
  }

  /** 把输入框里的数加进去或改掉，成功返回 true。 */
  function commit(sale, line) {
    const v = C.parseWeight(ui.entry);
    if (v === null) {
      $('#display').classList.add('err');
      toast(ui.entry ? '重量要大于 0' : '先输入重量', true);
      return false;
    }
    if (ui.editIdx !== null) { line.weights[ui.editIdx] = v; ui.editIdx = null; }
    else { line.weights.push(v); ui.scrollList = 'bottom'; }
    ui.entry = ''; touch(sale); save();
    return true;
  }

  // ---------- 文件：PDF、导出、导入 ----------
  async function shareFile(blob, filename, title) {
    const file = new File([blob], filename, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title }); }
      catch (e) { if (e.name !== 'AbortError') toast('分享失败：' + e.message, true); }
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  }

  let preview = null;
  function showPDF(pages, filename) {
    const blob = window.RubberPDF.toPDF(pages);
    preview = { blob, filename };
    $('#sheet-root').innerHTML = `<div class="overlay" data-act="close-pdf"><div class="panel" data-stop="1">
      <div class="ph"><b>${esc(filename)}</b><span class="muted" style="font-size:13px">${pages.length} 页</span></div>
      <div class="pages">${pages.map(c => `<img alt="" src="${c.toDataURL('image/jpeg', 0.7)}">`).join('')}</div>
      <div class="pf"><button class="btn" data-act="close-pdf">关闭</button><button class="btn primary" data-act="share-pdf">分享 / 保存 PDF</button></div>
    </div></div>`;
  }

  function exportData() {
    const blob = new Blob([JSON.stringify({ app: 'rubber-split', exportedAt: new Date().toISOString(), ...state }, null, 1)], { type: 'application/json' });
    shareFile(blob, `胶园分账-手机数据-${Core.today()}.json`, '胶园分账数据');
  }

  function importData(obj) {
    if (!Core.looksLikeData(obj)) { toast('这个文件不是胶园分账的数据', true); return; }
    const p = Core.previewMerge(state, obj);
    if (!p.added && !p.updated && !p.addedFamilies) { alert('导入数据\n\n' + Core.mergeMessage(p)); return; }
    if (!confirm('导入数据：\n\n' + Core.mergeMessage(p) + '\n\n确定导入吗？')) return;
    const firstTime = !state.families.length && !state.sales.length;
    Core.merge(state, obj);
    if (firstTime && obj.settings) state.settings = Core.normalize(obj).settings;
    save(); render(); toast('已导入');
  }

  // ---------- 事件 ----------
  function onClick(e) {
    const k = e.target.closest('[data-k]');
    if (k) { key(k.dataset.k); return; }
    const el = e.target.closest('[data-act]');
    if (!el || el.tagName === 'INPUT' || el.tagName === 'SELECT') return;
    // 点预览面板里的空白处不关闭，只有点外面的灰色区域或「关闭」才关。
    if (el.classList.contains('overlay') && e.target.closest('[data-stop]')) return;
    const sale = curSale();
    switch (el.dataset.act) {
      case 'tab': ui.tab = el.dataset.tab; ui.saleId = null; ui.famId = null; render(); window.scrollTo(0, 0); break;
      case 'new-sale': newSale(); break;
      case 'open-sale': ui.tab = 'sales'; ui.saleId = el.dataset.id; ui.famId = null; render(); window.scrollTo(0, 0); break;
      case 'close-sale': ui.saleId = null; render(); break;
      case 'open-fam': openFam(el.dataset.id); break;
      case 'close-fam': ui.famId = null; ui.editIdx = null; render(); break;
      case 'pick-w': {
        const i = Number(el.dataset.i);
        if (ui.editIdx === i) { ui.editIdx = null; ui.entry = ''; }
        else { ui.editIdx = i; ui.entry = C.fmtKg(curLine(sale).weights[i]).replace(/,/g, ''); }
        const top = $('.wlist').scrollTop; render(); $('.wlist').scrollTop = top; paintDisplay(); break;
      }
      case 'remove-line': {
        const line = curLine(sale);
        if (line.weights.length && !confirm(`${famName(line.familyId, line.name)} 已经称了 ${line.weights.length} 次，确定这次不算这家吗？称重会删除。`)) return;
        sale.lines.splice(sale.lines.indexOf(line), 1); touch(sale); save(); ui.famId = null; render(); break;
      }
      case 'del-sale': {
        const r = C.saleResult(sale);
        if (!confirm(`删除 ${C.fmtDate(sale.date)} 这次卖胶吗？\n里面有 ${r.count} 次称重、${C.fmtKg(r.weightC)} kg，删除后找不回来。`)) return;
        state.sales = state.sales.filter(s => s !== sale); save(); ui.saleId = null; render(); toast('已删除'); break;
      }
      case 'sale-pdf': showPDF(window.RubberPDF.saleSheet(state, sale), `卖胶-${sale.date}.pdf`); break;
      case 'year-pdf': showPDF(window.RubberPDF.yearSheet(state, ui.year), `全年汇总-${ui.year}.pdf`); break;
      case 'share-pdf': if (preview) shareFile(preview.blob, preview.filename, preview.filename); break;
      case 'close-pdf': $('#sheet-root').innerHTML = ''; preview = null; break;
      case 'fam-add': {
        const f = { id: Core.uid(), name: '', ownerBp: state.settings.defaultOwnerBp, active: true };
        state.families.push(f); save(); ui.focusKey = 'fname-' + f.id; render();
        const el2 = document.querySelector(`[data-key="fname-${f.id}"]`); if (el2) el2.scrollIntoView({ block: 'center' });
        break;
      }
      case 'fam-move': {
        const i = Number(el.dataset.i), j = i + Number(el.dataset.d);
        if (j < 0 || j >= state.families.length) return;
        [state.families[i], state.families[j]] = [state.families[j], state.families[i]]; save(); render(); break;
      }
      case 'fam-del': {
        const f = famById(el.dataset.id);
        if (!confirm(`删除家庭「${f.name || '（没名字）'}」吗？`)) return;
        state.families = state.families.filter(x => x !== f); save(); render(); break;
      }
      case 'export': exportData(); break;
      case 'import': $('#import-file').click(); break;
    }
  }

  function onChange(e) {
    const el = e.target, act = el.dataset.act;
    if (!act) return;
    const sale = curSale();
    const later = () => setTimeout(render, 0);
    switch (act) {
      case 'sale-date': if (/^\d{4}-\d{2}-\d{2}$/.test(el.value)) { sale.date = el.value; touch(sale); save(); } later(); break;
      case 'sale-price': {
        const v = el.value.trim() === '' ? 0 : C.parsePrice(el.value);
        if (v === null) { toast('胶价要填整数，比如 18000', true); later(); return; }
        sale.price = v; touch(sale); save(); later(); break;
      }
      case 'sale-note': sale.note = el.value.trim(); touch(sale); save(); break;
      case 'line-pct': {
        const v = C.parsePercent(el.value);
        if (v === null) { toast('比例要在 0 到 100 之间', true); later(); return; }
        curLine(sale).ownerBp = v; touch(sale); save(); later(); setTimeout(paintDisplay, 1); break;
      }
      case 'add-line': {
        const f = famById(el.value); if (!f) return;
        sale.lines.push({ familyId: f.id, name: f.name, ownerBp: f.ownerBp, weights: [] }); touch(sale); save(); later(); break;
      }
      case 'fam-name': {
        const f = famById(el.dataset.id); f.name = el.value.trim();
        state.sales.forEach(s => s.lines.forEach(l => { if (l.familyId === f.id) l.name = f.name; }));
        save(); break;
      }
      case 'fam-pct': {
        const f = famById(el.dataset.id), v = C.parsePercent(el.value);
        if (v === null) { toast('比例要在 0 到 100 之间', true); later(); return; }
        f.ownerBp = v; save(); later(); break;
      }
      case 'fam-active': famById(el.dataset.id).active = el.checked; save(); later(); break;
      case 'year': ui.year = Number(el.value); later(); break;
      case 'set': state.settings[el.dataset.k] = el.value.trim(); save(); break;
      case 'set-pct': {
        const v = C.parsePercent(el.value);
        if (v === null) { toast('比例要在 0 到 100 之间', true); later(); return; }
        state.settings.defaultOwnerBp = v; save(); later(); break;
      }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    load();
    document.addEventListener('click', onClick);
    document.addEventListener('change', onChange);
    document.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); e.target.blur(); }
    });
    $('#import-file').addEventListener('change', e => {
      const file = e.target.files[0]; if (!file) return;
      file.text().then(t => { try { importData(JSON.parse(t)); } catch (err) { toast('读取失败：不是有效的数据文件', true); } });
      e.target.value = '';
    });
    render();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  });

  window.__rubberMobile = { get state() { return state; }, ui, render, key, importData };
})();
