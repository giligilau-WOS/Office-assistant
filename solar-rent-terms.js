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

  // --------------------------------------------------------------------------
  // 1. 溪埔國中 D4 一期第 1 次續約契約書（114.09.19 版）條款
  // --------------------------------------------------------------------------
  const XIPU_RENEWAL_PRESET = {
    match: c => String(c.contract_start || '').slice(0, 10) === '2026-03-27' && Math.abs((Number(c.capacity_kwp) || 0) - 190.12) < 0.005,
    label: '續約契約書（114.09.19 版）',
    contractFields: {
      billing_mode: 'TIERED_BASE_RENT', billing_cycle: '年結', annual_due_month_day: '04-27',
      fit_rate: 4.8061, feedback_rate: 0.15, base_annual_rent: 175095
    },
    // 契約第五條第一款所列各期（第 5 期契約書誤植為民國 112 年，依連續年度以 120 年列管）
    schedule: [
      ['2027-04-27', 175095], ['2028-04-27', 175095], ['2029-04-27', 175095], ['2030-04-27', 175095],
      ['2031-04-27', 175095], ['2032-04-27', 175095], ['2033-04-27', 175095], ['2034-04-27', 175095],
      ['2035-04-27', 175095], ['2036-03-27', 160504]
    ],
    terms: {
      calc: { kwp: 190.12, kwh_per_kwp_day: 3.5, days: 365, fit_rate: 4.8061, fit_label: '105年躉購費率', feedback_pct: 15, result: 175095 },
      pay_methods: '現金、票據',
      pay_place: '溪埔國民中學總務處出納組（84048 高雄市大樹區溪埔路1號）；或至各銀行、郵局、農漁會等金融機構繳納',
      bank_name: '合作金庫 大樹分行',
      bank_account_name: '高雄市立溪埔國民中學',
      // 帳號不寫入程式碼（公開程式碼庫）：帶入時請依契約書第五條第四款於視窗中輸入，僅存於雲端試算表
      bank_account_no: '',
      notice_days: 30,
      source: '續約契約書（114.09.19 版）第四～六條',
      notes: '契約書第五條第 5 期誤植為「民國112年4月27日」，依連續年度應為民國120年4月27日，系統以 120 年列管；建議請廠商確認並於公證時更正。'
    }
  };

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

  function presetSchedule(c, preset) {
    const gen = generateRentSchedule(c);
    return preset.schedule.map(([due, amount], i) => ({
      no: i + 1,
      period_start: gen[i]?.period_start || '', period_end: gen[i]?.period_end || '',
      months: gen[i]?.months || 12, due_date: due, amount
    }));
  }

  window.generateRentSchedule = generateRentSchedule;

  function getRentTerms(c) {
    const t = parseJSON(c?.rent_terms_json, null);
    return t && Array.isArray(t.schedule) && t.schedule.length ? t : null;
  }

  function contractRecords(c) {
    return (appData.tables.Solar_Records || []).filter(r => r.solar_id === c.solar_id);
  }

  function matchRecord(inst, recs) {
    return recs.find(r => r.due_date && String(r.due_date).slice(0, 10) === inst.due_date)
      || recs.find(r => String(r.period_label || '').trim() === `第${inst.no}期`)
      || null;
  }

  const isPaid = r => !!r && (!!r.payment_date || (r.actual_feedback !== '' && r.actual_feedback !== null && r.actual_feedback !== undefined));

  function installmentStatus(inst, rec, noticeDays) {
    const today = todayStr();
    const d = diffDays(today, inst.due_date);
    const stmtDl = addDays(inst.due_date, -(Number(noticeDays) || 30));
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
    const preset = XIPU_RENEWAL_PRESET.match(c) ? XIPU_RENEWAL_PRESET : null;
    const sid = esc(c.solar_id);

    if (!t) {
      return `
        <div class="panel" id="rent-terms-panel">
          <div class="panel-hd"><h3>💰 年租金繳納條件（契約第四～六條）</h3></div>
          <div class="panel-bd">
            <div class="empty-state" style="padding:14px">
              尚未設定本契約的年租金繳納時程、方式與處所。
              <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:10px">
                ${preset ? `<button class="btn-sm btn-primary" onclick="openRentTermsModal('${sid}', true)">📄 帶入${esc(preset.label)}條款</button>` : ''}
                <button class="btn-sm ${preset ? '' : 'btn-primary'}" onclick="openRentTermsModal('${sid}', false)">＋ 依契約起迄自動產生</button>
              </div>
            </div>
          </div>
        </div>`;
    }

    const recs = contractRecords(c);
    const calc = t.calc || {};
    const total = t.schedule.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const rows = t.schedule.map(inst => {
      const rec = matchRecord(inst, recs);
      const st = installmentStatus(inst, rec, t.notice_days);
      return `<tr>
        <td style="white-space:nowrap"><strong>第 ${inst.no} 期</strong>${inst.months < 12 ? `<div class="item-meta">${inst.months} 個月折算</div>` : ''}</td>
        <td style="white-space:nowrap">${inst.period_start ? `${rocShort(inst.period_start)} ～ ${rocShort(inst.period_end)}` : '-'}</td>
        <td style="white-space:nowrap"><strong>${rocShort(inst.due_date)} 前</strong><div class="item-meta">${esc(inst.due_date)}</div></td>
        <td style="white-space:nowrap;text-align:right"><strong>${fmtMoney(inst.amount)}</strong></td>
        <td style="white-space:nowrap">${rocShort(st.stmtDl)} 前</td>
        <td style="white-space:nowrap"><span class="tag ${st.cls}">${esc(st.text)}</span></td>
      </tr>`;
    }).join('');

    return `
      <div class="panel" id="rent-terms-panel">
        <div class="panel-hd">
          <h3>💰 年租金繳納條件（共 ${t.schedule.length} 期，合計 ${fmtMoney(total)}）</h3>
          <button class="btn-sm" onclick="openRentTermsModal('${sid}', false)">✎ 編輯繳納條件</button>
        </div>
        <div class="panel-bd">
          <div class="sol-info-grid" style="margin-top:0;margin-bottom:12px">
            <div>
              <strong>計算方式（第四條）</strong>
              ${calc.kwp ? `<div class="item-meta">${calc.kwp} kWp × ${calc.kwh_per_kwp_day} 度／天 × ${calc.days} 天 × ${calc.fit_rate} 元／度 × ${calc.feedback_pct}%</div>
              <div class="item-meta">＝ 經營年租金 <strong>${fmtMoney(calc.result)}</strong>${calc.fit_label ? `（${esc(calc.fit_label)}）` : ''}</div>` : `<div class="item-meta">經營年租金 <strong>${fmtMoney(c.base_annual_rent)}</strong></div>`}
              <div class="item-meta">參考年租金 = 售電收入 × 回饋百分比；兩者相差達 5% 以上依 5% 級距調整（逾 200% 須契約變更），尚未售電不適用</div>
            </div>
            <div>
              <strong>繳納方式與處所（第五條）</strong>
              <div class="item-meta">方式：${esc(t.pay_methods || '-')}</div>
              ${t.pay_place ? `<div class="item-meta">處所：${esc(t.pay_place)}</div>` : ''}
              ${(t.bank_name || t.bank_account_no) ? `<div class="item-meta">代收帳戶：${esc(t.bank_name || '')}｜戶名 ${esc(t.bank_account_name || '')}｜帳號 ${t.bank_account_no ? `<code>${esc(t.bank_account_no)}</code>` : '<strong style="color:var(--red)">未填（請按「編輯繳納條件」補上）</strong>'}</div>` : ''}
            </div>
            <div>
              <strong>繳納流程與逾期（第五、六條）</strong>
              <div class="item-meta">① 廠商於各期期限 <strong>${Number(t.notice_days) || 30} 天前</strong>製作參考年租金明細表，掛號（郵戳為憑）或親送學校</div>
              <div class="item-meta">② 學校依級距核算後開立繳款通知單 → ③ 廠商於期限前至指定處所繳納</div>
              <div class="item-meta">逾期違約金：未滿 1 月 2%、1～2 月 4%、2～3 月 8%、3 月以上 10%；逾期達 4 個月經催告仍未繳得終止契約</div>
            </div>
          </div>
          ${t.notes ? `<div class="gate-banner amber" style="margin-bottom:10px;font-size:13px">📝 ${esc(t.notes)}</div>` : ''}
          <div style="overflow-x:auto">
            <table>
              <thead><tr><th>期數</th><th>計租區間（民國）</th><th>繳納期限</th><th style="text-align:right">經營年租金</th><th>明細表送達期限</th><th>狀態</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
          ${t.source ? `<div class="item-meta" style="margin-top:6px">依據：${esc(t.source)}。實際應繳金額以各期參考年租金依 5% 級距核算後之繳款通知單為準（見下方對帳明細）。</div>` : ''}
        </div>
      </div>`;
  }

  // --------------------------------------------------------------------------
  // 4. 編輯／帶入視窗
  // --------------------------------------------------------------------------
  function previewTableHTML(schedule) {
    if (!schedule.length) return '<div class="empty-state">請先於契約主檔填妥起租日、屆滿日與經營年租金，才能產生繳納時程。</div>';
    return `<div style="max-height:260px;overflow:auto;border:1px solid var(--border);border-radius:8px">
      <table><thead><tr><th>期數</th><th>計租區間</th><th>繳納期限</th><th style="text-align:right">金額</th></tr></thead><tbody>
      ${schedule.map(i => `<tr><td>第 ${i.no} 期${i.months < 12 ? `（${i.months} 個月）` : ''}</td><td>${rocShort(i.period_start)} ～ ${rocShort(i.period_end)}</td><td><strong>${rocShort(i.due_date)}</strong></td><td style="text-align:right">${fmtMoney(i.amount)}</td></tr>`).join('')}
      </tbody></table></div>`;
  }

  let rtDraft = null;

  window.openRentTermsModal = function(solarId, usePreset) {
    const c = appData.tables.Solar_Contracts.find(x => x.solar_id === solarId);
    if (!c) return;
    const existing = getRentTerms(c);
    const preset = usePreset && XIPU_RENEWAL_PRESET.match(c) ? XIPU_RENEWAL_PRESET : null;
    const contractForCalc = preset ? { ...c, ...preset.contractFields } : c;
    const schedule = preset ? presetSchedule(contractForCalc, preset)
      : (existing ? existing.schedule : generateRentSchedule(contractForCalc));
    const base = preset ? preset.terms : (existing || DEFAULT_TERMS);
    const calc = preset ? preset.terms.calc : (existing?.calc || (c.capacity_kwp && c.fit_rate ? {
      kwp: Number(c.capacity_kwp), kwh_per_kwp_day: 3.5, days: 365, fit_rate: Number(c.fit_rate),
      fit_label: '', feedback_pct: Number((normFeedbackRate(c.feedback_rate) * 100).toFixed(2)),
      result: Number(c.base_annual_rent) || calcBaseAnnualRent(c.capacity_kwp, c.fit_rate, c.feedback_rate)
    } : null));
    rtDraft = { solarId, schedule, calc, preset: !!preset };

    const v = k => esc(base[k] ?? DEFAULT_TERMS[k] ?? '');
    openModal(preset ? `📄 帶入${preset.label}條款` : '💰 年租金繳納條件', `
      ${preset ? `<div class="gate-banner amber" style="margin-bottom:10px;font-size:13px">將同時更新本契約：計費方式＝5% 級距制、年結、經營年租金 175,095 元、躉購費率 4.8061、回饋 15%、約定繳款日 04-27。</div>` : ''}
      <div class="form-grid">
        <div class="field"><label>繳納方式</label><input id="rt-methods" type="text" value="${v('pay_methods')}"></div>
        <div class="field"><label>明細表須於期限前幾天送達</label><input id="rt-notice" type="number" min="0" value="${v('notice_days')}"></div>
        <div class="field full"><label>繳納處所</label><input id="rt-place" type="text" value="${v('pay_place')}"></div>
        <div class="field"><label>代收金融機構</label><input id="rt-bank" type="text" value="${v('bank_name')}"></div>
        <div class="field"><label>戶名</label><input id="rt-accname" type="text" value="${v('bank_account_name')}"></div>
        <div class="field"><label>帳號${preset ? '（請依契約書第五條第四款輸入）' : ''}</label><input id="rt-accno" type="text" value="${v('bank_account_no')}" placeholder="例：0000-000-00000-0"></div>
        <div class="field"><label>依據</label><input id="rt-source" type="text" value="${v('source')}" placeholder="例：租賃契約第四～六條"></div>
        <div class="field full"><label>備註</label><textarea id="rt-notes" rows="2">${v('notes')}</textarea></div>
      </div>
      <div style="font-weight:700;margin:10px 0 6px">📅 繳納時程（${schedule.length} 期）${preset ? '：依契約書第五條第一款' : existing ? '：沿用已儲存時程' : '：依契約起迄自動產生'}</div>
      ${previewTableHTML(schedule)}
      ${existing && !preset ? `<button class="btn-xs" style="margin-top:6px" onclick="regenRentSchedule('${esc(solarId)}')">↺ 依目前契約起迄重新產生時程</button>` : ''}
    `, `<button onclick="closeModal()">取消</button><button class="btn-primary" ${schedule.length ? '' : 'disabled'} onclick="saveRentTerms()">💾 儲存繳納條件</button>`);
    if (preset) setTimeout(() => document.getElementById('rt-accno')?.focus(), 50);
  };

  window.regenRentSchedule = function(solarId) {
    const c = appData.tables.Solar_Contracts.find(x => x.solar_id === solarId);
    if (!c || !rtDraft) return;
    const t = getRentTerms(c);
    c.rent_terms_json = JSON.stringify({ ...(t || {}), schedule: generateRentSchedule(c) });
    window.openRentTermsModal(solarId, false);
  };

  window.saveRentTerms = async function() {
    if (!rtDraft || !rtDraft.schedule.length) return;
    const c = appData.tables.Solar_Contracts.find(x => x.solar_id === rtDraft.solarId);
    if (!c) return;
    const val = id => (document.getElementById(id)?.value || '').trim();
    const terms = {
      version: 1,
      calc: rtDraft.calc,
      schedule: rtDraft.schedule,
      pay_methods: val('rt-methods'), pay_place: val('rt-place'),
      bank_name: val('rt-bank'), bank_account_name: val('rt-accname'), bank_account_no: val('rt-accno'),
      notice_days: Number(val('rt-notice')) || 30,
      source: val('rt-source'), notes: val('rt-notes'),
      updated_at: nowStr()
    };
    const first = rtDraft.schedule[0];
    const rec = {
      ...c,
      ...(rtDraft.preset ? XIPU_RENEWAL_PRESET.contractFields : {}),
      annual_due_month_day: first ? first.due_date.slice(5) : (c.annual_due_month_day || ''),
      rent_terms_json: JSON.stringify(terms),
      updated_at: nowStr()
    };
    upsertLocal('Solar_Contracts', rec, 'solar_id');
    closeModal();
    renderCurrentView();
    await pushToCloud({ action: 'batchUpsert', items: [{ table: 'Solar_Contracts', records: [rec] }] });
    toast(`✅ 已更新年租金繳納條件（${terms.schedule.length} 期）`);
  };

  // --------------------------------------------------------------------------
  // 5. 掛載：詳情頁、對帳期限推算、戰情室提醒
  // --------------------------------------------------------------------------
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
        const title = `${c.building_name}${c.phase_label ? '（' + c.phase_label + '）' : ''}`;
        // 以實際繳納時程取代「固定月日」推算的催繳提醒
        alerts = alerts.filter(a => !(a.badge === '太陽能催繳' && a.title === title));
        const recs = contractRecords(c);
        const next = t.schedule.find(i => !isPaid(matchRecord(i, recs)));
        if (!next) return;
        const rec = matchRecord(next, recs);
        const st = installmentStatus(next, rec, t.notice_days);
        const go = () => { solarV2SelectedId = c.solar_id; solarV2DetailTab = 'billing'; switchTab('solar'); };
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
  // 6. 自我驗證：產生器結果須與契約書第五條第一款完全相符
  // --------------------------------------------------------------------------
  window.runSolarRentTermsTests = function() {
    const results = [];
    const ok = (cond, name, got) => results.push({ pass: !!cond, name, got });
    const c = { contract_start: '2026-03-27', contract_end: '2036-02-26', base_annual_rent: 175095, capacity_kwp: 190.12 };
    const gen = generateRentSchedule(c);
    ok(gen.length === 10, '續約 119 個月產生 10 期', gen.length);
    ok(gen.every((g, i) => g.due_date === XIPU_RENEWAL_PRESET.schedule[i][0]), '各期繳納期限與契約書相符（116/4/27 … 124/4/27、125/3/27）', gen.map(g => g.due_date).join(','));
    ok(gen.every((g, i) => g.amount === XIPU_RENEWAL_PRESET.schedule[i][1]), '各期金額與契約書相符（9 × 175,095、末期 160,504）', gen.map(g => g.amount).join(','));
    ok(gen[9].months === 11 && gen[9].period_end === '2036-02-26', '末期 11 個月、截至 125/2/26', `${gen[9].months}/${gen[9].period_end}`);
    ok(calcBaseAnnualRent(190.12, 4.8061, 0.15) === 175095, '190.12 × 3.5 × 365 × 4.8061 × 15% = 175,095', calcBaseAnnualRent(190.12, 4.8061, 0.15));
    ok(XIPU_RENEWAL_PRESET.match({ contract_start: '2026-03-27', capacity_kwp: 190.12 }) && !XIPU_RENEWAL_PRESET.match({ contract_start: '2016-04-27', capacity_kwp: 190.12 }), '續約條款只對應續約契約（不套到原約）', '');
    return results;
  };

  if (window.GA_REGISTRY && typeof window.GA_REGISTRY.registerModule === 'function') {
    window.GA_REGISTRY.registerModule('solar-rent-terms.js', 'v1.0', '太陽能年租金繳納時程、方式、處所與明細表期限');
  }
})();
