/**
 * ============================================================================
 * 學校總務行政助理 — 太陽能屋頂租賃重構模組 V2 (solar-v2.js)
 * 1 主檔 (Solar_Contracts) ＋ 3 關聯子表 (Solar_Records / Solar_Bond_Ledger / Solar_Compliance_Logs)
 * 含：4區塊折疊契約表單、詳情3頁籤、共錶批次拆帳、5%級距＋違約金、雙保險合規、變更連動、D4一期驗收
 * ============================================================================
 */

(function injectSolarV2Styles() {
  const st = document.createElement('style');
  st.id = 'solar-v2-style';
  st.textContent = `
    .sol-acc{border:1px solid var(--border);border-radius:8px;margin-bottom:9px;background:#fff;overflow:hidden}
    .sol-acc summary{padding:8px 12px;background:#f8fafc;font-weight:700;cursor:pointer;display:flex;justify-content:space-between;align-items:center;list-style:none;font-size:13.5px}
    .sol-acc[open] summary{border-bottom:1px solid var(--border);background:#eff6ff;color:#1e3a8a}
    .sol-acc-bd{padding:11px 12px}
    .roc-hint{font-size:11.5px;color:#2563eb;font-weight:600;margin-top:2px}
    .sol-detail-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
    .sol-subrow{display:grid;grid-template-columns:1.8fr 1.1fr 1.1fr .9fr .9fr 28px;gap:5px;align-items:center;margin-bottom:5px}
    .sol-month-row{display:grid;grid-template-columns:1.1fr 1fr .8fr .7fr .9fr .9fr 28px;gap:5px;align-items:center;margin-bottom:5px}
    .sol-subrow input,.sol-month-row input,.sol-month-row select{padding:4px 6px;border:1px solid #cbd5e1;border-radius:5px;width:100%;font-size:12px}
    .ins-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:12px}
    .ins-card{border:1px solid var(--border);border-radius:8px;padding:10px 12px;background:#fff}
    .ins-card.red{border-left:4px solid var(--red);background:#fffafa}
    .ins-card.amber{border-left:4px solid var(--amber);background:#fffdf5}
    .ins-card.ok{border-left:4px solid var(--green);background:#f0fdf4}
    .sol-info-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;background:#f8fafc;border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-top:8px;font-size:12.5px}
    @media(max-width:960px){.ins-grid,.sol-info-grid{grid-template-columns:1fr}.sol-subrow,.sol-month-row{grid-template-columns:1fr 1fr}}
  `;
  document.head.appendChild(st);
})();

let solarV2SelectedId = null;
let solarV2DetailTab = 'billing'; // billing | bonds | compliance

function ensureSolarV2Tables() {
  if (!appData.tables) appData.tables = {};
  ['Solar_Contracts', 'Solar_Records', 'Solar_Bond_Ledger', 'Solar_Compliance_Logs'].forEach(k => {
    if (!Array.isArray(appData.tables[k])) appData.tables[k] = [];
  });
}

// ============================================================================
// 1. 財務精準四捨五入、西元/民國對照與核心計算引擎
// ============================================================================
function roundMoney(val) {
  const n = Number(val) || 0;
  return Math.round(n + (n >= 0 ? 1e-9 : -1e-9));
}

function toRocDate(ymd) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(String(ymd).slice(0, 10))) return '-';
  const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number);
  return `民國${y - 1911}年${m}月${d}日`;
}

function fmtDateWithRoc(ymd) { return ymd ? `${ymd}（${toRocDate(ymd)}）` : '-'; }

