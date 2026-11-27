/**
 * ============================================================================
 * 學校總務行政助理 — 第二期長期維運外掛模組 (ops-module.js)
 * 整合：太陽能屋頂租賃對帳與效率監控、學校水電費多錶號異常預警與季節預算推估
 * 並升級：主導覽獨立頁籤、Chrome 起始頁健康摘要條、A4 橫式報表 PDF 與跨模組預警
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// 0. 注入專屬樣式與狀態變數
// ----------------------------------------------------------------------------
(function injectOpsStyles() {
  const css = `
    .ops-strip {
      display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:14px;
    }
    .ops-mini-card {
      background:#fff; border:1px solid var(--border); border-radius:10px;
      padding:10px 14px; box-shadow:var(--shadow); cursor:pointer;
      display:flex; justify-content:space-between; align-items:center; gap:10px;
      transition:.15s;
    }
    .ops-mini-card:hover { border-color:#94a3b8; transform:translateY(-1px); }
    .ops-mini-card.warn-red { border-left:4px solid var(--red); background:#fffafa; }
    .ops-mini-card.warn-amber { border-left:4px solid var(--amber); background:#fffdf5; }
    .ops-mini-card.warn-ok { border-left:4px solid var(--green); }
    .ops-grid-2 { display:grid; grid-template-columns:repeat(2,1fr); gap:12px; margin-bottom:14px; }
    .ops-grid-3 { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:14px; }
    .site-card {
      background:#fff; border:1px solid var(--border); border-radius:10px;
      padding:12px 14px; box-shadow:var(--shadow);
    }
    .site-card.red { border-top:4px solid var(--red); }
    .site-card.amber { border-top:4px solid var(--amber); }
    .site-card.ok { border-top:4px solid var(--green); }
    .meter-card {
      background:#fff; border:1px solid var(--border); border-radius:8px;
      padding:10px 12px;
    }
    .meter-card.red { border-left:4px solid var(--red); background:#fffafa; }
    .meter-card.amber { border-left:4px solid var(--amber); background:#fffdf5; }
    .meter-card.blue { border-left:4px solid var(--primary); background:#f8fbff; }
    .chart-box {
      border:1px solid var(--border); border-radius:8px; background:#fff;
      padding:10px; overflow-x:auto; margin-bottom:14px;
    }
    .ops-kpi-4 { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:14px; }
    @media (max-width: 1100px) {
      .ops-strip, .ops-grid-3, .ops-grid-2, .ops-kpi-4 { grid-template-columns:1fr; }
    }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
})();

let opsSolarFilterSite = 'all';
let opsSolarYear = new Date().getFullYear() - 1911; // 民國年
let opsUtilYear = new Date().getFullYear() - 1911;  // 民國年
let opsUtilTypeFilter = 'all';   // all | 電費 | 水費
let opsUtilMeterFilter = 'all';
let opsUtilChartMetric = 'amount'; // amount | usage

// 替換主導覽列「下階段」按鈕為兩個正式功能頁籤
(function upgradeNavTabs() {
  const nav = document.getElementById('nav-tabs');
  if (!nav) return;
  const oldBtn = nav.querySelector('[data-tab="upcoming"]');
  if (oldBtn) {
    const solarBtn = document.createElement('button');
    solarBtn.className = 'nav-tab';
    solarBtn.dataset.tab = 'solar';
    solarBtn.textContent = '☀️ 太陽能';
    solarBtn.onclick = () => switchTab('solar');

    const utilBtn = document.createElement('button');
    utilBtn.className = 'nav-tab';
    utilBtn.dataset.tab = 'utilities';
    utilBtn.textContent = '⚡ 水電費';
    utilBtn.onclick = () => switchTab('utilities');

    oldBtn.replaceWith(solarBtn, utilBtn);
  }
})();

// ----------------------------------------------------------------------------
// 1. 太陽能對帳與發電效率核心演算法
// ----------------------------------------------------------------------------
function normFeedbackRate(raw) {
  if (raw === null || raw === undefined || raw === '') return 0;
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return 0;
    if (s.endsWith('%') || s.endsWith('％')) {
      const num = Number(s.slice(0, -1).trim());
      return (isNaN(num) || num < 0) ? 0 : Number((num / 100).toFixed(8));
    }
    const num = Number(s);
    if (isNaN(num) || num < 0) return 0;
    return num >= 1 ? Number((num / 100).toFixed(8)) : num;
  }
  const n = Number(raw);
  if (isNaN(n) || n < 0) return 0;
  return n >= 1 ? Number((n / 100).toFixed(8)) : n;
}

function billingDaysCount(startYmd, endYmd) {
  if (!startYmd || !endYmd) return 0;
  const d = diffDays(startYmd, endYmd) + 1;
  return d > 0 ? d : 1;
}

function getRecordRocYear(rec) {
  const lbl = String(rec.period_label || '');
  const m = lbl.match(/^(\d{2,3})/);
  if (m) return parseInt(m[1], 10);
  if (rec.period_end) return parseInt(String(rec.period_end).slice(0, 4), 10) - 1911;
  return new Date().getFullYear() - 1911;
}

function findPrevYearSolarRecord(rec, allRecords) {
  const sameSite = allRecords.filter(x => x.solar_id === rec.solar_id && x.record_id !== rec.record_id);
  // 1. 優先比對標準期別字首（如 115-Q1 → 114-Q1）
  const lbl = String(rec.period_label || '');
  const m = lbl.match(/^(\d{2,4})(.+)$/);
  if (m) {
    const prevLbl = `${parseInt(m[1], 10) - 1}${m[2]}`;
    const hit = sameSite.find(x => String(x.period_label || '') === prevLbl);
    if (hit) return hit;
  }
  // 2. 次選比對計費迄日相隔約 1 年（330 ~ 400 天）
  if (rec.period_end) {
    return sameSite.find(x => {
      if (!x.period_end) return false;
      const d = diffDays(x.period_end, rec.period_end);
      return d >= 330 && d <= 400;
    }) || null;
  }
  return null;
}

function evaluateSolarRecord(rec, contract, allRecords) {
  const today = todayStr();
  const cap = Number(contract?.capacity_kwp) || 0;
  const rate = normFeedbackRate(contract?.feedback_rate);
  const days = billingDaysCount(rec.period_start, rec.period_end);
  const gen = Number(rec.generation_kwh) || 0;
  const rev = Number(rec.taipower_revenue) || 0;

  const expected = Math.round(rev * rate);
  const hasActual = rec.actual_feedback !== '' && rec.actual_feedback !== null && rec.actual_feedback !== undefined;
  const actual = hasActual ? Number(rec.actual_feedback) : 0;
  const diffAmt = hasActual ? (actual - expected) : 0;

  let dailyYield = Number(rec.yield_per_kwp) || 0;
  if (cap > 0 && days > 0 && gen > 0) {
    dailyYield = Number((gen / (cap * days)).toFixed(2));
  }

  const prev = findPrevYearSolarRecord(rec, allRecords);
  let prevYield = 0;
  if (prev) {
    const pDays = billingDaysCount(prev.period_start, prev.period_end);
    prevYield = Number(prev.yield_per_kwp) || ((cap > 0 && pDays > 0) ? Number((Number(prev.generation_kwh || 0) / (cap * pDays)).toFixed(2)) : 0);
  }
  const yoyPct = (prevYield > 0 && dailyYield > 0)
    ? Number((((dailyYield - prevYield) / prevYield) * 100).toFixed(1))
    : null;

  const flags = [];
  let level = 'ok';
  const elevate = lv => {
    if (lv === 'red') level = 'red';
    else if (lv === 'amber' && level !== 'red') level = 'amber';
  };

  // 回饋金短收差額 > 10 元
  if (hasActual && Math.abs(diffAmt) > 10) {
    flags.push(`差額 ${diffAmt > 0 ? '+' : ''}${diffAmt.toLocaleString('zh-TW')}元`);
    elevate('red');
  }
  // 結算迄日逾 30 天未入帳
  if (!rec.payment_date && rec.period_end && diffDays(rec.period_end, today) > 30) {
    flags.push(`逾${diffDays(rec.period_end, today)}天未入帳`);
    elevate('amber');
  }
  // 發電效率異常（YoY 或首年 2.2 防線）
  if (yoyPct !== null) {
    if (yoyPct <= -25) { flags.push(`效率暴跌 ${yoyPct}%`); elevate('red'); }
    else if (yoyPct <= -15) { flags.push(`效率衰退 ${yoyPct}%`); elevate('amber'); }
  } else if (dailyYield > 0 && dailyYield < 2.2) {
    flags.push(`日均偏低(${dailyYield})`);
    elevate('amber');
  }

  return { days, expected, hasActual, actual, diffAmt, dailyYield, prevYield, yoyPct, flags, level };
}

function calcSolarOverview(rocYear) {
  const contracts = appData.tables.Solar_Contracts || [];
  const records = appData.tables.Solar_Records || [];
  const today = todayStr();
  const cMap = {};
  contracts.forEach(c => { cMap[c.solar_id] = c; });

  let totalKwp = 0, yearExpected = 0, yearActual = 0, docAlerts = 0, effAlerts = 0;
  contracts.filter(c => c.status !== '已期滿').forEach(c => {
    totalKwp += Number(c.capacity_kwp) || 0;
    [c.insurance_expiry, c.deposit_expiry].forEach(dt => {
      if (dt && diffDays(today, dt) <= 60) docAlerts++;
    });
  });

  const enriched = records.map(r => {
    const c = cMap[r.solar_id];
    const ev = evaluateSolarRecord(r, c, records);
    const ry = getRecordRocYear(r);
    if (ry === Number(rocYear)) {
      yearExpected += ev.expected;
      if (ev.hasActual) yearActual += ev.actual;
      if (ev.level === 'red' || ev.level === 'amber') effAlerts++;
    }
    return { ...r, _contract: c, _rocYear: ry, _eval: ev };
  });

  return { contracts, cMap, enriched, totalKwp: Number(totalKwp.toFixed(1)), yearExpected, yearActual, docAlerts, effAlerts };
}

// ----------------------------------------------------------------------------
// 2. 學校水電費多錶號異常偵測 & 季節曲線預算推估引擎
// ----------------------------------------------------------------------------
function evaluateUtilityBill(bill, meter, allBills) {
  const isElec = meter?.utility_type === '電費';
  const days = billingDaysCount(bill.bill_start, bill.bill_end) || (isElec ? 30 : 60);
  const usage = Number(bill.usage_units) || 0;
  const daily = days > 0 ? Number((usage / days).toFixed(2)) : 0;

  const sameMeter = allBills.filter(b => b.meter_id === bill.meter_id && b.bill_id !== bill.bill_id);

  // 找去年同期（同 YYYY-MM 去年同月）
  let prevBill = null;
  if (bill.billing_ym && /^\d{4}-\d{2}$/.test(bill.billing_ym)) {
    const prevYm = `${parseInt(bill.billing_ym.slice(0, 4), 10) - 1}-${bill.billing_ym.slice(5, 7)}`;
    prevBill = sameMeter.find(b => b.billing_ym === prevYm) || null;
  }

  let yoyPct = null, prevDaily = null;
  if (prevBill) {
    const pDays = billingDaysCount(prevBill.bill_start, prevBill.bill_end) || (isElec ? 30 : 60);
    prevDaily = pDays > 0 ? Number(((Number(prevBill.usage_units) || 0) / pDays).toFixed(2)) : 0;
    if (prevDaily > 0) {
      yoyPct = Number((((daily - prevDaily) / prevDaily) * 100).toFixed(1));
    }
  }

  const flags = [];
  let level = 'ok';
  const elevate = lv => {
    if (lv === 'red') level = 'red';
    else if (lv === 'amber' && level !== 'red') level = 'amber';
  };

  let demandPct = null;
  if (isElec) {
    const capKw = Number(meter?.contract_kw) || 0;
    const maxKw = Number(bill.max_demand_kw) || 0;
    if (capKw > 0 && maxKw > 0) {
      demandPct = Number(((maxKw / capKw) * 100).toFixed(1));
      if (demandPct > 100) {
        flags.push(`超約受罰(+${(maxKw - capKw).toFixed(1)}kW)`);
        elevate('red');
      } else if (demandPct >= 90) {
        flags.push(`超約風險(${demandPct}%)`);
        elevate('amber');
      }
    }
    const pf = bill.power_factor !== '' && bill.power_factor !== null && bill.power_factor !== undefined ? Number(bill.power_factor) : null;
    if (pf !== null && pf > 0) {
      if (pf < 80) { flags.push(`功因偏低(${pf}%)`); elevate('red'); }
      else if (pf < 85) { flags.push(`功因邊緣(${pf}%)`); elevate('amber'); }
    }
    if (yoyPct !== null && yoyPct > 25) {
      flags.push(`用電同期增${yoyPct}%`);
      elevate('amber');
    }
  } else {
    // 水費：雙重條件防寒暑假誤報（>20% 且日均增量 >= 2 度）
    if (yoyPct !== null && prevDaily !== null) {
      const deltaDaily = daily - prevDaily;
      if (yoyPct > 20 && deltaDaily >= 2) {
        flags.push(`疑似漏水(同期+${yoyPct}%/日增${deltaDaily.toFixed(1)}度)`);
        elevate('red');
      }
    } else {
      // 首年兜底：與前 3 期日均平均比對
      const prior3 = sameMeter
        .filter(b => String(b.billing_ym || '') < String(bill.billing_ym || ''))
        .sort((a, b) => String(b.billing_ym).localeCompare(String(a.billing_ym)))
        .slice(0, 3);
      if (prior3.length >= 2) {
        const avgDaily = prior3.reduce((s, b) => {
          const pd = billingDaysCount(b.bill_start, b.bill_end) || 60;
          return s + ((Number(b.usage_units) || 0) / pd);
        }, 0) / prior3.length;
        if (avgDaily > 0 && ((daily - avgDaily) / avgDaily) > 0.3 && (daily - avgDaily) >= 2) {
          flags.push(`用水偏高(較前${prior3.length}期+30%↑)`);
          elevate('amber');
        }
      }
    }
  }

  return {
    days, daily, prevDaily, yoyPct, demandPct,
    flags, alertText: flags.length ? flags.join('；') : '正常', level
  };
}

function checkLowDemandOptimization(meter, allBills) {
  if (meter.utility_type !== '電費' || !(Number(meter.contract_kw) > 0)) return false;
  const cap = Number(meter.contract_kw);
  const recent = allBills
    .filter(b => b.meter_id === meter.meter_id && Number(b.max_demand_kw) > 0 && b.billing_ym)
    .sort((a, b) => String(b.billing_ym).localeCompare(String(a.billing_ym)))
    .slice(0, 12);
  if (recent.length < 6) return false;
  // 需涵蓋至少 10 個月跨度，且每期皆低於 60%
  const newest = recent[0].billing_ym, oldest = recent[recent.length - 1].billing_ym;
  const spanMonths = (parseInt(newest.slice(0, 4), 10) - parseInt(oldest.slice(0, 4), 10)) * 12
    + (parseInt(newest.slice(5, 7), 10) - parseInt(oldest.slice(5, 7), 10)) + 1;
  if (spanMonths < 10) return false;
  return recent.every(b => (Number(b.max_demand_kw) / cap) < 0.6);
}

function calcUtilitiesBudgetProjection(rocYear) {
  const adYear = Number(rocYear) + 1911;
  const prevAdYear = adYear - 1;
  const meters = (appData.tables.Utilities_Meters || []).filter(m => m.is_active !== false);
  const bills = appData.tables.Utilities_Bills || [];
  const mMap = {};
  meters.forEach(m => { mMap[m.meter_id] = m; });

  // 依預算專款類別分組
  const groups = {};
  meters.forEach(m => {
    const cat = m.budget_category || (m.utility_type === '電費' ? '校內電費預算' : '校內水費預算');
    if (!groups[cat]) groups[cat] = { category: cat, budget: 0, meterIds: new Set(), types: new Set() };
    groups[cat].budget += Number(m.annual_budget) || 0;
    groups[cat].meterIds.add(m.meter_id);
    groups[cat].types.add(m.utility_type);
  });

  const results = Object.values(groups).map(g => {
    const curBills = bills.filter(b => g.meterIds.has(b.meter_id) && String(b.billing_ym || '').startsWith(String(adYear)));
    const prevBills = bills.filter(b => g.meterIds.has(b.meter_id) && String(b.billing_ym || '').startsWith(String(prevAdYear)));

    const curMonths = new Set(curBills.map(b => String(b.billing_ym).slice(5, 7)));
    const ytdActual = curBills.reduce((s, b) => s + (Number(b.bill_amount) || 0), 0);

    let projected = 0, modeLabel = '尚無本年帳單', factor = 1;
    if (prevBills.length >= 4 && curBills.length > 0) {
      const prevSame = prevBills.filter(b => curMonths.has(String(b.billing_ym).slice(5, 7)))
        .reduce((s, b) => s + (Number(b.bill_amount) || 0), 0);
      const prevRem = prevBills.filter(b => !curMonths.has(String(b.billing_ym).slice(5, 7)))
        .reduce((s, b) => s + (Number(b.bill_amount) || 0), 0);
      factor = (curMonths.size >= 2 && prevSame > 0) ? (ytdActual / prevSame) : 1.0;
      projected = Math.round(ytdActual + prevRem * factor);
      modeLabel = `季節曲線推估（調整係數 ${factor.toFixed(2)}）`;
    } else if (curBills.length > 0) {
      const maxM = Math.max(...Array.from(curMonths).map(mm => parseInt(mm, 10) || 1));
      projected = Math.round((ytdActual / maxM) * 12);
      modeLabel = '首年線性估算（未含夏月加權）';
    }

    const execPct = g.budget > 0 ? Number(((ytdActual / g.budget) * 100).toFixed(1)) : 0;
    const projPct = g.budget > 0 ? Number(((projected / g.budget) * 100).toFixed(1)) : 0;
    const level = (g.budget > 0 && projPct > 100) ? 'red' : (g.budget > 0 && projPct >= 90 ? 'amber' : 'ok');

    return { ...g, ytdActual, projected, modeLabel, execPct, projPct, level };
  });

  const totalBudget = results.reduce((s, r) => s + r.budget, 0);
  const totalActual = results.reduce((s, r) => s + r.ytdActual, 0);
  const totalProj = results.reduce((s, r) => s + r.projected, 0);
  return { adYear, meters, mMap, groups: results, totalBudget, totalActual, totalProj };
}

// ----------------------------------------------------------------------------
// 3. 畫面一：☀️ 太陽能屋頂租賃控管面板
// ----------------------------------------------------------------------------
function renderSolarViewHTML() {
  const ov = calcSolarOverview(opsSolarYear);
  const today = todayStr();
  const filteredRecs = ov.enriched
    .filter(r => opsSolarFilterSite === 'all' || r.solar_id === opsSolarFilterSite)
    .filter(r => r._rocYear === Number(opsSolarYear))
    .sort((a, b) => String(b.period_end || b.period_label).localeCompare(String(a.period_end || a.period_label)));

  return `
    <div class="ops-kpi-4">
      <div class="kpi-card kpi-blue">
        <div><div class="kpi-label">☀️ 併聯案場總容量</div><div class="kpi-val">${ov.totalKwp} <small style="font-size:13px">kWp</small></div></div>
        <span style="font-size:24px">🔆</span>
      </div>
      <div class="kpi-card kpi-green">
        <div><div class="kpi-label">💰 ${opsSolarYear}年累計實收回饋金</div><div class="kpi-val" style="font-size:22px">${fmtMoney(ov.yearActual)}</div></div>
        <span style="font-size:24px">🏦</span>
      </div>
      <div class="kpi-card ${ov.docAlerts?'kpi-amber':'kpi-green'}">
        <div><div class="kpi-label">🛡️ 保險／保證函到期提醒</div><div class="kpi-val">${ov.docAlerts}</div></div>
        <span style="font-size:24px">📄</span>
      </div>
      <div class="kpi-card ${ov.effAlerts?'kpi-red':'kpi-green'}">
        <div><div class="kpi-label">📉 本年對帳／效率警示期數</div><div class="kpi-val">${ov.effAlerts}</div></div>
        <span style="font-size:24px">⚡</span>
      </div>
    </div>

    <div class="panel">
      <div class="panel-hd">
        <h3>🏢 太陽能屋頂租賃契約主檔（共 ${ov.contracts.length} 案場）</h3>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn-sm" onclick="printSolarPDF()">🖨️ 輸出對帳報表 PDF</button>
          <button class="btn-sm btn-primary" onclick="openSolarContractModal()">＋ 新增太陽能案場契約</button>
        </div>
      </div>
      <div class="panel-bd">
        ${ov.contracts.length ? `<div class="ops-grid-2">${ov.contracts.map(c => renderSolarSiteCardHTML(c, ov.enriched, today)).join('')}</div>`
          : '<div class="empty-state">尚未建立太陽能屋頂租賃案場，點擊「＋ 新增太陽能案場契約」建檔（系統將自動監控保險效期、回饋金差額與發電效率）。</div>'}
      </div>
    </div>

    <div class="panel">
      <div class="panel-hd">
        <h3>📊 每期發電效率與回饋金對帳紀錄（民國 ${opsSolarYear} 年度）</h3>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          <button class="btn-xs" onclick="opsSolarYear--;renderCurrentView()">◀ 前年</button>
          <strong>${opsSolarYear} 年度</strong>
          <button class="btn-xs" onclick="opsSolarYear++;renderCurrentView()">後年 ▶</button>
          <select style="padding:3px 7px;border:1px solid #cbd5e1;border-radius:5px" onchange="opsSolarFilterSite=this.value;renderCurrentView()">
            <option value="all" ${opsSolarFilterSite==='all'?'selected':''}>全部案場</option>
            ${ov.contracts.map(c => `<option value="${esc(c.solar_id)}" ${opsSolarFilterSite===c.solar_id?'selected':''}>${esc(c.building_name)}</option>`).join('')}
          </select>
          <button class="btn-sm btn-primary" onclick="openSolarRecordModal('')">＋ 登錄本期對帳</button>
        </div>
      </div>
      <div class="panel-bd">
        ${filteredRecs.length ? `<div class="chart-box">${buildSolarYieldChartSVG(filteredRecs)}</div>` : ''}
        <div style="overflow-x:auto">
          ${filteredRecs.length ? `
            <table>
              <thead>
                <tr>
                  <th>案場與期別</th>
                  <th>計費區間</th>
                  <th>發電度數／日均效率</th>
                  <th>台電躉購金額</th>
                  <th>理論應收 vs 實收</th>
                  <th>入帳日與警示</th>
                  <th>維護防漏紀錄</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                ${filteredRecs.map(r => {
                  const ev = r._eval;
                  const yoyStr = ev.yoyPct !== null ? `${ev.yoyPct > 0 ? '+' : ''}${ev.yoyPct}%` : '首年';
                  return `
                    <tr>
                      <td>
                        <strong>${esc(r._contract?.building_name || r.solar_id)}</strong>
                        <div class="item-meta"><span class="tag tag-gray">${esc(r.period_label)}</span> ${r.drive_file_url ? `<a href="${esc(r.drive_file_url)}" target="_blank">📎 單據</a>` : ''}</div>
                      </td>
                      <td style="white-space:nowrap">${esc(r.period_start || '-')} ~ ${esc(r.period_end || '-')}<div class="item-meta">${ev.days} 天</div></td>
                      <td style="white-space:nowrap">
                        <div>${Number(r.generation_kwh || 0).toLocaleString('zh-TW')} 度</div>
                        <div class="item-meta">日均 <strong>${ev.dailyYield}</strong> 度/kWp（YoY ${yoyStr}）</div>
                      </td>
                      <td>${fmtMoney(r.taipower_revenue)}</td>
                      <td style="white-space:nowrap">
                        <div>應收：${fmtMoney(ev.expected)}</div>
                        <div class="item-meta">實收：<strong style="color:${ev.hasActual && Math.abs(ev.diffAmt)>10 ? 'var(--red)' : 'var(--green)'}">${ev.hasActual ? fmtMoney(ev.actual) : '尚未登錄'}</strong></div>
                      </td>
                      <td>
                        <div>${esc(r.payment_date || '未入帳')}</div>
                        ${ev.flags.length ? ev.flags.map(f => `<span class="tag ${ev.level==='red'?'tag-red':'tag-amber'}" style="margin-top:2px">${esc(f)}</span>`).join(' ') : '<span class="tag tag-green">正常</span>'}
                      </td>
                      <td style="max-width:180px"><div class="item-meta">${esc(r.maintenance_log || '-')}</div></td>
                      <td style="white-space:nowrap">
                        <button class="btn-xs" onclick="openSolarRecordModal('${esc(r.solar_id)}','${esc(r.record_id)}')">✎</button>
                        <button class="btn-xs btn-danger" onclick="deleteSolarRecord('${esc(r.record_id)}')">刪</button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          ` : '<div class="empty-state">本年度尚無太陽能對帳紀錄，點擊「＋ 登錄本期對帳」輸入台電躉購電費單即可自動驗算回饋金。</div>'}
        </div>
      </div>
    </div>
  `;
}

function renderSolarSiteCardHTML(c, allEnriched, today) {
  const ratePct = (normFeedbackRate(c.feedback_rate) * 100).toFixed(2).replace(/\.00$/, '');
  const insDiff = c.insurance_expiry ? diffDays(today, c.insurance_expiry) : null;
  const depDiff = c.deposit_expiry ? diffDays(today, c.deposit_expiry) : null;

  const badgeOf = (lbl, diff, dt) => {
    if (diff === null) return `<span class="tag tag-gray">${lbl}：未設</span>`;
    if (diff < 0) return `<span class="tag tag-red">🔴 ${lbl}已逾期 (${dt})</span>`;
    if (diff <= 30) return `<span class="tag tag-amber">🟡 ${lbl}剩 ${diff} 天 (${dt})</span>`;
    if (diff <= 60) return `<span class="tag tag-blue">🔵 ${lbl}剩 ${diff} 天 (${dt})</span>`;
    return `<span class="tag tag-green">✓ ${lbl}至 ${dt}</span>`;
  };

  let cardCls = 'ok';
  if ((insDiff !== null && insDiff < 0) || (depDiff !== null && depDiff < 0)) cardCls = 'red';
  else if ((insDiff !== null && insDiff <= 30) || (depDiff !== null && depDiff <= 30)) cardCls = 'amber';

  // 本年累計實收 vs 保底檢核
  const siteYearActual = allEnriched
    .filter(r => r.solar_id === c.solar_id && r._rocYear === Number(opsSolarYear) && r._eval.hasActual)
    .reduce((s, r) => s + r._eval.actual, 0);
  const minG = Number(c.min_annual_feedback) || 0;
  const minPct = minG > 0 ? Math.min(100, Math.round((siteYearActual / minG) * 100)) : 0;

  return `
    <div class="site-card ${cardCls}">
      <div class="item-row">
        <div>
          <span class="tag tag-blue">${esc(c.solar_id)}</span>
          <span class="tag ${c.status==='併聯發電中'?'tag-green':'tag-gray'}">${esc(c.status)}</span>
          <strong style="margin-left:4px;font-size:15px">${esc(c.building_name)}</strong>
        </div>
        <div style="display:flex;gap:4px">
          <button class="btn-xs btn-primary" onclick="openSolarRecordModal('${esc(c.solar_id)}')">＋ 登錄對帳</button>
          <button class="btn-xs" onclick="openSolarContractModal('${esc(c.solar_id)}')">✎</button>
          <button class="btn-xs btn-danger" onclick="deleteSolarContract('${esc(c.solar_id)}')">刪</button>
        </div>
      </div>
      <div class="item-meta" style="margin-top:5px">
        承租廠商：<strong>${esc(c.lessee_vendor || '-')}</strong> ｜ 容量：<strong>${c.capacity_kwp} kWp</strong> ｜ 回饋比例：<strong>${ratePct}%</strong>（${esc(c.billing_cycle)}）
      </div>
      <div class="item-meta">
        租期：${esc(c.contract_start || '-')} ~ ${esc(c.contract_end || '-')} ｜ 履保金：${fmtMoney(c.deposit_amount)}
        ${c.drive_folder_url ? `｜ <a href="${esc(c.drive_folder_url)}" target="_blank">📁 契約保單</a>` : ''}
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
        ${badgeOf('保險', insDiff, c.insurance_expiry)}
        ${badgeOf('保證函', depDiff, c.deposit_expiry)}
      </div>
      ${minG > 0 ? `
        <div class="item-meta" style="margin-top:8px">
          ${opsSolarYear}年保底檢核：實收 ${fmtMoney(siteYearActual)} ／ 保底 ${fmtMoney(minG)}（${minPct}%）
          <div class="mini-bar-wrap"><div class="mini-bar" style="width:${minPct}%;background:${minPct>=100?'var(--green)':'var(--primary)'}"></div></div>
        </div>` : ''}
    </div>
  `;
}

function buildSolarYieldChartSVG(records) {
  const ordered = [...records].reverse();
  const W = 980, H = 190, padL = 50, padR = 20, padT = 24, padB = 34;
  const chartW = W - padL - padR, chartH = H - padT - padB;
  const maxY = Math.max(4.5, ...ordered.map(r => Math.max(r._eval.dailyYield, r._eval.prevYield || 0))) * 1.1;
  const yOf = v => padT + chartH - (v / maxY) * chartH;
  const slotW = chartW / Math.max(1, ordered.length);

  let svg = `<text x="8" y="14" font-size="11.5" font-weight="700" fill="#334155">日均單位發電量趨勢（kWh/kWp/日｜淺灰：去年同期｜紅線：2.2 警戒基準）</text>`;
  // 2.2 警戒線
  const warnY = yOf(2.2);
  svg += `<line x1="${padL}" y1="${warnY}" x2="${W - padR}" y2="${warnY}" stroke="#ef4444" stroke-dasharray="4,3" stroke-width="1.2"/>`;
  svg += `<text x="${padL - 5}" y="${warnY + 3}" font-size="9.5" fill="#dc2626" text-anchor="end">2.2</text>`;

  ordered.forEach((r, i) => {
    const cx = padL + i * slotW + slotW / 2;
    const bw = Math.min(26, slotW * 0.34);
    const ev = r._eval;
    if (ev.prevYield > 0) {
      const py = yOf(ev.prevYield);
      svg += `<rect x="${cx - bw - 2}" y="${py}" width="${bw}" height="${padT + chartH - py}" rx="2" fill="#cbd5e1"><title>去年同期：${ev.prevYield}</title></rect>`;
    }
    const cy = yOf(ev.dailyYield);
    const col = ev.level === 'red' ? '#dc2626' : (ev.level === 'amber' ? '#d97706' : '#059669');
    svg += `<rect x="${cx + (ev.prevYield > 0 ? 2 : -bw / 2)}" y="${cy}" width="${bw}" height="${padT + chartH - cy}" rx="2" fill="${col}"><title>本期：${ev.dailyYield} kWh/kWp/日</title></rect>`;
    svg += `<text x="${cx + (ev.prevYield > 0 ? bw / 2 + 2 : 0)}" y="${cy - 4}" font-size="10" font-weight="700" fill="${col}" text-anchor="middle">${ev.dailyYield}</text>`;
    const lbl = `${(r._contract?.building_name || '').slice(0, 5)} ${r.period_label}`;
    svg += `<text x="${cx}" y="${H - 12}" font-size="10" fill="#475569" text-anchor="middle">${escSvg(lbl)}</text>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;font-family:'Microsoft JhengHei',sans-serif">${svg}</svg>`;
}

function openSolarContractModal(solarId = '') {
  const c = solarId ? (appData.tables.Solar_Contracts || []).find(x => x.solar_id === solarId) : {};
  const rateDisplay = c.feedback_rate !== undefined && c.feedback_rate !== '' ? (normFeedbackRate(c.feedback_rate) * 100) : '';
  openModal(solarId ? '✎ 編輯太陽能屋頂租賃契約' : '＋ 新增太陽能屋頂租賃契約', `
    <div class="form-grid">
      <div class="field full"><label>設置棟別與案場名稱 *</label><input id="sc-name" type="text" value="${esc(c.building_name || '')}" placeholder="例：教學大樓暨活動中心屋頂"></div>
      <div class="field full"><label>承租廠商與聯絡窗口</label><input id="sc-vendor" type="text" value="${esc(c.lessee_vendor || '')}" placeholder="例：XX綠能科技／陳經理 0912-xxx-xxx"></div>
      <div class="field"><label>總設置容量（kWp）*</label><input id="sc-kwp" type="number" step="0.01" value="${esc(c.capacity_kwp || '')}" placeholder="例：99.8"></div>
      <div class="field"><label>回饋金比例（%，例 12.5 代表 12.5%）*</label><input id="sc-rate" type="number" step="0.01" value="${esc(rateDisplay)}" placeholder="例：12.5"></div>
      <div class="field"><label>結算週期</label>
        <select id="sc-cycle">${['季結','半年結','年結'].map(x=>`<option value="${x}" ${c.billing_cycle===x?'selected':''}>${x}</option>`).join('')}</select>
      </div>
      <div class="field"><label>年度保底回饋金（元，無則填 0）</label><input id="sc-min" type="number" value="${Number(c.min_annual_feedback)||0}"></div>
      <div class="field"><label>契約起始日</label><input id="sc-s1" type="date" value="${esc(c.contract_start || '')}"></div>
      <div class="field"><label>契約屆滿日</label><input id="sc-s2" type="date" value="${esc(c.contract_end || '')}"></div>
      <div class="field"><label>履約保證金額（元）</label><input id="sc-dep" type="number" value="${esc(c.deposit_amount || '')}"></div>
      <div class="field"><label>履約保證函效期日（現金可留空）</label><input id="sc-depexp" type="date" value="${esc(c.deposit_expiry || '')}"></div>
      <div class="field"><label>公共意外險／產險續保到期日</label><input id="sc-insexp" type="date" value="${esc(c.insurance_expiry || '')}"></div>
      <div class="field"><label>案場狀態</label>
        <select id="sc-status">${['併聯發電中','建置中','已期滿'].map(x=>`<option value="${x}" ${(c.status||'併聯發電中')===x?'selected':''}>${x}</option>`).join('')}</select>
      </div>
      <div class="field full"><label>契約與保單雲端資料夾連結</label><input id="sc-url" type="url" value="${esc(c.drive_folder_url || '')}"></div>
    </div>
  `, `
    <button onclick="closeModal()">取消</button>
    <button class="btn-primary" onclick="saveSolarContract('${esc(solarId)}')">儲存契約</button>
  `);
}

async function saveSolarContract(solarId) {
  const name = document.getElementById('sc-name').value.trim();
  const kwp = Number(document.getElementById('sc-kwp').value);
  const ratePct = Number(document.getElementById('sc-rate').value);
  if (!name || !kwp) return toast('請填寫案場名稱與設置容量 (kWp)');

  const rec = {
    solar_id: solarId || nextId('Solar_Contracts', 'solar_id', 'SOL', 3),
    building_name: name,
    lessee_vendor: document.getElementById('sc-vendor').value.trim(),
    capacity_kwp: kwp,
    feedback_rate: Number((ratePct / 100).toFixed(5)),
    min_annual_feedback: Number(document.getElementById('sc-min').value) || 0,
    billing_cycle: document.getElementById('sc-cycle').value,
    contract_start: document.getElementById('sc-s1').value,
    contract_end: document.getElementById('sc-s2').value,
    deposit_amount: Number(document.getElementById('sc-dep').value) || 0,
    deposit_expiry: document.getElementById('sc-depexp').value,
    insurance_expiry: document.getElementById('sc-insexp').value,
    status: document.getElementById('sc-status').value,
    drive_folder_url: document.getElementById('sc-url').value.trim(),
    updated_at: nowStr(), is_deleted: false
  };
  upsertLocal('Solar_Contracts', rec, 'solar_id');
  closeModal();
  renderCurrentView();
  await pushToCloud({ action: 'upsert', table: 'Solar_Contracts', record: rec });
  toast('✅ 已儲存太陽能屋頂租賃契約');
}

async function deleteSolarContract(id) {
  if (!confirm('確定刪除此太陽能案場契約？')) return;
  appData.tables.Solar_Contracts = appData.tables.Solar_Contracts.filter(c => c.solar_id !== id);
  renderCurrentView();
  await pushToCloud({ action: 'softDelete', table: 'Solar_Contracts', id });
}

function openSolarRecordModal(presetSolarId = '', recordId = '') {
  const contracts = appData.tables.Solar_Contracts || [];
  if (!contracts.length) return toast('請先新增至少一個太陽能案場契約');
  const r = recordId ? (appData.tables.Solar_Records || []).find(x => x.record_id === recordId) : {};
  const targetSite = r.solar_id || presetSolarId || contracts[0].solar_id;
  const defPeriod = r.period_label || `${opsSolarYear}-Q${Math.ceil((new Date().getMonth() + 1) / 3)}`;

  openModal(recordId ? '✎ 編輯太陽能對帳紀錄' : '＋ 登錄太陽能每期發電與回饋金對帳', `
    <div id="sr-preview" class="gate-banner green">輸入台電電費單數據後將自動試算應收回饋金與發電效率…</div>
    <div class="form-grid">
      <div class="field"><label>對應案場 *</label>
        <select id="sr-site" onchange="previewSolarRecord()">${contracts.map(c=>`<option value="${esc(c.solar_id)}" ${targetSite===c.solar_id?'selected':''}>${esc(c.building_name)} (${c.capacity_kwp}kWp)</option>`).join('')}</select>
      </div>
      <div class="field"><label>結算期別（建議格式 115-Q1 或 115-H1）*</label><input id="sr-lbl" type="text" value="${esc(defPeriod)}" oninput="previewSolarRecord()"></div>
      <div class="field"><label>計費起日 *</label><input id="sr-s1" type="date" value="${esc(r.period_start || '')}" onchange="previewSolarRecord()"></div>
      <div class="field"><label>計費迄日 *</label><input id="sr-s2" type="date" value="${esc(r.period_end || '')}" onchange="previewSolarRecord()"></div>
      <div class="field"><label>本期發電度數（kWh）</label><input id="sr-kwh" type="number" step="0.1" value="${esc(r.generation_kwh ?? '')}" oninput="previewSolarRecord()"></div>
      <div class="field"><label>台電躉購電費總額（元）</label><input id="sr-rev" type="number" value="${esc(r.taipower_revenue ?? '')}" oninput="previewSolarRecord()"></div>
      <div class="field"><label>理論應收回饋金（自動算）</label><input id="sr-exp" type="number" value="${esc(r.expected_feedback ?? '')}" readonly style="background:#f8fafc;font-weight:700"></div>
      <div class="field"><label>實際入帳金額（元）</label><input id="sr-act" type="number" value="${esc(r.actual_feedback ?? '')}" oninput="previewSolarRecord()"></div>
      <div class="field"><label>公庫入帳日期</label><input id="sr-pdate" type="date" value="${esc(r.payment_date || '')}" onchange="previewSolarRecord()"></div>
      <div class="field"><label>電費單／匯款單掃描連結</label><input id="sr-url" type="url" value="${esc(r.drive_file_url || '')}"></div>
      <div class="field full"><label>屋頂防漏、清洗或逆變器維護紀錄</label><textarea id="sr-log">${esc(r.maintenance_log || '')}</textarea></div>
    </div>
  `, `
    <button onclick="closeModal()">取消</button>
    <button class="btn-primary" onclick="saveSolarRecord('${esc(recordId)}')">儲存對帳紀錄</button>
  `);
  previewSolarRecord(recordId);
}

function previewSolarRecord(excludeId = '') {
  const box = document.getElementById('sr-preview');
  if (!box) return;
  const sid = document.getElementById('sr-site').value;
  const contract = (appData.tables.Solar_Contracts || []).find(c => c.solar_id === sid);
  const simRec = {
    record_id: excludeId || '_sim',
    solar_id: sid,
    period_label: document.getElementById('sr-lbl').value.trim(),
    period_start: document.getElementById('sr-s1').value,
    period_end: document.getElementById('sr-s2').value,
    generation_kwh: Number(document.getElementById('sr-kwh').value) || 0,
    taipower_revenue: Number(document.getElementById('sr-rev').value) || 0,
    actual_feedback: document.getElementById('sr-act').value === '' ? '' : Number(document.getElementById('sr-act').value),
    payment_date: document.getElementById('sr-pdate').value
  };
  const ev = evaluateSolarRecord(simRec, contract, appData.tables.Solar_Records || []);
  document.getElementById('sr-exp').value = ev.expected;

  box.className = 'gate-banner ' + (ev.level === 'red' ? 'red' : ev.level === 'amber' ? 'amber' : 'green');
  box.innerHTML = `計費 <strong>${ev.days}</strong> 天 ｜ 理論應收：<strong>${fmtMoney(ev.expected)}</strong> ｜ 日均效率：<strong>${ev.dailyYield} kWh/kWp/日</strong> ${ev.yoyPct!==null?`(去年同期 ${ev.yoyPct>0?'+':''}${ev.yoyPct}%)`:'(無去年同期比對)'}`
    + (ev.flags.length ? `<br>⚠️ 偵測異常：<strong>${esc(ev.flags.join('；'))}</strong>` : '<br>✅ 對帳金額與發電效率均正常');
}

async function saveSolarRecord(recordId) {
  const sid = document.getElementById('sr-site').value;
  const lbl = document.getElementById('sr-lbl').value.trim();
  if (!sid || !lbl) return toast('請選擇案場並填寫結算期別');
  const contract = (appData.tables.Solar_Contracts || []).find(c => c.solar_id === sid);
  const s1 = document.getElementById('sr-s1').value;
  const s2 = document.getElementById('sr-s2').value;
  const kwh = Number(document.getElementById('sr-kwh').value) || 0;
  const rev = Number(document.getElementById('sr-rev').value) || 0;
  const actRaw = document.getElementById('sr-act').value;

  const rec = {
    record_id: recordId || nextId('Solar_Records', 'record_id', 'SR', 4),
    solar_id: sid,
    period_label: lbl,
    period_start: s1,
    period_end: s2,
    generation_kwh: kwh,
    taipower_revenue: rev,
    expected_feedback: Math.round(rev * normFeedbackRate(contract?.feedback_rate)),
    actual_feedback: actRaw === '' ? '' : Number(actRaw),
    payment_date: document.getElementById('sr-pdate').value,
    yield_per_kwp: (contract?.capacity_kwp && billingDaysCount(s1, s2)) ? Number((kwh / (Number(contract.capacity_kwp) * billingDaysCount(s1, s2))).toFixed(2)) : 0,
    maintenance_log: document.getElementById('sr-log').value.trim(),
    drive_file_url: document.getElementById('sr-url').value.trim(),
    updated_at: nowStr(), is_deleted: false
  };
  upsertLocal('Solar_Records', rec, 'record_id');
  closeModal();
  renderCurrentView();
  await pushToCloud({ action: 'upsert', table: 'Solar_Records', record: rec });
  toast('✅ 已儲存太陽能對帳紀錄');
}

async function deleteSolarRecord(id) {
  if (!confirm('確定刪除此筆太陽能對帳紀錄？')) return;
  appData.tables.Solar_Records = appData.tables.Solar_Records.filter(r => r.record_id !== id);
  renderCurrentView();
  await pushToCloud({ action: 'softDelete', table: 'Solar_Records', id });
}

function printSolarPDF() {
  const ov = calcSolarOverview(opsSolarYear);
  const recs = ov.enriched.filter(r => r._rocYear === Number(opsSolarYear));
  document.getElementById('print-area').innerHTML = `
    <div class="print-header">
      <div>
        <div style="font-size:12px;color:#475569">${esc(appData.schoolName)} ｜ 太陽能屋頂租賃履約與回饋金對帳表</div>
        <h2 style="margin:2px 0 0;font-size:17px">民國 ${opsSolarYear} 年度發電效率與回饋金彙整報表</h2>
      </div>
      <div style="text-align:right;font-size:11px;color:#475569">
        <div>總設置容量：${ov.totalKwp} kWp ｜ 年度累計實收：${fmtMoney(ov.yearActual)}</div>
        <div>列印日期：${todayStr()}</div>
      </div>
    </div>
    <table class="print-table" style="margin-bottom:10px">
      <thead>
        <tr><th>案場棟別</th><th>承租廠商</th><th>容量(kWp)</th><th>回饋比例</th><th>契約起迄</th><th>保險到期日</th><th>履保函效期</th><th>狀態</th></tr>
      </thead>
      <tbody>
        ${ov.contracts.map(c => `<tr>
          <td><strong>${esc(c.building_name)}</strong></td><td>${esc(c.lessee_vendor)}</td>
          <td style="text-align:right">${c.capacity_kwp}</td>
          <td style="text-align:right">${(normFeedbackRate(c.feedback_rate)*100).toFixed(2)}%</td>
          <td style="text-align:center">${esc(c.contract_start)} ~ ${esc(c.contract_end)}</td>
          <td style="text-align:center">${esc(c.insurance_expiry || '-')}</td>
          <td style="text-align:center">${esc(c.deposit_expiry || '-')}</td>
          <td style="text-align:center">${esc(c.status)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <table class="print-table">
      <thead>
        <tr><th>案場／期別</th><th>計費區間</th><th>發電度數</th><th>日均度/kWp (YoY)</th><th>台電躉購額</th><th>應收回饋金</th><th>實收回饋金</th><th>入帳日</th><th>異常與維護備註</th></tr>
      </thead>
      <tbody>
        ${recs.map(r => `<tr>
          <td>${esc(r._contract?.building_name || r.solar_id)} (${esc(r.period_label)})</td>
          <td style="text-align:center">${esc(r.period_start)}~${esc(r.period_end)}</td>
          <td style="text-align:right">${Number(r.generation_kwh||0).toLocaleString('zh-TW')}</td>
          <td style="text-align:center">${r._eval.dailyYield} (${r._eval.yoyPct!==null?(r._eval.yoyPct>0?'+':'')+r._eval.yoyPct+'%':'首年'})</td>
          <td style="text-align:right">${Number(r.taipower_revenue||0).toLocaleString('zh-TW')}</td>
          <td style="text-align:right">${r._eval.expected.toLocaleString('zh-TW')}</td>
          <td style="text-align:right">${r._eval.hasActual ? r._eval.actual.toLocaleString('zh-TW') : '-'}</td>
          <td style="text-align:center">${esc(r.payment_date || '未入帳')}</td>
          <td>${esc([r._eval.flags.join('；'), r.maintenance_log].filter(Boolean).join('｜') || '正常')}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  `;
  setTimeout(() => window.print(), 80);
}

// ----------------------------------------------------------------------------
// 4. 畫面二：⚡ 學校水電費多錶號控管與異常分析面板
// ----------------------------------------------------------------------------
function renderUtilitiesViewHTML() {
  const proj = calcUtilitiesBudgetProjection(opsUtilYear);
  const allBills = appData.tables.Utilities_Bills || [];
  const metersAll = appData.tables.Utilities_Meters || [];
  const adYear = proj.adYear;

  const filteredMeters = metersAll
    .filter(m => m.is_active !== false)
    .filter(m => opsUtilTypeFilter === 'all' || m.utility_type === opsUtilTypeFilter);

  const validMeterIds = new Set(filteredMeters.map(m => m.meter_id));
  const yearBills = allBills
    .filter(b => String(b.billing_ym || '').startsWith(String(adYear)))
    .filter(b => opsUtilMeterFilter === 'all' ? validMeterIds.has(b.meter_id) : b.meter_id === opsUtilMeterFilter)
    .map(b => ({ ...b, _meter: proj.mMap[b.meter_id], _eval: evaluateUtilityBill(b, proj.mMap[b.meter_id], allBills) }))
    .sort((a, b) => String(b.billing_ym).localeCompare(String(a.billing_ym)));

  const anomalyCount = yearBills.filter(b => b._eval.level === 'red' || b._eval.level === 'amber').length;

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <button class="btn-xs" onclick="opsUtilYear--;renderCurrentView()">◀ 前年</button>
        <strong style="font-size:15px">民國 ${opsUtilYear} 年度（${adYear}）</strong>
        <button class="btn-xs" onclick="opsUtilYear++;renderCurrentView()">後年 ▶</button>
        <span style="margin-left:8px"></span>
        ${[['all','全部水電'],['電費','⚡ 只看電費'],['水費','💧 只看水費']].map(([k,l]) =>
          `<button class="pill-btn ${opsUtilTypeFilter===k?'active':''}" onclick="opsUtilTypeFilter='${k}';opsUtilMeterFilter='all';renderCurrentView()">${l}</button>`
        ).join('')}
        <select style="padding:4px 8px;border:1px solid #cbd5e1;border-radius:6px" onchange="opsUtilMeterFilter=this.value;renderCurrentView()">
          <option value="all" ${opsUtilMeterFilter==='all'?'selected':''}>全部錶號 (${filteredMeters.length})</option>
          ${filteredMeters.map(m => `<option value="${esc(m.meter_id)}" ${opsUtilMeterFilter===m.meter_id?'selected':''}>[${m.utility_type}] ${esc(m.meter_label)} (${esc(m.meter_no)})</option>`).join('')}
        </select>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn-sm" onclick="openUtilityMeterModal()">＋ 新增水電錶</button>
        <button class="btn-sm btn-primary" onclick="openUtilityBillModal('')">＋ 登錄本期水電帳單</button>
        <button class="btn-sm" onclick="printUtilitiesPDF()">🖨️ 輸出水電報表 PDF</button>
      </div>
    </div>

    <!-- 1. 年度預算執行與季節曲線推估 -->
    <div class="panel">
      <div class="panel-hd">
        <h3>💰 ${opsUtilYear} 年度水電預算執行與「季節曲線」年底落點推估</h3>
        <span class="item-meta">全校總預算 ${fmtMoney(proj.totalBudget)} ｜ 累計實支 ${fmtMoney(proj.totalActual)} ｜ 預估全年 ${fmtMoney(proj.totalProj)} ｜ 本年異常帳單 ${anomalyCount} 筆</span>
      </div>
      <div class="panel-bd">
        ${proj.groups.length ? `<div class="ops-grid-3">${proj.groups.map(g => {
          const barCol = g.level === 'red' ? 'var(--red)' : g.level === 'amber' ? 'var(--amber)' : 'var(--green)';
          return `
            <div class="site-card ${g.level}">
              <div class="item-row">
                <strong>${esc(g.category)}</strong>
                <span class="tag ${g.level==='red'?'tag-red':g.level==='amber'?'tag-amber':'tag-green'}">${g.budget ? `推估 ${g.projPct}%` : '未設預算'}</span>
              </div>
              <div class="item-meta" style="margin-top:4px">
                實支 <strong>${fmtMoney(g.ytdActual)}</strong> ／ 預算 ${fmtMoney(g.budget)}（實支 ${g.execPct}%）
              </div>
              <div class="item-meta">
                年底落點推估：<strong style="color:${barCol}">${fmtMoney(g.projected)}</strong>
                ${g.budget > 0 ? `（預估${g.budget - g.projected >= 0 ? '結餘 ' + fmtMoney(g.budget - g.projected) : '短缺 ' + fmtMoney(g.projected - g.budget)}）` : ''}
              </div>
              <div class="mini-bar-wrap"><div class="mini-bar" style="width:${Math.min(100, g.projPct)}%;background:${barCol}"></div></div>
              <div class="item-meta" style="margin-top:4px;font-size:12px">📐 ${esc(g.modeLabel)}</div>
            </div>
          `;
        }).join('')}</div>` : `<div class="empty-state">尚未建立水電錶主檔，無法統計預算。<br><button class="btn-sm btn-primary" style="margin-top:8px" onclick="seedDefaultSchoolMeters()">⚡ 一鍵建立校園常用 4 顆水電錶範本</button></div>`}
      </div>
    </div>

    <!-- 2. 多錶號健康狀態卡 -->
    ${filteredMeters.length ? `
      <div class="panel">
        <div class="panel-hd">
          <h3>🔌 多錶號即時監控（點選錶號可篩選下方圖表與帳單）</h3>
          <button class="btn-xs" onclick="openUtilityMeterModal()">＋ 新增錶號</button>
        </div>
        <div class="panel-bd">
          <div class="ops-grid-3">
            ${filteredMeters.map(m => renderMeterStatusCardHTML(m, allBills)).join('')}
          </div>
        </div>
      </div>
    ` : ''}

    <!-- 3. 1~12 月同期走勢比較圖（SVG） -->
    ${filteredMeters.length ? `
      <div class="panel">
        <div class="panel-hd">
          <h3>📈 ${opsUtilYear} 年度 vs 去年同期（${opsUtilYear - 1} 年度）月度走勢對照</h3>
          <div style="display:flex;gap:6px">
            <button class="pill-btn ${opsUtilChartMetric==='amount'?'active':''}" onclick="opsUtilChartMetric='amount';renderCurrentView()">金額（元）</button>
            <button class="pill-btn ${opsUtilChartMetric==='usage'?'active':''}" onclick="opsUtilChartMetric='usage';renderCurrentView()">度數</button>
          </div>
        </div>
        <div class="panel-bd">
          <div class="chart-box" style="margin-bottom:0">${buildUtilitiesMonthlySVG(adYear, allBills, opsUtilMeterFilter === 'all' ? validMeterIds : new Set([opsUtilMeterFilter]))}</div>
        </div>
      </div>
    ` : ''}

    <!-- 4. 各期帳單與異常查修明細表 -->
    <div class="panel">
      <div class="panel-hd">
        <h3>🧾 各期水電帳單與異常查修紀錄（共 ${yearBills.length} 筆）</h3>
        <button class="btn-sm btn-primary" onclick="openUtilityBillModal('')">＋ 登錄帳單</button>
      </div>
      <div class="panel-bd" style="overflow-x:auto">
        ${yearBills.length ? `
          <table>
            <thead>
              <tr>
                <th>歸屬年月／錶號</th>
                <th>計費區間</th>
                <th>度數與日均</th>
                <th>去年同期 YoY</th>
                <th>應繳金額</th>
                <th>電錶需量／功因</th>
                <th>異常預警與查修備註</th>
                <th>核銷狀態</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${yearBills.map(b => {
                const ev = b._eval;
                const m = b._meter || {};
                const isElec = m.utility_type === '電費';
                return `
                  <tr>
                    <td>
                      <strong>${esc(b.billing_ym)}</strong>
                      <span class="tag ${isElec?'tag-amber':'tag-blue'}">${esc(m.utility_type || '')}</span>
                      <div class="item-meta">${esc(m.meter_label || b.meter_id)}</div>
                    </td>
                    <td style="white-space:nowrap">${esc(b.bill_start || '-')} ~ ${esc(b.bill_end || '-')}<div class="item-meta">${ev.days} 天</div></td>
                    <td style="white-space:nowrap"><strong>${Number(b.usage_units||0).toLocaleString('zh-TW')}</strong> 度<div class="item-meta">日均 ${ev.daily}</div></td>
                    <td style="white-space:nowrap">${ev.yoyPct !== null ? `<strong style="color:${ev.yoyPct>20?'var(--red)':'var(--text)'}">${ev.yoyPct>0?'+':''}${ev.yoyPct}%</strong>` : '<span class="item-meta">無同期</span>'}</td>
                    <td style="white-space:nowrap"><strong>${fmtMoney(b.bill_amount)}</strong></td>
                    <td style="white-space:nowrap">
                      ${isElec ? `
                        <div>需量：${b.max_demand_kw || '-'} kW ${ev.demandPct!==null?`(${ev.demandPct}%)`:''}</div>
                        <div class="item-meta">功因：${b.power_factor || '-'}%</div>
                      ` : '<span class="item-meta">水錶不適用</span>'}
                    </td>
                    <td style="max-width:210px">
                      <span class="tag ${ev.level==='red'?'tag-red':ev.level==='amber'?'tag-amber':'tag-green'}">${esc(ev.alertText)}</span>
                      ${b.handling_note ? `<div class="item-meta">🔧 ${esc(b.handling_note)}</div>` : ''}
                    </td>
                    <td>
                      <select style="padding:3px 6px;border:1px solid #cbd5e1;border-radius:5px;font-size:12px" onchange="toggleBillPaidStatus('${esc(b.bill_id)}',this.value)">
                        <option value="待核銷" ${b.paid_status!=='已撥款'?'selected':''}>待核銷</option>
                        <option value="已撥款" ${b.paid_status==='已撥款'?'selected':''}>已撥款</option>
                      </select>
                    </td>
                    <td style="white-space:nowrap">
                      <button class="btn-xs" onclick="openUtilityBillModal('${esc(b.meter_id)}','${esc(b.bill_id)}')">✎</button>
                      <button class="btn-xs btn-danger" onclick="deleteUtilityBill('${esc(b.bill_id)}')">刪</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        ` : '<div class="empty-state">本年度尚無符合篩選的水電帳單紀錄，點擊「＋ 登錄本期水電帳單」開始追蹤。</div>'}
      </div>
    </div>
  `;
}

function renderMeterStatusCardHTML(m, allBills) {
  const mBills = allBills.filter(b => b.meter_id === m.meter_id)
    .sort((a, b) => String(b.billing_ym || '').localeCompare(String(a.billing_ym || '')));
  const latest = mBills[0];
  const ev = latest ? evaluateUtilityBill(latest, m, allBills) : null;
  const lowDemOpt = checkLowDemandOptimization(m, allBills);
  const cls = ev?.level === 'red' ? 'red' : (ev?.level === 'amber' ? 'amber' : (lowDemOpt ? 'blue' : ''));

  return `
    <div class="meter-card ${cls}">
      <div class="item-row">
        <div style="cursor:pointer" onclick="opsUtilMeterFilter='${esc(m.meter_id)}';renderCurrentView()">
          <span class="tag ${m.utility_type==='電費'?'tag-amber':'tag-blue'}">${esc(m.utility_type)}</span>
          <strong style="margin-left:4px">${esc(m.meter_label)}</strong>
        </div>
        <div style="display:flex;gap:4px">
          <button class="btn-xs btn-primary" onclick="openUtilityBillModal('${esc(m.meter_id)}')">＋帳單</button>
          <button class="btn-xs" onclick="openUtilityMeterModal('${esc(m.meter_id)}')">✎</button>
        </div>
      </div>
      <div class="item-meta" style="margin-top:4px">
        錶號：<code>${esc(m.meter_no)}</code> ｜ 專款：${esc(m.budget_category || '-')}
        ${m.utility_type==='電費' && m.contract_kw ? `｜契約容量：<strong>${m.contract_kw} kW</strong>` : ''}
      </div>
      <div class="item-meta" style="margin-top:4px">
        ${latest ? `最新 (${latest.billing_ym})：${fmtMoney(latest.bill_amount)} ／ ${latest.usage_units} 度 <span class="tag ${ev.level==='red'?'tag-red':ev.level==='amber'?'tag-amber':'tag-green'}">${esc(ev.alertText)}</span>` : '尚未登錄任何帳單'}
      </div>
      ${lowDemOpt ? `<div class="item-meta" style="color:var(--primary);font-weight:700;margin-top:4px">💡 連續多期需量低於 60%，可評估調降契約容量省基本電費</div>` : ''}
    </div>
  `;
}

function buildUtilitiesMonthlySVG(adYear, allBills, meterIdSet) {
  const curM = Array(12).fill(0), prevM = Array(12).fill(0), redM = Array(12).fill(false);
  const mMap = {};
  (appData.tables.Utilities_Meters || []).forEach(m => { mMap[m.meter_id] = m; });

  allBills.forEach(b => {
    if (!meterIdSet.has(b.meter_id) || !b.billing_ym) return;
    const y = parseInt(String(b.billing_ym).slice(0, 4), 10);
    const mIdx = parseInt(String(b.billing_ym).slice(5, 7), 10) - 1;
    if (mIdx < 0 || mIdx > 11) return;
    const val = opsUtilChartMetric === 'amount' ? (Number(b.bill_amount) || 0) : (Number(b.usage_units) || 0);
    if (y === adYear) {
      curM[mIdx] += val;
      const ev = evaluateUtilityBill(b, mMap[b.meter_id], allBills);
      if (ev.level === 'red') redM[mIdx] = true;
    } else if (y === adYear - 1) {
      prevM[mIdx] += val;
    }
  });

  const maxV = Math.max(100, ...curM, ...prevM) * 1.15;
  const W = 980, H = 200, padL = 62, padR = 16, padT = 24, padB = 30;
  const chartW = W - padL - padR, chartH = H - padT - padB;
  const yOf = v => padT + chartH - (v / maxV) * chartH;
  const slotW = chartW / 12;

  let svg = `<text x="8" y="14" font-size="11.5" font-weight="700" fill="#334155">1～12月${opsUtilChartMetric==='amount'?'費用（元）':'用量（度）'}對照（淺灰：${adYear-1912}年 ｜ 深藍：${adYear-1911}年 ｜ 紅：含異常紅燈）</text>`;
  [0, 0.5, 1].forEach(r => {
    const v = Math.round(maxV * r), y = yOf(v);
    svg += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#e2e8f0"/>`;
    svg += `<text x="${padL - 6}" y="${y + 3}" font-size="9.5" fill="#64748b" text-anchor="end">${v.toLocaleString('zh-TW')}</text>`;
  });

  for (let i = 0; i < 12; i++) {
    const cx = padL + i * slotW + slotW / 2;
    const bw = Math.min(22, slotW * 0.34);
    if (prevM[i] > 0) {
      const py = yOf(prevM[i]);
      svg += `<rect x="${cx - bw - 1.5}" y="${py}" width="${bw}" height="${padT + chartH - py}" rx="2" fill="#cbd5e1"><title>去年${i+1}月：${prevM[i].toLocaleString('zh-TW')}</title></rect>`;
    }
    if (curM[i] > 0) {
      const cy = yOf(curM[i]);
      const col = redM[i] ? '#dc2626' : '#2563eb';
      svg += `<rect x="${cx + 1.5}" y="${cy}" width="${bw}" height="${padT + chartH - cy}" rx="2" fill="${col}"><title>今年${i+1}月：${curM[i].toLocaleString('zh-TW')}</title></rect>`;
    }
    svg += `<text x="${cx}" y="${H - 10}" font-size="10.5" fill="#475569" text-anchor="middle">${i + 1}月</text>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;font-family:'Microsoft JhengHei',sans-serif">${svg}</svg>`;
}

async function seedDefaultSchoolMeters() {
  const templates = [
    { meter_id: 'MTR-E01', meter_no: '00-00-0000-00-0', utility_type: '電費', meter_label: '一般校園用電主錶', contract_kw: 150, budget_category: '校內基本水電', annual_budget: 600000, is_active: true },
    { meter_id: 'MTR-E02', meter_no: '00-00-0000-00-1', utility_type: '電費', meter_label: '班班有冷氣專錶', contract_kw: 200, budget_category: '冷氣電費專款', annual_budget: 450000, is_active: true },
    { meter_id: 'MTR-E03', meter_no: '00-00-0000-00-2', utility_type: '電費', meter_label: '中央廚房獨立電錶', contract_kw: 80, budget_category: '中央廚房專款', annual_budget: 240000, is_active: true },
    { meter_id: 'MTR-W01', meter_no: '00-00000000-0', utility_type: '水費', meter_label: '校園主棟總水錶', contract_kw: '', budget_category: '校內基本水電', annual_budget: 180000, is_active: true }
  ].map(r => ({ ...r, updated_at: nowStr(), is_deleted: false }));

  templates.forEach(r => upsertLocal('Utilities_Meters', r, 'meter_id'));
  renderCurrentView();
  await pushToCloud({ action: 'batchUpsert', items: [{ table: 'Utilities_Meters', records: templates }] });
  toast('✅ 已建立 4 顆校園常用水電錶範本（請點 ✎ 修改為實際電號與契約容量）');
}

function openUtilityMeterModal(meterId = '') {
  const m = meterId ? (appData.tables.Utilities_Meters || []).find(x => x.meter_id === meterId) : {};
  const isElec = (m.utility_type || '電費') === '電費';
  openModal(meterId ? '✎ 編輯水電錶主檔' : '＋ 新增學校水電錶主檔', `
    <div class="form-grid">
      <div class="field"><label>類別 *</label>
        <select id="um-type" onchange="document.getElementById('um-kw-wrap').style.display=this.value==='電費'?'flex':'none'">
          <option value="電費" ${isElec?'selected':''}>⚡ 電費</option>
          <option value="水費" ${!isElec?'selected':''}>💧 水費</option>
        </select>
      </div>
      <div class="field"><label>台電電號／台水水號（純文字保留前導零）*</label><input id="um-no" type="text" value="${esc(m.meter_no || '')}" placeholder="例：11-23-4567-89-0"></div>
      <div class="field full"><label>設置棟別與用途說明 *</label><input id="um-label" type="text" value="${esc(m.meter_label || '')}" placeholder="例：班班有冷氣專錶／中央廚房獨立錶"></div>
      <div class="field" id="um-kw-wrap" style="display:${isElec?'flex':'none'}"><label>台電契約容量（kW，供 90% 超約警示）</label><input id="um-kw" type="number" step="0.1" value="${esc(m.contract_kw ?? '')}"></div>
      <div class="field"><label>預算專款類別（同類別將合併推估預算）</label><input id="um-cat" type="text" value="${esc(m.budget_category || '校內基本水電')}" placeholder="例：校內基本水電／冷氣電費專款"></div>
      <div class="field"><label>該錶年度預算額度（元）</label><input id="um-budget" type="number" value="${Number(m.annual_budget)||0}"></div>
      <div class="field full"><label><input type="checkbox" id="um-active" ${m.is_active !== false ? 'checked' : ''}> 啟用此錶號監控</label></div>
    </div>
  `, `
    ${meterId ? `<button class="btn-danger" style="margin-right:auto" onclick="deleteUtilityMeter('${esc(meterId)}')">刪除錶號</button>` : ''}
    <button onclick="closeModal()">取消</button>
    <button class="btn-primary" onclick="saveUtilityMeter('${esc(meterId)}')">儲存錶號</button>
  `);
}

async function saveUtilityMeter(meterId) {
  const no = document.getElementById('um-no').value.trim();
  const label = document.getElementById('um-label').value.trim();
  const type = document.getElementById('um-type').value;
  if (!no || !label) return toast('請填寫電號／水號與用途說明');
  const rec = {
    meter_id: meterId || nextId('Utilities_Meters', 'meter_id', 'MTR', 4),
    meter_no: no,
    utility_type: type,
    meter_label: label,
    contract_kw: type === '電費' ? (Number(document.getElementById('um-kw').value) || '') : '',
    budget_category: document.getElementById('um-cat').value.trim() || '校內基本水電',
    annual_budget: Number(document.getElementById('um-budget').value) || 0,
    is_active: document.getElementById('um-active').checked,
    updated_at: nowStr(), is_deleted: false
  };
  upsertLocal('Utilities_Meters', rec, 'meter_id');
  closeModal();
  renderCurrentView();
  await pushToCloud({ action: 'upsert', table: 'Utilities_Meters', record: rec });
  toast('✅ 已儲存水電錶主檔');
}

async function deleteUtilityMeter(id) {
  if (!confirm('確定刪除此錶號？')) return;
  appData.tables.Utilities_Meters = appData.tables.Utilities_Meters.filter(m => m.meter_id !== id);
  closeModal();
  renderCurrentView();
  await pushToCloud({ action: 'softDelete', table: 'Utilities_Meters', id });
}

function openUtilityBillModal(presetMeterId = '', billId = '') {
  const meters = (appData.tables.Utilities_Meters || []).filter(m => m.is_active !== false);
  if (!meters.length) return toast('請先建立水電錶主檔');
  const b = billId ? (appData.tables.Utilities_Bills || []).find(x => x.bill_id === billId) : {};
  const targetMeterId = b.meter_id || presetMeterId || meters[0].meter_id;
  const defYm = b.billing_ym || todayStr().slice(0, 7);

  openModal(billId ? '✎ 編輯水電帳單紀錄' : '＋ 登錄本期水電帳單（即時異常偵測）', `
    <div id="ub-preview" class="gate-banner green">輸入帳單度數與金額後將即時比對去年同期、超約與功率因數…</div>
    <div class="form-grid">
      <div class="field full"><label>對應水電錶 *</label>
        <select id="ub-meter" onchange="onUtilityBillMeterChange('${esc(billId)}')">
          ${meters.map(m => `<option value="${esc(m.meter_id)}" ${targetMeterId===m.meter_id?'selected':''}>[${m.utility_type}] ${esc(m.meter_label)} (${esc(m.meter_no)})</option>`).join('')}
        </select>
      </div>
      <div class="field"><label>歸屬年月（YYYY-MM，跨年同期比對鍵）*</label><input id="ub-ym" type="month" value="${esc(defYm)}" onchange="previewUtilityBill('${esc(billId)}')"></div>
      <div class="field"><label>核銷狀態</label>
        <select id="ub-paid"><option value="待核銷" ${b.paid_status!=='已撥款'?'selected':''}>待核銷</option><option value="已撥款" ${b.paid_status==='已撥款'?'selected':''}>已撥款</option></select>
      </div>
      <div class="field"><label>計費起日</label><input id="ub-s1" type="date" value="${esc(b.bill_start || '')}" onchange="previewUtilityBill('${esc(billId)}')"></div>
      <div class="field"><label>計費迄日</label><input id="ub-s2" type="date" value="${esc(b.bill_end || '')}" onchange="previewUtilityBill('${esc(billId)}')"></div>
      <div class="field"><label>本期度數（電 kWh／水 立方公尺）*</label><input id="ub-usage" type="number" step="0.1" value="${esc(b.usage_units ?? '')}" oninput="previewUtilityBill('${esc(billId)}')"></div>
      <div class="field"><label>本期應繳金額（元）*</label><input id="ub-amt" type="number" value="${esc(b.bill_amount ?? '')}"></div>
      <div class="field ub-elec-only"><label>最高需量（kW，電錶專用）</label><input id="ub-kw" type="number" step="0.1" value="${esc(b.max_demand_kw ?? '')}" oninput="previewUtilityBill('${esc(billId)}')"></div>
      <div class="field ub-elec-only"><label>功率因數（%，電錶專用，低於80%罰款）</label><input id="ub-pf" type="number" step="0.1" value="${esc(b.power_factor ?? '')}" oninput="previewUtilityBill('${esc(billId)}')"></div>
      <div class="field full"><label>異常查修與處理備註</label><textarea id="ub-note" placeholder="例：已請水電工檢查活動中心後方廁所浮球閥並修復">${esc(b.handling_note || '')}</textarea></div>
    </div>
  `, `
    <button onclick="closeModal()">取消</button>
    <button class="btn-primary" onclick="saveUtilityBill('${esc(billId)}')">儲存帳單</button>
  `);
  onUtilityBillMeterChange(billId);
}

function onUtilityBillMeterChange(excludeId) {
  const mid = document.getElementById('ub-meter')?.value;
  const meter = (appData.tables.Utilities_Meters || []).find(m => m.meter_id === mid);
  const isElec = meter?.utility_type === '電費';
  document.querySelectorAll('.ub-elec-only').forEach(el => { el.style.display = isElec ? 'flex' : 'none'; });
  previewUtilityBill(excludeId);
}

function previewUtilityBill(excludeId = '') {
  const box = document.getElementById('ub-preview');
  if (!box) return;
  const mid = document.getElementById('ub-meter').value;
  const meter = (appData.tables.Utilities_Meters || []).find(m => m.meter_id === mid);
  const simBill = {
    bill_id: excludeId || '_sim',
    meter_id: mid,
    billing_ym: document.getElementById('ub-ym').value,
    bill_start: document.getElementById('ub-s1').value,
    bill_end: document.getElementById('ub-s2').value,
    usage_units: Number(document.getElementById('ub-usage').value) || 0,
    max_demand_kw: document.getElementById('ub-kw')?.value === '' ? '' : Number(document.getElementById('ub-kw')?.value),
    power_factor: document.getElementById('ub-pf')?.value === '' ? '' : Number(document.getElementById('ub-pf')?.value)
  };
  const ev = evaluateUtilityBill(simBill, meter, appData.tables.Utilities_Bills || []);
  box.className = 'gate-banner ' + (ev.level === 'red' ? 'red' : ev.level === 'amber' ? 'amber' : 'green');
  box.innerHTML = `計費 <strong>${ev.days}</strong> 天 ｜ 日均用量：<strong>${ev.daily}</strong> 度/日`
    + (ev.yoyPct !== null ? ` ｜ 去年同期：<strong>${ev.yoyPct > 0 ? '+' : ''}${ev.yoyPct}%</strong>` : ' ｜ 尚無去年同期數據')
    + (ev.demandPct !== null ? ` ｜ 需量使用率：<strong>${ev.demandPct}%</strong>` : '')
    + `<br>${ev.flags.length ? '🚨 異常偵測：<strong>' + esc(ev.alertText) + '</strong>' : '✅ 各項指標正常'}`;
}

async function saveUtilityBill(billId) {
  const mid = document.getElementById('ub-meter').value;
  const ym = document.getElementById('ub-ym').value;
  if (!mid || !ym) return toast('請選擇錶號與歸屬年月');
  const meter = (appData.tables.Utilities_Meters || []).find(m => m.meter_id === mid);
  const isElec = meter?.utility_type === '電費';

  const rec = {
    bill_id: billId || nextId('Utilities_Bills', 'bill_id', 'UTL', 4),
    meter_id: mid,
    billing_ym: ym,
    bill_start: document.getElementById('ub-s1').value,
    bill_end: document.getElementById('ub-s2').value,
    usage_units: Number(document.getElementById('ub-usage').value) || 0,
    bill_amount: Number(document.getElementById('ub-amt').value) || 0,
    max_demand_kw: isElec && document.getElementById('ub-kw').value !== '' ? Number(document.getElementById('ub-kw').value) : '',
    power_factor: isElec && document.getElementById('ub-pf').value !== '' ? Number(document.getElementById('ub-pf').value) : '',
    yoy_change_pct: '',
    alert_flags: '正常',
    handling_note: document.getElementById('ub-note').value.trim(),
    paid_status: document.getElementById('ub-paid').value,
    updated_at: nowStr(), is_deleted: false
  };
  const ev = evaluateUtilityBill(rec, meter, appData.tables.Utilities_Bills || []);
  rec.yoy_change_pct = ev.yoyPct !== null ? ev.yoyPct : '';
  rec.alert_flags = ev.alertText;

  upsertLocal('Utilities_Bills', rec, 'bill_id');
  closeModal();
  renderCurrentView();
  await pushToCloud({ action: 'upsert', table: 'Utilities_Bills', record: rec });
  toast(ev.level === 'ok' ? '✅ 已儲存帳單（指標正常）' : `⚠️ 已儲存帳單，觸發預警：${ev.alertText}`);
}

async function toggleBillPaidStatus(billId, status) {
  const b = (appData.tables.Utilities_Bills || []).find(x => x.bill_id === billId);
  if (!b) return;
  b.paid_status = status;
  b.updated_at = nowStr();
  renderCurrentView();
  await pushToCloud({ action: 'upsert', table: 'Utilities_Bills', record: b });
}

async function deleteUtilityBill(id) {
  if (!confirm('確定刪除此筆水電帳單？')) return;
  appData.tables.Utilities_Bills = appData.tables.Utilities_Bills.filter(b => b.bill_id !== id);
  renderCurrentView();
  await pushToCloud({ action: 'softDelete', table: 'Utilities_Bills', id });
}

function printUtilitiesPDF() {
  const proj = calcUtilitiesBudgetProjection(opsUtilYear);
  const allBills = appData.tables.Utilities_Bills || [];
  const bills = allBills
    .filter(b => String(b.billing_ym || '').startsWith(String(proj.adYear)))
    .map(b => ({ ...b, _meter: proj.mMap[b.meter_id], _eval: evaluateUtilityBill(b, proj.mMap[b.meter_id], allBills) }))
    .sort((a, b) => String(a.billing_ym).localeCompare(String(b.billing_ym)));

  document.getElementById('print-area').innerHTML = `
    <div class="print-header">
      <div>
        <div style="font-size:12px;color:#475569">${esc(appData.schoolName)} ｜ 水電費預算執行與異常控管報表</div>
        <h2 style="margin:2px 0 0;font-size:17px">民國 ${opsUtilYear} 年度多錶號水電支出與季節曲線預算推估</h2>
      </div>
      <div style="text-align:right;font-size:11px;color:#475569">
        <div>核定總預算：${fmtMoney(proj.totalBudget)} ｜ 累計實支：${fmtMoney(proj.totalActual)} ｜ 預估全年：${fmtMoney(proj.totalProj)}</div>
        <div>列印日期：${todayStr()}</div>
      </div>
    </div>
    <table class="print-table" style="margin-bottom:10px">
      <thead><tr><th>預算專款類別</th><th>核定預算</th><th>累計實支</th><th>實支率</th><th>推估全年總支出</th><th>推估執行率</th><th>推估模式</th></tr></thead>
      <tbody>
        ${proj.groups.map(g => `<tr>
          <td><strong>${esc(g.category)}</strong></td>
          <td style="text-align:right">${g.budget.toLocaleString('zh-TW')}</td>
          <td style="text-align:right">${g.ytdActual.toLocaleString('zh-TW')}</td>
          <td style="text-align:center">${g.execPct}%</td>
          <td style="text-align:right;font-weight:700">${g.projected.toLocaleString('zh-TW')}</td>
          <td style="text-align:center;font-weight:700">${g.projPct}%</td>
          <td>${esc(g.modeLabel)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <table class="print-table">
      <thead><tr><th>年月</th><th>類別／錶號用途</th><th>度數(日均)</th><th>去年同期YoY</th><th>金額(元)</th><th>需量／功因</th><th>異常判斷</th><th>查修與核銷</th></tr></thead>
      <tbody>
        ${bills.map(b => `<tr>
          <td style="text-align:center">${esc(b.billing_ym)}</td>
          <td>[${esc(b._meter?.utility_type||'')}] ${esc(b._meter?.meter_label||b.meter_id)}</td>
          <td style="text-align:right">${Number(b.usage_units||0).toLocaleString('zh-TW')} (${b._eval.daily})</td>
          <td style="text-align:center">${b._eval.yoyPct!==null?(b._eval.yoyPct>0?'+':'')+b._eval.yoyPct+'%':'-'}</td>
          <td style="text-align:right">${Number(b.bill_amount||0).toLocaleString('zh-TW')}</td>
          <td style="text-align:center">${b._meter?.utility_type==='電費'?`${b.max_demand_kw||'-'}kW / ${b.power_factor||'-'}%`:'-'}</td>
          <td style="font-weight:700">${esc(b._eval.alertText)}</td>
          <td>${esc(b.paid_status)} ${b.handling_note?'｜'+esc(b.handling_note):''}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  `;
  setTimeout(() => window.print(), 80);
}

// ----------------------------------------------------------------------------
// 5. 整合至 Chrome 起始戰情室摘要條 ＋ 跨模組預警雷達 ＋ 主視圖路由
// ----------------------------------------------------------------------------
function renderOpsDashStripHTML() {
  const curRocY = new Date().getFullYear() - 1911;
  const sol = calcSolarOverview(curRocY);
  const util = calcUtilitiesBudgetProjection(curRocY);
  const allBills = appData.tables.Utilities_Bills || [];
  const adY = String(util.adYear);

  let elecSpend = 0, waterSpend = 0, elecIssues = 0, waterIssues = 0;
  allBills.filter(b => String(b.billing_ym || '').startsWith(adY)).forEach(b => {
    const m = util.mMap[b.meter_id];
    if (!m) return;
    const ev = evaluateUtilityBill(b, m, allBills);
    if (m.utility_type === '電費') {
      elecSpend += Number(b.bill_amount) || 0;
      if (ev.level !== 'ok' && b.paid_status !== '已撥款') elecIssues++;
    } else {
      waterSpend += Number(b.bill_amount) || 0;
      if (ev.level !== 'ok' && b.paid_status !== '已撥款') waterIssues++;
    }
  });

  const solCls = sol.effAlerts > 0 ? 'warn-red' : (sol.docAlerts > 0 ? 'warn-amber' : 'warn-ok');
  const utilBudgetRed = util.groups.some(g => g.level === 'red');
  const utilBudgetAmber = util.groups.some(g => g.level === 'amber');
  const elecCls = (elecIssues > 0 || utilBudgetRed) ? 'warn-red' : (utilBudgetAmber ? 'warn-amber' : 'warn-ok');
  const waterCls = waterIssues > 0 ? 'warn-red' : 'warn-ok';

  return `
    <div class="ops-strip">
      <div class="ops-mini-card ${solCls}" onclick="switchTab('solar')">
        <div>
          <div style="font-size:12px;color:var(--muted);font-weight:700">☀️ 太陽能屋頂租賃（${sol.contracts.length} 案場｜${sol.totalKwp} kWp）</div>
          <div style="font-weight:800;font-size:15px;margin-top:2px">${curRocY}年實收回饋：${fmtMoney(sol.yearActual)}</div>
          <div class="item-meta">${sol.docAlerts ? `🛡️ ${sol.docAlerts} 項保單／保證函待續保` : '✓ 保單與保證函效期正常'}${sol.effAlerts ? ` ｜ ⚠️ ${sol.effAlerts} 期異常` : ''}</div>
        </div>
        <span class="tag ${solCls==='warn-red'?'tag-red':solCls==='warn-amber'?'tag-amber':'tag-green'}">進入面板 →</span>
      </div>
      <div class="ops-mini-card ${elecCls}" onclick="opsUtilTypeFilter='電費';switchTab('utilities')">
        <div>
          <div style="font-size:12px;color:var(--muted);font-weight:700">⚡ 電費（${curRocY}年累計）</div>
          <div style="font-weight:800;font-size:15px;margin-top:2px">${fmtMoney(elecSpend)} <small style="font-weight:500;color:var(--muted)">/ 全年預估 ${fmtMoney(util.totalProj)}</small></div>
          <div class="item-meta">${elecIssues ? `🚨 ${elecIssues} 筆超約／功因異常待處理` : (utilBudgetRed ? '🚨 推估將超支年度預算' : '✓ 需量與功率因數正常')}</div>
        </div>
        <span class="tag ${elecCls==='warn-red'?'tag-red':elecCls==='warn-amber'?'tag-amber':'tag-green'}">查看 →</span>
      </div>
      <div class="ops-mini-card ${waterCls}" onclick="opsUtilTypeFilter='水費';switchTab('utilities')">
        <div>
          <div style="font-size:12px;color:var(--muted);font-weight:700">💧 水費（${curRocY}年累計）</div>
          <div style="font-weight:800;font-size:15px;margin-top:2px">${fmtMoney(waterSpend)}</div>
          <div class="item-meta">${waterIssues ? `🚨 ${waterIssues} 筆疑似漏水／異常暴增` : '✓ 各水錶同期用水正常'}</div>
        </div>
        <span class="tag ${waterCls==='warn-red'?'tag-red':'tag-green'}">查看 →</span>
      </div>
    </div>
  `;
}

// 掛載起始戰情室摘要條
const _prevRenderDashboardHTML = renderDashboardHTML;
renderDashboardHTML = function() {
  const html = _prevRenderDashboardHTML();
  return html.replace('<div class="dash-grid">', renderOpsDashStripHTML() + '<div class="dash-grid">');
};

// 掛載主視圖路由
const _prevRenderCurrentView = renderCurrentView;
renderCurrentView = function() {
  const el = document.getElementById('main-view');
  if (currentTab === 'solar') { el.innerHTML = renderSolarViewHTML(); return; }
  if (currentTab === 'utilities') { el.innerHTML = renderUtilitiesViewHTML(); return; }
  _prevRenderCurrentView();
};

// 升級跨模組紅黃燈預警雷達（取代第一期佔位提醒，納入完整第二期預警與點擊直達）
const _prevBuildAllAlertsPhase2 = buildAllAlerts;
buildAllAlerts = function() {
  const alerts = _prevBuildAllAlertsPhase2().filter(
    a => !['太陽能保險續保', '太陽能履約保證函', '水電異常'].includes(a.badge)
  );
  const today = todayStr();
  const curRocY = new Date().getFullYear() - 1911;

  // 1. 太陽能三段保險／履保函 & 對帳／發電效率預警
  const sol = calcSolarOverview(curRocY);
  sol.contracts.filter(c => c.status !== '已期滿').forEach(c => {
    [['保險續保', c.insurance_expiry], ['履約保證函', c.deposit_expiry]].forEach(([lbl, dt]) => {
      if (!dt) return;
      const d = diffDays(today, dt);
      if (d <= 60) {
        alerts.push({
          level: d < 0 ? 'red' : (d <= 30 ? 'amber' : 'blue'),
          badge: '太陽能' + lbl,
          title: c.building_name,
          detail: `到期日 ${dt}（${d < 0 ? '已逾期 ' + Math.abs(d) + ' 天' : '剩 ' + d + ' 天'}）`,
          sortKey: d,
          action: () => switchTab('solar')
        });
      }
    });
  });

  sol.enriched.filter(r => r._rocYear === curRocY).forEach(r => {
    if (r._eval.flags.length) {
      alerts.push({
        level: r._eval.level === 'red' ? 'red' : 'amber',
        badge: '太陽能對帳',
        title: `${r._contract?.building_name || r.solar_id} (${r.period_label})`,
        detail: r._eval.flags.join('；'),
        sortKey: r._eval.level === 'red' ? -2 : 5,
        action: () => switchTab('solar')
      });
    }
  });

  // 2. 水電異常帳單、預算超支推估、契約容量優化建議
  const util = calcUtilitiesBudgetProjection(curRocY);
  const allBills = appData.tables.Utilities_Bills || [];
  allBills.filter(b => b.paid_status !== '已撥款').forEach(b => {
    const m = util.mMap[b.meter_id];
    if (!m) return;
    const ev = evaluateUtilityBill(b, m, allBills);
    if (ev.level === 'red' || ev.level === 'amber') {
      alerts.push({
        level: ev.level,
        badge: m.utility_type === '水費' ? '水費異常' : '電費異常',
        title: `${m.meter_label} (${b.billing_ym})`,
        detail: ev.alertText,
        sortKey: ev.level === 'red' ? -4 : 3,
        action: () => { opsUtilTypeFilter = m.utility_type; opsUtilMeterFilter = m.meter_id; switchTab('utilities'); }
      });
    }
  });

  util.groups.forEach(g => {
    if (g.level === 'red' || g.level === 'amber') {
      alerts.push({
        level: g.level,
        badge: '水電預算',
        title: `${g.category}（${curRocY}年度推估 ${g.projPct}%）`,
        detail: `實支 ${fmtMoney(g.ytdActual)}，${g.modeLabel}全年落點 ${fmtMoney(g.projected)}（預算 ${fmtMoney(g.budget)}）`,
        sortKey: g.level === 'red' ? -1 : 6,
        action: () => { opsUtilTypeFilter = 'all'; opsUtilMeterFilter = 'all'; switchTab('utilities'); }
      });
    }
  });

  util.meters.forEach(m => {
    if (checkLowDemandOptimization(m, allBills)) {
      alerts.push({
        level: 'blue',
        badge: '節費建議',
        title: `${m.meter_label}（契約容量 ${m.contract_kw} kW）`,
        detail: '連續多期最高需量低於契約容量 60%，建議評估調降以節省固定基本電費',
        sortKey: 30,
        action: () => { opsUtilTypeFilter = '電費'; opsUtilMeterFilter = m.meter_id; switchTab('utilities'); }
      });
    }
  });

  const rank = { red: 0, amber: 1, blue: 2 };
  alerts.sort((a, b) => (rank[a.level] - rank[b.level]) || (a.sortKey - b.sortKey));
  return alerts;
};

// 載入完畢後立即重繪畫面啟用第二期模組
renderCurrentView();
// ----------------------------------------------------------------------------
// 6. 外部《溪埔國中電費整理》Google 試算表一鍵連結同步介面
// ----------------------------------------------------------------------------
const _baseRenderUtilitiesViewHTML = renderUtilitiesViewHTML;
renderUtilitiesViewHTML = function() {
  const html = _baseRenderUtilitiesViewHTML();
  return html.replace(
    '<button class="btn-sm" onclick="printUtilitiesPDF()">🖨️ 輸出水電報表 PDF</button>',
    '<button class="btn-sm" onclick="openSyncExternalElecModal()">🔄 連結／同步原電費表</button><button class="btn-sm" onclick="printUtilitiesPDF()">🖨️ 輸出水電報表 PDF</button>'
  );
};

function openSyncExternalElecModal() {
  openModal('🔄 連結並同步《溪埔國中電費整理》Google 試算表', `
    <div class="gate-banner green" style="margin-bottom:12px">
      <strong>運作方式：</strong>貼上你原本的 Google 試算表網址後，系統會自動抓取 <code>2017年</code>～<code>2026年</code>（含未來新年度分頁）的所有月度電費、度數、契約容量與最高需量。<br>
      日後你在原試算表登記新月份後，按一下即可更新，<strong>不會重複匯入，也不會覆蓋你填過的核銷狀態與查修備註</strong>。
    </div>
    <div class="field full">
      <label>原電費試算表網址（或試算表 ID）*</label>
      <input id="ext-elec-url" type="text" value="${esc(appConfig.extElecUrl || '')}" placeholder="https://docs.google.com/spreadsheets/d/你的試算表ID/edit">
    </div>
  `, `
    <button onclick="closeModal()">取消</button>
    <button class="btn-primary" onclick="runSyncExternalElec()">⚡ 立即同步全部年度電費</button>
  `);
}

async function runSyncExternalElec() {
  const sheetId = (document.getElementById('ext-elec-url')?.value || '').trim();
  if (!sheetId) return toast('請貼上《溪埔國中電費整理》的 Google 試算表網址');
  saveConfig({ extElecUrl: sheetId });
  closeModal();
  toast('⏳ 正在從原電費試算表同步 2017～2026 年資料，請稍候...');

  const res = await pushToCloud({ action: 'syncExternalElec', sheetId });
  if (res && res.ok && !res.localOnly) {
    await syncFromCloud(false);
    opsUtilTypeFilter = '電費';
    opsUtilMeterFilter = 'MTR-E01';
    renderCurrentView();
    toast(`✅ 已同步《${res.sheetName}》共 ${res.syncedCount} 期（最新 ${res.latestYm}，契約 ${res.latestCap}kW）`);
  }
}

renderCurrentView();
