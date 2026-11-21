// 胶园分账：所有计算都在这里。
// 重量用"百分之一公斤"的整数保存（23.50 kg 存成 2350），比例用"万分之一"的整数保存（55% 存成 5500），
// 钱是整数 kip。这样不会出现浮点误差，结果和手算一致。
(function (root) {
  'use strict';
  const Calc = {};

  /** 非负整数 n / d 四舍五入。 */
  function roundDiv(n, d) {
    const q = Math.floor(n / d);
    return (n - q * d) * 2 >= d ? q + 1 : q;
  }
  Calc.roundDiv = roundDiv;

  function clean(text) {
    return String(text == null ? '' : text).trim().replace(/[,，\s]/g, '').replace(/。/g, '.');
  }

  /** "23.5" -> 2350；最多两位小数，必须大于 0；不合法返回 null。 */
  Calc.parseWeight = function (text) {
    const s = clean(text);
    if (!/^\d{1,6}(\.\d{0,2})?$/.test(s) && !/^\.\d{1,2}$/.test(s)) return null;
    const [i, f = ''] = s.split('.');
    const value = Number(i || 0) * 100 + Number((f + '00').slice(0, 2));
    return value > 0 ? value : null;
  };

  /** 胶价：正整数 kip。 */
  Calc.parsePrice = function (text) {
    const s = clean(text);
    if (!/^\d{1,9}$/.test(s)) return null;
    const value = Number(s);
    return value > 0 ? value : null;
  };

  /** 比例：0–100，最多两位小数，返回万分之一的整数。 */
  Calc.parsePercent = function (text) {
    const s = clean(text).replace(/%$/, '');
    if (!/^\d{1,3}(\.\d{0,2})?$/.test(s)) return null;
    const [i, f = ''] = s.split('.');
    const value = Number(i) * 100 + Number((f + '00').slice(0, 2));
    return value <= 10000 ? value : null;
  };

  function groupDigits(intText) {
    return intText.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /** 1234500 -> "1,234,500" */
  Calc.fmtKip = function (n) {
    const v = Math.round(Number(n) || 0);
    return (v < 0 ? '-' : '') + groupDigits(String(Math.abs(v)));
  };

  /** 123450 -> "1,234.50" */
  Calc.fmtKg = function (c) {
    const v = Math.round(Number(c) || 0);
    const a = Math.abs(v);
    return (v < 0 ? '-' : '') + groupDigits(String(Math.floor(a / 100))) + '.' + String(a % 100).padStart(2, '0');
  };

  /** 5500 -> "55"，5550 -> "55.5" */
  Calc.fmtPct = function (bp) {
    const v = Number(bp) || 0;
    const whole = Math.floor(v / 100);
    const frac = v % 100;
    if (!frac) return String(whole);
    return whole + '.' + String(frac).padStart(2, '0').replace(/0$/, '');
  };

  /** 一家人一次卖胶的结果。ownerBp 是"我们"的比例。 */
  Calc.lineResult = function (line, price) {
    const weights = (line.weights || []).filter(w => Number.isInteger(w) && w > 0);
    const weightC = weights.reduce((a, b) => a + b, 0);
    const money = roundDiv(weightC * (price || 0), 100);
    const ownerBp = Math.min(10000, Math.max(0, line.ownerBp | 0));
    const familyBp = 10000 - ownerBp;
    // 家庭那份按他们自己会算的方式四舍五入，剩下的归我们，两份相加正好等于胶钱。
    const familyShare = roundDiv(money * familyBp, 10000);
    return { count: weights.length, weightC, money, ownerBp, familyBp, familyShare, ownerShare: money - familyShare };
  };

  /** 一次卖胶的全部结果。 */
  Calc.saleResult = function (sale) {
    const price = sale.price || 0;
    const lines = (sale.lines || []).map(line => ({ line, r: Calc.lineResult(line, price) }));
    const used = lines.filter(x => x.r.count > 0);
    const sum = key => used.reduce((a, x) => a + x.r[key], 0);
    const weightC = sum('weightC');
    const buyerMoney = roundDiv(weightC * price, 100);
    const money = sum('money');
    return {
      lines, used, price, weightC,
      count: sum('count'),
      buyerMoney,           // 买胶人按总重付的钱
      money,                // 各家胶钱相加
      roundingDiff: buyerMoney - money,
      ownerShare: sum('ownerShare'),
      familyShare: sum('familyShare'),
    };
  };

  /** 某一年的汇总。familyName(id, fallback) 用来取当前名字。 */
  Calc.yearSummary = function (state, year, familyName) {
    const prefix = String(year) + '-';
    const sales = (state.sales || []).filter(s => String(s.date || '').startsWith(prefix))
      .slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const byFamily = new Map();
    const saleRows = [];
    for (const sale of sales) {
      const res = Calc.saleResult(sale);
      if (!res.used.length) continue;
      saleRows.push({ sale, res });
      for (const { line, r } of res.used) {
        const key = line.familyId || ('name:' + line.name);
        let row = byFamily.get(key);
        if (!row) {
          row = { familyId: line.familyId, name: familyName ? familyName(line.familyId, line.name) : line.name,
            sales: 0, count: 0, weightC: 0, money: 0, ownerShare: 0, familyShare: 0 };
          byFamily.set(key, row);
        }
        row.sales += 1; row.count += r.count; row.weightC += r.weightC; row.money += r.money;
        row.ownerShare += r.ownerShare; row.familyShare += r.familyShare;
      }
    }
    const order = new Map((state.families || []).map((f, i) => [f.id, i]));
    const families = [...byFamily.values()].sort((a, b) =>
      (order.has(a.familyId) ? order.get(a.familyId) : 1e9) - (order.has(b.familyId) ? order.get(b.familyId) : 1e9));
    const total = key => families.reduce((a, f) => a + f[key], 0);
    return {
      year, saleRows, families,
      salesCount: saleRows.length,
      weightC: total('weightC'), money: total('money'),
      buyerMoney: saleRows.reduce((a, x) => a + x.res.buyerMoney, 0),
      ownerShare: total('ownerShare'), familyShare: total('familyShare'),
    };
  };

  /** 2026-11-21 -> 21/11/2026 */
  Calc.fmtDate = function (iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? `${m[3]}/${m[2]}/${m[1]}` : (iso || '');
  };

  if (typeof module === 'object' && module.exports) module.exports = Calc;
  else root.Calc = Calc;
})(typeof window !== 'undefined' ? window : globalThis);