function subMonthsYmd(ymd, months) {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(String(ymd).slice(0, 10))) return '';
  const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number);
  const totalM = y * 12 + (m - 1) - Number(months);
  const ny = Math.floor(totalM / 12), nm = (totalM % 12) + 1;
  const maxD = new Date(ny, nm, 0).getDate();
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, maxD)).padStart(2, '0')}`;
}

function calcBaseAnnualRent(kwp, fitRate, feedbackRateRaw) {
  const k = Number(kwp) || 0, f = Number(fitRate) || 0, r = normFeedbackRate(feedbackRateRaw);
  return (k > 0 && f > 0 && r > 0) ? roundMoney(k * 3.5 * 365 * f * r) : 0;
}

function suggestTierPercentV2(refRent, baseAnnualRent) {
  const base = Number(baseAnnualRent) || 0, ref = Number(refRent) || 0;
  if (base <= 0) return 100;
  const pct = (ref / base) * 100;
  if (Math.abs(pct - 100) < 5 - 1e-9) return 100;
  return Math.max(5, Math.ceil((pct - 1e-9) / 5) * 5);
}

function calcOverduePenaltyV2(unpaidAmount, dueYmd, refYmd) {
  const amt = Number(unpaidAmount) || 0;
  const zero = { overdueDays: 0, fullMonths: 0, ratePct: 0, penalty: 0, canTerminate: false };
  if (amt <= 0 || !dueYmd || !refYmd) return zero;
  const dStr = String(dueYmd).slice(0, 10), rStr = String(refYmd).slice(0, 10);
  const daysOver = diffDays(dStr, rStr);
  if (daysOver <= 0) return zero;
  const [dy, dm, dd] = dStr.split('-').map(Number), [ry, rm, rd] = rStr.split('-').map(Number);
  const fullMonths = Math.max(0, (ry - dy) * 12 + (rm - dm) - (rd < dd ? 1 : 0));
  const ratePct = fullMonths >= 3 ? 10 : fullMonths >= 2 ? 8 : fullMonths >= 1 ? 4 : 2;
  return { overdueDays: daysOver, fullMonths, ratePct, penalty: roundMoney((amt * ratePct) / 100), canTerminate: fullMonths >= 4 };
}

function inferRecordDueDate(rec, c) {
  const md = String(c?.annual_due_month_day || '').trim();
  if (!/^\d{2}-\d{2}$/.test(md) || !rec.period_end) return '';
  const endY = parseInt(String(rec.period_end).slice(0, 4), 10);
  const cand = `${endY}-${md}`;
  return cand >= rec.period_end ? cand : `${endY + 1}-${md}`;
}

function calcSolarBillV2(rec, contract) {
  const c = contract || {};
  const mode = c.billing_mode || (Number(c.min_annual_feedback) > 0 ? 'MIN_GUARANTEE' : 'PURE_PERCENTAGE');
  const rate = normFeedbackRate(c.feedback_rate);
  const totalRev = Number(rec.taipower_revenue) || 0;
  const totalKwh = Number(rec.generation_kwh) || 0;
  const refRent = roundMoney(totalRev * rate);
  const baseRent = Number(c.base_annual_rent) || calcBaseAnnualRent(c.capacity_kwp, c.fit_rate, c.feedback_rate);
  const periodMonths = Number(rec.period_months) || 12;
  const proratedBase = baseRent > 0 ? roundMoney((baseRent * periodMonths) / 12) : 0;
  const ratioPct = baseRent > 0 ? Number(((refRent / baseRent) * 100).toFixed(2)) : 0;
  const suggestedTier = suggestTierPercentV2(refRent, baseRent);
  const appliedTier = (rec.applied_tier_percent !== '' && rec.applied_tier_percent !== null && rec.applied_tier_percent !== undefined)
    ? Number(rec.applied_tier_percent) : suggestedTier;

  let calculatedRent = refRent;
  if (mode === 'TIERED_BASE_RENT' && baseRent > 0) calculatedRent = roundMoney((baseRent * appliedTier) / 100);
  else if (mode === 'MIN_GUARANTEE') calculatedRent = Math.max(refRent, Number(c.min_annual_feedback) || 0);

  const hasActual = rec.actual_feedback !== '' && rec.actual_feedback !== null && rec.actual_feedback !== undefined;
  const actualPaid = hasActual ? Number(rec.actual_feedback) : 0;
  const dueDate = rec.due_date || inferRecordDueDate(rec, c);
  const unpaid = hasActual ? (actualPaid < calculatedRent ? calculatedRent - actualPaid : calculatedRent) : calculatedRent;
  const paidOnTime = hasActual && rec.payment_date && dueDate && diffDays(dueDate, rec.payment_date) <= 0;
  const penInfo = dueDate ? calcOverduePenaltyV2(paidOnTime ? 0 : unpaid, dueDate, rec.payment_date || todayStr())
    : { overdueDays: 0, fullMonths: 0, ratePct: 0, penalty: 0, canTerminate: false };

  const days = billingDaysCount(rec.period_start, rec.period_end);
  const cap = Number(c.capacity_kwp) || 0;
  const dailyYield = (cap > 0 && days > 0 && totalKwh > 0) ? Number((totalKwh / (cap * days)).toFixed(2)) : (Number(rec.yield_per_kwp) || 0);

  return {
    mode, rate, totalKwh, totalRev, refRent, baseRent, periodMonths, proratedBase,
    ratioPct, suggestedTier, appliedTier, calculatedRent,
    hasActual, actualPaid, diffAmt: hasActual ? (actualPaid - calculatedRent) : 0,
    dueDate, penInfo, days, dailyYield
  };
}

function getContractBondSummary(solarId, contract) {
  ensureSolarV2Tables();
  const txs = appData.tables.Solar_Bond_Ledger.filter(t => t.solar_id === solarId)
    .sort((a, b) => String(a.tx_date || '').localeCompare(String(b.tx_date || '')));
  const initial = Number(contract?.deposit_amount) || 0;
  if (!txs.length) return { txs, initial, balance: initial, refunded: 0, hasLedger: false };
  return {
    txs, initial, hasLedger: true,
    balance: txs.reduce((s, t) => s + (Number(t.amount) || 0), 0),
    refunded: txs.filter(t => Number(t.amount) < 0).reduce((s, t) => s + Math.abs(Number(t.amount)), 0)
  };
}

function getContractComplianceSummary(solarId, contract) {
  ensureSolarV2Tables();
  const today = todayStr();
  const logs = appData.tables.Solar_Compliance_Logs.filter(l => l.solar_id === solarId)
    .sort((a, b) => String(b.effective_date || '').localeCompare(String(a.effective_date || '')));
  const latestPub = logs.find(l => l.log_type === 'PUBLIC_LIABILITY_INS') || null;
  const latestProp = logs.find(l => l.log_type === 'PROPERTY_INS') || null;

  const evalPub = log => {
    if (!log) {
      if (contract?.insurance_expiry) {
        const d = diffDays(today, contract.insurance_expiry);
        return { exists: true, legacy: true, expiry: contract.insurance_expiry, diff: d, compliant: true, missing: [], level: d <= 30 ? 'red' : d <= 60 ? 'amber' : 'ok' };
      }
      return { exists: false, compliant: false, missing: ['尚未登錄公共意外責任險'], level: 'red', expiry: '', diff: null };
    }
    const c = parseJSON(log.compliance_json, {}), missing = [];
    if ((Number(c.per_person) || 0) < 300) missing.push('每人傷亡須≥300萬');
    if ((Number(c.per_accident_body) || 0) < 1500) missing.push('每事故傷亡須≥1500萬');
    if ((Number(c.per_accident_prop) || 0) < 200) missing.push('每事故財損須≥200萬');
    if ((Number(c.aggregate) || 0) < 4800) missing.push('總保額須≥4800萬');
    const diff = log.expiry_date ? diffDays(today, log.expiry_date) : null;
    const compliant = missing.length === 0;
    const level = (!compliant || (diff !== null && diff <= 30)) ? 'red' : (diff !== null && diff <= 60 ? 'amber' : 'ok');
    return { exists: true, log, expiry: log.expiry_date, diff, compliant, missing, level };
  };

  const evalProp = log => {
    if (!log) return { exists: false, compliant: false, missing: ['尚未登錄產物保險'], level: 'amber', expiry: '', diff: null };
    const c = parseJSON(log.compliance_json, {}), missing = [];
    if (!c.typhoon) missing.push('缺颱風險');
    if (!c.fire) missing.push('缺火災險');
    if (!c.earthquake) missing.push('缺地震險');
    const diff = log.expiry_date ? diffDays(today, log.expiry_date) : null;
    const compliant = missing.length === 0;
    const level = (!compliant || (diff !== null && diff <= 30)) ? 'red' : (diff !== null && diff <= 60 ? 'amber' : 'ok');
    return { exists: true, log, expiry: log.expiry_date, diff, compliant, missing, level };
  };

  return { logs, pub: evalPub(latestPub), prop: evalProp(latestProp), amendments: logs.filter(l => l.log_type === 'AMENDMENT') };
}

function buildSolarV2Alerts() {
  ensureSolarV2Tables();
  const today = todayStr(), alerts = [], cMap = {};
  appData.tables.Solar_Contracts.forEach(c => { cMap[c.solar_id] = c; });

  appData.tables.Solar_Contracts.filter(c => !['已屆滿', '已期滿', '已解約'].includes(c.status)).forEach(c => {
    const title = `${c.building_name}${c.phase_label ? '（' + c.phase_label + '）' : ''}`;
    const go = tab => () => { solarV2SelectedId = c.solar_id; solarV2DetailTab = tab; switchTab('solar'); };
    const cmp = getContractComplianceSummary(c.solar_id, c);

    if (cmp.pub.level !== 'ok') {
      const msg = !cmp.pub.exists ? '尚未登錄有效公共意外責任險'
        : !cmp.pub.compliant ? `保額不足：${cmp.pub.missing.join('、')}`
        : cmp.pub.diff < 0 ? `已過期 ${Math.abs(cmp.pub.diff)} 天 (${cmp.pub.expiry})` : `到期剩 ${cmp.pub.diff} 天 (${cmp.pub.expiry})`;
      alerts.push({ level: cmp.pub.level, badge: '太陽能意外險', title, detail: msg, sortKey: cmp.pub.diff ?? -20, action: go('compliance') });
    }
    if (cmp.prop.level !== 'ok') {
      const msg = !cmp.prop.exists ? '尚未登錄產物保險（須含颱風／火災／地震）'
        : !cmp.prop.compliant ? `險種缺漏：${cmp.prop.missing.join('、')}`
        : cmp.prop.diff < 0 ? `已過期 ${Math.abs(cmp.prop.diff)} 天 (${cmp.prop.expiry})` : `到期剩 ${cmp.prop.diff} 天 (${cmp.prop.expiry})`;
      alerts.push({ level: cmp.prop.level, badge: '太陽能產險', title, detail: msg, sortKey: cmp.prop.diff ?? -10, action: go('compliance') });
    }
    const renewDl = c.renewal_deadline || (c.contract_end ? subMonthsYmd(c.contract_end, 3) : '');
    if (renewDl) {
      const dr = diffDays(today, renewDl);
      if (dr <= 30 && dr >= -120) {
        alerts.push({
          level: dr <= 0 ? 'red' : 'amber', badge: '太陽能續租', title, sortKey: dr, action: go('compliance'),
          detail: dr <= 0 ? `已達優先續租書面申請截止日 ${fmtDateWithRoc(renewDl)}（屆滿 ${c.contract_end}）` : `優先續租截止日 ${fmtDateWithRoc(renewDl)}（剩 ${dr} 天）`
        });
      }
    }
    const md = String(c.annual_due_month_day || '').trim();
    if (/^\d{2}-\d{2}$/.test(md)) {
      const y = new Date().getFullYear();
      let dueThis = `${y}-${md}`;
      if (diffDays(today, dueThis) < -30) dueThis = `${y + 1}-${md}`;
      const dd = diffDays(today, dueThis);
      if (dd <= 30 && dd >= -15) {
        alerts.push({
          level: dd < 0 ? 'red' : 'amber', badge: '太陽能催繳', title, sortKey: dd, action: go('billing'),
          detail: `約定繳款日 ${fmtDateWithRoc(dueThis)}（${dd < 0 ? '已過' + Math.abs(dd) + '天' : '剩' + dd + '天'}），請催送參考年租金明細並開立繳款通知單`
        });
      }
    }
    if (c.bond_method && c.bond_method !== '現金' && c.deposit_expiry) {
      const db = diffDays(today, c.deposit_expiry);
      if (db <= 60) {
        alerts.push({
          level: db <= 30 ? 'red' : 'amber', badge: '太陽能保證函', title, sortKey: db, action: go('bonds'),
          detail: `${c.bond_method}效期至 ${fmtDateWithRoc(c.deposit_expiry)}（${db < 0 ? '已過期' : '剩 ' + db + ' 天，請通知換函'}）`
        });
      }
    }
  });

  appData.tables.Solar_Records.forEach(r => {
    const c = cMap[r.solar_id]; if (!c) return;
    const calc = calcSolarBillV2(r, c);
    const go = () => { solarV2SelectedId = c.solar_id; solarV2DetailTab = 'billing'; switchTab('solar'); };
    if (calc.penInfo.canTerminate && !r.payment_date) {
      alerts.push({ level: 'red', badge: '光電得終止', title: `${c.building_name} (${r.period_label})`, detail: `逾期已達 ${calc.penInfo.fullMonths} 個月（達得終止門檻！違約金 10% = ${fmtMoney(calc.penInfo.penalty)}）`, sortKey: -30, action: go });
    } else if (!r.payment_date && calc.penInfo.overdueDays > 0) {
      alerts.push({ level: 'red', badge: '光電逾期', title: `${c.building_name} (${r.period_label})`, detail: `逾期 ${calc.penInfo.overdueDays} 天，加收 ${calc.penInfo.ratePct}% 違約金 (${fmtMoney(calc.penInfo.penalty)})`, sortKey: -15, action: go });
    } else if (calc.hasActual && Math.abs(calc.diffAmt) > 10) {
      alerts.push({ level: 'red', badge: '光電短收', title: `${c.building_name} (${r.period_label})`, detail: `應繳 ${fmtMoney(calc.calculatedRent)} vs 實繳 ${fmtMoney(calc.actualPaid)}（差額 ${calc.diffAmt > 0 ? '+' : ''}${calc.diffAmt.toLocaleString('zh-TW')}元）`, sortKey: -10, action: go });
    }
  });

  const rk = { red: 0, amber: 1, blue: 2 };
  return alerts.sort((a, b) => (rk[a.level] - rk[b.level]) || (a.sortKey - b.sortKey));
}

// ============================================================================
// 2. 太陽能 V2 總覽儀表板 & 契約詳情三頁籤
// ============================================================================
const _origSwitchTabSolV2 = switchTab;
switchTab = function(tab) {
  if (tab !== 'solar' || currentTab === 'solar') solarV2SelectedId = null;
  _origSwitchTabSolV2(tab);
};

renderSolarViewHTML = function() {
  ensureSolarV2Tables();
  if (solarV2SelectedId) {
    const hit = appData.tables.Solar_Contracts.find(c => c.solar_id === solarV2SelectedId);
    if (hit) return renderSolarContractDetailHTML(hit);
    solarV2SelectedId = null;
  }
  const contracts = appData.tables.Solar_Contracts, records = appData.tables.Solar_Records;
  const alerts = buildSolarV2Alerts(), cMap = {}, meterGroups = {};
  contracts.forEach(c => {
    cMap[c.solar_id] = c;
    const m = String(c.taipower_meter_no || '').trim();
    if (m) (meterGroups[m] = meterGroups[m] || []).push(c);
  });

  const active = contracts.filter(c => !['已屆滿', '已期滿', '已解約'].includes(c.status));
  const totalKwp = active.reduce((s, c) => s + (Number(c.capacity_kwp) || 0), 0);
  const totalBondBal = contracts.reduce((s, c) => s + getContractBondSummary(c.solar_id, c).balance, 0);
  let yearCalc = 0, yearActual = 0;
  records.forEach(r => {
    if (getRecordRocYear(r) === Number(opsSolarYear)) {
      const k = calcSolarBillV2(r, cMap[r.solar_id]);
      yearCalc += k.calculatedRent;
      if (k.hasActual) yearActual += k.actualPaid;
    }
  });
  window._solarV2Alerts = alerts;

  return `
    <div class="ops-kpi-4">
      <div class="kpi-card kpi-blue"><div><div class="kpi-label">☀️ 管理中總標租容量</div><div class="kpi-val">${totalKwp.toFixed(2)} <small style="font-size:13px">kWp</small></div></div><span style="font-size:24px">🔆</span></div>
      <div class="kpi-card kpi-green"><div><div class="kpi-label">💰 ${opsSolarYear}年應收／實收回饋金</div><div class="kpi-val" style="font-size:18px">${fmtMoney(yearActual)}<div class="item-meta">應收 ${fmtMoney(yearCalc)}</div></div></div><span style="font-size:24px">🏦</span></div>
      <div class="kpi-card kpi-blue"><div><div class="kpi-label">🔒 留存履約保證金總餘額</div><div class="kpi-val" style="font-size:20px">${fmtMoney(totalBondBal)}</div></div><span style="font-size:24px">🛡️</span></div>
      <div class="kpi-card ${alerts.some(a=>a.level==='red')?'kpi-red':alerts.length?'kpi-amber':'kpi-green'}"><div><div class="kpi-label">🚨 待處理預警事項數</div><div class="kpi-val">${alerts.length}</div></div><span style="font-size:24px">🔔</span></div>
    </div>

    ${alerts.length ? `
      <div class="panel">
        <div class="panel-hd">
          <h3>🔔 太陽能總務預警雷達（雙保險合規／優先續租／對帳催繳／保證函／逾期違約）</h3>
          <span class="tag tag-red">${alerts.filter(a=>a.level==='red').length} 紅燈 ／ ${alerts.filter(a=>a.level==='amber').length} 黃燈</span>
        </div>
        <div class="panel-bd">
          ${alerts.map((a, i) => `
            <div class="alert-item ${a.level}" style="cursor:pointer" onclick="window._solarV2Alerts[${i}]?.action?.()">
              <div class="item-row"><div><span class="tag ${a.level==='red'?'tag-red':'tag-amber'}">${esc(a.badge)}</span><strong style="margin-left:5px">${esc(a.title)}</strong></div><span style="font-size:12px;color:var(--primary)">前往處理 →</span></div>
              <div class="item-meta">${esc(a.detail)}</div>
            </div>`).join('')}
        </div>
      </div>` : ''}

    <div class="panel">
      <div class="panel-hd">
        <h3>🏢 太陽能屋頂租賃契約主檔（共 ${contracts.length} 份契約）</h3>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <button class="btn-xs" onclick="opsSolarYear--;renderCurrentView()">◀ ${opsSolarYear-1}年</button>
          <strong>${opsSolarYear}年</strong>
          <button class="btn-xs" onclick="opsSolarYear++;renderCurrentView()">${opsSolarYear+1}年 ▶</button>
          <button class="btn-sm" onclick="openSharedMeterBatchModal()">⚡ 共錶電號批次拆帳</button>
          <button class="btn-sm" onclick="runSolarV2UnitTests()">🧪 驗算測試</button>
          <button class="btn-sm" onclick="seedD4Phase1Data()">🌱 匯入D4一期測試案</button>
          <button class="btn-sm" onclick="printSolarPDF()">🖨️ 總表PDF</button>
          <button class="btn-sm btn-primary" onclick="openSolarContractModal()">＋ 新增租賃契約</button>
        </div>
      </div>
      <div class="panel-bd">
        ${contracts.length ? `<div class="ops-grid-2">${contracts.map(c => renderSolarV2CardHTML(c, meterGroups)).join('')}</div>`
          : `<div class="empty-state">尚未建立太陽能屋頂租賃契約。<br><button class="btn-sm btn-primary" style="margin-top:8px" onclick="seedD4Phase1Data()">🌱 一鍵載入「D4教室暨D4風雨球場屋頂（一期）」完整真實案例</button></div>`}
      </div>
    </div>
  `;
};

function renderSolarV2CardHTML(c, meterGroups) {
  const bond = getContractBondSummary(c.solar_id, c);
  const cmp = getContractComplianceSummary(c.solar_id, c);
  const ratePct = (normFeedbackRate(c.feedback_rate) * 100).toFixed(2).replace(/\.00$/, '');
  const modeMap = { TIERED_BASE_RENT: '5%級距制', PURE_PERCENTAGE: '純比例制', MIN_GUARANTEE: '保底制' };
  const sharedCnt = c.taipower_meter_no ? (meterGroups[c.taipower_meter_no] || []).length : 0;
  const cls = (cmp.pub.level === 'red' || cmp.prop.level === 'red') ? 'red' : ((cmp.pub.level === 'amber' || cmp.prop.level === 'amber') ? 'amber' : 'ok');

  return `
    <div class="site-card ${cls}">
      <div class="item-row">
        <div style="flex:1;min-width:0">
          <span class="tag tag-blue">${esc(c.solar_id)}</span>
          ${c.phase_label ? `<span class="tag tag-amber">${esc(c.phase_label)}</span>` : ''}
          <span class="tag ${c.status==='併聯發電中'?'tag-green':'tag-gray'}">${esc(c.status)}</span>
          <div style="font-size:15.5px;font-weight:800;margin-top:4px;cursor:pointer;color:var(--primary)" onclick="openSolarContractDetail('${esc(c.solar_id)}')">${esc(c.building_name)}</div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0;align-items:flex-start">
          <button class="btn-xs btn-primary" style="white-space:nowrap" onclick="openSolarContractDetail('${esc(c.solar_id)}')">進入管理 →</button>
          <button class="btn-xs" onclick="openSolarContractModal('${esc(c.solar_id)}')">✎</button>
        </div>
      </div>
      <div class="item-meta">廠商：<strong>${esc(c.vendor_name || c.lessee_vendor || '-')}</strong>${c.vendor_tax_id ? ` (統編 ${esc(c.vendor_tax_id)})` : ''}</div>
      <div class="item-meta">容量：<strong>${c.capacity_kwp} kWp</strong>${c.shared_total_kwp ? `／共錶 ${c.shared_total_kwp} kWp（占比 <strong>${c.allocation_ratio || 100}%</strong>）` : ''} ${c.taipower_meter_no ? `｜電號 <code>${esc(c.taipower_meter_no)}</code>${sharedCnt > 1 ? ` (${sharedCnt}期共錶)` : ''}` : ''}</div>
      <div class="item-meta">計費：<strong>${modeMap[c.billing_mode] || '純比例制'}</strong>｜回饋 <strong>${ratePct}%</strong>${c.base_annual_rent ? `｜基準年租金 <strong>${fmtMoney(c.base_annual_rent)}</strong>` : ''}</div>
      <div class="item-meta">租期：${esc(c.contract_start || '-')} ~ <strong>${esc(c.contract_end || '-')}</strong>（${toRocDate(c.contract_end)}）｜保證金餘額：<strong>${fmtMoney(bond.balance)}</strong></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">
        <span class="tag ${cmp.pub.level==='ok'?'tag-green':cmp.pub.level==='amber'?'tag-amber':'tag-red'}">意外險：${cmp.pub.exists ? (cmp.pub.compliant ? (cmp.pub.expiry || '已登錄') : '保額不足') : '未登錄'}</span>
        <span class="tag ${cmp.prop.level==='ok'?'tag-green':cmp.prop.level==='amber'?'tag-amber':'tag-red'}">產險：${cmp.prop.exists ? (cmp.prop.compliant ? (cmp.prop.expiry || '已登錄') : '缺險種') : '未登錄'}</span>
        ${c.renewal_deadline ? `<span class="tag tag-gray">續租截止：${esc(c.renewal_deadline)}</span>` : ''}
      </div>
    </div>`;
}

function openSolarContractDetail(solarId, tab = 'billing') {
  solarV2SelectedId = solarId;
  solarV2DetailTab = tab;
  renderCurrentView();
}

function renderSolarContractDetailHTML(c) {
  const bond = getContractBondSummary(c.solar_id, c);
  const cmp = getContractComplianceSummary(c.solar_id, c);
  const recs = appData.tables.Solar_Records.filter(r => r.solar_id === c.solar_id)
    .sort((a, b) => String(b.period_end || b.period_label).localeCompare(String(a.period_end || a.period_label)));
  const buildings = parseJSON(c.buildings_json, []);
  const ratePct = (normFeedbackRate(c.feedback_rate) * 100).toFixed(2).replace(/\.00$/, '');

  const tabBody = solarV2DetailTab === 'billing' ? renderSolarDetailBillingTabHTML(c, recs)
    : solarV2DetailTab === 'bonds' ? renderSolarDetailBondsTabHTML(c, bond)
    : renderSolarDetailComplianceTabHTML(c, cmp);

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">
      <button class="btn-sm" onclick="solarV2SelectedId=null;renderCurrentView()">← 返回太陽能契約總覽</button>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn-sm" onclick="openSolarContractModal('${esc(c.solar_id)}')">✎ 編輯契約主檔（4區塊）</button>
        <button class="btn-sm" onclick="openSharedMeterBatchModal('${esc(c.taipower_meter_no || '')}')">⚡ 共錶批次拆帳</button>
        <button class="btn-sm btn-primary" onclick="printSingleSolarContractPDF('${esc(c.solar_id)}')">🖨️ 列印本約完整報表 PDF</button>
        <button class="btn-sm btn-danger" onclick="deleteSolarContractV2('${esc(c.solar_id)}')">🗑️ 刪除契約</button>
      </div>
    </div>

    <div class="panel">
      <div class="panel-bd">
        <div class="item-row" style="flex-wrap:wrap">
          <div>
            <span class="tag tag-blue">${esc(c.solar_id)}</span>
            ${c.phase_label ? `<span class="tag tag-amber">${esc(c.phase_label)}</span>` : ''}
            <span class="tag ${c.status==='併聯發電中'?'tag-green':'tag-gray'}">${esc(c.status)}</span>
            ${c.parent_contract_id ? `<span class="tag tag-gray">續約母約：${esc(c.parent_contract_id)}</span>` : ''}
            <h2 style="margin:4px 0 2px;font-size:20px">${esc(c.building_name)}</h2>
          </div>
          <div style="text-align:right"><div class="item-meta">留存履約保證金餘額</div><div style="font-size:22px;font-weight:800;color:var(--primary)">${fmtMoney(bond.balance)}</div></div>
        </div>

        <div class="sol-info-grid">
          <div>
            <strong>承租廠商與連帶保證人</strong>
            <div class="item-meta">廠商：${esc(c.vendor_name || c.lessee_vendor || '-')} ${c.vendor_tax_id ? `(統編 ${esc(c.vendor_tax_id)})` : ''}</div>
            <div class="item-meta">聯絡：${esc(c.vendor_contact || '-')} ${esc(c.vendor_phone || '')} ${esc(c.vendor_email || '')}</div>
            ${c.guarantor_name ? `<div class="item-meta">連保：${esc(c.guarantor_name)} (${esc(c.guarantor_tax_id || '-')}) ／ ${esc(c.guarantor_rep || '-')} ${esc(c.guarantor_phone || '')}</div>` : ''}
          </div>
          <div>
            <strong>共錶與計費參數</strong>
            <div class="item-meta">電號：<code>${esc(c.taipower_meter_no || '-')}</code> ／ 台電約號：${esc(c.taipower_contract_no || '-')}</div>
            <div class="item-meta">容量：<strong>${c.capacity_kwp} kWp</strong> ／ 共錶 ${c.shared_total_kwp || c.capacity_kwp} kWp（<strong>${c.allocation_ratio || 100}%</strong>）</div>
            <div class="item-meta">原躉購費率 ${c.fit_rate || '-'} ｜ 回饋 ${ratePct}% ｜ 基準年租金 <strong>${fmtMoney(c.base_annual_rent)}</strong></div>
          </div>
          <div>
            <strong>效期、公證與繳款約定</strong>
            <div class="item-meta">起迄：${esc(c.contract_start || '-')} ~ <strong>${esc(c.contract_end || '-')}</strong>（${c.term_months || '-'}個月）</div>
            <div class="item-meta" style="color:#2563eb">${toRocDate(c.contract_start)} ~ ${toRocDate(c.contract_end)}</div>
            <div class="item-meta">優先續租截止：<strong>${fmtDateWithRoc(c.renewal_deadline)}</strong> ｜ 繳款日：${esc(c.annual_due_month_day || '-')}</div>
            ${c.meter_cutoff_note ? `<div class="item-meta" style="color:#b45309">📝 ${esc(c.meter_cutoff_note)}</div>` : ''}
            ${c.drive_folder_url ? `<div class="item-meta"><a href="${esc(c.drive_folder_url)}" target="_blank">📁 契約與保單雲端資料夾</a></div>` : ''}
          </div>
        </div>
        ${buildings.length ? `<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;align-items:center"><span style="font-size:12px;font-weight:700;color:var(--muted)">🏗️ 建物標的：</span>${buildings.map(b => `<span class="tag tag-gray">${esc(b.name)} ${b.area ? b.area + '㎡' : ''}${b.land_lot ? '｜地號' + esc(b.land_lot) : ''}${b.voltage ? '｜' + esc(b.voltage) : ''}</span>`).join('')}</div>` : ''}
      </div>
    </div>

    <div class="sol-detail-tabs">
      <button class="${solarV2DetailTab==='billing'?'btn-primary':''}" onclick="solarV2DetailTab='billing';renderCurrentView()">📊 對帳明細與級距驗算 (${recs.length})</button>
      <button class="${solarV2DetailTab==='bonds'?'btn-primary':''}" onclick="solarV2DetailTab='bonds';renderCurrentView()">🔒 履約保證金帳本 (${bond.txs.length})</button>
      <button class="${solarV2DetailTab==='compliance'?'btn-primary':''}" onclick="solarV2DetailTab='compliance';renderCurrentView()">🛡️ 雙保險與變更歷程 (${cmp.logs.length})</button>
    </div>
    ${tabBody}`;
}

function renderSolarDetailBillingTabHTML(c, recs) {
  return `
    <div class="panel">
      <div class="panel-hd">
        <h3>📊 各期租金、轉供／餘電混算與 5% 級距對帳表</h3>
        <button class="btn-sm btn-primary" onclick="openSolarBillV2Modal('${esc(c.solar_id)}')">＋ 新增本期對帳單</button>
      </div>
      <div class="panel-bd" style="overflow-x:auto">
        ${recs.length ? `<table>
          <thead><tr><th>期數與區間</th><th>本約度數／含稅收入</th><th>參考年租金與占比</th><th>適用級距／應繳租金</th><th>逾期違約金</th><th>實繳與匯款核銷</th><th>操作</th></tr></thead>
          <tbody>
            ${recs.map(r => {
              const k = calcSolarBillV2(r, c), details = parseJSON(r.monthly_details_json, []);
              return `<tr>
                <td style="white-space:nowrap"><strong>${esc(r.period_label)}</strong> (${k.periodMonths}個月)<div class="item-meta">${esc(r.period_start)}~${esc(r.period_end)}</div><div class="item-meta" style="color:#2563eb">${toRocDate(r.period_start)}~${toRocDate(r.period_end)}</div></td>
                <td style="white-space:nowrap"><strong>${k.totalKwh.toLocaleString('zh-TW')} 度</strong><div class="item-meta">收入 ${fmtMoney(k.totalRev)}</div>${details.length ? `<div class="item-meta">含 ${details.length} 筆拆帳明細</div>` : ''}</td>
                <td style="white-space:nowrap"><strong>${fmtMoney(k.refRent)}</strong>${k.baseRent ? `<div class="item-meta">占基準 ${k.ratioPct}%（建議 ${k.suggestedTier}%）</div>` : ''}${k.periodMonths < 12 && k.baseRent ? `<div class="item-meta">折算基準 ${fmtMoney(k.proratedBase)}</div>` : ''}</td>
                <td style="white-space:nowrap"><span class="tag tag-blue">${k.mode==='TIERED_BASE_RENT' ? `套用 ${k.appliedTier}%` : k.mode}</span><div style="font-weight:800;color:var(--primary)">${fmtMoney(k.calculatedRent)}</div>${r.tier_clause_note ? `<div class="item-meta">📖 ${esc(r.tier_clause_note)}</div>` : ''}</td>
                <td style="white-space:nowrap">${k.penInfo.penalty > 0 ? `<span class="tag tag-red">逾期${k.penInfo.overdueDays}天 (+${k.penInfo.ratePct}%)</span><div style="color:var(--red);font-weight:700">${fmtMoney(k.penInfo.penalty)}</div>${k.penInfo.canTerminate ? '<span class="tag tag-red">🚨 達得終止門檻</span>' : ''}` : '<span class="tag tag-green">無逾期</span>'}${k.dueDate ? `<div class="item-meta">期限 ${esc(k.dueDate)}</div>` : ''}</td>
                <td style="white-space:nowrap"><strong style="color:${k.hasActual && Math.abs(k.diffAmt)>10 ? 'var(--red)' : 'var(--green)'}">${k.hasActual ? fmtMoney(k.actualPaid) : '未入帳'}</strong><div class="item-meta">${r.payment_date ? fmtDateWithRoc(r.payment_date) : ''}</div><div class="item-meta">${r.remittance_batch_no ? '批號 ' + esc(r.remittance_batch_no) : ''} ${r.drive_file_url ? `<a href="${esc(r.drive_file_url)}" target="_blank">📎 收據</a>` : ''}</div></td>
                <td style="white-space:nowrap"><button class="btn-xs" onclick="openSolarBillV2Modal('${esc(c.solar_id)}','${esc(r.record_id)}')">✎ 明細</button><button class="btn-xs btn-danger" onclick="deleteSolarRecordV2('${esc(r.record_id)}')">刪</button></td>
              </tr>`;
            }).join('')}
          </tbody></table>` : '<div class="empty-state">尚無對帳紀錄。</div>'}
      </div>
    </div>`;
}

function renderSolarDetailBondsTabHTML(c, bond) {
  const lbl = { DEPOSIT: '繳納 (+)', REFUND: '分期退還 (-)', DEDUCT: '扣抵 (-)', CARRY_OVER: '轉續約留存' };
  const oneEighth = bond.initial > 0 ? roundMoney(bond.initial / 8) : 0;
  let running = 0;
  return `
    <div class="eng-kpi-row" style="grid-template-columns:repeat(4,1fr)">
      <div class="eng-stat"><div class="lbl">原始保證金總額</div><div class="val">${fmtMoney(bond.initial)}</div></div>
      <div class="eng-stat"><div class="lbl">累計退還／扣抵</div><div class="val" style="color:var(--amber)">${fmtMoney(bond.refunded)}</div></div>
      <div class="eng-stat"><div class="lbl">目前留存餘額</div><div class="val" style="color:var(--primary)">${fmtMoney(bond.balance)}</div></div>
      <div class="eng-stat"><div class="lbl">繳納方式／效期</div><div class="val" style="font-size:15px">${esc(c.bond_method || '現金')}<div class="item-meta">${c.bond_method && c.bond_method !== '現金' ? fmtDateWithRoc(c.deposit_expiry) : '無效期限制'}</div></div></div>
    </div>
    <div class="panel">
      <div class="panel-hd">
        <h3>🔒 履約保證金動態帳本</h3>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${oneEighth > 0 ? `<button class="btn-sm" onclick="openBondTxModal('${esc(c.solar_id)}','','REFUND',${oneEighth},'契約期滿申請退還 1/8 履約保證金')">⚡ 快速退還 1/8 (${oneEighth.toLocaleString('zh-TW')}元)</button>` : ''}
          <button class="btn-sm btn-primary" onclick="openBondTxModal('${esc(c.solar_id)}')">＋ 新增保證金異動</button>
        </div>
      </div>
      <div class="panel-bd" style="overflow-x:auto">
        ${bond.txs.length ? `<table>
          <thead><tr><th>異動日期</th><th>類型</th><th>金額</th><th>累計餘額</th><th>事由與公文字號</th><th>匯入帳號與領據</th><th>操作</th></tr></thead>
          <tbody>${bond.txs.map(t => {
            const amt = Number(t.amount) || 0; running += amt;
            return `<tr>
              <td style="white-space:nowrap"><strong>${esc(t.tx_date)}</strong><div class="item-meta">${toRocDate(t.tx_date)}</div></td>
              <td><span class="tag ${amt>=0?'tag-green':'tag-amber'}">${lbl[t.tx_type] || esc(t.tx_type)}</span></td>
              <td style="font-weight:800;color:${amt>=0?'var(--green)':'var(--red)'};white-space:nowrap">${amt>=0?'+':''}${amt.toLocaleString('zh-TW')} 元</td>
              <td style="font-weight:700;white-space:nowrap">${running.toLocaleString('zh-TW')} 元</td>
              <td><strong>${esc(t.reason)}</strong><div class="item-meta">${t.doc_no ? '文號：' + esc(t.doc_no) : ''}</div></td>
              <td><div>${esc(t.vendor_bank_account || '-')}</div>${t.receipt_url ? `<a href="${esc(t.receipt_url)}" target="_blank">📎 領據收據</a>` : ''}</td>
              <td style="white-space:nowrap"><button class="btn-xs" onclick="openBondTxModal('${esc(c.solar_id)}','${esc(t.tx_id)}')">✎</button><button class="btn-xs btn-danger" onclick="deleteBondTx('${esc(t.tx_id)}')">刪</button></td>
            </tr>`;
          }).join('')}</tbody></table>` : '<div class="empty-state">尚未建立保證金異動明細。</div>'}
      </div>
    </div>`;
}

function renderSolarDetailComplianceTabHTML(c, cmp) {
  const pubC = cmp.pub.log ? parseJSON(cmp.pub.log.compliance_json, {}) : {};
  const propC = cmp.prop.log ? parseJSON(cmp.prop.log.compliance_json, {}) : {};
  const tMap = { PUBLIC_LIABILITY_INS: ['tag-blue', '公共意外責任險'], PROPERTY_INS: ['tag-amber', '產物保險'], AMENDMENT: ['tag-gray', '契約變更協議書'] };

  return `
    <div class="ins-grid">
      <div class="ins-card ${cmp.pub.level}">
        <div class="item-row"><strong>🛡️ 公共意外責任險（4項最低保額）</strong><span class="tag ${cmp.pub.level==='ok'?'tag-green':cmp.pub.level==='amber'?'tag-amber':'tag-red'}">${cmp.pub.exists ? (cmp.pub.compliant ? '✅ 合規' : '🚨 保額不足') : '🚨 未登錄'}</span></div>
        <div class="item-meta">最新效期：<strong>${cmp.pub.expiry ? fmtDateWithRoc(cmp.pub.expiry) : '未登錄'}</strong></div>
        ${cmp.pub.log ? `<div class="item-meta">每人 ${pubC.per_person||0}萬(≥300)｜每事故傷亡 ${pubC.per_accident_body||0}萬(≥1500)｜財損 ${pubC.per_accident_prop||0}萬(≥200)｜總額 ${pubC.aggregate||0}萬(≥4800)</div>` : ''}
        ${cmp.pub.missing.length ? `<div class="item-meta" style="color:var(--red);font-weight:700">⚠️ ${esc(cmp.pub.missing.join('、'))}</div>` : ''}
      </div>
      <div class="ins-card ${cmp.prop.level}">
        <div class="item-row"><strong>⛈️ 產物保險（颱風／火災／地震）</strong><span class="tag ${cmp.prop.level==='ok'?'tag-green':cmp.prop.level==='amber'?'tag-amber':'tag-red'}">${cmp.prop.exists ? (cmp.prop.compliant ? '✅ 齊備' : '🚨 缺險種') : '⚠️ 未登錄'}</span></div>
        <div class="item-meta">最新效期：<strong>${cmp.prop.expiry ? fmtDateWithRoc(cmp.prop.expiry) : '未登錄'}</strong></div>
        ${cmp.prop.log ? `<div class="item-meta">颱風 ${propC.typhoon?'✅':'❌'} ｜ 火災 ${propC.fire?'✅':'❌'} ｜ 地震 ${propC.earthquake?'✅':'❌'}</div>` : ''}
        ${cmp.prop.missing.length ? `<div class="item-meta" style="color:var(--red);font-weight:700">⚠️ ${esc(cmp.prop.missing.join('、'))}</div>` : ''}
      </div>
    </div>
    <div class="panel">
      <div class="panel-hd">
        <h3>📜 雙保險續保與契約變更協議書歷程（變更屆滿日自動同步主檔）</h3>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn-sm" onclick="openComplianceLogModal('${esc(c.solar_id)}','','PUBLIC_LIABILITY_INS')">＋ 意外險</button>
          <button class="btn-sm" onclick="openComplianceLogModal('${esc(c.solar_id)}','','PROPERTY_INS')">＋ 產險</button>
          <button class="btn-sm btn-primary" onclick="openComplianceLogModal('${esc(c.solar_id)}','','AMENDMENT')">＋ 變更協議書</button>
        </div>
      </div>
      <div class="panel-bd" style="overflow-x:auto">
        ${cmp.logs.length ? `<table>
          <thead><tr><th>類別</th><th>保單／公證字號</th><th>起始／簽署日</th><th>續保到期日</th><th>合規檢核／變更摘要</th><th>附件</th><th>操作</th></tr></thead>
          <tbody>${cmp.logs.map(l => {
            const [tCls, tLbl] = tMap[l.log_type] || ['tag-gray', l.log_type], j = parseJSON(l.compliance_json, {});
            const det = l.log_type === 'PUBLIC_LIABILITY_INS' ? `保額 ${j.per_person||0}/${j.per_accident_body||0}/${j.per_accident_prop||0}/${j.aggregate||0}萬`
              : l.log_type === 'PROPERTY_INS' ? `涵蓋：${[j.typhoon?'颱風':'', j.fire?'火災':'', j.earthquake?'地震':''].filter(Boolean).join('、')||'無'}`
              : j.change_end_date ? `屆滿日：${j.old_end_date||'-'} → ${j.new_end_date}（續租截止 ${j.new_renewal_deadline||'-'}）` : '';
            return `<tr>
              <td><span class="tag ${tCls}">${tLbl}</span></td>
              <td><strong>${esc(l.doc_or_policy_no || '-')}</strong></td>
              <td style="white-space:nowrap">${esc(l.effective_date || '-')}<div class="item-meta">${toRocDate(l.effective_date)}</div></td>
              <td style="white-space:nowrap">${l.expiry_date ? `${esc(l.expiry_date)}<div class="item-meta">${toRocDate(l.expiry_date)}</div>` : '-'}</td>
              <td><div>${esc(det)}</div>${l.notes ? `<div class="item-meta">${esc(l.notes)}</div>` : ''}</td>
              <td>${l.attachment_url ? `<a href="${esc(l.attachment_url)}" target="_blank">📎 掃描檔</a>` : '-'}</td>
              <td style="white-space:nowrap"><button class="btn-xs" onclick="openComplianceLogModal('${esc(c.solar_id)}','${esc(l.log_id)}')">✎</button><button class="btn-xs btn-danger" onclick="deleteComplianceLog('${esc(l.log_id)}')">刪</button></td>
            </tr>`;
          }).join('')}</tbody></table>` : '<div class="empty-state">尚無雙保險或契約變更紀錄。</div>'}
      </div>
    </div>`;
}

// ============================================================================
// 3. 新版 4 區塊折疊契約表單 (openSolarContractModal)
// ============================================================================
openSolarContractModal = function(solarId = '') {
  ensureSolarV2Tables();
  const c = solarId ? appData.tables.Solar_Contracts.find(x => x.solar_id === solarId) : {};
  const others = appData.tables.Solar_Contracts.filter(x => x.solar_id !== solarId);
  const buildings = parseJSON(c.buildings_json, []);
  const ratePct = (c.feedback_rate !== undefined && c.feedback_rate !== '') ? Number((normFeedbackRate(c.feedback_rate) * 100).toFixed(2)) : 15;
  const bmode = c.billing_mode || 'TIERED_BASE_RENT', smode = c.sales_mode || 'MIXED_WHEELING', bmethod = c.bond_method || '現金';

  openModal(solarId ? `✎ 編輯太陽能契約（${c.solar_id}）` : '＋ 新增太陽能屋頂租賃契約（4 區塊架構）', `
    <details class="sol-acc" open>
      <summary><span>1. 基本識別與建物標的清冊</span><small style="color:var(--muted)">案場名稱／期別／面積與地號</small></summary>
      <div class="sol-acc-bd"><div class="form-grid">
        <div class="field full"><label>案場／屋頂名稱 *</label><input id="sv2-name" type="text" value="${esc(c.building_name || '')}" placeholder="例：D4教室暨D4風雨球場屋頂"></div>
        <div class="field"><label>期別</label><input id="sv2-phase" type="text" value="${esc(c.phase_label || '')}" placeholder="例：一期／二期"></div>
        <div class="field"><label>案場狀態</label><select id="sv2-status">${['併聯發電中','建置中','已屆滿','已解約'].map(s=>`<option value="${s}" ${(c.status||'併聯發電中')===s?'selected':''}>${s}</option>`).join('')}</select></div>
        <div class="field full"><label>續約關聯前母約（選填）</label><select id="sv2-parent"><option value="">無（新簽獨立約）</option>${others.map(o=>`<option value="${esc(o.solar_id)}" ${c.parent_contract_id===o.solar_id?'selected':''}>${esc(o.solar_id)} - ${esc(o.building_name)} ${esc(o.phase_label||'')}</option>`).join('')}</select></div>
        <div class="field full"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><label style="margin:0">建物清冊（棟別／地號／建號使照／面積㎡／電壓）</label><button type="button" class="btn-xs" onclick="addSolarBuildingRow()">＋ 新增棟別</button></div><div id="sv2-buildings-wrap"></div></div>
      </div></div>
    </details>
    <details class="sol-acc" open>
      <summary><span>2. 承租廠商與連帶保證人</span><small style="color:var(--muted)">統編／聯絡窗口／連帶保證人</small></summary>
      <div class="sol-acc-bd"><div class="form-grid">
        <div class="field"><label>廠商名稱 *</label><input id="sv2-vname" type="text" value="${esc(c.vendor_name || c.lessee_vendor || '')}"></div>
        <div class="field"><label>廠商統編</label><input id="sv2-vtax" type="text" value="${esc(c.vendor_tax_id || '')}"></div>
        <div class="field"><label>負責人／聯絡人</label><input id="sv2-vcontact" type="text" value="${esc(c.vendor_contact || '')}"></div>
        <div class="field"><label>聯絡電話</label><input id="sv2-vphone" type="text" value="${esc(c.vendor_phone || '')}"></div>
        <div class="field"><label>Email</label><input id="sv2-vemail" type="email" value="${esc(c.vendor_email || '')}"></div>
        <div class="field"><label>地址</label><input id="sv2-vaddr" type="text" value="${esc(c.vendor_address || '')}"></div>
        <div class="field"><label>連帶保證人名稱（選填）</label><input id="sv2-gname" type="text" value="${esc(c.guarantor_name || '')}"></div>
        <div class="field"><label>連帶保證人統編</label><input id="sv2-gtax" type="text" value="${esc(c.guarantor_tax_id || '')}"></div>
        <div class="field"><label>連帶保證人代表人</label><input id="sv2-grep" type="text" value="${esc(c.guarantor_rep || '')}"></div>
        <div class="field"><label>連帶保證人電話</label><input id="sv2-gphone" type="text" value="${esc(c.guarantor_phone || '')}"></div>
      </div></div>
    </details>
    <details class="sol-acc" open>
      <summary><span>3. 共錶分攤與計費參數</span><small style="color:var(--muted)">電號分群／5%級距制／基準年租金</small></summary>
      <div class="sol-acc-bd"><div class="form-grid">
        <div class="field"><label>台電電號（共錶分群鍵）</label><input id="sv2-meter" type="text" value="${esc(c.taipower_meter_no || '')}" placeholder="18-40-6486-03-1"></div>
        <div class="field"><label>台電契約編號</label><input id="sv2-tpno" type="text" value="${esc(c.taipower_contract_no || '')}" placeholder="18-PV-105-0128"></div>
        <div class="field"><label>共錶併聯總容量（kWp）</label><input id="sv2-shared-kwp" type="number" step="0.01" value="${esc(c.shared_total_kwp || c.capacity_kwp || '')}" oninput="recalcSolarFormFields('ratio')"></div>
        <div class="field"><label>本約標租容量（kWp）*</label><input id="sv2-kwp" type="number" step="0.01" value="${esc(c.capacity_kwp || '')}" oninput="recalcSolarFormFields('both')"></div>
        <div class="field"><label>共錶分攤比例（%，預設自動算可手調）</label><input id="sv2-ratio" type="number" step="0.1" value="${esc(c.allocation_ratio || 100)}"></div>
        <div class="field"><label>售電模式</label><select id="sv2-sales"><option value="MIXED_WHEELING" ${smode==='MIXED_WHEELING'?'selected':''}>民間售電業轉供＋台電餘電</option><option value="TAIPOWER_FIT" ${smode==='TAIPOWER_FIT'?'selected':''}>台電全額躉購</option></select></div>
        <div class="field"><label>計費模式</label><select id="sv2-bmode" onchange="syncSolarFormVisibility()"><option value="TIERED_BASE_RENT" ${bmode==='TIERED_BASE_RENT'?'selected':''}>基準年租金 5% 級距制</option><option value="PURE_PERCENTAGE" ${bmode==='PURE_PERCENTAGE'?'selected':''}>純實際售電比例制</option><option value="MIN_GUARANTEE" ${bmode==='MIN_GUARANTEE'?'selected':''}>保底制</option></select></div>
        <div class="field"><label>回饋金比例（%）*</label><input id="sv2-rate" type="number" step="0.01" value="${esc(ratePct)}" oninput="recalcSolarFormFields('base')"></div>
        <div class="field sv2-tiered-only"><label>原定躉購費率（元／度）</label><input id="sv2-fit" type="number" step="0.0001" value="${esc(c.fit_rate || '')}" oninput="recalcSolarFormFields('base')"></div>
        <div class="field sv2-tiered-only"><label>基準經營年租金（自動試算可微調）</label><input id="sv2-baserent" type="number" value="${esc(c.base_annual_rent || '')}"></div>
        <div class="field sv2-min-only"><label>年度保底回饋金（元）</label><input id="sv2-minrent" type="number" value="${Number(c.min_annual_feedback) || 0}"></div>
        <div class="field"><label>結算週期</label><select id="sv2-cycle">${['年結','半年結','季結','月結'].map(x=>`<option value="${x}" ${(c.billing_cycle||'年結')===x?'selected':''}>${x}</option>`).join('')}</select></div>
        <div class="field"><label>約定繳款月日（MM-DD）</label><input id="sv2-duemd" type="text" value="${esc(c.annual_due_month_day || '')}" placeholder="10-27"></div>
        <div class="field full"><label>抄表日與合約到期日差異備註</label><input id="sv2-cutoff" type="text" value="${esc(c.meter_cutoff_note || '')}" placeholder="例：抄表結算至 2026/03/31"></div>
      </div></div>
    </details>
    <details class="sol-acc" open>
      <summary><span>4. 契約效期、公證與保證金</span><small style="color:var(--muted)">雙保險移至詳情獨立管理</small></summary>
      <div class="sol-acc-bd"><div class="form-grid">
        <div class="field"><label>契約起始日</label><input id="sv2-s1" type="date" value="${esc(c.contract_start || '')}" oninput="updateSolarFormRocHints()"><div id="sv2-s1-roc" class="roc-hint"></div></div>
        <div class="field"><label>契約屆滿日（自動減3月算續租日）</label><input id="sv2-s2" type="date" value="${esc(c.contract_end || '')}" oninput="onSolarEndDateChange()"><div id="sv2-s2-roc" class="roc-hint"></div></div>
        <div class="field"><label>總租期月數（例 119）</label><input id="sv2-term" type="number" value="${esc(c.term_months || '')}"></div>
        <div class="field"><label>優先續租申請截止日</label><input id="sv2-renew" type="date" value="${esc(c.renewal_deadline || '')}" oninput="updateSolarFormRocHints()"><div id="sv2-renew-roc" class="roc-hint"></div></div>
        <div class="field"><label>公證書字號</label><input id="sv2-notary" type="text" value="${esc(c.notary_no || '')}"></div>
        <div class="field"><label>契約與保單雲端資料夾連結</label><input id="sv2-drive" type="url" value="${esc(c.drive_folder_url || '')}"></div>
        <div class="field"><label>保證金繳納方式</label><select id="sv2-bmethod" onchange="syncSolarFormVisibility()">${['現金','銀行保證函','定存單'].map(m=>`<option value="${m}" ${bmethod===m?'selected':''}>${m}</option>`).join('')}</select></div>
        <div class="field"><label>原始履約保證金總額（元）</label><input id="sv2-bondinit" type="number" value="${esc(c.deposit_amount || '')}"></div>
        <div class="field sv2-bondexp-only"><label>保證函／定存單效期日</label><input id="sv2-bondexp" type="date" value="${esc(c.deposit_expiry || '')}" oninput="updateSolarFormRocHints()"><div id="sv2-bondexp-roc" class="roc-hint"></div></div>
        ${!solarId ? `<div class="field full"><label><input type="checkbox" id="sv2-init-bond-tx" checked> 建檔時同步於「保證金帳本」建立初始繳納紀錄</label></div>` : ''}
      </div></div>
    </details>
  `, `<button onclick="closeModal()">取消</button><button class="btn-primary" onclick="saveSolarContractV2('${esc(solarId)}')">儲存契約</button>`);

  (buildings.length ? buildings : [{}]).forEach(b => addSolarBuildingRow(b));
  syncSolarFormVisibility();
  updateSolarFormRocHints();
};

function addSolarBuildingRow(b = {}) {
  const wrap = document.getElementById('sv2-buildings-wrap'); if (!wrap) return;
  const row = document.createElement('div'); row.className = 'sol-subrow';
  row.innerHTML = `<input class="sb-name" placeholder="建物名稱" value="${esc(b.name||'')}">
    <input class="sb-lot" placeholder="地號" value="${esc(b.land_lot||'')}">
    <input class="sb-permit" placeholder="建號/使照" value="${esc(b.permit_no||'')}">
    <input type="number" step="0.01" class="sb-area" placeholder="面積㎡" value="${esc(b.area||'')}">
    <input class="sb-volt" placeholder="電壓" value="${esc(b.voltage||'')}">
    <button type="button" class="btn-xs btn-danger" onclick="this.parentElement.remove()">✕</button>`;
  wrap.appendChild(row);
}

function recalcSolarFormFields(kind) {
  const kwp = Number(document.getElementById('sv2-kwp')?.value) || 0;
  const shared = Number(document.getElementById('sv2-shared-kwp')?.value) || 0;
  if ((kind === 'ratio' || kind === 'both') && kwp > 0 && shared > 0) document.getElementById('sv2-ratio').value = Math.round((kwp / shared) * 100);
  if (kind === 'base' || kind === 'both') {
    const base = calcBaseAnnualRent(kwp, document.getElementById('sv2-fit')?.value, document.getElementById('sv2-rate')?.value);
    if (base > 0) {
      document.getElementById('sv2-baserent').value = base;
      const bEl = document.getElementById('sv2-bondinit');
      if (bEl && !bEl.value) bEl.value = base * 2;
    }
  }
}

function syncSolarFormVisibility() {
  const bm = document.getElementById('sv2-bmode')?.value, dm = document.getElementById('sv2-bmethod')?.value;
  document.querySelectorAll('.sv2-tiered-only').forEach(e => { e.style.display = bm === 'TIERED_BASE_RENT' ? 'flex' : 'none'; });
  document.querySelectorAll('.sv2-min-only').forEach(e => { e.style.display = bm === 'MIN_GUARANTEE' ? 'flex' : 'none'; });
  document.querySelectorAll('.sv2-bondexp-only').forEach(e => { e.style.display = dm !== '現金' ? 'flex' : 'none'; });
}

function onSolarEndDateChange() {
  const endDt = document.getElementById('sv2-s2')?.value;
  if (endDt) document.getElementById('sv2-renew').value = subMonthsYmd(endDt, 3);
  updateSolarFormRocHints();
}

function updateSolarFormRocHints() {
  [['sv2-s1','sv2-s1-roc'],['sv2-s2','sv2-s2-roc'],['sv2-renew','sv2-renew-roc'],['sv2-bondexp','sv2-bondexp-roc']].forEach(([i, o]) => {
    const el = document.getElementById(o); if (el) el.textContent = toRocDate(document.getElementById(i)?.value);
  });
}

async function saveSolarContractV2(solarId) {
  const name = document.getElementById('sv2-name').value.trim(), kwp = Number(document.getElementById('sv2-kwp').value);
  if (!name || !kwp) return toast('請填寫案場／屋頂名稱與本約容量 (kWp)');
  const existing = solarId ? appData.tables.Solar_Contracts.find(x => x.solar_id === solarId) : {};
  const buildings = Array.from(document.querySelectorAll('#sv2-buildings-wrap .sol-subrow')).map(r => ({
    name: r.querySelector('.sb-name')?.value.trim() || '', land_lot: r.querySelector('.sb-lot')?.value.trim() || '',
    permit_no: r.querySelector('.sb-permit')?.value.trim() || '', area: r.querySelector('.sb-area')?.value ? Number(r.querySelector('.sb-area').value) : '',
    voltage: r.querySelector('.sb-volt')?.value.trim() || ''
  })).filter(b => b.name);

  const vName = document.getElementById('sv2-vname').value.trim(), vCon = document.getElementById('sv2-vcontact').value.trim(), vPh = document.getElementById('sv2-vphone').value.trim();
  const ratePct = Number(document.getElementById('sv2-rate').value) || 0, bMethod = document.getElementById('sv2-bmethod').value;
  const endDt = document.getElementById('sv2-s2').value, sid = solarId || nextId('Solar_Contracts', 'solar_id', 'SOL', 3);

  const rec = {
    ...existing, solar_id: sid, building_name: name, phase_label: document.getElementById('sv2-phase').value.trim(),
    parent_contract_id: document.getElementById('sv2-parent').value, status: document.getElementById('sv2-status').value,
    buildings_json: JSON.stringify(buildings), lessee_vendor: [vName, vCon, vPh].filter(Boolean).join('／'),
    vendor_name: vName, vendor_tax_id: document.getElementById('sv2-vtax').value.trim(), vendor_contact: vCon,
    vendor_phone: vPh, vendor_email: document.getElementById('sv2-vemail').value.trim(), vendor_address: document.getElementById('sv2-vaddr').value.trim(),
    guarantor_name: document.getElementById('sv2-gname').value.trim(), guarantor_tax_id: document.getElementById('sv2-gtax').value.trim(),
    guarantor_rep: document.getElementById('sv2-grep').value.trim(), guarantor_phone: document.getElementById('sv2-gphone').value.trim(),
    taipower_meter_no: document.getElementById('sv2-meter').value.trim(), taipower_contract_no: document.getElementById('sv2-tpno').value.trim(),
    shared_total_kwp: Number(document.getElementById('sv2-shared-kwp').value) || kwp, capacity_kwp: kwp,
    allocation_ratio: Number(document.getElementById('sv2-ratio').value) || 100,
    sales_mode: document.getElementById('sv2-sales').value, billing_mode: document.getElementById('sv2-bmode').value,
    fit_rate: Number(document.getElementById('sv2-fit').value) || '', feedback_rate: Number((ratePct / 100).toFixed(5)),
    base_annual_rent: Number(document.getElementById('sv2-baserent').value) || 0, min_annual_feedback: Number(document.getElementById('sv2-minrent').value) || 0,
    billing_cycle: document.getElementById('sv2-cycle').value, annual_due_month_day: document.getElementById('sv2-duemd').value.trim(),
    meter_cutoff_note: document.getElementById('sv2-cutoff').value.trim(), contract_start: document.getElementById('sv2-s1').value,
    contract_end: endDt, term_months: Number(document.getElementById('sv2-term').value) || '',
    renewal_deadline: document.getElementById('sv2-renew').value || (endDt ? subMonthsYmd(endDt, 3) : ''),
    notary_no: document.getElementById('sv2-notary').value.trim(), drive_folder_url: document.getElementById('sv2-drive').value.trim(),
    bond_method: bMethod, deposit_amount: Number(document.getElementById('sv2-bondinit').value) || 0,
    deposit_expiry: bMethod === '現金' ? '' : document.getElementById('sv2-bondexp').value,
    insurance_expiry: existing.insurance_expiry || '', updated_at: nowStr(), is_deleted: false
  };
  upsertLocal('Solar_Contracts', rec, 'solar_id');
  const items = [{ table: 'Solar_Contracts', records: [rec] }];

  if (!solarId && document.getElementById('sv2-init-bond-tx')?.checked && rec.deposit_amount > 0) {
    const tx = {
      tx_id: nextId('Solar_Bond_Ledger', 'tx_id', 'BND', 4), solar_id: sid,
      tx_date: rec.contract_start || todayStr(), tx_type: 'DEPOSIT', amount: rec.deposit_amount,
      reason: '契約起始原始履約保證金繳納', doc_no: rec.notary_no || '', vendor_bank_account: '', receipt_url: '',
      updated_at: nowStr(), is_deleted: false
    };
    upsertLocal('Solar_Bond_Ledger', tx, 'tx_id');
    items.push({ table: 'Solar_Bond_Ledger', records: [tx] });
  }
  closeModal(); solarV2SelectedId = sid; renderCurrentView();
  await pushToCloud({ action: 'batchUpsert', items });
  toast(`✅ 已儲存太陽能契約：${name}`);
}

async function deleteSolarContractV2(id) {
  if (!confirm(`確定刪除契約 ${id}？`)) return;
  appData.tables.Solar_Contracts = appData.tables.Solar_Contracts.filter(c => c.solar_id !== id);
  solarV2SelectedId = null; renderCurrentView();
  await pushToCloud({ action: 'softDelete', table: 'Solar_Contracts', id });
}

// ============================================================================
// 4. 對帳單彈窗 ＋ 共錶電號批次拆帳
// ============================================================================
function openSolarBillV2Modal(solarId, recordId = '') {
  const c = appData.tables.Solar_Contracts.find(x => x.solar_id === solarId); if (!c) return;
  const r = recordId ? appData.tables.Solar_Records.find(x => x.record_id === recordId) : {};
  const details = parseJSON(r.monthly_details_json, []);

  openModal(recordId ? `✎ 編輯對帳單（${r.period_label}）` : `＋ 新增對帳單（${c.building_name}）`, `
    <div id="sbv2-preview" class="gate-banner green" style="margin-bottom:10px"></div>
    <div class="form-grid">
      <div class="field"><label>期數／期別 *</label><input id="sbv2-lbl" value="${esc(r.period_label || '第1期')}"></div>
      <div class="field"><label>計費月數（未滿12月自動顯示折算基準）</label><input id="sbv2-months" type="number" step="0.5" value="${Number(r.period_months)||12}" oninput="previewSolarBillV2('${esc(solarId)}')"></div>
      <div class="field"><label>計費起日</label><input id="sbv2-s1" type="date" value="${esc(r.period_start||'')}" onchange="previewSolarBillV2('${esc(solarId)}')"><div id="sbv2-s1-roc" class="roc-hint"></div></div>
      <div class="field"><label>計費迄日</label><input id="sbv2-s2" type="date" value="${esc(r.period_end||'')}" onchange="previewSolarBillV2('${esc(solarId)}')"><div id="sbv2-s2-roc" class="roc-hint"></div></div>
      <div class="field full"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><label style="margin:0">售電明細（轉供／台電餘電，填完自動加總）</label><button type="button" class="btn-xs" onclick="addSolarDetailRow('${esc(solarId)}')">＋ 新增明細列</button></div><div id="sbv2-details-wrap"></div></div>
      <div class="field"><label>本約合計度數（kWh）*</label><input id="sbv2-kwh" type="number" step="0.1" value="${esc(r.generation_kwh??'')}" oninput="previewSolarBillV2('${esc(solarId)}')"></div>
      <div class="field"><label>本約含稅總收入（元）*</label><input id="sbv2-rev" type="number" value="${esc(r.taipower_revenue??'')}" oninput="previewSolarBillV2('${esc(solarId)}')"></div>
      <div class="field"><label>適用級距 %（留空自動算，可手動覆寫）</label><input id="sbv2-tier" type="number" value="${esc(r.applied_tier_percent??'')}" placeholder="例：70" oninput="previewSolarBillV2('${esc(solarId)}')"></div>
      <div class="field"><label>級距條款依據</label><input id="sbv2-clause" value="${esc(r.tier_clause_note||'')}" placeholder="例：契約第5條第2項第13款"></div>
      <div class="field"><label>約定繳款期限（計違約金用）</label><input id="sbv2-due" type="date" value="${esc(r.due_date||'')}" onchange="previewSolarBillV2('${esc(solarId)}')"></div>
      <div class="field"><label>實繳金額（元）</label><input id="sbv2-paidamt" type="number" value="${esc(r.actual_feedback??'')}" oninput="previewSolarBillV2('${esc(solarId)}')"></div>
      <div class="field"><label>付款／入帳日期</label><input id="sbv2-pdate" type="date" value="${esc(r.payment_date||'')}" onchange="previewSolarBillV2('${esc(solarId)}')"><div id="sbv2-pdate-roc" class="roc-hint"></div></div>
      <div class="field"><label>匯款批號</label><input id="sbv2-batch" value="${esc(r.remittance_batch_no||'')}"></div>
      <div class="field full"><label>匯款收據連結</label><input id="sbv2-url" type="url" value="${esc(r.drive_file_url||'')}"></div>
      <div class="field full"><label>備註</label><textarea id="sbv2-note">${esc(r.maintenance_log||'')}</textarea></div>
    </div>
  `, `<button onclick="closeModal()">取消</button><button class="btn-primary" onclick="saveSolarBillV2('${esc(solarId)}','${esc(recordId)}')">儲存對帳單</button>`);

  details.forEach(d => addSolarDetailRow(solarId, d));
  previewSolarBillV2(solarId);
}

function addSolarDetailRow(solarId, d = {}) {
  const wrap = document.getElementById('sbv2-details-wrap'); if (!wrap) return;
  const row = document.createElement('div'); row.className = 'sol-month-row';
  row.innerHTML = `<select class="sd-src" onchange="sumSolarDetailRows('${esc(solarId)}')"><option value="WHEELING" ${d.source!=='TAIPOWER'?'selected':''}>民間轉供</option><option value="TAIPOWER" ${d.source==='TAIPOWER'?'selected':''}>台電餘電/躉購</option></select>
    <input class="sd-lbl" placeholder="月份/說明" value="${esc(d.label||'')}">
    <input type="number" step="0.01" class="sd-price" placeholder="單價" value="${esc(d.unit_price??'')}">
    <input type="number" step="0.01" class="sd-loss" placeholder="線損%" value="${esc(d.line_loss??'')}">
    <input type="number" step="0.1" class="sd-kwh" placeholder="本約度數" value="${esc(d.alloc_kwh??'')}" oninput="sumSolarDetailRows('${esc(solarId)}')">
    <input type="number" class="sd-amt" placeholder="本約含稅元" value="${esc(d.alloc_amount??'')}" oninput="sumSolarDetailRows('${esc(solarId)}')">
    <button type="button" class="btn-xs btn-danger" onclick="this.parentElement.remove();sumSolarDetailRows('${esc(solarId)}')">✕</button>`;
  wrap.appendChild(row);
}

function sumSolarDetailRows(solarId) {
  const rows = Array.from(document.querySelectorAll('#sbv2-details-wrap .sol-month-row'));
  if (!rows.length) return;
  let kwh = 0, rev = 0;
  rows.forEach(r => { kwh += Number(r.querySelector('.sd-kwh')?.value) || 0; rev += Number(r.querySelector('.sd-amt')?.value) || 0; });
  document.getElementById('sbv2-kwh').value = roundMoney(kwh);
  document.getElementById('sbv2-rev').value = roundMoney(rev);
  previewSolarBillV2(solarId);
}

function previewSolarBillV2(solarId) {
  const c = appData.tables.Solar_Contracts.find(x => x.solar_id === solarId);
  const box = document.getElementById('sbv2-preview'); if (!c || !box) return;
  [['sbv2-s1','sbv2-s1-roc'],['sbv2-s2','sbv2-s2-roc'],['sbv2-pdate','sbv2-pdate-roc']].forEach(([i, o]) => {
    const el = document.getElementById(o); if (el) el.textContent = toRocDate(document.getElementById(i)?.value);
  });
  const k = calcSolarBillV2({
    period_start: document.getElementById('sbv2-s1').value, period_end: document.getElementById('sbv2-s2').value,
    period_months: Number(document.getElementById('sbv2-months').value) || 12,
    generation_kwh: Number(document.getElementById('sbv2-kwh').value) || 0,
    taipower_revenue: Number(document.getElementById('sbv2-rev').value) || 0,
    applied_tier_percent: document.getElementById('sbv2-tier').value === '' ? '' : Number(document.getElementById('sbv2-tier').value),
    due_date: document.getElementById('sbv2-due').value,
    actual_feedback: document.getElementById('sbv2-paidamt').value === '' ? '' : Number(document.getElementById('sbv2-paidamt').value),
    payment_date: document.getElementById('sbv2-pdate').value
  }, c);
  const red = k.penInfo.canTerminate || (k.hasActual && Math.abs(k.diffAmt) > 10);
  box.className = 'gate-banner ' + (red ? 'red' : k.penInfo.penalty > 0 ? 'amber' : 'green');
  box.innerHTML = `參考年租金：<strong>${fmtMoney(k.refRent)}</strong>${k.baseRent ? `（占基準 ${fmtMoney(k.baseRent)} 之 <strong>${k.ratioPct}%</strong>；建議級距 <strong>${k.suggestedTier}%</strong>${k.periodMonths < 12 ? `；${k.periodMonths}月折算基準 ${fmtMoney(k.proratedBase)}` : ''}）` : ''}<br>👉 <strong>應繳年租金（套用 ${k.appliedTier}%）：${fmtMoney(k.calculatedRent)}</strong>${k.penInfo.penalty > 0 ? ` ｜ 🚨 逾期${k.penInfo.overdueDays}天，違約金(${k.penInfo.ratePct}%) = ${fmtMoney(k.penInfo.penalty)}${k.penInfo.canTerminate ? '【已達得終止門檻】' : ''}` : ''}`;
}

async function saveSolarBillV2(solarId, recordId) {
  const c = appData.tables.Solar_Contracts.find(x => x.solar_id === solarId);
  const lbl = document.getElementById('sbv2-lbl').value.trim(); if (!c || !lbl) return toast('請填寫期別');
  const details = Array.from(document.querySelectorAll('#sbv2-details-wrap .sol-month-row')).map(r => ({
    source: r.querySelector('.sd-src')?.value || 'WHEELING', label: r.querySelector('.sd-lbl')?.value.trim() || '',
    unit_price: r.querySelector('.sd-price')?.value ? Number(r.querySelector('.sd-price').value) : '',
    line_loss: r.querySelector('.sd-loss')?.value ? Number(r.querySelector('.sd-loss').value) : '',
    alloc_kwh: Number(r.querySelector('.sd-kwh')?.value) || 0, alloc_amount: Number(r.querySelector('.sd-amt')?.value) || 0
  })).filter(d => d.alloc_kwh > 0 || d.alloc_amount > 0);

  const rec = {
    record_id: recordId || nextId('Solar_Records', 'record_id', 'SR', 4), solar_id: solarId, period_label: lbl,
    period_start: document.getElementById('sbv2-s1').value, period_end: document.getElementById('sbv2-s2').value,
    period_months: Number(document.getElementById('sbv2-months').value) || 12, monthly_details_json: JSON.stringify(details),
    generation_kwh: Number(document.getElementById('sbv2-kwh').value) || 0, taipower_revenue: Number(document.getElementById('sbv2-rev').value) || 0,
    applied_tier_percent: document.getElementById('sbv2-tier').value === '' ? '' : Number(document.getElementById('sbv2-tier').value),
    tier_clause_note: document.getElementById('sbv2-clause').value.trim(), due_date: document.getElementById('sbv2-due').value,
    actual_feedback: document.getElementById('sbv2-paidamt').value === '' ? '' : Number(document.getElementById('sbv2-paidamt').value),
    payment_date: document.getElementById('sbv2-pdate').value, remittance_batch_no: document.getElementById('sbv2-batch').value.trim(),
    drive_file_url: document.getElementById('sbv2-url').value.trim(), maintenance_log: document.getElementById('sbv2-note').value.trim(),
    updated_at: nowStr(), is_deleted: false
  };
  const k = calcSolarBillV2(rec, c);
  rec.expected_feedback = k.refRent; rec.applied_tier_percent = k.appliedTier; rec.calculated_rent = k.calculatedRent;
  rec.overdue_penalty = k.penInfo.penalty; rec.yield_per_kwp = k.dailyYield;
  upsertLocal('Solar_Records', rec, 'record_id'); closeModal(); renderCurrentView();
  await pushToCloud({ action: 'upsert', table: 'Solar_Records', record: rec });
  toast(`✅ 已儲存 ${lbl} 對帳單`);
}

async function deleteSolarRecordV2(id) {
  if (!confirm('確定刪除此筆對帳單？')) return;
  appData.tables.Solar_Records = appData.tables.Solar_Records.filter(r => r.record_id !== id);
  renderCurrentView();
  await pushToCloud({ action: 'softDelete', table: 'Solar_Records', id });
}

function openSharedMeterBatchModal(presetMeterNo = '') {
  ensureSolarV2Tables();
  const meters = Array.from(new Set(appData.tables.Solar_Contracts.map(c => String(c.taipower_meter_no || '').trim()).filter(Boolean)));
  if (!meters.length) return toast('尚無設定「台電電號」的太陽能契約');
  const sel = presetMeterNo && meters.includes(presetMeterNo) ? presetMeterNo : meters[0];

  openModal('⚡ 共錶電號批次拆帳匯入', `
    <div class="form-grid" style="margin-bottom:10px">
      <div class="field"><label>選擇台電共錶電號 *</label><select id="smb-meter" onchange="previewSharedMeterSplit()">${meters.map(m=>`<option value="${esc(m)}" ${m===sel?'selected':''}>${esc(m)}</option>`).join('')}</select></div>
      <div class="field"><label>期別名稱 *</label><input id="smb-lbl" value="第10期"></div>
      <div class="field"><label>計費起日</label><input id="smb-s1" type="date" value="${todayStr().slice(0,4)}-01-01"></div>
      <div class="field"><label>計費迄日</label><input id="smb-s2" type="date" value="${todayStr()}"></div>
      <div class="field"><label>民間轉供共錶總度數（如阿波羅）</label><input id="smb-wkwh" type="number" value="0" oninput="previewSharedMeterSplit()"></div>
      <div class="field"><label>轉供未稅單價（元／度，自動＋5%稅）</label><input id="smb-wprice" type="number" step="0.01" value="5.27" oninput="previewSharedMeterSplit()"></div>
      <div class="field"><label>台電餘電共錶總度數</label><input id="smb-tkwh" type="number" value="0" oninput="previewSharedMeterSplit()"></div>
      <div class="field"><label>台電餘電共錶含稅總金額</label><input id="smb-tamt" type="number" value="0" oninput="previewSharedMeterSplit()"></div>
    </div>
    <div id="smb-preview" class="gate-banner green"></div>
  `, `<button onclick="closeModal()">取消</button><button class="btn-primary" onclick="applySharedMeterSplit()">⚡ 拆帳並批次寫入各契約</button>`);
  previewSharedMeterSplit();
}

function calcSharedMeterSplitList() {
  const m = document.getElementById('smb-meter')?.value;
  const wKwh = Number(document.getElementById('smb-wkwh')?.value) || 0, wPrice = Number(document.getElementById('smb-wprice')?.value) || 0;
  const tKwh = Number(document.getElementById('smb-tkwh')?.value) || 0, tAmt = Number(document.getElementById('smb-tamt')?.value) || 0;
  return appData.tables.Solar_Contracts.filter(c => String(c.taipower_meter_no || '').trim() === m).map(c => {
    const ratioPct = Number(c.allocation_ratio) || 100, ratio = ratioPct / 100;
    const allocWKwh = roundMoney(wKwh * ratio), allocWAmt = roundMoney(allocWKwh * wPrice * 1.05);
    const allocTKwh = roundMoney(tKwh * ratio), allocTAmt = roundMoney(tAmt * ratio);
    return { contract: c, ratioPct, allocWKwh, allocWAmt, allocTKwh, allocTAmt, totalKwh: allocWKwh + allocTKwh, totalRev: allocWAmt + allocTAmt };
  });
}

function previewSharedMeterSplit() {
  const box = document.getElementById('smb-preview'); if (!box) return;
  const list = calcSharedMeterSplitList(), sumR = list.reduce((s, x) => s + x.ratioPct, 0);
  box.className = 'gate-banner ' + (Math.abs(sumR - 100) > 0.5 && list.length > 1 ? 'amber' : 'green');
  box.innerHTML = `<strong>共 ${list.length} 份契約（占比合計 ${sumR}%）：</strong><br>` +
    list.map(x => `• ${esc(x.contract.building_name)} ${esc(x.contract.phase_label||'')}（${x.ratioPct}%）→ <strong>${x.totalKwh.toLocaleString('zh-TW')}度 ／ ${fmtMoney(x.totalRev)}</strong>`).join('<br>');
}

async function applySharedMeterSplit() {
  const list = calcSharedMeterSplitList(), lbl = document.getElementById('smb-lbl').value.trim();
  if (!list.length || !lbl) return toast('請填寫期別名稱');
  const s1 = document.getElementById('smb-s1').value, s2 = document.getElementById('smb-s2').value, wp = Number(document.getElementById('smb-wprice').value) || 0;
  let seq = 0;
  appData.tables.Solar_Records.forEach(r => { const m = String(r.record_id || '').match(/(\d+)$/); if (m) seq = Math.max(seq, parseInt(m[1], 10)); });

  const recs = list.map((x, i) => {
    const det = [];
    if (x.allocWKwh > 0) det.push({ source: 'WHEELING', label: '共錶轉供拆帳', unit_price: wp, line_loss: '', alloc_kwh: x.allocWKwh, alloc_amount: x.allocWAmt });
    if (x.allocTKwh > 0 || x.allocTAmt > 0) det.push({ source: 'TAIPOWER', label: '台電餘電拆帳', unit_price: '', line_loss: '', alloc_kwh: x.allocTKwh, alloc_amount: x.allocTAmt });
    const rec = {
      record_id: `SR-${String(seq + i + 1).padStart(4, '0')}`, solar_id: x.contract.solar_id, period_label: lbl,
      period_start: s1, period_end: s2, period_months: 12, monthly_details_json: JSON.stringify(det),
      generation_kwh: x.totalKwh, taipower_revenue: x.totalRev, applied_tier_percent: '', tier_clause_note: '',
      due_date: '', actual_feedback: '', payment_date: '', remittance_batch_no: '', drive_file_url: '',
      maintenance_log: `共錶批次拆帳（占比 ${x.ratioPct}%）`, updated_at: nowStr(), is_deleted: false
    };
    const k = calcSolarBillV2(rec, x.contract);
    rec.expected_feedback = k.refRent; rec.applied_tier_percent = k.appliedTier; rec.calculated_rent = k.calculatedRent;
    rec.overdue_penalty = k.penInfo.penalty; rec.yield_per_kwp = k.dailyYield;
    upsertLocal('Solar_Records', rec, 'record_id');
    return rec;
  });
  closeModal(); renderCurrentView();
  await pushToCloud({ action: 'batchUpsert', items: [{ table: 'Solar_Records', records: recs }] });
  toast(`✅ 已批次拆帳並寫入 ${recs.length} 筆對帳單`);
}

// ============================================================================
// 5. 保證金異動與雙保險／變更協議彈窗（變更屆滿日自動同步主檔）
// ============================================================================
function openBondTxModal(solarId, txId = '', presetType = 'DEPOSIT', presetAmt = '', presetReason = '') {
  const t = txId ? appData.tables.Solar_Bond_Ledger.find(x => x.tx_id === txId) : {};
  const tt = t.tx_type || presetType, absAmt = t.amount !== undefined && t.amount !== '' ? Math.abs(Number(t.amount)) : presetAmt;
  openModal(txId ? '✎ 編輯保證金異動' : '＋ 新增履約保證金異動', `
    <div class="form-grid">
      <div class="field"><label>異動日期 *</label><input id="bt-date" type="date" value="${esc(t.tx_date||todayStr())}" oninput="document.getElementById('bt-roc').textContent=toRocDate(this.value)"><div id="bt-roc" class="roc-hint">${toRocDate(t.tx_date||todayStr())}</div></div>
      <div class="field"><label>類型 *</label><select id="bt-type"><option value="DEPOSIT" ${tt==='DEPOSIT'?'selected':''}>繳納 (+)</option><option value="REFUND" ${tt==='REFUND'?'selected':''}>分期退還 (-)</option><option value="DEDUCT" ${tt==='DEDUCT'?'selected':''}>扣抵 (-)</option><option value="CARRY_OVER" ${tt==='CARRY_OVER'?'selected':''}>轉續約留存</option></select></div>
      <div class="field"><label>金額（填正數，退還扣抵自動轉負）*</label><input id="bt-amt" type="number" min="0" value="${esc(absAmt)}"></div>
      <div class="field"><label>公文字號</label><input id="bt-doc" value="${esc(t.doc_no||'')}"></div>
      <div class="field full"><label>事由 *</label><input id="bt-reason" value="${esc(t.reason||presetReason)}"></div>
      <div class="field full"><label>退還匯入銀行與帳號</label><input id="bt-bank" value="${esc(t.vendor_bank_account||'')}"></div>
      <div class="field full"><label>領據收據連結</label><input id="bt-url" type="url" value="${esc(t.receipt_url||'')}"></div>
    </div>
  `, `<button onclick="closeModal()">取消</button><button class="btn-primary" onclick="saveBondTx('${esc(solarId)}','${esc(txId)}')">儲存</button>`);
}

async function saveBondTx(solarId, txId) {
  const tt = document.getElementById('bt-type').value, raw = Math.abs(Number(document.getElementById('bt-amt').value) || 0);
  const reason = document.getElementById('bt-reason').value.trim();
  if (!raw || !reason) return toast('請填寫金額與事由');
  const rec = {
    tx_id: txId || nextId('Solar_Bond_Ledger', 'tx_id', 'BND', 4), solar_id: solarId,
    tx_date: document.getElementById('bt-date').value || todayStr(), tx_type: tt,
    amount: (tt === 'REFUND' || tt === 'DEDUCT') ? -raw : raw, reason,
    doc_no: document.getElementById('bt-doc').value.trim(), vendor_bank_account: document.getElementById('bt-bank').value.trim(),
    receipt_url: document.getElementById('bt-url').value.trim(), updated_at: nowStr(), is_deleted: false
  };
  upsertLocal('Solar_Bond_Ledger', rec, 'tx_id'); closeModal(); renderCurrentView();
  await pushToCloud({ action: 'upsert', table: 'Solar_Bond_Ledger', record: rec });
  toast('✅ 已更新保證金帳本');
}

async function deleteBondTx(id) {
  if (!confirm('確定刪除此筆保證金異動？')) return;
  appData.tables.Solar_Bond_Ledger = appData.tables.Solar_Bond_Ledger.filter(t => t.tx_id !== id);
  renderCurrentView();
  await pushToCloud({ action: 'softDelete', table: 'Solar_Bond_Ledger', id });
}

function openComplianceLogModal(solarId, logId = '', presetType = 'PUBLIC_LIABILITY_INS') {
  const c = appData.tables.Solar_Contracts.find(x => x.solar_id === solarId);
  const l = logId ? appData.tables.Solar_Compliance_Logs.find(x => x.log_id === logId) : {};
  const lt = l.log_type || presetType, j = parseJSON(l.compliance_json, {});

  openModal(logId ? '✎ 編輯保險／變更協議' : '＋ 登錄雙保險或變更協議書', `
    <div class="form-grid">
      <div class="field"><label>紀錄類別 *</label><select id="cl-type" onchange="syncComplianceModalFields()"><option value="PUBLIC_LIABILITY_INS" ${lt==='PUBLIC_LIABILITY_INS'?'selected':''}>🛡️ 公共意外責任險</option><option value="PROPERTY_INS" ${lt==='PROPERTY_INS'?'selected':''}>⛈️ 產物保險</option><option value="AMENDMENT" ${lt==='AMENDMENT'?'selected':''}>📜 契約變更協議書</option></select></div>
      <div class="field"><label>保單號碼／公證書字號 *</label><input id="cl-doc" value="${esc(l.doc_or_policy_no||'')}"></div>
      <div class="field"><label>起始／簽署日 *</label><input id="cl-eff" type="date" value="${esc(l.effective_date||todayStr())}"></div>
      <div class="field cl-ins-only"><label>續保到期日 *</label><input id="cl-exp" type="date" value="${esc(l.expiry_date||'')}"></div>
      <div class="field full cl-pub-only"><div class="rule-builder-box"><strong>公共意外險最低保額檢核（單位：萬元）</strong><div class="form-grid">
        <div class="field"><label>每人傷亡 (≥300萬)</label><input id="cl-p1" type="number" value="${j.per_person??300}"></div>
        <div class="field"><label>每事故傷亡 (≥1500萬)</label><input id="cl-p2" type="number" value="${j.per_accident_body??1500}"></div>
        <div class="field"><label>每事故財損 (≥200萬)</label><input id="cl-p3" type="number" value="${j.per_accident_prop??200}"></div>
        <div class="field"><label>總保額 (≥4800萬)</label><input id="cl-p4" type="number" value="${j.aggregate??4800}"></div>
      </div></div></div>
      <div class="field full cl-prop-only"><div class="rule-builder-box"><strong>產物保險必要險種確認</strong><div class="check-group">
        <label><input type="checkbox" id="cl-typhoon" ${j.typhoon!==false?'checked':''}> 颱風險</label>
        <label><input type="checkbox" id="cl-fire" ${j.fire!==false?'checked':''}> 火災險</label>
        <label><input type="checkbox" id="cl-quake" ${j.earthquake!==false?'checked':''}> 地震險</label>
      </div></div></div>
      <div class="field full cl-amend-only"><div class="rule-builder-box">
        <label style="font-weight:700;cursor:pointer"><input type="checkbox" id="cl-chg-end" ${j.change_end_date?'checked':''} onchange="document.getElementById('cl-newend-wrap').style.display=this.checked?'grid':'none'"> 📅 變更契約屆滿日（自動同步更新主檔屆滿日與優先續租日）</label>
        <div id="cl-newend-wrap" class="form-grid" style="display:${j.change_end_date?'grid':'none'}">
          <div class="field"><label>原屆滿日</label><input id="cl-oldend" type="date" value="${esc(j.old_end_date||c?.contract_end||'')}"></div>
          <div class="field"><label>新屆滿日 *</label><input id="cl-newend" type="date" value="${esc(j.new_end_date||'')}"></div>
        </div>
      </div></div>
      <div class="field full"><label>附件掃描連結</label><input id="cl-url" type="url" value="${esc(l.attachment_url||'')}"></div>
      <div class="field full"><label>條文摘要或備註</label><textarea id="cl-notes">${esc(l.notes||'')}</textarea></div>
    </div>
  `, `<button onclick="closeModal()">取消</button><button class="btn-primary" onclick="saveComplianceLog('${esc(solarId)}','${esc(logId)}')">儲存</button>`);
  syncComplianceModalFields();
}

function syncComplianceModalFields() {
  const t = document.getElementById('cl-type')?.value;
  document.querySelectorAll('.cl-ins-only').forEach(e => { e.style.display = t !== 'AMENDMENT' ? 'flex' : 'none'; });
  document.querySelectorAll('.cl-pub-only').forEach(e => { e.style.display = t === 'PUBLIC_LIABILITY_INS' ? 'flex' : 'none'; });
  document.querySelectorAll('.cl-prop-only').forEach(e => { e.style.display = t === 'PROPERTY_INS' ? 'flex' : 'none'; });
  document.querySelectorAll('.cl-amend-only').forEach(e => { e.style.display = t === 'AMENDMENT' ? 'flex' : 'none'; });
}

async function saveComplianceLog(solarId, logId) {
  const lt = document.getElementById('cl-type').value, doc = document.getElementById('cl-doc').value.trim();
  if (!doc) return toast('請填寫保單號碼或公證書字號');
  const c = appData.tables.Solar_Contracts.find(x => x.solar_id === solarId);
  let comp = {}; const items = [];

  if (lt === 'PUBLIC_LIABILITY_INS') {
    comp = { per_person: Number(document.getElementById('cl-p1').value)||0, per_accident_body: Number(document.getElementById('cl-p2').value)||0, per_accident_prop: Number(document.getElementById('cl-p3').value)||0, aggregate: Number(document.getElementById('cl-p4').value)||0 };
  } else if (lt === 'PROPERTY_INS') {
    comp = { typhoon: document.getElementById('cl-typhoon').checked, fire: document.getElementById('cl-fire').checked, earthquake: document.getElementById('cl-quake').checked };
  } else if (document.getElementById('cl-chg-end').checked && document.getElementById('cl-newend').value && c) {
    const newEnd = document.getElementById('cl-newend').value, newRenew = subMonthsYmd(newEnd, 3);
    comp = { change_end_date: true, old_end_date: document.getElementById('cl-oldend').value, new_end_date: newEnd, new_renewal_deadline: newRenew };
    c.contract_end = newEnd; c.renewal_deadline = newRenew; c.notary_no = doc; c.updated_at = nowStr();
    upsertLocal('Solar_Contracts', c, 'solar_id');
    items.push({ table: 'Solar_Contracts', records: [c] });
  }

  const rec = {
    log_id: logId || nextId('Solar_Compliance_Logs', 'log_id', 'CMP', 4), solar_id: solarId, log_type: lt,
    doc_or_policy_no: doc, effective_date: document.getElementById('cl-eff').value,
    expiry_date: lt === 'AMENDMENT' ? '' : document.getElementById('cl-exp').value,
    compliance_json: JSON.stringify(comp), attachment_url: document.getElementById('cl-url').value.trim(),
    notes: document.getElementById('cl-notes').value.trim(), updated_at: nowStr(), is_deleted: false
  };
  upsertLocal('Solar_Compliance_Logs', rec, 'log_id');
  items.push({ table: 'Solar_Compliance_Logs', records: [rec] });
  closeModal(); renderCurrentView();
  await pushToCloud({ action: 'batchUpsert', items });
  toast(comp.change_end_date ? `✅ 已同步更新契約屆滿日至 ${comp.new_end_date}` : '✅ 已儲存保險／變更歷程');
}

async function deleteComplianceLog(id) {
  if (!confirm('確定刪除此筆紀錄？')) return;
  appData.tables.Solar_Compliance_Logs = appData.tables.Solar_Compliance_Logs.filter(l => l.log_id !== id);
  renderCurrentView();
  await pushToCloud({ action: 'softDelete', table: 'Solar_Compliance_Logs', id });
}

// ============================================================================
// 6. 單契約 PDF、D4 一期真實 Seed Data 與核心驗算單元測試
// ============================================================================
function printSingleSolarContractPDF(solarId) {
  const c = appData.tables.Solar_Contracts.find(x => x.solar_id === solarId); if (!c) return;
  const bond = getContractBondSummary(solarId, c), cmp = getContractComplianceSummary(solarId, c);
  const recs = appData.tables.Solar_Records.filter(r => r.solar_id === solarId);

  document.getElementById('print-area').innerHTML = `
    <div class="print-header">
      <div><div style="font-size:12px;color:#475569">${esc(appData.schoolName)} ｜ 太陽能屋頂標租履約總表</div><h2 style="margin:2px 0 0;font-size:17px">${esc(c.building_name)} ${c.phase_label?'（'+esc(c.phase_label)+'）':''}</h2></div>
      <div style="text-align:right;font-size:11px;color:#475569"><div>電號 ${esc(c.taipower_meter_no||'-')} ｜ ${c.capacity_kwp} kWp (${c.allocation_ratio||100}%)</div><div>列印：${fmtDateWithRoc(todayStr())}</div></div>
    </div>
    <div class="print-meta">
      <div><strong>廠商：</strong>${esc(c.vendor_name||c.lessee_vendor||'-')} (${esc(c.vendor_tax_id||'-')})</div>
      <div><strong>連帶保證人：</strong>${esc(c.guarantor_name||'無')}</div>
      <div><strong>基準年租金：</strong>${fmtMoney(c.base_annual_rent)}</div>
      <div><strong>保證金餘額：</strong>${fmtMoney(bond.balance)}</div>
      <div><strong>契約起迄：</strong>${esc(c.contract_start)}~${esc(c.contract_end)}</div>
      <div><strong>續租截止：</strong>${esc(c.renewal_deadline||'-')}</div>
      <div><strong>意外險：</strong>${cmp.pub.exists?`${cmp.pub.expiry}(${cmp.pub.compliant?'合規':'不足'})`:'未登錄'}</div>
      <div><strong>產險：</strong>${cmp.prop.exists?`${cmp.prop.expiry}(${cmp.prop.compliant?'齊備':'缺項'})`:'未登錄'}</div>
    </div>
    <table class="print-table" style="margin-bottom:8px">
      <thead><tr><th>期數</th><th>計費區間</th><th>本約度數</th><th>含稅總收入</th><th>參考年租金</th><th>級距／條款</th><th>應繳年租金</th><th>實繳／入帳日／批號</th></tr></thead>
      <tbody>${recs.map(r => { const k = calcSolarBillV2(r, c); return `<tr><td>${esc(r.period_label)}</td><td>${esc(r.period_start)}~${esc(r.period_end)}</td><td style="text-align:right">${k.totalKwh.toLocaleString('zh-TW')}</td><td style="text-align:right">${k.totalRev.toLocaleString('zh-TW')}</td><td style="text-align:right">${k.refRent.toLocaleString('zh-TW')} (${k.ratioPct}%)</td><td>${k.appliedTier}% ${esc(r.tier_clause_note||'')}</td><td style="text-align:right;font-weight:700">${k.calculatedRent.toLocaleString('zh-TW')}</td><td>${k.hasActual?k.actualPaid.toLocaleString('zh-TW'):'-'} / ${esc(r.payment_date||'-')} ${esc(r.remittance_batch_no||'')}</td></tr>`; }).join('')}</tbody>
    </table>
    <table class="print-table">
      <thead><tr><th>保證金異動日</th><th>類型</th><th>金額</th><th>事由</th><th>公文字號</th><th>匯入帳號</th></tr></thead>
      <tbody>${bond.txs.map(t => `<tr><td>${esc(t.tx_date)}</td><td>${esc(t.tx_type)}</td><td style="text-align:right">${Number(t.amount).toLocaleString('zh-TW')}</td><td>${esc(t.reason)}</td><td>${esc(t.doc_no||'-')}</td><td>${esc(t.vendor_bank_account||'-')}</td></tr>`).join('')}</tbody>
    </table>`;
  setTimeout(() => window.print(), 80);
}

async function seedD4Phase1Data() {
  ensureSolarV2Tables();
  const sid = 'SOL-D4P1';
  const contractRec = {
    solar_id: sid, building_name: 'D4教室暨D4風雨球場屋頂', phase_label: '一期', parent_contract_id: '', status: '併聯發電中',
    buildings_json: JSON.stringify([{ name: 'D4教室', land_lot: '', permit_no: '', area: 970.31, voltage: '' }, { name: 'D4風雨球場', land_lot: '', permit_no: '', area: 460.8, voltage: '' }]),
    lessee_vendor: '環球大宇宙太陽能工業有限公司／鄭玲玲／07-7338282',
    vendor_name: '環球大宇宙太陽能工業有限公司', vendor_tax_id: '28929872', vendor_contact: '鄭玲玲', vendor_phone: '07-7338282', vendor_email: 'sun.s8282@msa.hinet.net', vendor_address: '',
    guarantor_name: '鉅光科技工業有限公司', guarantor_tax_id: '22073218', guarantor_rep: '吳家慶', guarantor_phone: '0980-889269',
    taipower_meter_no: '18-40-6486-03-1', taipower_contract_no: '18-PV-105-0128', shared_total_kwp: 325.91, capacity_kwp: 190.12, allocation_ratio: 58,
    sales_mode: 'MIXED_WHEELING', billing_mode: 'TIERED_BASE_RENT', fit_rate: 4.8061, feedback_rate: 0.15, base_annual_rent: 175095, min_annual_feedback: 0,
    billing_cycle: '年結', annual_due_month_day: '10-27', meter_cutoff_note: '抄表結算至 2026/03/31（原誤植屆滿日 2025/03/26 已更正）',
    contract_start: '2016-04-27', contract_end: '2026-03-26', term_months: 119, renewal_deadline: '2025-12-26', notary_no: '114年度雄院民公吉字第1871號',
    drive_folder_url: '', bond_method: '現金', deposit_amount: 350190, deposit_expiry: '', insurance_expiry: '', updated_at: nowStr(), is_deleted: false
  };
  const billRec = {
    record_id: 'SR-D4P1-10', solar_id: sid, period_label: '第10期', period_start: '2025-09-01', period_end: '2026-03-31', period_months: 7,
    monthly_details_json: JSON.stringify([
      { source: 'WHEELING', label: '阿波羅電力7個月一期拆帳(58%)', unit_price: 5.27, line_loss: '', alloc_kwh: 121365, alloc_amount: 671566 },
      { source: 'TAIPOWER', label: '114年12月台電餘電一期', unit_price: '', line_loss: '', alloc_kwh: 6324, alloc_amount: 31913 }
    ]),
    generation_kwh: 127689, taipower_revenue: 703479, expected_feedback: 105522, applied_tier_percent: 70, tier_clause_note: '契約第5條第2項第13款',
    calculated_rent: 122567, overdue_penalty: 0, actual_feedback: 122567, payment_date: '2026-09-29', remittance_batch_no: '260929596113',
    due_date: '2026-10-27', yield_per_kwp: 3.17, drive_file_url: '', maintenance_log: '第10期結算（阿波羅轉供＋台電餘電）', updated_at: nowStr(), is_deleted: false
  };
  const bondTxs = [
    { tx_id: 'BND-D4P1-01', solar_id: sid, tx_date: '2016-04-27', tx_type: 'DEPOSIT', amount: 350190, reason: '原始履約保證金繳納（2年基準年租金）', doc_no: '18-PV-105-0128', vendor_bank_account: '', receipt_url: '', updated_at: nowStr(), is_deleted: false },
    { tx_id: 'BND-D4P1-02', solar_id: sid, tx_date: '2026-09-29', tx_type: 'REFUND', amount: -43774, reason: '滿119個月申請退還 1/8 履約保證金', doc_no: '(114)環字第1150929002號', vendor_bank_account: '彰化銀行鳳山分行 6520-01-892696-00', receipt_url: '', updated_at: nowStr(), is_deleted: false }
  ];
  const amendLog = {
    log_id: 'CMP-D4P1-01', solar_id: sid, log_type: 'AMENDMENT', doc_or_policy_no: '114年度雄院民公吉字第1871號',
    effective_date: '2025-12-23', expiry_date: '',
    compliance_json: JSON.stringify({ change_end_date: true, old_end_date: '2025-03-26', new_end_date: '2026-03-26', new_renewal_deadline: '2025-12-26' }),
    attachment_url: '', notes: '更正原誤植屆滿日 2025/03/26 → 2026/03/26（租期119個月，續租截止 2025/12/26）', updated_at: nowStr(), is_deleted: false
  };

  upsertLocal('Solar_Contracts', contractRec, 'solar_id');
  upsertLocal('Solar_Records', billRec, 'record_id');
  bondTxs.forEach(t => upsertLocal('Solar_Bond_Ledger', t, 'tx_id'));
  upsertLocal('Solar_Compliance_Logs', amendLog, 'log_id');
  solarV2SelectedId = sid; solarV2DetailTab = 'billing'; renderCurrentView();

  await pushToCloud({
    action: 'batchUpsert',
    items: [
      { table: 'Solar_Contracts', records: [contractRec] },
      { table: 'Solar_Records', records: [billRec] },
      { table: 'Solar_Bond_Ledger', records: bondTxs },
      { table: 'Solar_Compliance_Logs', records: [amendLog] }
    ]
  });
  toast('✅ 已載入 D4 教室暨風雨球場（一期）全部 4 表測試案例！');
}

function runSolarV2UnitTests() {
  const logs = []; let pass = 0, fail = 0;
  const ok = (cond, name, got) => { if (cond) { pass++; logs.push(`✅ [PASS] ${name}`); } else { fail++; logs.push(`❌ [FAIL] ${name} (got: ${got})`); } };
  const base = calcBaseAnnualRent(190.12, 4.8061, 0.15);
  ok(base === 175095, '基準經營年租金 = 175,095 元', base);
  const k = calcSolarBillV2(
    { period_start: '2025-09-01', period_end: '2026-03-31', period_months: 7, generation_kwh: 127689, taipower_revenue: 703479, applied_tier_percent: 70, actual_feedback: 122567, payment_date: '2026-09-29', due_date: '2026-10-27' },
    { capacity_kwp: 190.12, fit_rate: 4.8061, feedback_rate: 0.15, billing_mode: 'TIERED_BASE_RENT', base_annual_rent: 175095 }
  );
  ok(k.refRent === 105522 && k.ratioPct === 60.27, '第10期參考年租金 105,522 元 (60.27%)', `${k.refRent}/${k.ratioPct}`);
  ok(k.suggestedTier === 65 && k.calculatedRent === 122567, '5%級距建議 65% ｜ 手動70% 應繳 122,567 元', `${k.suggestedTier}/${k.calculatedRent}`);
  ok(k.proratedBase === 102139, '7個月折算基準年租金 = 102,139 元', k.proratedBase);
  ok(suggestTierPercentV2(96000, 100000) === 100 && suggestTierPercentV2(105100, 100000) === 110, '5%級距臨界區間正確');
  ok(subMonthsYmd('2026-03-26', 3) === '2025-12-26', '變更屆滿日 2026-03-26 推算續租截止 2025-12-26');
  const p = [0, '2026-11-10', '2026-11-27', '2026-12-27', '2027-01-27', '2027-02-27'].map(d => d ? calcOverduePenaltyV2(100000, '2026-10-27', d) : calcOverduePenaltyV2(100000, '2026-10-27', '2026-10-27'));
  ok(p[0].ratePct===0 && p[1].ratePct===2 && p[2].ratePct===4 && p[3].ratePct===8 && p[4].ratePct===10 && !p[4].canTerminate && p[5].canTerminate, '逾期違約金 0→2→4→8→10% 及滿4月得終止警示');
  ok(350190 - roundMoney(350190 / 8) === 306416, '保證金 350,190 退還 1/8 (-43,774) = 餘額 306,416 元');
  ok(['15%', '15％', 15, 0.15, '0.15'].every(v => normFeedbackRate(v) === 0.15) && normFeedbackRate(1) === 0.01 && normFeedbackRate('1%') === 0.01,
    '回饋率正規化等價性（15% / 15 / 0.15 / "0.15" / 1% / 1）');

  openModal('🧪 太陽能 V2 核心計算引擎驗算報告', `
    <div class="gate-banner ${fail===0?'green':'red'}" style="margin-bottom:10px"><strong>Verification Stamp：</strong><code>${fail===0?'verified: [solar-v2-math, overdue-penalty, bond-ledger, amendment-sync]':'FAILED'}</code><br>通過 ${pass} 項 ／ 失敗 ${fail} 項</div>
    <div class="verify-log">${esc(logs.join('\n'))}</div>
  `, `<button class="btn-primary" onclick="closeModal()">關閉</button>`);
}

// ============================================================================
// 7. 整合至 Chrome 起始頁摘要條 ＋ 全域預警雷達
// ============================================================================
const _prevRenderOpsDashStrip = renderOpsDashStripHTML;
renderOpsDashStripHTML = function() {
  ensureSolarV2Tables();
  const baseHtml = _prevRenderOpsDashStrip();
  const curRocY = new Date().getFullYear() - 1911;
  const contracts = appData.tables.Solar_Contracts;
  const active = contracts.filter(c => !['已屆滿', '已期滿', '已解約'].includes(c.status));
  const totalKwp = active.reduce((s, c) => s + (Number(c.capacity_kwp) || 0), 0);
  const bondBal = contracts.reduce((s, c) => s + getContractBondSummary(c.solar_id, c).balance, 0);
  const sAlerts = buildSolarV2Alerts(), redCnt = sAlerts.filter(a => a.level === 'red').length;
  const cls = redCnt > 0 ? 'warn-red' : (sAlerts.length > 0 ? 'warn-amber' : 'warn-ok');
  let yrActual = 0;
  appData.tables.Solar_Records.forEach(r => { if (getRecordRocYear(r) === curRocY && r.actual_feedback !== '') yrActual += Number(r.actual_feedback) || 0; });

  const card = `<div class="ops-mini-card ${cls}" onclick="solarV2SelectedId=null;switchTab('solar')">
    <div>
      <div style="font-size:12px;color:var(--muted);font-weight:700">☀️ 太陽能（${active.length} 約）</div>
      <div style="font-weight:800;font-size:15px;margin-top:2px">實收 ${fmtMoney(yrActual)} <small style="font-weight:500;color:var(--muted)">｜保金 ${fmtMoney(bondBal)}</small></div>
      <div class="item-meta">${sAlerts.length ? `🚨 ${redCnt} 紅燈 ／ ${sAlerts.length - redCnt} 黃燈（保險／續租／催繳）` : '✓ 雙保險、保證函與對帳全數合規'}</div>
    </div>
    <span class="tag ${cls==='warn-red'?'tag-red':cls==='warn-amber'?'tag-amber':'tag-green'}">查看 →</span>
  </div>`;
  return baseHtml.replace(new RegExp('<div class="ops-mini-card[\\s\\S]*?進入面板 →</span>\\s*</div>'), card);
};

const _prevBuildAllAlertsSolarV2 = buildAllAlerts;
buildAllAlerts = function() {
  const base = _prevBuildAllAlertsSolarV2().filter(a => !['太陽能保險續保', '太陽能履約保證函', '太陽能對帳'].includes(a.badge));
  const merged = base.concat(buildSolarV2Alerts());
  const rk = { red: 0, amber: 1, blue: 2 };
  return merged.sort((a, b) => (rk[a.level] - rk[b.level]) || (a.sortKey - b.sortKey));
};

ensureSolarV2Tables();
renderCurrentView();
