// 胶园分账：Mac 版和手机版共用的数据规则（读入检查、合并、老挝文用语）。
(function (root) {
  'use strict';
  const Core = {};

  Core.DEFAULT_SETTINGS = {
    title: 'ໃບສະຫຼຸບການຂາຍຢາງພາລາ',
    ownerLabel: 'ເຈົ້າຂອງສວນ',
    place: '',
    defaultOwnerBp: 5000,
  };
  Core.emptyState = () => ({ version: 1, settings: { ...Core.DEFAULT_SETTINGS }, families: [], sales: [] });
  Core.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  Core.today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  function clampBp(v) { v = Number(v); return Number.isInteger(v) && v >= 0 && v <= 10000 ? v : 5000; }
  Core.clampBp = clampBp;

  /** 把读进来的任何东西整理成合法的数据。 */
  Core.normalize = function (obj) {
    const s = Core.emptyState();
    if (!obj || typeof obj !== 'object') return s;
    s.settings = { ...Core.DEFAULT_SETTINGS, ...(obj.settings || {}) };
    s.settings.defaultOwnerBp = clampBp(s.settings.defaultOwnerBp);
    for (const k of ['title', 'ownerLabel', 'place']) s.settings[k] = String(s.settings[k] || '');
    s.families = (Array.isArray(obj.families) ? obj.families : []).filter(f => f && f.id).map(f => ({
      id: String(f.id), name: String(f.name || ''), ownerBp: clampBp(f.ownerBp), active: f.active !== false,
    }));
    s.sales = (Array.isArray(obj.sales) ? obj.sales : []).filter(x => x && x.id).map(x => ({
      id: String(x.id), date: /^\d{4}-\d{2}-\d{2}$/.test(x.date) ? x.date : Core.today(),
      price: Number.isInteger(x.price) && x.price > 0 ? x.price : 0,
      note: String(x.note || ''), createdAt: Number(x.createdAt) || 0, updatedAt: Number(x.updatedAt) || 0,
      lines: (Array.isArray(x.lines) ? x.lines : []).map(l => ({
        familyId: String(l.familyId || ''), name: String(l.name || ''), ownerBp: clampBp(l.ownerBp),
        weights: (Array.isArray(l.weights) ? l.weights : []).filter(w => Number.isInteger(w) && w > 0),
      })),
    }));
    return s;
  };

  /** 是不是胶园分账导出的文件。 */
  Core.looksLikeData = obj => !!obj && typeof obj === 'object' && Array.isArray(obj.families) && Array.isArray(obj.sales);

  /**
   * 把另一台设备的数据合并进来（会修改 state）。
   * 家庭先按编号对，对不上再按名字对，都对不上就新加。
   * 卖胶按编号对：没有的加进来；两边都有、内容不同的，留最后修改的那份。
   */
  Core.merge = function (state, incoming) {
    const inc = Core.normalize(incoming);
    const famMap = new Map();
    const result = { added: 0, updated: 0, same: 0, kept: 0, addedFamilies: 0 };
    const findLocal = (id, name) => state.families.find(x => x.id === id)
      || (name.trim() ? state.families.find(x => x.name.trim() === name.trim()) : null);
    for (const f of inc.families) {
      let local = findLocal(f.id, f.name);
      if (!local) { local = { ...f }; state.families.push(local); result.addedFamilies++; }
      famMap.set(f.id, local.id);
    }
    for (const sale of inc.sales) {
      const copy = JSON.parse(JSON.stringify(sale));
      for (const l of copy.lines) {
        if (famMap.has(l.familyId)) { l.familyId = famMap.get(l.familyId); continue; }
        let local = findLocal(l.familyId, l.name);
        if (!local) {
          local = { id: l.familyId || Core.uid(), name: l.name, ownerBp: l.ownerBp, active: true };
          state.families.push(local); result.addedFamilies++;
        }
        famMap.set(l.familyId, local.id);
        l.familyId = local.id;
      }
      const i = state.sales.findIndex(x => x.id === copy.id);
      if (i < 0) { state.sales.push(copy); result.added++; }
      else if (JSON.stringify(state.sales[i].lines) === JSON.stringify(copy.lines)
        && state.sales[i].price === copy.price && state.sales[i].date === copy.date && state.sales[i].note === copy.note) result.same++;
      else if ((copy.updatedAt || 0) > (state.sales[i].updatedAt || 0)) { state.sales[i] = copy; result.updated++; }
      else result.kept++;
    }
    return result;
  };

  /** 合并前先算一下会发生什么，不改动 state。 */
  Core.previewMerge = function (state, incoming) {
    return Core.merge(JSON.parse(JSON.stringify(state)), incoming);
  };

  Core.mergeMessage = function (r) {
    const parts = [];
    if (r.added) parts.push(`新增 ${r.added} 次卖胶`);
    if (r.updated) parts.push(`更新 ${r.updated} 次（对方改得更晚）`);
    if (r.same) parts.push(`${r.same} 次已经有了，跳过`);
    if (r.kept) parts.push(`${r.kept} 次这边改得更晚，保留这边的`);
    if (r.addedFamilies) parts.push(`新增 ${r.addedFamilies} 个家庭`);
    return parts.length ? parts.join('\n') : '没有可以合并的内容';
  };

  Core.famName = (state, id, fallback) => {
    const f = state.families.find(x => x.id === id);
    return f ? f.name : (fallback || '');
  };

  /** 这一年的第几次卖胶 */
  Core.saleNo = function (state, sale) {
    const year = String(sale.date).slice(0, 4);
    const list = state.sales.filter(s => String(s.date).slice(0, 4) === year)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.createdAt || 0) - (b.createdAt || 0)));
    return list.indexOf(sale) + 1;
  };

  /** PDF 上用的老挝文。 */
  Core.L = {
    date: 'ວັນທີ', price: 'ລາຄາ', perKg: 'ກີບ/ກິໂລ', kip: 'ກີບ', kg: 'kg',
    no: 'ລ/ດ', family: 'ຄອບຄົວ', name: 'ຊື່ຄອບຄົວ', times: 'ຊັ່ງ (ເທື່ອ)', weight: 'ນ້ຳໜັກລວມ (kg)',
    money: 'ເງິນລວມ (ກີບ)', share: 'ສ່ວນແບ່ງ', total: 'ລວມທັງໝົດ', saleNo: 'ຄັ້ງທີ',
    totalWeight: 'ນ້ຳໜັກລວມ', totalMoney: 'ເງິນລວມທັງໝົດ', families: 'ຈຳນວນຄອບຄົວ',
    summary: 'ສະຫຼຸບແຕ່ລະຄອບຄົວ', detail: 'ລາຍລະອຽດການຊັ່ງ', time: 'ເທື່ອທີ', note: 'ໝາຍເຫດ',
    check: 'ວິທີກວດເອງ: ນ້ຳໜັກລວມ × ລາຄາ = ເງິນລວມ. ເງິນລວມ × % = ສ່ວນແບ່ງ. ເງິນປັດເສດເປັນກີບເຕັມ.',
    yearTitle: 'ສະຫຼຸບການຂາຍຢາງປະຈຳປີ', year: 'ປີ', sales: 'ຂາຍ (ຄັ້ງ)', salesCount: 'ຈຳນວນຄັ້ງທີ່ຂາຍ',
    eachSale: 'ການຂາຍແຕ່ລະຄັ້ງ', printed: 'ພິມວັນທີ', familyShare: 'ສ່ວນຂອງຄອບຄົວ', page: 'ໜ້າ',
  };

  if (typeof module === 'object' && module.exports) module.exports = Core;
  else root.Core = Core;
})(typeof window !== 'undefined' ? window : globalThis);
