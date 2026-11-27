/**
 * ============================================================================
 * 總務行政戰情助理 — 【模組 F1】小額與法定採購三軌精算台帳 (statutory-procurement.js)
 * 遵循規範：UI_DESIGN_RULES.md §0–§5.2 F1
 *
 * 三軌獨立分母精算（嚴禁混算）：
 * 1. 《政府採購法》§14 同性質小額累計防拆單（年度 150,000 元上限；120,000 元 80% 橘燈預警）
 * 2. 🌿 機關綠色採購法定比率（指定品項具環保標章達成率，預設目標 >= 95%，支援入帳前即時試算）
 * 3. 🤝 身心障礙優先採購法定比率（義務品項優採機構比率 >= 5%，自動精算「尚差 $X,XXX 元達標」）
 *
 * 雲端同步：透過 GA_CORE.extStore ('STAT_PROC') 無損寫入既有 Project_Responsibilities 表，免重部署 GAS。
 * ============================================================================
 */

(function initStatutoryProcurementModule() {
  if (!window.GA_CORE) return;

  const MOD_KEY = 'STAT_PROC';
  const CATEGORIES = [
    '水電零星修繕',
    '冷氣空調維修',
    '印刷與文宣品',
    '資訊耗材設備',
    '清潔與環境衛生',
    '教學與體育用品',
    '便當餐盒與茶點',
    '校舍土木零星修繕',
    '其他庶務採購'
  ];

  const GREEN_OPTIONS = [
    { value: 'NONE', label: '非指定品項（不計入綠採分母）', short: '非指定' },
    { value: 'CERTIFIED', label: '🌿 指定品項・具環保標章（進分子＋分母）', short: '🌿 環保標章' },
    { value: 'UNCERTIFIED', label: '⚠️ 指定品項・無標章未專簽（只進分母，拉低達成率）', short: '⚠️ 指定無標章' },
    { value: 'EXEMPT_APPROVED', label: '📄 指定品項・已專簽核准不統計（不進分母）', short: '專簽免計' }
  ];

  const PRIO_OPTIONS = [
    { value: 'NONE', label: '非義務品項（不計入優採分母）', short: '非義務' },
    { value: 'PRIORITY_ORG', label: '🤝 義務品項・優採合格機構／庇護工場（進分子＋分母）', short: '🤝 優採機構' },
    { value: 'GENERAL_VENDOR', label: '⚠️ 義務品項（餐盒/印刷/清潔等）・一般廠商（只進分母）', short: '⚠️ 義務一般廠' }
  ];

  const state = {
    fiscalYear: String(new Date().getFullYear() - 1911),
    filterTab: 'ALL', // ALL | SEC14 | GREEN | PRIO
    quarter: 'ALL',   // ALL | Q1 | Q2 | Q3 | Q4
    page: 1,
    rightMode: 'FORM', // FORM | SEC14_BARS
    editingId: '',
    simAmount: 0,
    simCategory: '資訊耗材設備',
    simGreen: 'NONE',
    simPrio: 'NONE'
  };

  const h = s => (typeof esc === 'function' ? esc(s) : String(s ?? ''));
  const roc = ymd => window.GA_CORE.formatRocDate(ymd);

  function inferQuarter(ymd) {
    const m = parseInt(String(ymd || '').slice(5, 7), 10);
    if (!m || isNaN(m)) return 'Q4';
    if (m <= 3) return 'Q1';
    if (m <= 6) return 'Q2';
    if (m <= 9) return 'Q3';
    return 'Q4';
  }

  function inferProjectCategory(p) {
    const nm = String(p.project_name || '');
    if (/冷氣|空調/.test(nm)) return '冷氣空調維修';
    if (/水電|照明|燈具|電力/.test(nm)) return '水電零星修繕';
    if (/印刷|聯絡簿|講義|畢業紀念冊/.test(nm)) return '印刷與文宣品';
    if (/資訊|電腦|網路|碳粉|印表機/.test(nm)) return '資訊耗材設備';
    if (/清潔|消毒|水塔|環境|垃圾|除草/.test(nm)) return '清潔與環境衛生';
    if (/餐盒|便當|點心|茶水/.test(nm)) return '便當餐盒與茶點';
    if (/體育|球|教學|圖書/.test(nm)) return '教學與體育用品';
    if (/工程|修繕|廁所|跑道|防水|油漆/.test(nm)) return '校舍土木零星修繕';
    return '其他庶務採購';
  }

  // 匯整雲端手動小額台帳 ＋ 「小額／逕洽／共契契約」自動勾稽列（與上網公開招標案徹底分流！）
  function getUnifiedRecords(fiscalYear) {
    const fy = String(fiscalYear || state.fiscalYear);
    const manual = window.GA_CORE.extStore.list(MOD_KEY)
      .filter(r => String(r.fiscal_year || fy) === fy)
      .map(r => ({
        ...r,
        source: 'MANUAL',
        amount: Number(r.amount) || 0,
        quarter: r.quarter || inferQuarter(r.purchase_date)
      }));

    const linkedProjIds = new Set(manual.map(m => m.linked_project_id).filter(Boolean));
    const autoFromProjects = ((typeof appData !== 'undefined' && appData?.tables?.Projects) || [])
      .filter(p => !['廢標撤案'].includes(p.status) && String(p.fiscal_year || '') === fy && !linkedProjIds.has(p.project_id))
      .map(p => {
        const flg = parseJSON(p.flags_json, {});
        if (flg.exclude_from_sp_ledger) return null;
        const isMicroProj = window.GA_CORE.isMicroPurchaseProject(p);
        const greenTrack = flg.green_track || (flg.is_green ? 'CERTIFIED' : 'NONE');
        const prioTrack = flg.priority_track || (flg.is_priority ? 'PRIORITY_ORG' : 'NONE');
        // 上網招標案不混入小額台帳（除非明確標記綠優採且使用者未隱藏）
        if (!isMicroProj && greenTrack === 'NONE' && prioTrack === 'NONE') return null;

        const amt = Number(p.award_amount) || Number(p.contract_amount) || Number(p.budget_amount) || 0;
        const isCoSupply = String(p.award_method || '').includes('共同供應契約');
        const countSec14 = flg.count_in_sec14 !== undefined ? !!flg.count_in_sec14 : (isMicroProj && !isCoSupply && amt <= 150000);
        const dt = p.start_date || p.award_date || p.created_at?.slice(0, 10) || (typeof todayStr === 'function' ? todayStr() : '2026-11-26');
        return {
          id: `AUTO-${p.project_id}`,
          fiscal_year: fy,
          purchase_date: String(dt).slice(0, 10),
          quarter: inferQuarter(dt),
          item_title: p.project_name,
          category: flg.sec14_category || inferProjectCategory(p),
          vendor_name: p.vendor_name || (isMicroProj ? '（小額契約廠商）' : '（標案決標廠商）'),
          amount: amt,
          count_in_sec14: countSec14,
          is_micro_contract: isMicroProj,
          green_track: greenTrack,
          priority_track: prioTrack,
          voucher_no: (typeof formatProjectCaseNo === 'function' ? formatProjectCaseNo(p) : p.project_id),
          linked_project_id: p.project_id,
          source: 'PROJECT'
        };
      })
      .filter(Boolean);

    return [...manual, ...autoFromProjects].sort((a, b) => String(b.purchase_date || '').localeCompare(String(a.purchase_date || '')));
  }

  function calcStatutoryProcurementStats(fiscalYear = state.fiscalYear, simRecord = null) {
    const records = getUnifiedRecords(fiscalYear);
    if (simRecord && Number(simRecord.amount) > 0) {
      records.push({
        id: '__SIM__',
        fiscal_year: String(fiscalYear),
        amount: Number(simRecord.amount) || 0,
        category: simRecord.category || '其他庶務採購',
        count_in_sec14: Number(simRecord.amount) <= 150000,
        green_track: simRecord.green_track || 'NONE',
        priority_track: simRecord.priority_track || 'NONE',
        source: 'SIM'
      });
    }

    // Track 1: §14 同性質分類累計（僅計入小額逕行採購 <= 150,000）
    const catTotals = {};
    CATEGORIES.forEach(c => { catTotals[c] = 0; });
    let microCount = 0;
    let microSum = 0;

    // Track 2: 綠色採購（獨立分母）
    let greenNumer = 0;
    let greenDenom = 0;
    let greenExemptCount = 0;

    // Track 3: 優先採購（獨立分母）
    let prioNumer = 0;
    let prioDenom = 0;

    for (const r of records) {
      const amt = Number(r.amount) || 0;
      if (amt <= 0) continue;

      const isSec14 = r.count_in_sec14 !== false && amt <= 150000;
      if (isSec14) {
        const cat = catTotals[r.category] !== undefined ? r.category : '其他庶務採購';
        catTotals[cat] += amt;
        microCount++;
        microSum += amt;
      }

      if (r.green_track === 'CERTIFIED') {
        greenNumer += amt;
        greenDenom += amt;
      } else if (r.green_track === 'UNCERTIFIED') {
        greenDenom += amt;
      } else if (r.green_track === 'EXEMPT_APPROVED') {
        greenExemptCount++;
      }

      if (r.priority_track === 'PRIORITY_ORG') {
        prioNumer += amt;
        prioDenom += amt;
      } else if (r.priority_track === 'GENERAL_VENDOR') {
        prioDenom += amt;
      }
    }

    const catList = Object.entries(catTotals)
      .map(([category, sum]) => ({
        category,
        sum,
        pct: Math.min(100, Math.round((sum / 150000) * 1000) / 10),
        rawPct: Math.round((sum / 150000) * 1000) / 10,
        remain: Math.max(0, 150000 - sum),
        tone: sum >= 150000 ? 'red' : sum >= 120000 ? 'amber' : 'green'
      }))
      .sort((a, b) => b.sum - a.sum);

    const topCat = catList[0] || { category: '尚無紀錄', sum: 0, rawPct: 0, remain: 150000, tone: 'green' };
    const greenTarget = 95;
    const greenPct = greenDenom > 0 ? Math.round((greenNumer / greenDenom) * 1000) / 10 : 100;
    const greenPass = greenDenom === 0 || greenPct >= greenTarget;
    // 若綠採未達 95%，需新增多少環保標章採購 (greenNumer + X) / (greenDenom + X) >= 0.95 => X >= (0.95*D - N)/0.05
    const greenNeedAdd = (!greenPass && greenDenom > 0)
      ? Math.max(0, Math.ceil((0.95 * greenDenom - greenNumer) / 0.05))
      : 0;

    const prioTarget = 5;
    const prioPct = prioDenom > 0 ? Math.round((prioNumer / prioDenom) * 1000) / 10 : 100;
    const prioPass = prioDenom === 0 || prioPct >= prioTarget;
    // 現有義務分母下差額 vs 新購優採品差額
    const prioShortfallDirect = (!prioPass && prioDenom > 0)
      ? Math.max(0, Math.ceil(prioDenom * 0.05 - prioNumer))
      : 0;
    const prioNeedNewPurchase = (!prioPass && prioDenom > 0)
      ? Math.max(0, Math.ceil((0.05 * prioDenom - prioNumer) / 0.95))
      : 0;

    return {
      fiscalYear: String(fiscalYear),
      records: records.filter(r => r.source !== 'SIM'),
      microCount,
      microSum,
      catList,
      topCat,
      sec14DangerCount: catList.filter(c => c.sum >= 150000).length,
      sec14WarnCount: catList.filter(c => c.sum >= 120000 && c.sum < 150000).length,
      greenNumer,
      greenDenom,
      greenExemptCount,
      greenTarget,
      greenPct,
      greenPass,
      greenNeedAdd,
      prioNumer,
      prioDenom,
      prioTarget,
      prioPct,
      prioPass,
      prioShortfallDirect,
      prioNeedNewPurchase
    };
  }

  window.calcStatutoryProcurementStats = calcStatutoryProcurementStats;

  // --------------------------------------------------------------------------
  // UI 互動操作
  // --------------------------------------------------------------------------
  window.spSetFilter = function(tab) { state.filterTab = tab; state.page = 1; renderCurrentView(); };
  window.spSetQuarter = function(q) { state.quarter = q; state.page = 1; renderCurrentView(); };
  window.spSetYear = function(fy) { state.fiscalYear = String(fy); state.page = 1; renderCurrentView(); };
  window.spSetPage = function(p) { state.page = Math.max(1, p); renderCurrentView(); };
  window.spSetRightMode = function(m) { state.rightMode = m; renderCurrentView(); };

  window.spEditRecord = function(id) {
    state.editingId = id || '';
    state.rightMode = 'FORM';
    renderCurrentView();
  };

  window.spUpdateSimPreview = function() {
    const amt = Number(document.getElementById('sp-f-amount')?.value || 0);
    const cat = document.getElementById('sp-f-category')?.value || '其他庶務採購';
    const grn = document.getElementById('sp-f-green')?.value || 'NONE';
    const pri = document.getElementById('sp-f-prio')?.value || 'NONE';
    const box = document.getElementById('sp-live-sim-banner');
    if (!box) return;
    if (amt <= 0) {
      box.innerHTML = `<span style="color:var(--text-muted,#57534E)">💡 輸入金額並選擇綠採／優採屬性後，將即時預估入帳後之全校達成率與 §14 剩餘額度。</span>`;
      box.className = 'sp-sim-box';
      return;
    }
    const sim = calcStatutoryProcurementStats(state.fiscalYear, {
      amount: amt, category: cat, green_track: grn, priority_track: pri
    });
    const catStat = sim.catList.find(c => c.category === cat) || { sum: amt, rawPct: 0 };
    const msgs = [];
    let isDanger = false;
    if (amt <= 150000) {
      msgs.push(`§14「${h(cat)}」累計將達 <strong>${fmtMoney(catStat.sum)}</strong>（${catStat.rawPct}%）`);
      if (catStat.sum >= 150000) {
        isDanger = true;
        msgs.push(`🚨 <strong>已逾 15 萬元小額上限！依法不得逕洽廠商拆單，請改採公開取得報價單或企劃書</strong>`);
      } else if (catStat.sum >= 120000) {
        msgs.push(`⚠️ 已達 80% 警戒線（剩餘額度 ${fmtMoney(150000 - catStat.sum)}）`);
      }
    }
    if (grn !== 'NONE' && grn !== 'EXEMPT_APPROVED') {
      msgs.push(`🌿 年度綠採率將變為 <strong>${sim.greenPct}%</strong>${sim.greenPass ? '（達標）' : '（⚠️ 低於 95% 法定目標！）'}`);
      if (!sim.greenPass) isDanger = true;
    }
    if (pri !== 'NONE') {
      msgs.push(`🤝 年度優採率將變為 <strong>${sim.prioPct}%</strong>${sim.prioPass ? '（達標）' : `（尚差 ${fmtMoney(sim.prioShortfallDirect)} 達標 5%）`}`);
    }
    box.className = `sp-sim-box ${isDanger ? 'is-danger' : 'is-ok'}`;
    box.innerHTML = msgs.join(' ｜ ');
  };

  window.spSaveRecord = async function() {
    const title = (document.getElementById('sp-f-title')?.value || '').trim();
    const amount = Number(document.getElementById('sp-f-amount')?.value || 0);
    if (!title) return toast('請輸入採購品項／摘要名稱');
    if (!(amount > 0)) return toast('請輸入有效採購金額');

    const rawDate = (document.getElementById('sp-f-date')?.value || '').trim();
    const ymd = window.GA_CORE.parseFlexibleRocDate(rawDate) || (typeof todayStr === 'function' ? todayStr() : '2026-11-26');
    const id = state.editingId || window.GA_CORE.extStore.nextSeqId(MOD_KEY, 'SP', 4);
    const rec = {
      id,
      fiscal_year: state.fiscalYear,
      purchase_date: ymd,
      quarter: inferQuarter(ymd),
      item_title: title,
      category: document.getElementById('sp-f-category')?.value || '其他庶務採購',
      vendor_name: (document.getElementById('sp-f-vendor')?.value || '').trim(),
      amount,
      count_in_sec14: document.getElementById('sp-f-sec14')?.checked !== false,
      green_track: document.getElementById('sp-f-green')?.value || 'NONE',
      green_mark_no: (document.getElementById('sp-f-green-no')?.value || '').trim(),
      priority_track: document.getElementById('sp-f-prio')?.value || 'NONE',
      voucher_no: (document.getElementById('sp-f-voucher')?.value || '').trim(),
      note: (document.getElementById('sp-f-note')?.value || '').trim()
    };

    state.editingId = '';
    await window.GA_CORE.extStore.upsert(MOD_KEY, id, rec, `${rec.fiscal_year}小額｜${rec.item_title} $${rec.amount}`, rec.category);
    toast(`✅ 已儲存「${rec.item_title}」（${fmtMoney(rec.amount)}）`);
  };

  window.spDeleteRecord = async function(id, title) {
    if (String(id).startsWith('AUTO-')) {
      const pid = String(id).replace(/^AUTO-/, '');
      window.spOpenProjectTrackModal(pid);
      return;
    }
    if (state.editingId === id) state.editingId = '';
    await window.GA_CORE.extStore.remove(MOD_KEY, id, title || id);
  };

  window.spOpenMicroProjectWizard = function() {
    if (typeof openProjectWizard !== 'function') return;
    openProjectWizard();
    setTimeout(() => {
      const tierEl = document.getElementById('wiz-tier');
      const awardEl = document.getElementById('wiz-award');
      const maintChk = document.getElementById('flg-maint');
      if (tierEl) {
        tierEl.value = '小額(15萬以下)';
        if (typeof refreshWizardAwardOptions === 'function') refreshWizardAwardOptions('逕洽');
        if (typeof refreshWizardProjectId === 'function') refreshWizardProjectId();
        if (typeof onWizardTierChange === 'function') onWizardTierChange();
      }
      if (awardEl) awardEl.value = '逕洽';
      if (maintChk && !maintChk.checked) { maintChk.checked = true; if (typeof toggleMaintOptionsUI === 'function') toggleMaintOptionsUI(); }
    }, 60);
  };

  window.spOpenProjectTrackModal = function(projectId) {
    const p = (appData.tables.Projects || []).find(x => x.project_id === projectId);
    if (!p) return;
    const flg = parseJSON(p.flags_json, {});
    const curCat = flg.sec14_category || inferProjectCategory(p);
    const curSec14 = flg.count_in_sec14 !== undefined ? !!flg.count_in_sec14 : true;
    const curGreen = flg.green_track || (flg.is_green ? 'CERTIFIED' : 'NONE');
    const curPrio = flg.priority_track || (flg.is_priority ? 'PRIORITY_ORG' : 'NONE');

    openModal(`⚙️ 設定小額契約統計屬性：${p.project_name}`, `
      <div class="form-grid">
        <div class="field full">
          <label>🛡️ 採購法 §14 同性質分類</label>
          <select id="sp-pm-cat">${CATEGORIES.map(c => `<option value="${h(c)}" ${curCat === c ? 'selected' : ''}>${h(c)}</option>`).join('')}</select>
        </div>
        <div class="field full">
          <label>🌿 綠色採購統計軌跡</label>
          <select id="sp-pm-green">${GREEN_OPTIONS.map(o => `<option value="${o.value}" ${curGreen === o.value ? 'selected' : ''}>${h(o.label)}</option>`).join('')}</select>
        </div>
        <div class="field full">
          <label>🤝 優先採購統計軌跡</label>
          <select id="sp-pm-prio">${PRIO_OPTIONS.map(o => `<option value="${o.value}" ${curPrio === o.value ? 'selected' : ''}>${h(o.label)}</option>`).join('')}</select>
        </div>
        <div class="field full" style="flex-direction:row;align-items:center;gap:8px">
          <input type="checkbox" id="sp-pm-sec14" ${curSec14 ? 'checked' : ''} style="width:18px;height:18px">
          <label for="sp-pm-sec14" style="margin:0;font-size:14px;cursor:pointer">計入本年度 §14 同性質 15 萬元小額累計（若屬臺銀共同供應契約可取消勾選）</label>
        </div>
      </div>
    `, `
      <button type="button" class="btn-danger" style="margin-right:auto" onclick="spExcludeProjectFromLedger('${h(projectId)}')">✕ 從小額台帳隱藏此案</button>
      <button type="button" onclick="closeModal()">取消</button>
      <button type="button" class="btn-primary" onclick="spSaveProjectTrackModal('${h(projectId)}')">💾 儲存設定</button>
    `);
  };

  window.spSaveProjectTrackModal = async function(projectId) {
    const p = (appData.tables.Projects || []).find(x => x.project_id === projectId);
    if (!p) return;
    const flg = {
      ...parseJSON(p.flags_json, {}),
      sec14_category: document.getElementById('sp-pm-cat')?.value || '其他庶務採購',
      green_track: document.getElementById('sp-pm-green')?.value || 'NONE',
      priority_track: document.getElementById('sp-pm-prio')?.value || 'NONE',
      count_in_sec14: !!document.getElementById('sp-pm-sec14')?.checked,
      exclude_from_sp_ledger: false
    };
    p.flags_json = JSON.stringify(flg);
    p.updated_at = nowStr();
    persistCache();
    closeModal();
    renderCurrentView();
    await pushToCloud({ action: 'upsert', table: 'Projects', record: p });
    toast('✅ 已更新此契約之 §14 與綠優採統計設定');
  };

  window.spExcludeProjectFromLedger = async function(projectId) {
    const p = (appData.tables.Projects || []).find(x => x.project_id === projectId);
    if (!p) return;
    const prevJson = p.flags_json;
    p.flags_json = JSON.stringify({ ...parseJSON(prevJson, {}), exclude_from_sp_ledger: true });
    p.updated_at = nowStr();
    persistCache();
    closeModal();
    renderCurrentView();
    await pushToCloud({ action: 'upsert', table: 'Projects', record: p });
    window.GA_CORE.pushUndoAction(`已從小額台帳隱藏「${String(p.project_name || '').slice(0, 14)}」`, async () => {
      p.flags_json = prevJson;
      p.updated_at = nowStr();
      persistCache();
      renderCurrentView();
      await pushToCloud({ action: 'upsert', table: 'Projects', record: p });
    });
  };

  window.exportStatutoryProcCSV = function(mode = 'ALL') {
    const stats = calcStatutoryProcurementStats(state.fiscalYear);
    let rows = stats.records;
    if (mode === 'GREEN') rows = rows.filter(r => r.green_track && r.green_track !== 'NONE');
    if (mode === 'PRIO') rows = rows.filter(r => r.priority_track && r.priority_track !== 'NONE');

    const header = ['年度', '季度', '請購/核銷日期(民國)', '品項名稱', '§14同性質分類', '廠商名稱', '金額', '計入§14小額', '綠色採購軌跡', '環保標章號', '優先採購軌跡', '傳票/動支單號', '資料來源'];
    const csvLines = [
      header.join(','),
      ...rows.map(r => [
        r.fiscal_year,
        r.quarter,
        roc(r.purchase_date),
        `"${String(r.item_title || '').replace(/"/g, '""')}"`,
        `"${String(r.category || '').replace(/"/g, '""')}"`,
        `"${String(r.vendor_name || '').replace(/"/g, '""')}"`,
        r.amount,
        r.count_in_sec14 !== false ? '是' : '否',
        GREEN_OPTIONS.find(o => o.value === r.green_track)?.short || '非指定',
        `"${String(r.green_mark_no || '').replace(/"/g, '""')}"`,
        PRIO_OPTIONS.find(o => o.value === r.priority_track)?.short || '非義務',
        `"${String(r.voucher_no || '').replace(/"/g, '""')}"`,
        r.source === 'PROJECT' ? '小額契約自動匯總' : '小額自記帳'
      ].join(','))
    ];
    const blob = new Blob(['\uFEFF' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `總務小額與綠優採對帳表_${state.fiscalYear}年度_${mode}.csv`;
    a.click();
    toast(`⬇️ 已匯出 ${rows.length} 筆對帳 CSV（可直接以 Excel 開啟核對申報網）`);
  };

  // --------------------------------------------------------------------------
  // 視圖渲染（100dvh 零外層捲動左右雙欄）
  // --------------------------------------------------------------------------
  function renderView(container) {
    const fyNow = new Date().getFullYear() - 1911;
    const years = [String(fyNow - 1), String(fyNow), String(fyNow + 1)];
    const st = calcStatutoryProcurementStats(state.fiscalYear);
    const microContractsCount = st.records.filter(r => r.source === 'PROJECT').length;

    let filtered = st.records.slice();
    if (state.quarter !== 'ALL') filtered = filtered.filter(r => r.quarter === state.quarter);
    if (state.filterTab === 'CONTRACTS') {
      filtered = filtered.filter(r => r.source === 'PROJECT');
    } else if (state.filterTab === 'SEC14') {
      const warnCats = new Set(st.catList.filter(c => c.sum >= 90000).map(c => c.category));
      filtered = filtered.filter(r => r.count_in_sec14 !== false && (warnCats.has(r.category) || r.amount >= 50000));
    } else if (state.filterTab === 'GREEN') {
      filtered = filtered.filter(r => r.green_track && r.green_track !== 'NONE');
    } else if (state.filterTab === 'PRIO') {
      filtered = filtered.filter(r => r.priority_track && r.priority_track !== 'NONE');
    }

    const pageSize = window.innerHeight < 720 ? 5 : 7;
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (state.page > totalPages) state.page = totalPages;
    const pageRows = filtered.slice((state.page - 1) * pageSize, state.page * pageSize);

    const editing = state.editingId
      ? window.GA_CORE.extStore.get(MOD_KEY, state.editingId)
      : null;

    container.innerHTML = `
      <div class="ga-split-shell" id="sp-module-root">
        <!-- 頂部：三軌法定安全尺規橫幅 -->
        <div class="sp-top-deck">
          <div class="sp-gauge-card tone-${st.topCat.tone}">
            <div class="sp-gauge-hd">
              <span>🛡️ §14 同性質累計（上限 15 萬）</span>
              <span class="tag tag-${st.topCat.tone === 'red' ? 'red' : st.topCat.tone === 'amber' ? 'amber' : 'green'}">${st.topCat.sum >= 150000 ? '達上限' : st.topCat.sum >= 120000 ? '80%警戒' : '安全額內'}</span>
            </div>
            <div class="sp-gauge-val num-mono">${fmtMoney(st.topCat.sum)} <small>/ 150,000 元（${st.topCat.rawPct}%）</small></div>
            <div class="sp-gauge-sub">最高：<strong>${h(st.topCat.category)}</strong>（餘 ${fmtMoney(st.topCat.remain)}｜共 ${st.microCount} 筆）</div>
          </div>

          <div class="sp-gauge-card tone-${st.greenPass ? 'green' : 'red'}">
            <div class="sp-gauge-hd">
              <span>🌿 綠色採購達成率（目標 ≥${st.greenTarget}%）</span>
              <span class="tag ${st.greenDenom === 0 ? 'tag-blue' : st.greenPass ? 'tag-green' : 'tag-red'}">${st.greenDenom === 0 ? '尚無指定品' : st.greenPass ? '法規達標 ✓' : '低於目標'}</span>
            </div>
            <div class="sp-gauge-val num-mono">${st.greenDenom === 0 ? '—' : `${st.greenPct}%`} <small>標章 ${fmtMoney(st.greenNumer)} / 指定分母 ${fmtMoney(st.greenDenom)}</small></div>
            <div class="sp-gauge-sub">${st.greenDenom === 0 ? '非指定品項自動排除於分母外，不影響達成率' : st.greenPass ? `已達 ${st.greenTarget}% 考核標準（專簽免計 ${st.greenExemptCount} 筆）` : `⚠️ 尚需採購環保標章指定品約 ${fmtMoney(st.greenNeedAdd)} 以拉回 ${st.greenTarget}%`}</div>
          </div>

          <div class="sp-gauge-card tone-${st.prioPass ? 'green' : 'amber'}">
            <div class="sp-gauge-hd">
              <span>🤝 身障優先採購（門檻 ≥${st.prioTarget}%）</span>
              <span class="tag ${st.prioDenom === 0 ? 'tag-blue' : st.prioPass ? 'tag-green' : 'tag-amber'}">${st.prioDenom === 0 ? '尚無義務品' : st.prioPass ? '已達 5% ✓' : '待補足 5%'}</span>
            </div>
            <div class="sp-gauge-val num-mono">${st.prioDenom === 0 ? '—' : `${st.prioPct}%`} <small>優採 ${fmtMoney(st.prioNumer)} / 義務分母 ${fmtMoney(st.prioDenom)}</small></div>
            <div class="sp-gauge-sub">${st.prioDenom === 0 ? '購買餐盒、印刷、清潔等義務品項請優先選用優採機構' : st.prioPass ? '已符合身心障礙者權益保障法 5% 義務比率' : `💡 <strong>尚差 ${fmtMoney(st.prioShortfallDirect)} 達標 5%</strong>（若新購優採機構品項需 ${fmtMoney(st.prioNeedNewPurchase)}）`}</div>
          </div>
        </div>

        <!-- 主體：左右雙欄同屏工作台 -->
        <div class="ga-split-body" style="grid-template-columns: minmax(0, 1.45fr) minmax(360px, 1fr)">
          <!-- 左欄：對帳篩選與高清晰分頁清單 -->
          <section class="panel ga-pane">
            <div class="panel-hd" style="gap:8px;flex-wrap:wrap">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <h3>🧾 ${h(state.fiscalYear)} 年度小額採購・開口維護・綠優採台帳</h3>
                <select aria-label="會計年度" onchange="spSetYear(this.value)" style="padding:4px 8px;border-radius:8px;border:1px solid var(--border-strong,#D6CBB9);font-weight:700;font-size:14px">
                  ${years.map(y => `<option value="${y}" ${y === state.fiscalYear ? 'selected' : ''}>${y} 年度</option>`).join('')}
                </select>
                <select aria-label="季度篩選" onchange="spSetQuarter(this.value)" style="padding:4px 8px;border-radius:8px;border:1px solid var(--border-strong,#D6CBB9);font-weight:700;font-size:14px">
                  <option value="ALL" ${state.quarter === 'ALL' ? 'selected' : ''}>全年 (Q1~Q4)</option>
                  ${['Q1', 'Q2', 'Q3', 'Q4'].map(q => `<option value="${q}" ${q === state.quarter ? 'selected' : ''}>${q} 季報</option>`).join('')}
                </select>
              </div>
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                <button type="button" class="btn-sm btn-primary" onclick="spOpenMicroProjectWizard()" title="建立如飲水機/電梯/清潔等 15 萬以下分期履約小額契約">＋ 開小額分期契約</button>
                <button type="button" class="btn-sm" onclick="exportStatutoryProcCSV('GREEN')">🌿 綠採CSV</button>
                <button type="button" class="btn-sm" onclick="exportStatutoryProcCSV('PRIO')">🤝 優採CSV</button>
              </div>
            </div>

            <div class="sp-filter-bar">
              <div class="sp-tabs">
                <button type="button" class="sp-tab ${state.filterTab === 'ALL' ? 'active' : ''}" onclick="spSetFilter('ALL')">全部小額 (${st.records.length})</button>
                <button type="button" class="sp-tab ${state.filterTab === 'CONTRACTS' ? 'active' : ''}" onclick="spSetFilter('CONTRACTS')">🔧 小額分期契約 (${microContractsCount})</button>
                <button type="button" class="sp-tab ${state.filterTab === 'SEC14' ? 'active' : ''}" onclick="spSetFilter('SEC14')">🛡️ §14 重點分類</button>
                <button type="button" class="sp-tab ${state.filterTab === 'GREEN' ? 'active' : ''}" onclick="spSetFilter('GREEN')">🌿 綠採指定品</button>
                <button type="button" class="sp-tab ${state.filterTab === 'PRIO' ? 'active' : ''}" onclick="spSetFilter('PRIO')">🤝 優採義務品</button>
              </div>
              <div class="sp-pager num-mono">
                <button type="button" class="btn-xs" ${state.page <= 1 ? 'disabled' : ''} onclick="spSetPage(${state.page - 1})">◀</button>
                <span>${state.page} / ${totalPages}</span>
                <button type="button" class="btn-xs" ${state.page >= totalPages ? 'disabled' : ''} onclick="spSetPage(${state.page + 1})">▶</button>
              </div>
            </div>

            <div class="ga-pane-scroll">
              ${pageRows.length ? `
                <table class="sp-table">
                  <thead>
                    <tr>
                      <th>日期</th>
                      <th>小額品項／維護契約</th>
                      <th>§14 分類</th>
                      <th>軌跡</th>
                      <th style="text-align:right">金額</th>
                      <th style="text-align:right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${pageRows.map(r => {
                      const gOpt = GREEN_OPTIONS.find(o => o.value === r.green_track);
                      const pOpt = PRIO_OPTIONS.find(o => o.value === r.priority_track);
                      return `
                        <tr>
                          <td class="num-mono" style="white-space:nowrap"><strong>${h(roc(r.purchase_date))}</strong><div class="item-meta">${h(r.quarter)}${r.voucher_no && r.voucher_no !== '小額免編號' ? '｜' + h(r.voucher_no) : ''}</div></td>
                          <td>
                            <div style="font-size:15.5px;font-weight:700;color:var(--text-primary,#1C1917)">${h(r.item_title)}</div>
                            <div class="item-meta">${h(r.vendor_name || '未填廠商')} ${r.source === 'PROJECT' ? '<span class="tag tag-blue">🔧 分期契約</span>' : ''} ${r.count_in_sec14 === false ? '<span class="tag tag-gray">免計§14</span>' : ''}</div>
                          </td>
                          <td style="white-space:nowrap"><span class="tag tag-gray">${h(r.category)}</span></td>
                          <td style="white-space:nowrap">
                            ${r.green_track && r.green_track !== 'NONE' ? `<span class="tag ${r.green_track === 'CERTIFIED' ? 'tag-green' : r.green_track === 'UNCERTIFIED' ? 'tag-red' : 'tag-gray'}">${h(gOpt?.short || '')}</span>` : ''}
                            ${r.priority_track && r.priority_track !== 'NONE' ? `<span class="tag ${r.priority_track === 'PRIORITY_ORG' ? 'tag-green' : 'tag-amber'}">${h(pOpt?.short || '')}</span>` : ''}
                            ${(!r.green_track || r.green_track === 'NONE') && (!r.priority_track || r.priority_track === 'NONE') ? '<span style="color:var(--text-muted,#57534E);font-size:13px">小額</span>' : ''}
                          </td>
                          <td class="num-mono" style="text-align:right;white-space:nowrap;font-size:15.5px;font-weight:800">${fmtMoney(r.amount)}</td>
                          <td style="text-align:right;white-space:nowrap">
                            ${r.source === 'PROJECT'
                              ? `<button type="button" class="btn-xs btn-primary" onclick="openProjectDetail('${h(r.linked_project_id)}')">檢核</button>
                                 <button type="button" class="btn-xs" title="設定分類、排除 §14 或從此表隱藏" onclick="spOpenProjectTrackModal('${h(r.linked_project_id)}')">✎</button>`
                              : `<button type="button" class="btn-xs" onclick="spEditRecord('${h(r.id)}')">✎</button>
                                 <button type="button" class="btn-xs" onclick="spDeleteRecord('${h(r.id)}','${h(r.item_title)}')">刪</button>`}
                          </td>
                        </tr>`;
                    }).join('')}
                  </tbody>
                </table>
              ` : `
                <div class="empty-state" style="padding:28px 16px">
                  <div style="font-size:16px;font-weight:700;color:var(--text-primary,#1C1917);margin-bottom:6px">尚無符合條件之小額採購紀錄（上網招標案已分流至「🏛️ 招標採購履約」）</div>
                  <div>日常單筆小額請於右側直接記帳；若為按月／按季分期核銷之小額契約（如飲水機保養），可點右上「＋ 開小額分期契約」！</div>
                </div>
              `}
            </div>
          </section>

          <!-- 右欄：快速登錄（含即時試算） ↔ §14 九大分類累計尺規 -->
          <section class="panel ga-pane">
            <div class="panel-hd">
              <div class="sp-tabs">
                <button type="button" class="sp-tab ${state.rightMode === 'FORM' ? 'active' : ''}" onclick="spSetRightMode('FORM')">${editing ? '✎ 編輯紀錄' : '＋ 記一筆小額／綠優採'}</button>
                <button type="button" class="sp-tab ${state.rightMode === 'SEC14_BARS' ? 'active' : ''}" onclick="spSetRightMode('SEC14_BARS')">📊 §14 九大分類尺規</button>
              </div>
              ${editing ? `<button type="button" class="btn-xs" onclick="spEditRecord('')">取消編輯</button>` : ''}
            </div>

            <div class="ga-pane-scroll" style="padding:12px 14px">
              ${state.rightMode === 'SEC14_BARS' ? `
                <div style="display:flex;flex-direction:column;gap:10px">
                  <div class="item-meta" style="font-size:13.5px">依《政府採購法》第 14 條，機關不得意圖規避本法之適用而分批辦理公告金額十分之一（15 萬元）以下之同性質採購：</div>
                  ${st.catList.map(c => `
                    <div style="padding:9px 12px;border:1px solid var(--border-subtle,#E7DFD3);border-radius:10px;background:#fff">
                      <div style="display:flex;justify-content:space-between;align-items:center;font-size:15px;font-weight:700">
                        <span>${h(c.category)}</span>
                        <span class="num-mono" style="color:${c.tone === 'red' ? '#DC2626' : c.tone === 'amber' ? '#B45309' : '#1C1917'}">${fmtMoney(c.sum)} / 150,000 元（${c.rawPct}%）</span>
                      </div>
                      <div class="mini-bar-wrap" style="height:9px;margin-top:6px">
                        <div class="mini-bar" style="width:${c.pct}%;background:${c.tone === 'red' ? '#DC2626' : c.tone === 'amber' ? '#D97706' : '#0D9488'}"></div>
                      </div>
                    </div>
                  `).join('')}
                </div>
              ` : `
                <div id="sp-live-sim-banner" class="sp-sim-box">
                  💡 輸入金額並選擇綠採／優採屬性後，即時預估入帳後之全校達成率與 §14 剩餘額度。
                </div>
                <div class="form-grid" style="margin-top:10px">
                  <div class="field full">
                    <label>採購品項／動支事由 *</label>
                    <input id="sp-f-title" type="text" value="${h(editing?.item_title || '')}" placeholder="例：辦公室影印紙與環保碳粉匣、校慶志工餐盒">
                  </div>
                  <div class="field">
                    <label>核銷／決標金額 (元) *</label>
                    <input id="sp-f-amount" type="number" min="1" value="${h(editing?.amount || '')}" placeholder="例：28500" oninput="spUpdateSimPreview()">
                  </div>
                  <div class="field">
                    <label>請購或核銷日期（支援民國如 115/11/26）</label>
                    <input id="sp-f-date" type="text" value="${h(editing ? roc(editing.purchase_date) : roc(typeof todayStr === 'function' ? todayStr() : '2026-11-26'))}" placeholder="115/11/26">
                  </div>
                  <div class="field">
                    <label>🛡️ 採購法 §14 同性質分類</label>
                    <select id="sp-f-category" onchange="spUpdateSimPreview()">
                      ${CATEGORIES.map(c => `<option value="${h(c)}" ${editing?.category === c ? 'selected' : ''}>${h(c)}</option>`).join('')}
                    </select>
                  </div>
                  <div class="field">
                    <label>廠商名稱</label>
                    <input id="sp-f-vendor" type="text" value="${h(editing?.vendor_name || '')}" placeholder="例：○○庇護工場／○○水電行">
                  </div>
                  <div class="field full">
                    <label>🌿 綠色採購法定統計軌跡（僅環境部指定品項進分母）</label>
                    <select id="sp-f-green" onchange="spUpdateSimPreview()">
                      ${GREEN_OPTIONS.map(o => `<option value="${o.value}" ${(editing?.green_track || 'NONE') === o.value ? 'selected' : ''}>${h(o.label)}</option>`).join('')}
                    </select>
                  </div>
                  <div class="field full">
                    <label>🤝 身心障礙優先採購統計軌跡（餐盒／印刷／清潔／禮品等義務品項進分母）</label>
                    <select id="sp-f-prio" onchange="spUpdateSimPreview()">
                      ${PRIO_OPTIONS.map(o => `<option value="${o.value}" ${(editing?.priority_track || 'NONE') === o.value ? 'selected' : ''}>${h(o.label)}</option>`).join('')}
                    </select>
                  </div>
                  <div class="field">
                    <label>環保標章字號（選填）</label>
                    <input id="sp-f-green-no" type="text" value="${h(editing?.green_mark_no || '')}" placeholder="例：環保標章第 12345 號">
                  </div>
                  <div class="field">
                    <label>動支單號／傳票號（選填）</label>
                    <input id="sp-f-voucher" type="text" value="${h(editing?.voucher_no || '')}" placeholder="例：115-動-082">
                  </div>
                  <div class="field full" style="flex-direction:row;align-items:center;gap:8px">
                    <input id="sp-f-sec14" type="checkbox" ${editing?.count_in_sec14 === false ? '' : 'checked'} style="width:18px;height:18px">
                    <label for="sp-f-sec14" style="font-size:14px;margin:0;cursor:pointer">計入採購法 §14 年度小額同性質累計（共同供應契約下訂可取消勾選）</label>
                  </div>
                </div>
                <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px">
                  <button type="button" class="btn-primary" onclick="spSaveRecord()">💾 ${editing ? '更新紀錄並重算比率' : '儲存並計入三軌指標'}</button>
                </div>
              `}
            </div>
          </section>
        </div>
      </div>
    `;
  }

  // 註冊至 GA_CORE 插槽中心
  window.GA_CORE.registerModule({
    id: 'statutory-proc',
    title: '小額・綠優採',
    navGroup: 'procurement',
    icon: '🧾',
    version: 'v2.0',
    getSummaryTile() {
      const st = calcStatutoryProcurementStats();
      const redCount = (st.sec14DangerCount > 0 ? 1 : 0) + (!st.greenPass && st.greenDenom > 0 ? 1 : 0);
      const amberCount = (st.sec14WarnCount > 0 ? 1 : 0) + (!st.prioPass && st.prioDenom > 0 ? 1 : 0);
      const gTxt = st.greenDenom > 0 ? `綠採 ${st.greenPct}%` : '綠採待登錄';
      const pTxt = st.prioDenom > 0
        ? (st.prioPass ? `優採 ${st.prioPct}%✓` : `優採差 ${Number(st.prioShortfallDirect).toLocaleString('zh-TW')}元`)
        : '優採待登錄';
      return {
        id: 'statutory-proc',
        icon: '🧾',
        title: '小額・綠優採',
        kpi: st.greenDenom > 0 ? `${st.greenPct}%` : `${st.microCount}`,
        unit: st.greenDenom > 0 ? '綠採達成' : '筆小額列管',
        tone: redCount > 0 ? 'red' : amberCount > 0 ? 'amber' : 'teal',
        redCount,
        amberCount,
        subText: `${gTxt}｜${pTxt}｜§14最高 ${Math.round(st.topCat.sum / 1000)}k`
      };
    },
    getAlerts(data, today) {
      const st = calcStatutoryProcurementStats();
      const alerts = [];
      if (st.topCat.sum >= 120000) {
        alerts.push({
          level: st.topCat.sum >= 150000 ? 'red' : 'amber',
          badge: '小額§14預警',
          title: `小額同性質「${st.topCat.category}」已累計 ${fmtMoney(st.topCat.sum)}`,
          dueDate: `${new Date().getFullYear()}-12-31`,
          actionHint: st.topCat.sum >= 150000 ? '已達 15 萬上限，後續同性質需求請改採公開取得報價單' : `剩餘安全額度 ${fmtMoney(st.topCat.remain)}，請留意勿分批拆單`,
          action: () => switchTab('statutory-proc')
        });
      }
      if (st.greenDenom > 0 && !st.greenPass) {
        alerts.push({
          level: 'red',
          badge: '綠採未達標',
          title: `年度綠色採購達成率 ${st.greenPct}%（低於法定 ${st.greenTarget}%）`,
          dueDate: `${new Date().getFullYear()}-12-20`,
          actionHint: `尚需補購具環保標章指定品約 ${fmtMoney(st.greenNeedAdd)} 或檢視是否漏辦不統計專簽`,
          action: () => switchTab('statutory-proc')
        });
      }
      if (st.prioDenom > 0 && !st.prioPass) {
        alerts.push({
          level: 'amber',
          badge: '優採差額提醒',
          title: `年度優先採購比率 ${st.prioPct}%（尚差 ${fmtMoney(st.prioShortfallDirect)} 達標 5%）`,
          dueDate: `${new Date().getFullYear()}-12-20`,
          actionHint: `建議後續餐盒、印刷或清潔用品優先向合格庇護工場採購約 ${fmtMoney(st.prioNeedNewPurchase)}`,
          action: () => switchTab('statutory-proc')
        });
      }
      return alerts;
    },
    renderView
  });
})();
