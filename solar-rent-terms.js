/**
 * ============================================================================
 * 學校總務行政助理 — 太陽能年租金繳納條件模組 (solar-rent-terms.js)
 * 必須於 solar-v2.js 之後載入。
 *
 * 依租賃契約第四～六條，於每份太陽能契約記錄：
 *   1. 經營年租金計算方式（容量 × 每 kWp 每日度數 × 天數 × 躉購費率 × 回饋百分比）
 *   2. 各期繳納時程（期數、計租區間、繳納期限、金額；末期不足一年依月數折算）
 *   3. 繳納方式、處所、代收帳號，以及「繳納期限 N 天前送參考年租金明細表」流程
 * 並在契約詳情頁顯示繳納時程與各期入帳狀態，戰情室依「下一期」實際期限提醒。
 *
 * 資料存於 Solar_Contracts.rent_terms_json（單一 JSON 欄位），隨既有雲端同步。
 * ============================================================================
 */

(function initSolarRentTerms() {
  if (typeof buildSolarV2Alerts !== 'function') return;

  const DEFAULT_TERMS = {
    pay_methods: '現金、票據', pay_place: '', bank_name: '', bank_account_name: '', bank_account_no: '',
    notice_days: 30, source: '', notes: ''
  };

  // --------------------------------------------------------------------------
  // 2. 繳納時程產生器
  //    第 N 期計租區間 = 起租日 + (N-1) 年 ～ 起租日 + N 年 - 1 日（末期截至租期屆滿日）
  //    繳納期限 = 區間末日 + 1 個月 + 1 日；末期不足 12 個月依月數折算
  // --------------------------------------------------------------------------
  const addMonths = (ymd, n) => subMonthsYmd(ymd, -n);

  function monthsBetween(startYmd, endYmd) {
    const next = addDays(endYmd, 1);
    const [y1, m1, d1] = startYmd.split('-').map(Number), [y2, m2, d2] = next.split('-').map(Number);
    return Math.max(1, (y2 * 12 + m2) - (y1 * 12 + m1) - (d2 < d1 ? 1 : 0));
  }

  function generateRentSchedule(c) {
    const start = String(c.contract_start || '').slice(0, 10), end = String(c.contract_end || '').slice(0, 10);
    const base = Number(c.base_annual_rent) || calcBaseAnnualRent(c.capacity_kwp, c.fit_rate, c.feedback_rate);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start || !base) return [];
    const list = [];
    let ps = start, no = 1;
    while (ps <= end && no <= 40) {
      let pe = addDays(addMonths(ps, 12), -1), months = 12;
      if (pe >= end) { pe = end; months = Math.min(12, monthsBetween(ps, end)); }
      list.push({
        no, period_start: ps, period_end: pe, months,
        due_date: addDays(addMonths(pe, 1), 1),
        amount: months === 12 ? base : roundMoney((base * months) / 12)
      });
      ps = addDays(pe, 1); no++;
    }
    return list;
  }

  window.generateRentSchedule = generateRentSchedule;

  // ------------------------------------------------------------------
  // 儲存位置：
  //   主要 → Solar_Compliance_Logs 一列（log_type＝RENT_TERMS，內容存於既有的 compliance_json 欄）。
  //          此表欄位為雲端既有欄位，保證能寫入試算表並於同步時讀回。
  //   同步 → Solar_Contracts.rent_terms_json（若試算表有此欄亦一併保存）。
  //   讀取時兩處取較新（updated_at）者。
  // ------------------------------------------------------------------
  const RT_LOG_TYPE = 'RENT_TERMS';
  const rtLogId = solarId => `RT-${solarId}-TERMS`; // 結尾非數字，不影響保險紀錄 CMP-
  const validTerms = t => t && Array.isArray(t.schedule) && t.schedule.length ? t : null;

  function rentTermsLog(solarId) {
    return (appData.tables.Solar_Compliance_Logs || [])
      .filter(l => l.solar_id === solarId && l.log_type === RT_LOG_TYPE && !(l.is_deleted === true || String(l.is_deleted).toUpperCase() === 'TRUE'))
      .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))[0] || null;
  }

  function getRentTerms(c) {
    if (!c) return null;
    const fromCol = validTerms(parseJSON(c.rent_terms_json, null));
    const log = rentTermsLog(c.solar_id);
    const fromLog = log ? validTerms(parseJSON(log.compliance_json, null)) : null;
    if (fromCol && fromLog) return String(fromCol.updated_at || '') >= String(fromLog.updated_at || '') ? fromCol : fromLog;
    return fromCol || fromLog;
  }

  function buildRentTermsLog(solarId, terms) {
    const first = terms.schedule[0], last = terms.schedule[terms.schedule.length - 1];
    return {
      log_id: rtLogId(solarId), solar_id: solarId, log_type: RT_LOG_TYPE,
      doc_or_policy_no: terms.source || '年租金繳納條件',
      effective_date: first?.period_start || '', expiry_date: last?.due_date || '',
      compliance_json: JSON.stringify(terms), attachment_url: '',
      notes: '年租金繳納條件（系統自動儲存，請勿手動刪除）',
      updated_at: nowStr(), is_deleted: false
    };
  }

  // 保險合規摘要不納入繳納條件紀錄
  const _prevComplianceSummary = getContractComplianceSummary;
  getContractComplianceSummary = function(solarId, contract) {
    const r = _prevComplianceSummary(solarId, contract);
    r.logs = (r.logs || []).filter(l => l.log_type !== RT_LOG_TYPE);
    return r;
  };

  function contractRecords(c) {
    return (appData.tables.Solar_Records || []).filter(r => r.solar_id === c.solar_id);
  }

  function matchRecord(inst, recs) {
    return recs.find(r => r.due_date && String(r.due_date).slice(0, 10) === inst.due_date)
      || recs.find(r => String(r.period_label || '').trim() === `第${inst.no}期`)
      || null;
  }

  const isPaid = r => !!r && (!!r.payment_date || (r.actual_feedback !== '' && r.actual_feedback !== null && r.actual_feedback !== undefined));

  const isPriorSettled = (inst, t) => !!t && Number(t.prior_settled_through) >= inst.no;
  const instPaid = (inst, rec, t) => isPaid(rec) || isPriorSettled(inst, t);

  function installmentStatus(inst, rec, noticeDays, t) {
    const today = todayStr();
    const d = diffDays(today, inst.due_date);
    const stmtDl = addDays(inst.due_date, -(Number(noticeDays) || 30));
    if (!isPaid(rec) && isPriorSettled(inst, t)) return { key: 'paid', cls: 'tag-green', text: '已繳（建檔前）', d, stmtDl };
    if (isPaid(rec)) return { key: 'paid', cls: 'tag-green', text: `已入帳${rec.payment_date ? ' ' + rec.payment_date.slice(5).replace('-', '/') : ''}`, d, stmtDl };
    if (d < 0) {
      const pen = calcOverduePenaltyV2(inst.amount, inst.due_date, today);
      return { key: 'overdue', cls: 'tag-red', text: `逾期 ${Math.abs(d)} 天（違約金 ${pen.ratePct}%）`, d, stmtDl };
    }
    if (d <= 30) return { key: 'soon', cls: 'tag-amber', text: d === 0 ? '今天截止' : `剩 ${d} 天`, d, stmtDl };
    if (diffDays(today, stmtDl) <= 14) return { key: 'notice', cls: 'tag-amber', text: '待送明細表', d, stmtDl };
    return { key: 'future', cls: 'tag-gray', text: '未到期', d, stmtDl };
  }

  // --------------------------------------------------------------------------
  // 3. 契約詳情頁：年租金繳納條件區塊
  // --------------------------------------------------------------------------
  const rocShort = ymd => {
    if (!ymd) return '-';
    const [y, m, d] = ymd.split('-').map(Number);
    return `${y - 1911}/${m}/${d}`;
  };

  function renderRentTermsPanelHTML(c) {
    const t = getRentTerms(c);
    const sid = esc(c.solar_id);
    const GA = window.GA_CORE;

    if (!t) {
      return `
        <div class="panel" id="rent-terms-panel">
          <div class="panel-hd"><h3>💰 年租金繳納條件</h3></div>
          <div class="panel-bd">
            <div class="empty-state" style="padding:14px">
              尚未設定本契約的年租金繳納時程、方式與處所。
              <div style="margin-top:10px"><button class="btn-sm btn-primary" onclick="openRentTermsModal('${sid}')">＋ 依契約起迄產生繳納時程</button></div>
            </div>
          </div>
        </div>`;
    }

    const recs = contractRecords(c);
    const calc = t.calc || {};
    const total = t.schedule.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const rows = t.schedule.map(inst => {
      const rec = matchRecord(inst, recs);
      const st = installmentStatus(inst, rec, t.notice_days, t);
      const showRel = st.key !== 'paid' && st.key !== 'future';
      return `<tr>
        <td style="white-space:nowrap"><strong>第 ${inst.no} 期</strong>${inst.months < 12 ? `<div class="item-meta">${inst.months} 個月折算</div>` : ''}</td>
        <td style="white-space:nowrap" class="ga-roc">${inst.period_start ? `${rocShort(inst.period_start)} ～ ${rocShort(inst.period_end)}` : '-'}</td>
        <td style="white-space:nowrap" class="ga-roc"><strong>${rocShort(inst.due_date)}</strong>${showRel && GA ? `<div class="item-meta">${GA.relText(GA.daysLeft(inst.due_date))}</div>` : ''}</td>
        <td style="white-space:nowrap;text-align:right" class="ga-roc"><strong>${fmtMoney(inst.amount)}</strong></td>
        <td style="white-space:nowrap" class="ga-roc">${rocShort(st.stmtDl)} 前</td>
        <td style="white-space:nowrap"><span class="tag ${st.cls}">${esc(st.text)}</span></td>
      </tr>`;
    }).join('');

    return `
      <div class="panel" id="rent-terms-panel">
        <div class="panel-hd">
          <h3>💰 年租金繳納條件（${t.schedule.length} 期・合計 ${fmtMoney(total)}${t.min_guarantee ? '・保底' : ''}）</h3>
          <button class="btn-sm" onclick="openRentTermsModal('${sid}')">✎ 編輯繳納條件</button>
        </div>
        <div class="panel-bd">
          <div class="rt-info">
            <div>
              <strong>計算方式</strong>
              ${calc.kwp ? `<div class="item-meta">${calc.kwp} kWp × ${calc.kwh_per_kwp_day} 度／天 × ${calc.days} 天 × ${calc.fit_rate} 元／度 × ${calc.feedback_pct}% ＝ <strong>${fmtMoney(calc.result)}</strong>${calc.fit_label ? `（${esc(calc.fit_label)}）` : ''}</div>` : `<div class="item-meta">經營年租金 <strong>${fmtMoney(c.base_annual_rent)}</strong></div>`}
              <div class="item-meta">參考年租金＝售電收入 × 回饋%；相差達 5% 依級距調整${t.min_guarantee ? '，每期至少收取約定金額（保底）' : ''}</div>
            </div>
            <div>
              <strong>繳納方式與處所</strong>
              <div class="item-meta">${esc(t.pay_methods || '-')}${t.pay_place ? `｜${esc(t.pay_place)}` : ''}</div>
              ${(t.bank_name || t.bank_account_no) ? `<div class="item-meta">代收：${esc(t.bank_name || '')}｜${esc(t.bank_account_name || '')}｜${t.bank_account_no ? `<code>${esc(t.bank_account_no)}</code>` : '<strong style="color:var(--red)">帳號未填</strong>'}</div>` : ''}
            </div>
            <div>
              <strong>流程與逾期</strong>
              <div class="item-meta">廠商於期限 <strong>${Number(t.notice_days) || 30} 天前</strong>送參考年租金明細表 → 學校開繳款通知單 → 廠商繳納</div>
              <div class="item-meta">逾期違約金 2／4／8／10%；逾期滿 4 個月經催告得終止</div>
            </div>
          </div>
          ${t.notes ? `<div class="item-meta" style="margin:0 0 10px">📝 ${esc(t.notes)}</div>` : ''}
          <div style="overflow-x:auto">
            <table>
              <thead><tr><th>期數</th><th>計租區間</th><th>繳納期限</th><th style="text-align:right">經營年租金</th><th>明細表送達</th><th>狀態</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
          ${t.source ? `<div class="item-meta" style="margin-top:6px">依據：${esc(t.source)}。實際應繳金額以繳款通知單為準。</div>` : ''}
        </div>
      </div>`;
  }

  if (!document.getElementById('rent-terms-style')) {
    const st = document.createElement('style');
    st.id = 'rent-terms-style';
    st.textContent = `
      @layer modules {
        #rent-terms-panel .rt-info { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-bottom: 12px; }
        #rent-terms-panel .rt-info strong { font-size: 14px; }
        #rent-terms-panel .item-meta { font-size: 13px; }
        @media (max-width: 960px) { #rent-terms-panel .rt-info { grid-template-columns: 1fr; } }
      }`;
    document.head.appendChild(st);
  }

  // --------------------------------------------------------------------------
  // 4. 編輯視窗
  // --------------------------------------------------------------------------
  function previewTableHTML(schedule) {
    if (!schedule.length) return '<div class="empty-state">請先於契約主檔填妥起租日、屆滿日與經營年租金，才能產生繳納時程。</div>';
    return `<div style="max-height:260px;overflow:auto;border:1px solid var(--border);border-radius:8px">
      <table><thead><tr><th>期數</th><th>計租區間</th><th>繳納期限</th><th style="text-align:right">金額</th></tr></thead><tbody>
      ${schedule.map(i => `<tr><td>第 ${i.no} 期${i.months < 12 ? `（${i.months} 個月）` : ''}</td><td class="ga-roc">${rocShort(i.period_start)} ～ ${rocShort(i.period_end)}</td><td class="ga-roc"><strong>${rocShort(i.due_date)}</strong></td><td style="text-align:right" class="ga-roc">${fmtMoney(i.amount)}</td></tr>`).join('')}
      </tbody></table></div>`;
  }

  let rtDraft = null;

  window.openRentTermsModal = function(solarId) {
    const c = appData.tables.Solar_Contracts.find(x => x.solar_id === solarId);
    if (!c) return;
    const existing = getRentTerms(c);
    const schedule = existing ? existing.schedule : generateRentSchedule(c);
    const base = existing || DEFAULT_TERMS;
    const calc = existing?.calc || (c.capacity_kwp && c.fit_rate ? {
      kwp: Number(c.capacity_kwp), kwh_per_kwp_day: 3.5, days: 365, fit_rate: Number(c.fit_rate),
      fit_label: '', feedback_pct: Number((normFeedbackRate(c.feedback_rate) * 100).toFixed(2)),
      result: Number(c.base_annual_rent) || calcBaseAnnualRent(c.capacity_kwp, c.fit_rate, c.feedback_rate)
    } : null);
    const priorDue = schedule.filter(i => i.due_date < todayStr()).length;
    rtDraft = { solarId, schedule, calc };

    const v = k => esc(base[k] ?? DEFAULT_TERMS[k] ?? '');
    const priorChecked = existing ? Number(existing.prior_settled_through) > 0 : true;
    const minChecked = existing ? !!existing.min_guarantee : Number(c.min_annual_feedback) > 0;
    openModal('💰 年租金繳納條件', `
      <div class="form-grid">
        <div class="field"><label>繳納方式</label><input id="rt-methods" type="text" value="${v('pay_methods')}"></div>
        <div class="field"><label>明細表須於期限前幾天送達</label><input id="rt-notice" type="number" min="0" value="${v('notice_days')}"></div>
        <div class="field full"><label>繳納處所</label><input id="rt-place" type="text" value="${v('pay_place')}"></div>
        <div class="field"><label>代收金融機構</label><input id="rt-bank" type="text" value="${v('bank_name')}"></div>
        <div class="field"><label>戶名</label><input id="rt-accname" type="text" value="${v('bank_account_name')}"></div>
        <div class="field"><label>帳號</label><input id="rt-accno" type="text" value="${v('bank_account_no')}" placeholder="依契約書填入"></div>
        <div class="field"><label>依據</label><input id="rt-source" type="text" value="${v('source')}" placeholder="例：租賃契約第四～六條"></div>
        <div class="field full"><label>備註</label><textarea id="rt-notes" rows="2">${v('notes')}</textarea></div>
      </div>
      <label style="display:flex;gap:8px;align-items:flex-start;margin-top:8px;font-size:14px;cursor:pointer"><input type="checkbox" id="rt-min" ${minChecked ? 'checked' : ''} style="margin-top:3px"><span>每期至少收取約定金額（保底）：級距結果低於該期金額時，以該期金額計收</span></label>
      <div style="font-weight:700;margin:10px 0 6px">📅 繳納時程（${schedule.length} 期）${existing ? '：沿用已儲存時程' : '：依契約起迄自動產生'}</div>
      ${previewTableHTML(schedule)}
      ${priorDue > 0 ? `<label style="display:flex;gap:8px;align-items:flex-start;margin-top:8px;font-size:14px;cursor:pointer"><input type="checkbox" id="rt-prior" ${priorChecked ? 'checked' : ''} style="margin-top:3px"><span>已到期的前 <strong>${priorDue}</strong> 期（${rocShort(schedule[0].due_date)}～${rocShort(schedule[priorDue - 1].due_date)}）已繳清，不列入逾期提醒</span></label>` : ''}
      ${existing ? `<button class="btn-xs" style="margin-top:6px" onclick="regenRentSchedule('${esc(solarId)}')">↺ 依目前契約起迄重新產生時程</button>` : ''}
    `, `<button onclick="closeModal()">取消</button><button class="btn-primary" ${schedule.length ? '' : 'disabled'} onclick="saveRentTerms()">💾 儲存繳納條件</button>`);
  };

  window.regenRentSchedule = function(solarId) {
    const c = appData.tables.Solar_Contracts.find(x => x.solar_id === solarId);
    if (!c || !rtDraft) return;
    const t = getRentTerms(c);
    c.rent_terms_json = JSON.stringify({ ...(t || {}), schedule: generateRentSchedule(c), updated_at: nowStr() });
    window.openRentTermsModal(solarId);
  };

  window.saveRentTerms = async function() {
    if (!rtDraft || !rtDraft.schedule.length) return;
    const c = appData.tables.Solar_Contracts.find(x => x.solar_id === rtDraft.solarId);
    if (!c) return;
    const val = id => (document.getElementById(id)?.value || '').trim();
    const priorEl = document.getElementById('rt-prior');
    const priorDue = rtDraft.schedule.filter(i => i.due_date < todayStr()).length;
    const terms = {
      version: 1,
      calc: rtDraft.calc,
      schedule: rtDraft.schedule,
      pay_methods: val('rt-methods'), pay_place: val('rt-place'),
      bank_name: val('rt-bank'), bank_account_name: val('rt-accname'), bank_account_no: val('rt-accno'),
      notice_days: Number(val('rt-notice')) || 30,
      source: val('rt-source'), notes: val('rt-notes'),
      min_guarantee: !!document.getElementById('rt-min')?.checked,
      prior_settled_through: priorEl && priorEl.checked ? priorDue : 0,
      updated_at: nowStr()
    };
    const first = rtDraft.schedule[0];
    const rec = {
      ...c,
      annual_due_month_day: first ? first.due_date.slice(5) : (c.annual_due_month_day || ''),
      rent_terms_json: JSON.stringify(terms),
      updated_at: nowStr()
    };
    upsertLocal('Solar_Contracts', rec, 'solar_id');
    const logRec = buildRentTermsLog(rec.solar_id, terms);
    upsertLocal('Solar_Compliance_Logs', logRec, 'log_id');
    closeModal();
    renderCurrentView();
    await pushToCloud({ action: 'batchUpsert', items: [
      { table: 'Solar_Contracts', records: [rec] },
      { table: 'Solar_Compliance_Logs', records: [logRec] }
    ] });
    toast(`✅ 已更新年租金繳納條件（${terms.schedule.length} 期）`);
  };

  // --------------------------------------------------------------------------
  // 5. 掛載：詳情頁、對帳期限推算、戰情室提醒
  // --------------------------------------------------------------------------
  // 保底（第三條第四款）：級距結果低於該期約定金額時，以約定金額計收
  const _prevCalcBill = calcSolarBillV2;
  calcSolarBillV2 = function(rec, contract) {
    const k = _prevCalcBill(rec, contract);
    const t = getRentTerms(contract);
    if (!t || !t.min_guarantee || k.mode !== 'TIERED_BASE_RENT') return k;
    const inst = t.schedule.find(i => i.due_date === k.dueDate)
      || t.schedule.find(i => String(rec.period_label || '').trim() === `第${i.no}期`);
    const floor = inst ? Number(inst.amount) : (Number(contract.min_annual_feedback) || k.baseRent);
    if (!floor || k.calculatedRent >= floor) return { ...k, floorAmount: floor, floorApplied: false };
    const calculatedRent = floor;
    const unpaid = k.hasActual ? (k.actualPaid < calculatedRent ? calculatedRent - k.actualPaid : 0) : calculatedRent;
    const paidOnTime = k.hasActual && rec.payment_date && k.dueDate && diffDays(k.dueDate, rec.payment_date) <= 0 && unpaid === 0;
    const penInfo = k.dueDate ? calcOverduePenaltyV2(paidOnTime ? 0 : unpaid, k.dueDate, rec.payment_date || todayStr()) : k.penInfo;
    return {
      ...k, calculatedRent, appliedTier: Math.max(k.appliedTier, 100), floorAmount: floor, floorApplied: true,
      diffAmt: k.hasActual ? (k.actualPaid - calculatedRent) : 0, penInfo
    };
  };

  const _prevBillingTab = renderSolarDetailBillingTabHTML;
  renderSolarDetailBillingTabHTML = function(c, recs) {
    return renderRentTermsPanelHTML(c) + _prevBillingTab(c, recs);
  };

  // 對帳單未填期限時，依繳納時程找出對應期別的期限（末期 3/27 等非固定月日亦正確）
  const _prevInferDue = inferRecordDueDate;
  inferRecordDueDate = function(rec, c) {
    const t = getRentTerms(c);
    if (t && rec && rec.period_end) {
      const pe = String(rec.period_end).slice(0, 10);
      const inst = t.schedule.find(i => i.period_start && pe >= addDays(i.period_start, -31) && pe <= i.due_date);
      if (inst) return inst.due_date;
    }
    return _prevInferDue(rec, c);
  };

  const _prevSolarAlerts = buildSolarV2Alerts;
  buildSolarV2Alerts = function() {
    let alerts = _prevSolarAlerts();
    const today = todayStr();
    (appData.tables.Solar_Contracts || [])
      .filter(c => !['已屆滿', '已期滿', '已解約'].includes(c.status))
      .forEach(c => {
        const t = getRentTerms(c);
        if (!t) return;
        const title = solarContractTitle(c);
        // 以實際繳納時程取代「固定月日」推算的催繳提醒
        alerts = alerts.filter(a => !(a.badge === '太陽能催繳' && a.title === title));
        const recs = contractRecords(c);
        const next = t.schedule.find(i => !instPaid(i, matchRecord(i, recs), t));
        if (!next) return;
        const rec = matchRecord(next, recs);
        const st = installmentStatus(next, rec, t.notice_days, t);
        const go = () => openSolarContractFromAlert(c.solar_id, 'billing');
        const amt = fmtMoney(next.amount);
        if (st.key === 'overdue' && !rec) {
          alerts.push({ level: 'red', badge: '太陽能催繳', title, sortKey: st.d, action: go,
            detail: `繳納期限 ${next.due_date}（第 ${next.no} 期 ${amt}）已逾期 ${Math.abs(st.d)} 天未入帳，請開立逾期違約金繳款單` });
        } else if (st.key === 'soon' || st.key === 'notice') {
          const stmtPast = diffDays(today, st.stmtDl) < 0;
          alerts.push({ level: 'amber', badge: '太陽能催繳', title, sortKey: st.d, action: go,
            detail: rec
              ? `繳納期限 ${next.due_date}（第 ${next.no} 期）待入帳，請確認廠商依繳款通知單繳納`
              : stmtPast
                ? `繳納期限 ${next.due_date}（第 ${next.no} 期 ${amt}）；參考年租金明細表送達期限 ${st.stmtDl} 已過，請催廠商送件並開立繳款通知單`
                : `繳納期限 ${next.due_date}（第 ${next.no} 期 ${amt}）；廠商應於 ${st.stmtDl} 前送參考年租金明細表` });
        }
      });
    return alerts;
  };

  // --------------------------------------------------------------------------
  // 6. 自我驗證（使用虛構契約數據，不含任何實際契約內容）
  // --------------------------------------------------------------------------
  window.runSolarRentTermsTests = function() {
    const results = [];
    const ok = (cond, name, got) => results.push({ pass: !!cond, name, got });
    const c = { contract_start: '2030-01-10', contract_end: '2039-12-09', base_annual_rent: 120000, capacity_kwp: 100 };
    const gen = generateRentSchedule(c);
    ok(gen.length === 10, '119 個月契約產生 10 期', gen.length);
    ok(gen.slice(0, 9).every(g => g.amount === 120000 && g.months === 12), '前 9 期各 12 個月、全額 120,000', gen.map(g => g.amount).join(','));
    ok(gen[9].months === 11 && gen[9].period_end === '2039-12-09', '末期 11 個月、截至契約屆滿日', `${gen[9].months}/${gen[9].period_end}`);
    ok(gen[9].amount === roundMoney(120000 * 11 / 12), '末期依月數折算 110,000', gen[9].amount);
    ok(gen.every((g, i) => i === 0 || g.due_date > gen[i - 1].due_date), '繳納期限逐期遞增', gen.map(g => g.due_date).join(','));
    ok(gen.every(g => g.due_date > g.period_start), '繳納期限晚於計租起日', '');
    ok(calcBaseAnnualRent(100, 5, 0.1) === roundMoney(100 * 3.5 * 365 * 5 * 0.1), '100 × 3.5 × 365 × 5 × 10% = 63,875', calcBaseAnnualRent(100, 5, 0.1));
    const tc = { ...c, solar_id: '_T1', billing_mode: 'TIERED_BASE_RENT', feedback_rate: 0.1, fit_rate: 5,
      rent_terms_json: JSON.stringify({ min_guarantee: true, schedule: gen }) };
    const g4 = gen[3];
    const bill = rev => calcSolarBillV2({ period_label: '第4期', period_start: g4.period_start, period_end: g4.period_end, period_months: 12, taipower_revenue: rev, due_date: g4.due_date, applied_tier_percent: '' }, tc);
    const low = bill(500000), high = bill(1440000);
    ok(low.calculatedRent === 120000 && low.floorApplied, '保底：參考年租金偏低時仍收該期金額', low.calculatedRent);
    ok(high.calculatedRent > 120000 && !high.floorApplied, '參考年租金高於經營年租金時依級距加收', `${high.suggestedTier}/${high.calculatedRent}`);
    const id = rtLogId('SOL-X');
    ok(id === 'RT-SOL-X-TERMS', '條款紀錄編號不影響 CMP 流水號', id);
    return results;
  };

  if (window.GA_REGISTRY && typeof window.GA_REGISTRY.registerModule === 'function') {
    window.GA_REGISTRY.registerModule('solar-rent-terms.js', 'v1.0', '太陽能年租金繳納時程、方式、處所與明細表期限');
  }
})();
