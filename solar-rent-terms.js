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
      notes: '契約書第五條第 5 期誤植為「民國112年4月27日」，已確認正確為民國120年4月27日，系統以 120 年列管。'
    }
  };

  // --------------------------------------------------------------------------
  // 1b. 二期屋頂型租賃契約（111年度雄院民公吉字第1156號，111.11.17 公證）
  //     標的：教室 11.84 ＋ 警衛室 17.76 ＋ 中央廚房 106.19 ＝ 135.79 kWp（B類，回饋 12%）
  // --------------------------------------------------------------------------
  const XIPU_PHASE2_PRESET = {
    key: 'xipu-phase2',
    match: c => String(c.contract_start || '').slice(0, 10) === '2022-11-17' && Math.abs((Number(c.capacity_kwp) || 0) - 135.79) < 0.005,
    label: '二期屋頂型契約（111.11.17 公證）',
    contractFields: {
      billing_mode: 'TIERED_BASE_RENT', billing_cycle: '年結', annual_due_month_day: '12-17',
      fit_rate: 4.497, feedback_rate: 0.12, base_annual_rent: 93612, min_annual_feedback: 93612
    },
    // 建立新契約時使用（本約尚未建檔時）
    newContract: {
      building_name: '教室、警衛室、中央廚房屋頂', phase_label: '二期', parent_contract_id: '', status: '併聯發電中',
      buildings_json: JSON.stringify([
        { name: '教室（11.84 kWp）', land_lot: '', permit_no: '', area: '', voltage: '' },
        { name: '警衛室（17.76 kWp）', land_lot: '', permit_no: '', area: '', voltage: '' },
        { name: '中央廚房（106.19 kWp）', land_lot: '', permit_no: '', area: '', voltage: '' }
      ]),
      lessee_vendor: '環球大宇宙太陽能工業有限公司／鄭玲玲／07-7338282',
      vendor_name: '環球大宇宙太陽能工業有限公司', vendor_tax_id: '28929872', vendor_contact: '鄭玲玲', vendor_phone: '07-7338282',
      vendor_email: '', vendor_address: '高雄市鳥松區美山路62-1號',
      guarantor_name: '鉅光科技工業有限公司', guarantor_tax_id: '22073218', guarantor_rep: '吳家慶', guarantor_phone: '0980-889269',
      taipower_meter_no: '', taipower_contract_no: '', shared_total_kwp: 135.79, capacity_kwp: 135.79, allocation_ratio: 100,
      sales_mode: 'TAIPOWER_FIT', meter_cutoff_note: '',
      contract_start: '2022-11-17', contract_end: '2032-10-16', term_months: 119, renewal_deadline: '2032-07-16',
      notary_no: '111年度雄院民公吉字第1156號', drive_folder_url: '',
      bond_method: '現金', deposit_amount: 187224, deposit_expiry: '', insurance_expiry: '', is_deleted: false
    },
    // 契約第五條第一款
    schedule: [
      ['2023-12-17', 93612], ['2024-12-17', 93612], ['2025-12-17', 93612], ['2026-12-17', 93612],
      ['2027-12-17', 93612], ['2028-12-17', 93612], ['2029-12-17', 93612], ['2030-12-17', 93612],
      ['2031-12-17', 93612], ['2032-11-17', 85811]
    ],
    terms: {
      calc: { kwp: 135.79, kwh_per_kwp_day: 3.5, days: 365, fit_rate: 4.497, fit_label: '111年躉購費率，B類', feedback_pct: 12, result: 93612 },
      min_guarantee: true,
      pay_methods: '現金、票據',
      pay_place: '溪埔國民中學總務處出納組（84048 高雄市大樹區溪埔路1號）；或至各銀行、郵局、農漁會等金融機構繳納',
      bank_name: '合作金庫 大樹分行',
      bank_account_name: '高雄市立溪埔國民中學',
      bank_account_no: '',
      notice_days: 30,
      source: '二期屋頂型租賃契約（111年度雄院民公吉字第1156號）第三～六條',
      notes: '保底：第三條第四款，參考年租金每年至少給付 93,612 元（第 10 期 11 個月至少 85,811 元），高於經營年租金時依第五條第二款 5% 級距計收。履約保證金 187,224 元（2 年經營年租金），繳納方式請依實際收執之票據或保證書更正。優先續租 2 次（第 1 次 9 年 11 個月）。'
    }
  };
  XIPU_RENEWAL_PRESET.key = 'xipu-renewal';

  const PRESETS = [XIPU_RENEWAL_PRESET, XIPU_PHASE2_PRESET];

  // --------------------------------------------------------------------------
  // 1c. 二期屋頂型保單（華南產物）
  //     產險：電子設備綜合保險 19 處案場之第 17 項「溪埔國中二期」
  //     意外險：公共意外責任險，保單手註「二期」
  // --------------------------------------------------------------------------
  const INSURANCE_PRESETS = [{
    key: 'xipu-phase2-ins-115',
    contractMatch: c => XIPU_PHASE2_PRESET.match(c),
    label: '二期保單（產險 115/06/15 起、意外險 114/11/25 起）',
    logs: [
      {
        policyKey: '151060201', log_type: 'PROPERTY_INS',
        doc_or_policy_no: '華南產物 1401字第151060201號',
        effective_date: '2026-06-15', expiry_date: '2027-06-15',
        compliance: { typhoon: true, fire: true, earthquake: true },
        notes: '電子設備綜合保險（高雄 19 處案場）第 17 項：溪埔路1號「溪埔國中二期」，製造年份 112/01/31，保額 5,979,373 元。附加條款 F05 加保颱風、洪水、地震；火災屬主險承保範圍。自負額每一事故每一地址損失之 15%，最低 10 萬元。續保自 1401字第141060197號。'
      },
      {
        policyKey: '142021519', log_type: 'PUBLIC_LIABILITY_INS',
        doc_or_policy_no: '華南產物 1402第142021519號',
        effective_date: '2025-11-25', expiry_date: '2026-11-25',
        compliance: { per_person: 300, per_accident_body: 1500, per_accident_prop: 200, aggregate: 4800 },
        notes: '公共意外責任險，被保險人經營業務處所：高雄市立溪埔國民中學（溪埔路1號），保單手註「二期」。每一意外事故自負額 2,500 元，保險費 5,936 元。續保自 1402字第132021555號。'
      }
    ]
  }];

  const missingPresetLogs = (c, pr) => {
    const logs = (appData.tables.Solar_Compliance_Logs || []).filter(l => l.solar_id === c.solar_id);
    return pr.logs.filter(x => !logs.some(l => String(l.doc_or_policy_no || '').includes(x.policyKey)));
  };

  window.openInsurancePresetModal = function(solarId, key) {
    const c = (appData.tables.Solar_Contracts || []).find(x => x.solar_id === solarId);
    const pr = INSURANCE_PRESETS.find(x => x.key === key);
    if (!c || !pr) return;
    const todo = missingPresetLogs(c, pr);
    const tName = { PROPERTY_INS: '產物保險', PUBLIC_LIABILITY_INS: '公共意外責任險' };
    openModal(`📄 帶入${pr.label}`, `
      <div class="item-meta" style="margin-bottom:8px">將於 <strong>${esc(c.solar_id)}｜${esc(solarContractTitle(c))}</strong> 新增 ${todo.length} 筆保險紀錄：</div>
      <table><thead><tr><th>類別</th><th>保單號碼</th><th>保險期間</th><th>內容</th></tr></thead><tbody>
      ${todo.map(x => `<tr>
        <td style="white-space:nowrap"><strong>${tName[x.log_type]}</strong></td>
        <td style="white-space:nowrap">${esc(x.doc_or_policy_no)}</td>
        <td style="white-space:nowrap">${rocShort(x.effective_date)} ～ ${rocShort(x.expiry_date)}${diffDays(todayStr(), x.expiry_date) < 0 ? '<div><span class="tag tag-red">已到期，需續保保單</span></div>' : ''}</td>
        <td style="font-size:12.5px">${x.log_type === 'PROPERTY_INS' ? '颱風 ✓ 火災 ✓ 地震 ✓' : '300／1,500／200／4,800 萬（符合契約最低保額）'}<div class="item-meta">${esc(x.notes)}</div></td>
      </tr>`).join('')}
      </tbody></table>
    `, `<button onclick="closeModal()">取消</button><button class="btn-primary" onclick="saveInsurancePreset('${esc(solarId)}','${esc(key)}')">💾 新增 ${todo.length} 筆保險紀錄</button>`);
  };

  window.saveInsurancePreset = async function(solarId, key) {
    const c = (appData.tables.Solar_Contracts || []).find(x => x.solar_id === solarId);
    const pr = INSURANCE_PRESETS.find(x => x.key === key);
    if (!c || !pr) return;
    const recs = missingPresetLogs(c, pr).map(x => {
      const rec = {
        log_id: nextId('Solar_Compliance_Logs', 'log_id', 'CMP', 4), solar_id: solarId, log_type: x.log_type,
        doc_or_policy_no: x.doc_or_policy_no, effective_date: x.effective_date, expiry_date: x.expiry_date,
        compliance_json: JSON.stringify(x.compliance), attachment_url: '', notes: x.notes,
        updated_at: nowStr(), is_deleted: false
      };
      upsertLocal('Solar_Compliance_Logs', rec, 'log_id');
      return rec;
    });
    closeModal();
    solarV2SelectedId = solarId; solarV2DetailTab = 'compliance';
    renderCurrentView();
    if (recs.length) await pushToCloud({ action: 'batchUpsert', items: [{ table: 'Solar_Compliance_Logs', records: recs }] });
    toast(`✅ 已新增 ${recs.length} 筆保險紀錄`);
  };
  const findPreset = c => PRESETS.find(pr => pr.match(c)) || null;
  const fmtPresetFields = f => [
    f.billing_mode === 'TIERED_BASE_RENT' ? '計費方式＝5% 級距制' : '', f.billing_cycle || '',
    f.base_annual_rent ? `經營年租金 ${Number(f.base_annual_rent).toLocaleString('zh-TW')} 元` : '',
    f.fit_rate ? `躉購費率 ${f.fit_rate}` : '', f.feedback_rate ? `回饋 ${Math.round(f.feedback_rate * 100)}%` : '',
    f.annual_due_month_day ? `約定繳款日 ${f.annual_due_month_day}` : ''
  ].filter(Boolean).join('、');

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
    const preset = findPreset(c);
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
      const st = installmentStatus(inst, rec, t.notice_days, t);
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
    openTermsModalFor(c, usePreset ? findPreset(c) : null, false);
  };

  // 依預設建立尚未建檔的新契約（例如二期屋頂型）
  window.openCreatePresetContract = function(presetKey) {
    const preset = PRESETS.find(pr => pr.key === presetKey && pr.newContract);
    if (!preset) return;
    const draft = {
      ...preset.newContract, ...preset.contractFields,
      solar_id: nextId('Solar_Contracts', 'solar_id', 'SOL', 3), updated_at: nowStr()
    };
    openTermsModalFor(draft, preset, true);
  };

  function openTermsModalFor(c, preset, isNew) {
    const solarId = c.solar_id;
    const existing = isNew ? null : getRentTerms(c);
    const contractForCalc = preset ? { ...c, ...preset.contractFields } : c;
    const schedule = preset ? presetSchedule(contractForCalc, preset)
      : (existing ? existing.schedule : generateRentSchedule(contractForCalc));
    const base = preset ? preset.terms : (existing || DEFAULT_TERMS);
    const calc = preset ? preset.terms.calc : (existing?.calc || (c.capacity_kwp && c.fit_rate ? {
      kwp: Number(c.capacity_kwp), kwh_per_kwp_day: 3.5, days: 365, fit_rate: Number(c.fit_rate),
      fit_label: '', feedback_pct: Number((normFeedbackRate(c.feedback_rate) * 100).toFixed(2)),
      result: Number(c.base_annual_rent) || calcBaseAnnualRent(c.capacity_kwp, c.fit_rate, c.feedback_rate)
    } : null));
    const priorDue = schedule.filter(i => i.due_date < todayStr()).length;
    rtDraft = { solarId, schedule, calc, preset, isNew, newContract: isNew ? c : null };

    const v = k => esc(base[k] ?? DEFAULT_TERMS[k] ?? '');
    const priorChecked = existing ? Number(existing.prior_settled_through) > 0 : true;
    openModal(isNew ? `📄 新增${preset.label}` : preset ? `📄 帶入${preset.label}條款` : '💰 年租金繳納條件', `
      ${isNew ? `<div class="gate-banner amber" style="margin-bottom:10px;font-size:13px">將新增契約 <strong>${esc(c.solar_id)}｜${esc(c.building_name)}（${esc(c.phase_label)}）</strong>：${c.capacity_kwp} kWp、租期 ${rocShort(c.contract_start)}～${rocShort(c.contract_end)}（${c.term_months} 個月）、公證 ${esc(c.notary_no)}、履約保證金 ${fmtMoney(c.deposit_amount)}；${esc(fmtPresetFields(preset.contractFields))}。台電電號、保險等其他資料可於建立後以「編輯契約主檔」補上。</div>`
        : preset ? `<div class="gate-banner amber" style="margin-bottom:10px;font-size:13px">將同時更新本契約：${esc(fmtPresetFields(preset.contractFields))}。</div>` : ''}
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
      ${priorDue > 0 ? `<label style="display:flex;gap:8px;align-items:flex-start;margin-top:8px;font-size:13px;cursor:pointer"><input type="checkbox" id="rt-prior" ${priorChecked ? 'checked' : ''} style="margin-top:3px"><span>已到期的前 <strong>${priorDue}</strong> 期（${rocShort(schedule[0].due_date)}～${rocShort(schedule[priorDue - 1].due_date)}）已繳清，標示為「已繳（建檔前）」，不列入逾期提醒</span></label>` : ''}
      ${existing && !preset ? `<button class="btn-xs" style="margin-top:6px" onclick="regenRentSchedule('${esc(solarId)}')">↺ 依目前契約起迄重新產生時程</button>` : ''}
    `, `<button onclick="closeModal()">取消</button><button class="btn-primary" ${schedule.length ? '' : 'disabled'} onclick="saveRentTerms()">💾 ${isNew ? '建立契約與繳納條件' : '儲存繳納條件'}</button>`);
    if (preset) setTimeout(() => document.getElementById('rt-accno')?.focus(), 50);
  }

  window.regenRentSchedule = function(solarId) {
    const c = appData.tables.Solar_Contracts.find(x => x.solar_id === solarId);
    if (!c || !rtDraft) return;
    const t = getRentTerms(c);
    c.rent_terms_json = JSON.stringify({ ...(t || {}), schedule: generateRentSchedule(c) });
    window.openRentTermsModal(solarId, false);
  };

  window.saveRentTerms = async function() {
    if (!rtDraft || !rtDraft.schedule.length) return;
    const c = rtDraft.isNew ? rtDraft.newContract : appData.tables.Solar_Contracts.find(x => x.solar_id === rtDraft.solarId);
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
      min_guarantee: !!rtDraft.preset?.terms?.min_guarantee || !!getRentTerms(c)?.min_guarantee,
      prior_settled_through: priorEl && priorEl.checked ? priorDue : 0,
      updated_at: nowStr()
    };
    const first = rtDraft.schedule[0];
    const rec = {
      ...c,
      ...(rtDraft.preset ? rtDraft.preset.contractFields : {}),
      annual_due_month_day: first ? first.due_date.slice(5) : (c.annual_due_month_day || ''),
      rent_terms_json: JSON.stringify(terms),
      updated_at: nowStr()
    };
    upsertLocal('Solar_Contracts', rec, 'solar_id');
    const created = rtDraft.isNew;
    closeModal();
    if (created) { solarV2SelectedId = rec.solar_id; solarV2DetailTab = 'billing'; }
    renderCurrentView();
    await pushToCloud({ action: 'batchUpsert', items: [{ table: 'Solar_Contracts', records: [rec] }] });
    toast(created ? `✅ 已建立 ${rec.solar_id}｜${rec.building_name}（${terms.schedule.length} 期繳納時程）` : `✅ 已更新年租金繳納條件（${terms.schedule.length} 期）`);
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

  // 太陽能總覽：本約尚未建檔時，顯示「新增二期屋頂型契約」按鈕
  const _prevRenderView_rt = renderCurrentView;
  renderCurrentView = function() {
    _prevRenderView_rt();
    if (typeof currentTab === 'undefined' || currentTab !== 'solar' || solarV2SelectedId) return;
    const addBtn = Array.from(document.querySelectorAll('#main-view button')).find(b => (b.getAttribute('onclick') || '') === 'openSolarContractModal()');
    if (!addBtn || document.getElementById('btn-create-phase2')) return;
    PRESETS.filter(pr => pr.newContract && !(appData.tables.Solar_Contracts || []).some(c => pr.match(c))).forEach(pr => {
      const b = document.createElement('button');
      b.id = 'btn-create-phase2';
      b.className = 'btn-sm';
      b.textContent = `📄 新增${pr.label}`;
      b.onclick = () => window.openCreatePresetContract(pr.key);
      addBtn.insertAdjacentElement('beforebegin', b);
    });
  };

  // 雙保險頁籤：有尚未登錄的對應保單時，顯示一鍵帶入
  const _prevComplianceTab = renderSolarDetailComplianceTabHTML;
  renderSolarDetailComplianceTabHTML = function(c, cmp) {
    const banners = INSURANCE_PRESETS.filter(pr => pr.contractMatch(c)).map(pr => {
      const todo = missingPresetLogs(c, pr);
      if (!todo.length) return '';
      return `<div class="gate-banner amber" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
        <span>📄 已有 ${esc(pr.label)}：${todo.map(x => x.log_type === 'PROPERTY_INS' ? '產物保險' : '公共意外責任險').join('、')}尚未登錄</span>
        <button class="btn-sm btn-primary" onclick="openInsurancePresetModal('${esc(c.solar_id)}','${esc(pr.key)}')">帶入 ${todo.length} 筆保單</button>
      </div>`;
    }).join('');
    return banners + _prevComplianceTab(c, cmp);
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
    const c2 = { contract_start: '2022-11-17', contract_end: '2032-10-16', base_annual_rent: 93612, capacity_kwp: 135.79 };
    const gen2 = generateRentSchedule(c2);
    ok(gen2.length === 10 && gen2.every((g, i) => g.due_date === XIPU_PHASE2_PRESET.schedule[i][0] && g.amount === XIPU_PHASE2_PRESET.schedule[i][1]),
      '二期：10 期期限與金額與契約書相符（112～120/12/17 各 93,612、121/11/17 85,811）', gen2.map(g => g.due_date + ':' + g.amount).join(','));
    ok(calcBaseAnnualRent(135.79, 4.497, 0.12) === 93612, '二期：135.79 × 3.5 × 365 × 4.497 × 12% = 93,612', calcBaseAnnualRent(135.79, 4.497, 0.12));
    const tc = { ...c2, solar_id: '_T2', billing_mode: 'TIERED_BASE_RENT', feedback_rate: 0.12, fit_rate: 4.497,
      rent_terms_json: JSON.stringify({ min_guarantee: true, schedule: generateRentSchedule(c2) }) };
    const low = calcSolarBillV2({ period_label: '第4期', period_start: '2025-11-17', period_end: '2026-11-16', period_months: 12, taipower_revenue: 500000, due_date: '2026-12-17', applied_tier_percent: '' }, tc);
    const high = calcSolarBillV2({ period_label: '第4期', period_start: '2025-11-17', period_end: '2026-11-16', period_months: 12, taipower_revenue: 900000, due_date: '2026-12-17', applied_tier_percent: '' }, tc);
    const last = calcSolarBillV2({ period_label: '第10期', period_start: '2031-11-17', period_end: '2032-10-16', period_months: 11, taipower_revenue: 300000, due_date: '2032-11-17', applied_tier_percent: '' }, tc);
    ok(low.calculatedRent === 93612 && low.floorApplied, '二期保底：參考年租金偏低時仍收 93,612', low.calculatedRent);
    ok(high.calculatedRent === roundMoney(93612 * 1.2) && !high.floorApplied, '二期：參考年租金高於經營年租金時依級距加收（115%→120%）', `${high.suggestedTier}/${high.calculatedRent}`);
    ok(last.calculatedRent === 85811, '二期第 10 期保底 85,811', last.calculatedRent);
    ok(XIPU_PHASE2_PRESET.match(c2) && !XIPU_RENEWAL_PRESET.match(c2) && !XIPU_PHASE2_PRESET.match({ contract_start: '2026-03-27', capacity_kwp: 190.12 }), '一期續約與二期條款互不套用', '');
    return results;
  };

  if (window.GA_REGISTRY && typeof window.GA_REGISTRY.registerModule === 'function') {
    window.GA_REGISTRY.registerModule('solar-rent-terms.js', 'v1.0', '太陽能年租金繳納時程、方式、處所與明細表期限');
  }
})();
