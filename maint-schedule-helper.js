/**
 * ============================================================================
 * 學校總務行政助理 — 保養／分期合約自動排期與手動微調模組 (maint-schedule-helper.js)
 * 功能：
 * 1. 智慧平均推估演算法 (computeEvenInstallmentSchedule)：
 *    - 只要提供「契約起迄期間」與「期數」，自動精準推估每一期起迄日與預估請款金額
 *    - 若屬整月／整年度且可整除（如 1/1~12/31 分 4/6/12 期），自動按自然月／季對齊月底
 *    - 其餘任意日期區間則按總天數精準平均切分（相鄰兩期天數差不超過 1 天，無縫銜接）
 * 2. 開新採購精靈整合：
 *    - 勾選「年度保養／分期履約契約」時自動帶入預設 1 年迄日（另提供 半年／1年／2年 快捷鍵）
 *    - 即時展開「各期推估日期預覽＆手動微調表」，任何一期皆可先改日期再建立標案
 *    - 可勾選「同步預先建立各期分期請款草稿」，省去逐期手填之繁瑣
 * 3. 既有標案詳情頁升級：
 *    - 工具列新增「📅 各期日期自動推估／批次調整」視窗：隨時重算或一次批次微調所有期程
 *    - 分期付款頁籤新增「⚡ 一鍵產生各期請款排程」，依契約期間與金額自動平均帶入各期
 * ============================================================================
 */

(function initMaintScheduleHelper() {
  // --------------------------------------------------------------------------
  // 0. 樣式注入（支援淺色與深炭暖金主題）
  // --------------------------------------------------------------------------
  const st = document.createElement('style');
  st.id = 'maint-schedule-helper-style';
  st.textContent = `
    .msh-quick-dur {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      flex-wrap: wrap;
      margin-top: 4px;
    }
    .msh-chip {
      min-height: 26px !important;
      padding: 2px 9px !important;
      font-size: 12px !important;
      border-radius: 999px !important;
      border: 1px solid #CBD5E1 !important;
      background: #FFFFFF !important;
      color: #334155 !important;
      font-weight: 600 !important;
      cursor: pointer;
    }
    .msh-chip:hover {
      border-color: var(--primary, #1E3A5F) !important;
      color: var(--primary, #1E3A5F) !important;
      background: var(--primary-soft, #EFF4F9) !important;
    }
    .msh-preview-wrap {
      margin-top: 8px;
      background: #FFFFFF;
      border: 1px solid #CBD5E1;
      border-radius: 9px;
      overflow: hidden;
    }
    .msh-preview-hd {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
      padding: 7px 10px;
      background: #F8FAFC;
      border-bottom: 1px solid #E2E8F0;
      font-size: 12px;
      font-weight: 700;
      color: #1E293B;
    }
    .msh-preview-body {
      max-height: 220px;
      overflow-y: auto;
      padding: 6px 10px;
    }
    .msh-row {
      display: grid;
      grid-template-columns: 62px 1fr 16px 1fr 92px;
      gap: 6px;
      align-items: center;
      padding: 4px 0;
      border-bottom: 1px solid #F1F5F9;
      font-size: 12px;
    }
    .msh-row:last-child { border-bottom: none; }
    .msh-row input[type="date"] {
      padding: 4px 6px !important;
      border: 1px solid #CBD5E1;
      border-radius: 6px;
      font-size: 12px;
      width: 100%;
    }
    .msh-roc-tag {
      font-size: 12px;
      color: #64748B;
      text-align: right;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    .msh-badge-mode {
      font-size: 12px;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: 99px;
      background: #EFF4F9;
      color: #1E3A5F;
    }
    .msh-batch-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12.5px;
    }
    .msh-batch-table th, .msh-batch-table td {
      padding: 6px 8px;
      border-bottom: 1px solid #E2E8F0;
    }
    .msh-batch-table input[type="date"],
    .msh-batch-table input[type="text"] {
      padding: 4px 7px;
      border: 1px solid #CBD5E1;
      border-radius: 6px;
      font-size: 12px;
      width: 100%;
    }
    .msh-import-textarea {
      width: 100%;
      min-height: 145px;
      padding: 8px 10px;
      border: 1px solid #CBD5E1;
      border-radius: 8px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      line-height: 1.45;
      resize: vertical;
      background: #F8FAFC;
      color: #0F172A;
    }
    .msh-diff-box {
      margin-top: 10px;
      border: 1px solid #CBD5E1;
      border-radius: 9px;
      overflow: hidden;
      background: #FFFFFF;
    }
    .msh-diff-hd {
      padding: 8px 12px;
      background: #EFF4F9;
      border-bottom: 1px solid #CBD5E1;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      font-weight: 700;
      font-size: 12.5px;
      color: #1E3A5F;
    }
    .msh-diff-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    .msh-diff-table th, .msh-diff-table td {
      padding: 6px 9px;
      border-bottom: 1px solid #E2E8F0;
      vertical-align: top;
    }
    .msh-diff-table th {
      background: #F8FAFC;
      font-weight: 700;
      color: #475569;
    }
    .msh-diff-changed {
      background: #FFFBEB;
    }
    .msh-diff-old {
      color: #94A3B8;
      text-decoration: line-through;
      margin-right: 4px;
    }
    .msh-diff-new {
      color: #0F766E;
      font-weight: 700;
    }
    .msh-check-pill {
      display: inline-block;
      margin: 2px 4px 0 0;
      padding: 1px 6px;
      border-radius: 4px;
      font-size: 12px;
      background: #FEF3C7;
      color: #92400E;
      font-weight: 600;
    }
    .msh-routine-box {
      margin-top: 10px;
      padding: 9px 12px;
      border: 1px solid #BFDBFE;
      border-radius: 8px;
      background: #EFF6FF;
      font-size: 12px;
    }
    body[data-nordic-theme="obsidian"] .msh-preview-wrap,
    body[data-nordic-theme="obsidian"] .msh-diff-box {
      background: #1C1F26 !important;
      border-color: #323846 !important;
    }
    body[data-nordic-theme="obsidian"] .msh-preview-hd,
    body[data-nordic-theme="obsidian"] .msh-diff-hd {
      background: #232731 !important;
      border-color: #323846 !important;
      color: #F3F4F6 !important;
    }
    body[data-nordic-theme="obsidian"] .msh-diff-table th {
      background: #232731 !important;
      color: #CBD5E1 !important;
      border-color: #323846 !important;
    }
    body[data-nordic-theme="obsidian"] .msh-diff-table td {
      border-color: #2A2F3A !important;
      color: #E5E7EB !important;
    }
    body[data-nordic-theme="obsidian"] .msh-diff-changed {
      background: rgba(217, 119, 6, 0.14) !important;
    }
    body[data-nordic-theme="obsidian"] .msh-diff-new {
      color: #34D399 !important;
    }
    body[data-nordic-theme="obsidian"] .msh-import-textarea {
      background: #15181E !important;
      border-color: #373E4E !important;
      color: #F3F4F6 !important;
    }
    body[data-nordic-theme="obsidian"] .msh-routine-box {
      background: #1E293B !important;
      border-color: #334155 !important;
      color: #E2E8F0 !important;
    }
    body[data-nordic-theme="obsidian"] .msh-row { border-color: #2A2F3A !important; }
    body[data-nordic-theme="obsidian"] .msh-chip {
      background: #262B36 !important;
      border-color: #373E4E !important;
      color: #E5E7EB !important;
    }
    @media (max-width: 640px) {
      .msh-row { grid-template-columns: 52px 1fr 12px 1fr; }
      .msh-roc-tag { display: none; }
    }
  `;
  document.head.appendChild(st);

  // --------------------------------------------------------------------------
  // 1. 核心日期與金額平均推估引擎（純函式、冪等、邊界安全）
  // --------------------------------------------------------------------------
  function mshLastDayOfMonth(y, m1) {
    return new Date(y, m1, 0).getDate();
  }

  function mshFormatYmd(y, m1, d) {
    return `${y}-${String(m1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  function mshAddMonthsMinusOneDay(startYmd, months) {
    if (!startYmd || !/^\d{4}-\d{2}-\d{2}$/.test(startYmd)) return addDays(todayStr(), 364);
    const [sy, sm, sd] = startYmd.split('-').map(Number);
    const targetMonthIndex = (sm - 1) + months;
    const ey = sy + Math.floor(targetMonthIndex / 12);
    const em = (targetMonthIndex % 12) + 1;
    const maxD = mshLastDayOfMonth(ey, em);
    const nextAnniv = mshFormatYmd(ey, em, Math.min(sd, maxD));
    return addDays(nextAnniv, -1);
  }

  function mshFmtShortRoc(ymd) {
    if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return '-';
    const [y, m, d] = ymd.split('-');
    return `${Number(y) - 1911}/${m}/${d}`;
  }

  function splitAmountEvenly(totalAmount, periods) {
    const n = Math.max(1, parseInt(periods, 10) || 1);
    const tot = Math.max(0, Math.round(Number(totalAmount) || 0));
    if (!tot) return Array.from({ length: n }, () => 0);
    const base = Math.floor(tot / n);
    const rem = tot - base * n;
    return Array.from({ length: n }, (_, idx) => (idx === n - 1 ? base + rem : base));
  }

  /**
   * 依契約起迄期間與期數，智慧平均推估各期開始日與結束／請款日
   * mode: 'auto' | 'calendar' | 'even'
   */
  function computeEvenInstallmentSchedule(startYmd, endYmd, periods, mode = 'auto') {
    const n = Math.max(1, Math.min(24, parseInt(periods, 10) || 4));
    const baseStart = (startYmd && /^\d{4}-\d{2}-\d{2}$/.test(startYmd)) ? startYmd : todayStr();
    const baseEnd = (endYmd && /^\d{4}-\d{2}-\d{2}$/.test(endYmd) && diffDays(baseStart, endYmd) >= n - 1)
      ? endYmd
      : mshAddMonthsMinusOneDay(baseStart, 12);

    const [sy, sm, sd] = baseStart.split('-').map(Number);
    const [ey, em, ed] = baseEnd.split('-').map(Number);
    const totalMonths = (ey - sy) * 12 + (em - sm) + 1;
    const isWholeMonthSpan = (sd === 1) && (ed === mshLastDayOfMonth(ey, em)) && totalMonths > 0 && (totalMonths % n === 0);

    const useCalendar = (mode === 'calendar' && totalMonths > 0 && (totalMonths % n === 0))
      || (mode === 'auto' && isWholeMonthSpan);

    const out = [];
    if (useCalendar) {
      const stepM = totalMonths / n;
      for (let i = 0; i < n; i++) {
        const mStartIdx = (sm - 1) + i * stepM;
        const pSy = sy + Math.floor(mStartIdx / 12);
        const pSm = (mStartIdx % 12) + 1;
        const pStart = (i === 0) ? baseStart : mshFormatYmd(pSy, pSm, 1);

        const mEndIdx = (sm - 1) + (i + 1) * stepM - 1;
        const pEy = sy + Math.floor(mEndIdx / 12);
        const pEm = (mEndIdx % 12) + 1;
        const pEnd = (i === n - 1) ? baseEnd : mshFormatYmd(pEy, pEm, mshLastDayOfMonth(pEy, pEm));

        out.push({ period: i + 1, plan_start: pStart, plan_end: pEnd, modeUsed: 'calendar' });
      }
      return out;
    }

    // 任意期間按總天數精準平均插值（保證無縫銜接、無重複、最後一期精準對齊迄日）
    const inclusiveDays = Math.max(n, diffDays(baseStart, baseEnd) + 1);
    for (let i = 0; i < n; i++) {
      const offStart = Math.round((inclusiveDays * i) / n);
      const nextOffStart = Math.round((inclusiveDays * (i + 1)) / n);
      const offEnd = (i === n - 1) ? (inclusiveDays - 1) : Math.max(offStart, nextOffStart - 1);
      const pStart = addDays(baseStart, offStart);
      const pEnd = (i === n - 1) ? baseEnd : addDays(baseStart, offEnd);
      out.push({ period: i + 1, plan_start: pStart, plan_end: pEnd, modeUsed: 'even' });
    }
    return out;
  }

  window.computeEvenInstallmentSchedule = computeEvenInstallmentSchedule;
  window.splitAmountEvenly = splitAmountEvenly;

  // --------------------------------------------------------------------------
  // 2. 升級開案精靈：自動帶入迄日 ＋ 即時推估各期日期預覽與手動微調 ＋ 同步產生請款草稿
  // --------------------------------------------------------------------------
  let wizCustomSchedule = null; // 使用者在精靈預覽表手動改過的各期日期
  let wizSplitMode = 'auto';

  window.mshApplyQuickDuration = function(months) {
    const startEl = document.getElementById('wiz-start');
    const endEl = document.getElementById('wiz-end');
    if (!startEl || !endEl) return;
    if (!startEl.value) startEl.value = todayStr();
    endEl.value = mshAddMonthsMinusOneDay(startEl.value, months);
    endEl.dispatchEvent(new Event('change'));
    wizCustomSchedule = null;
    refreshWizardMaintPreview();
  };

  window.mshResetWizardMaintDates = function() {
    wizCustomSchedule = null;
    refreshWizardMaintPreview();
    if (typeof toast === 'function') toast('↺ 已重新平均推估各期日期');
  };

  window.mshChangeWizardSplitMode = function(mode) {
    wizSplitMode = mode;
    wizCustomSchedule = null;
    refreshWizardMaintPreview();
  };

  window.mshOnWizardRowDateEdit = function(idx, field, val) {
    if (!Array.isArray(wizCustomSchedule)) return;
    if (wizCustomSchedule[idx]) {
      wizCustomSchedule[idx][field] = val;
      const rocEl = document.getElementById(`msh-wroc-${idx}`);
      if (rocEl) rocEl.textContent = mshFmtShortRoc(wizCustomSchedule[idx].plan_end);
    }
  };

  function ensureWizardMaintPreviewUI() {
    const box = document.querySelector('#modal-body .maint-box');
    if (!box || document.getElementById('msh-wizard-extra')) return;

    const wrap = document.createElement('div');
    wrap.id = 'msh-wizard-extra';
    wrap.style.display = 'none';
    wrap.innerHTML = `
      <div class="msh-quick-dur">
        <span style="font-size:12px;color:#334155;font-weight:600">快速帶入契約期間：</span>
        <button type="button" class="msh-chip" onclick="mshApplyQuickDuration(6)">半年 (6個月)</button>
        <button type="button" class="msh-chip" onclick="mshApplyQuickDuration(12)">1 年 (12個月)</button>
        <button type="button" class="msh-chip" onclick="mshApplyQuickDuration(24)">2 年 (24個月)</button>
        <select id="msh-split-mode" style="padding:3px 7px;border:1px solid #CBD5E1;border-radius:6px;font-size:12px;margin-left:auto" onchange="mshChangeWizardSplitMode(this.value)">
          <option value="auto">自動智慧切分（整月對齊月底）</option>
          <option value="even">純平均天數切分</option>
        </select>
      </div>
      <div id="msh-preview-wrap" class="msh-preview-wrap"></div>
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#1E3A5F;font-weight:600;margin-top:6px;cursor:pointer">
        <input type="checkbox" id="msh-auto-billings" checked>
        ⚡ 開案同時自動建立各期「分期付款請款排程草稿」（平均分攤金額，後續可逐期修改）
      </label>
    `;
    box.appendChild(wrap);

    // 綁定起迄日、預算、期數變更時自動更新預覽
    ['wiz-start', 'wiz-end', 'wiz-budget', 'maint-freq', 'maint-custom-n'].forEach(id => {
      const el = document.getElementById(id);
      if (!el || el.dataset.mshBound) return;
      el.dataset.mshBound = '1';
      el.addEventListener('change', () => { wizCustomSchedule = null; refreshWizardMaintPreview(); });
      el.addEventListener('input', () => {
        if (id === 'wiz-budget' || id === 'maint-custom-n') {
          if (id === 'maint-custom-n') wizCustomSchedule = null;
          refreshWizardMaintPreview();
        }
      });
    });
  }

  function refreshWizardMaintPreview() {
    ensureWizardMaintPreviewUI();
    const isMaint = !!document.getElementById('flg-maint')?.checked;
    const extra = document.getElementById('msh-wizard-extra');
    if (!extra) return;
    extra.style.display = isMaint ? 'block' : 'none';
    if (!isMaint) return;

    const startEl = document.getElementById('wiz-start');
    const endEl = document.getElementById('wiz-end');
    if (startEl && !startEl.value) startEl.value = todayStr();
    if (startEl && endEl && !endEl.value) {
      endEl.value = mshAddMonthsMinusOneDay(startEl.value, 12);
      endEl.dispatchEvent(new Event('change'));
    }

    const periods = typeof getMaintPeriodCount === 'function' ? getMaintPeriodCount() : 4;
    const budget = Number(document.getElementById('wiz-budget')?.value) || 0;
    const startVal = startEl?.value || todayStr();
    const endVal = endEl?.value || mshAddMonthsMinusOneDay(startVal, 12);

    if (!Array.isArray(wizCustomSchedule) || wizCustomSchedule.length !== periods) {
      wizCustomSchedule = computeEvenInstallmentSchedule(startVal, endVal, periods, wizSplitMode);
    }
    const amts = splitAmountEvenly(budget, periods);
    const modeLabel = wizCustomSchedule[0]?.modeUsed === 'calendar' ? '自然月／季對齊' : '平均天數推估';

    const wrap = document.getElementById('msh-preview-wrap');
    if (!wrap) return;
    wrap.innerHTML = `
      <div class="msh-preview-hd">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span>📅 自動推估 ${periods} 期保養排程（可直接手動微調）</span>
          <span class="msh-badge-mode">${modeLabel}</span>
        </div>
        <button type="button" class="msh-chip" onclick="mshResetWizardMaintDates()">↺ 重算平均日期</button>
      </div>
      <div class="msh-preview-body">
        ${wizCustomSchedule.map((row, idx) => `
          <div class="msh-row">
            <strong>第 ${row.period} 期</strong>
            <input type="date" value="${esc(row.plan_start)}" aria-label="第${row.period}期開始日" onchange="mshOnWizardRowDateEdit(${idx},'plan_start',this.value)">
            <span style="text-align:center;color:#94A3B8">~</span>
            <input type="date" value="${esc(row.plan_end)}" aria-label="第${row.period}期結束日" onchange="mshOnWizardRowDateEdit(${idx},'plan_end',this.value)">
            <span class="msh-roc-tag" id="msh-wroc-${idx}">${amts[idx] ? `$${amts[idx].toLocaleString('zh-TW')}` : mshFmtShortRoc(row.plan_end)}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  // 掛載至 openProjectWizard 與 toggleMaintOptionsUI
  const _prevOpenWizard_msh = openProjectWizard;
  openProjectWizard = function(presetTemplateId = '', presetName = '', sourceMemoId = '') {
    wizCustomSchedule = null;
    wizSplitMode = 'auto';
    _prevOpenWizard_msh(presetTemplateId, presetName, sourceMemoId);
    ensureWizardMaintPreviewUI();
    refreshWizardMaintPreview();
  };

  const _prevToggleMaint_msh = toggleMaintOptionsUI;
  toggleMaintOptionsUI = function() {
    _prevToggleMaint_msh();
    const isMaint = !!document.getElementById('flg-maint')?.checked;
    if (isMaint) {
      const startEl = document.getElementById('wiz-start');
      const endEl = document.getElementById('wiz-end');
      if (startEl && !startEl.value) startEl.value = todayStr();
      if (startEl && endEl && !endEl.value) {
        endEl.value = mshAddMonthsMinusOneDay(startEl.value, 12);
        endEl.dispatchEvent(new Event('change'));
      }
    }
    wizCustomSchedule = null;
    refreshWizardMaintPreview();
    if (isMaint) {
      setTimeout(() => {
        document.getElementById('msh-wizard-extra')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 40);
    }
  };

  // 升級 buildStandardStages：使用精準平均／自然月切分演算法（並優先尊重精靈內手動微調日期）
  const _prevBuildStages_msh = buildStandardStages;
  buildStandardStages = function(opts) {
    const maintMeta = window._pendingMaintMeta || {};
    const isMaint = Boolean(maintMeta.is_maintenance || (opts && opts.flags && opts.flags.is_maintenance));
    if (!isMaint) return _prevBuildStages_msh(opts);

    const periods = maintMeta.maint_periods || (opts.flags && opts.flags.maint_periods) || 4;
    const tier = opts.tier || '小額(15萬以下)';
    const baseStart = opts.startDate || todayStr();
    const baseEnd = (opts.endDate && diffDays(baseStart, opts.endDate) >= Math.max(1, periods - 1))
      ? opts.endDate
      : mshAddMonthsMinusOneDay(baseStart, 12);

    const custom = Array.isArray(window._pendingMaintCustomSchedule) && window._pendingMaintCustomSchedule.length === periods
      ? window._pendingMaintCustomSchedule
      : computeEvenInstallmentSchedule(baseStart, baseEnd, periods, 'auto');

    const stages = [{
      stage_order: 1,
      stage_name: tier === '小額(15萬以下)' ? '簽辦動支與逕洽訂約' : '招標決標與契約簽訂',
      plan_start: addDays(custom[0].plan_start, -10),
      plan_end: addDays(custom[0].plan_start, -1),
      actual_start: '', actual_end: '', sla_deadline: '', blocker_note: '', status: '進行中',
      checklist_json: JSON.stringify([
        { id: 'm_init_1', text: '確認全年度累計總價未規避採購法分批辦理（§14），完成請購／動支簽核', required: true, done: false, doc_no: '', done_date: '' },
        { id: 'm_init_2', text: '核對報價單／維護契約條款（含保養頻率、叫修時效、零件計價與分期請款條件）', required: true, done: false, doc_no: '', done_date: '' },
        { id: 'm_init_3', text: '完成契約簽署或下訂通知，確認首期進場保養時間', required: true, done: false, doc_no: '', done_date: '' }
      ])
    }];

    custom.forEach((slot, idx) => {
      const i = idx + 1;
      const pStart = slot.plan_start;
      const pEnd = slot.plan_end >= pStart ? slot.plan_end : pStart;
      stages.push({
        stage_order: i + 1,
        stage_name: `第 ${i} 期履約保養與分期核銷`,
        plan_start: pStart,
        plan_end: pEnd,
        actual_start: '', actual_end: '', sla_deadline: pEnd, blocker_note: '', status: '未開始',
        checklist_json: JSON.stringify([
          { id: `m_p${i}_1`, text: `廠商完成第 ${i} 期現場保養／維護作業並留存紀錄表與照片`, required: true, done: false, doc_no: '', done_date: '' },
          { id: `m_p${i}_2`, text: `確認設備運轉正常並核對第 ${i} 期發票／收據金額無誤`, required: true, done: false, doc_no: '', done_date: '' },
          { id: `m_p${i}_3`, text: `完成第 ${i} 期驗收簽章，並於「💰 分期付款」頁籤登錄主計核銷撥款`, required: true, done: false, doc_no: '', done_date: '' }
        ])
      });
    });
    return stages;
  };

  // 掛載 submitNewProject：帶入精靈微調日期，並在勾選時自動建立各期分期請款草稿
  const _prevSubmitProject_msh = submitNewProject;
  submitNewProject = async function() {
    const isMaint = !!document.getElementById('flg-maint')?.checked;
    const wantAutoBillings = isMaint && !!document.getElementById('msh-auto-billings')?.checked;
    window._pendingMaintCustomSchedule = (isMaint && Array.isArray(wizCustomSchedule))
      ? wizCustomSchedule.map(x => ({ ...x }))
      : null;

    await _prevSubmitProject_msh();

    const createdId = selectedProjectId;
    const usedSchedule = window._pendingMaintCustomSchedule;
    window._pendingMaintCustomSchedule = null;

    if (wantAutoBillings && createdId) {
      const p = (appData.tables.Projects || []).find(x => x.project_id === createdId);
      if (p) {
        await generateInstallmentBillingsForProject(p, usedSchedule, true);
      }
    }
  };

  // --------------------------------------------------------------------------
  // 3. 批次產生各期「分期付款請款草稿」（平均金額＋預計日期，跳過已有期別）
  // --------------------------------------------------------------------------
  async function generateInstallmentBillingsForProject(p, scheduleOverride = null, silentIfEmpty = false) {
    if (!p) return 0;
    const flg = parseJSON(p.flags_json, {});
    const tasks = getProjectTasks(p.project_id);
    const maintTasks = tasks.filter(t => /第\s*\d+\s*期/.test(String(t.stage_name || '')));
    const periods = Number(flg.maint_periods) || maintTasks.length || 4;
    const startDate = p.start_date || maintTasks[0]?.plan_start || todayStr();
    const endDate = p.orig_end_date || maintTasks[maintTasks.length - 1]?.plan_end || mshAddMonthsMinusOneDay(startDate, 12);

    const schedule = (Array.isArray(scheduleOverride) && scheduleOverride.length)
      ? scheduleOverride
      : (maintTasks.length === periods
          ? maintTasks.map((t, idx) => ({ period: idx + 1, plan_start: t.plan_start, plan_end: t.plan_end }))
          : computeEvenInstallmentSchedule(startDate, endDate, periods, 'auto'));

    const existing = (appData.tables.Project_Billings || []).filter(b => b.project_id === p.project_id);
    const existingSeqs = new Set(existing.map(b => String(b.billing_seq || '').trim()));
    const contractAmt = Number(p.award_amount) || Number(p.budget_amount) || 0;
    const amts = splitAmountEvenly(contractAmt, schedule.length);

    let seqBase = 0;
    (appData.tables.Project_Billings || []).forEach(r => {
      const m = String(r.billing_id || '').match(/(\d+)$/);
      if (m) seqBase = Math.max(seqBase, parseInt(m[1], 10));
    });

    let cum = existing.reduce((s, b) => s + (Number(b.period_amount) || 0), 0);
    const newRecs = [];
    schedule.forEach((slot, idx) => {
      const seqName = `第${idx + 1}期保養請款`;
      if (existingSeqs.has(seqName)) return;
      const per = amts[idx] || 0;
      cum += per;
      const rec = {
        billing_id: `BIL-${String(seqBase + newRecs.length + 1).padStart(4, '0')}`,
        project_id: p.project_id,
        billing_seq: seqName,
        base_contract_amount: contractAmt,
        cum_progress_pct: contractAmt > 0 ? Number(((cum / contractAmt) * 100).toFixed(1)) : 0,
        cum_billed_amount: cum,
        period_amount: per,
        retention_deduct: 0,
        advance_recoup: 0,
        penalty_deduct: 0,
        net_payable: per,
        workflow_stage: '廠商請款',
        stage_dates_json: JSON.stringify({ '預計請款': slot.plan_end }),
        voucher_no: '',
        paid_date: '',
        material_gate_ack: `預計履約區間 ${mshFmtShortRoc(slot.plan_start)} ~ ${mshFmtShortRoc(slot.plan_end)}`,
        updated_at: nowStr(),
        is_deleted: false
      };
      upsertLocal('Project_Billings', rec, 'billing_id');
      newRecs.push(rec);
    });

    if (newRecs.length) {
      renderCurrentView();
      await pushToCloud({ action: 'batchUpsert', items: [{ table: 'Project_Billings', records: newRecs }] });
      if (!silentIfEmpty) toast(`⚡ 已自動產生 ${newRecs.length} 期請款排程草稿（可逐期微調）`);
    } else if (!silentIfEmpty) {
      toast('所有期別的請款紀錄皆已存在');
    }
    return newRecs.length;
  }

  window.autoGenerateMaintBillings = async function(projectId) {
    const p = (appData.tables.Projects || []).find(x => x.project_id === projectId);
    if (!p) return;
    await generateInstallmentBillingsForProject(p, null, false);
  };

  // --------------------------------------------------------------------------
  // 4. 標案詳情頁：新增「📅 各期日期自動推估／批次調整」彈窗與按鈕
  // --------------------------------------------------------------------------
  window.openBatchScheduleModal = function(projectId) {
    const p = (appData.tables.Projects || []).find(x => x.project_id === projectId);
    if (!p) return;
    const tasks = getProjectTasks(projectId);
    if (!tasks.length) return toast('此案件尚無可調整之階段');

    const maintTasks = tasks.filter(t => /第\s*\d+\s*期/.test(String(t.stage_name || '')));
    const targetTasks = maintTasks.length >= 2 ? maintTasks : tasks;
    const isMaintScoped = maintTasks.length >= 2;
    const defStart = p.start_date || targetTasks[0]?.plan_start || todayStr();
    const defEnd = p.orig_end_date || targetTasks[targetTasks.length - 1]?.plan_end || mshAddMonthsMinusOneDay(defStart, 12);

    window._mshBatchTargetIds = targetTasks.map(t => t.task_id);

    openModal('📅 各期日期自動推估與批次微調', `
      <div class="legal-hint" style="margin-bottom:10px">
        只要設定「契約起迄期間」並按 <strong>⚡ 一鍵平均推估</strong>，系統即自動將 <strong>${targetTasks.length} 個${isMaintScoped ? '分期保養階段' : '流程階段'}</strong> 平均分配日期，再依實際需求手動微調單一期別後一次儲存。
      </div>
      <div class="form-grid-3" style="margin-bottom:8px">
        <div class="field">
          <label>契約／履約起日</label>
          <input id="msh-b-start" type="date" value="${esc(defStart)}">
        </div>
        <div class="field">
          <label>契約／履約迄日</label>
          <input id="msh-b-end" type="date" value="${esc(defEnd)}">
        </div>
        <div class="field">
          <label>推估方式</label>
          <select id="msh-b-mode">
            <option value="auto">自動智慧（整月對齊月底）</option>
            <option value="even">純平均天數切分</option>
          </select>
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
        <button type="button" class="msh-chip" onclick="mshBatchQuickDur(6)">半年</button>
        <button type="button" class="msh-chip" onclick="mshBatchQuickDur(12)">1 年</button>
        <button type="button" class="msh-chip" onclick="mshBatchQuickDur(24)">2 年</button>
        <button type="button" class="btn-sm btn-primary" style="margin-left:auto" onclick="mshRunBatchAutoFill()">⚡ 一鍵平均推估全部日期</button>
      </div>
      <div style="max-height:310px;overflow-y:auto;border:1px solid var(--border);border-radius:8px">
        <table class="msh-batch-table">
          <thead>
            <tr>
              <th style="width:36%">期別／階段名稱</th>
              <th style="width:24%">預計開始日</th>
              <th style="width:24%">預計結束日</th>
              <th style="width:16%">民國迄日</th>
            </tr>
          </thead>
          <tbody>
            ${targetTasks.map((t, idx) => `
              <tr>
                <td><strong>${esc(t.stage_name)}</strong></td>
                <td><input id="msh-bs-${idx}" type="date" value="${esc(t.plan_start || '')}"></td>
                <td><input id="msh-be-${idx}" type="date" value="${esc(t.plan_end || '')}" onchange="const r=document.getElementById('msh-br-${idx}');if(r)r.textContent='${''}'+(this.value?this.value.replace(/^(\\d{4})-/,(_,y)=>(Number(y)-1911)+'/').replace('-','/'):'-')"></td>
                <td class="num-mono" id="msh-br-${idx}" style="color:var(--muted);font-size:12px">${esc(mshFmtShortRoc(t.plan_end))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `, `
      <button type="button" onclick="closeModal()">取消</button>
      <button type="button" class="btn-primary" onclick="saveBatchScheduleModal('${esc(projectId)}')">💾 一次儲存全部期程</button>
    `);
  };

  window.mshBatchQuickDur = function(months) {
    const sEl = document.getElementById('msh-b-start');
    const eEl = document.getElementById('msh-b-end');
    if (!sEl || !eEl) return;
    if (!sEl.value) sEl.value = todayStr();
    eEl.value = mshAddMonthsMinusOneDay(sEl.value, months);
    window.mshRunBatchAutoFill();
  };

  window.mshRunBatchAutoFill = function() {
    const ids = window._mshBatchTargetIds || [];
    if (!ids.length) return;
    const sVal = document.getElementById('msh-b-start')?.value || todayStr();
    const eVal = document.getElementById('msh-b-end')?.value || mshAddMonthsMinusOneDay(sVal, 12);
    const mode = document.getElementById('msh-b-mode')?.value || 'auto';
    const slots = computeEvenInstallmentSchedule(sVal, eVal, ids.length, mode);
    slots.forEach((slot, idx) => {
      const sInp = document.getElementById(`msh-bs-${idx}`);
      const eInp = document.getElementById(`msh-be-${idx}`);
      const rEl = document.getElementById(`msh-br-${idx}`);
      if (sInp) sInp.value = slot.plan_start;
      if (eInp) eInp.value = slot.plan_end;
      if (rEl) rEl.textContent = mshFmtShortRoc(slot.plan_end);
    });
    if (typeof toast === 'function') toast(`⚡ 已平均推估 ${slots.length} 期日期，您可再手動微調`);
  };

  window.saveBatchScheduleModal = async function(projectId) {
    const p = (appData.tables.Projects || []).find(x => x.project_id === projectId);
    const ids = window._mshBatchTargetIds || [];
    if (!p || !ids.length) return;

    const updatedTasks = [];
    ids.forEach((tid, idx) => {
      const t = (appData.tables.Project_Tasks || []).find(x => x.task_id === tid);
      if (!t) return;
      const ps = document.getElementById(`msh-bs-${idx}`)?.value || t.plan_start;
      const pe = document.getElementById(`msh-be-${idx}`)?.value || t.plan_end;
      t.plan_start = ps;
      t.plan_end = (pe && ps && pe < ps) ? ps : pe;
      if (/第\s*\d+\s*期/.test(String(t.stage_name || ''))) {
        t.sla_deadline = t.plan_end;
      }
      t.updated_at = nowStr();
      updatedTasks.push(t);
    });

    const newStart = document.getElementById('msh-b-start')?.value;
    const newEnd = document.getElementById('msh-b-end')?.value;
    if (newStart) p.start_date = newStart;
    if (newEnd) p.orig_end_date = newEnd;
    p.updated_at = nowStr();

    closeModal();
    renderCurrentView();
    await pushToCloud({
      action: 'batchUpsert',
      items: [
        { table: 'Projects', records: [p] },
        { table: 'Project_Tasks', records: updatedTasks }
      ]
    });
    toast(`✅ 已一次更新 ${updatedTasks.length} 個期別日期`);
  };

  // --------------------------------------------------------------------------
  // 5. 通用「📥 分期契約比對與批次匯入」工具（適用不等額分期、專屬查核項與例行連動）
  // --------------------------------------------------------------------------
  function mshStripJsonFences(raw) {
    let s = String(raw || '').trim();
    if (!s) return '';
    const fence = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (fence) s = fence[1].trim();
    return s;
  }

  function mshExtractPeriodNo(text) {
    const m = String(text || '').match(/第\s*(\d+)\s*期/);
    return m ? parseInt(m[1], 10) : null;
  }

  function mshNormalizeCheckList(arr, prefix) {
    if (!Array.isArray(arr)) return [];
    return arr
      .map((item, idx) => {
        if (typeof item === 'string') {
          const t = item.trim();
          return t ? { id: `${prefix}_${idx + 1}`, text: t, required: true, done: false, doc_no: '', done_date: '' } : null;
        }
        if (item && typeof item === 'object' && String(item.text || '').trim()) {
          return {
            id: String(item.id || `${prefix}_${idx + 1}`),
            text: String(item.text).trim(),
            required: item.required !== false,
            done: Boolean(item.done),
            doc_no: String(item.doc_no || ''),
            done_date: String(item.done_date || '')
          };
        }
        return null;
      })
      .filter(Boolean);
  }

  function parseMaintImportSpec(rawText, currentProject = null) {
    const cleaned = mshStripJsonFences(rawText);
    if (!cleaned) return { ok: false, error: '請先貼上契約分期明細 JSON 內容。' };
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      return { ok: false, error: `JSON 格式解析失敗：${err.message}` };
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: '根節點必須為 JSON 物件（須包含 periods 陣列）。' };
    }
    if (!Array.isArray(parsed.periods) || parsed.periods.length < 1 || parsed.periods.length > 36) {
      return { ok: false, error: 'periods 欄位必須為 1 至 36 筆之陣列。' };
    }

    const projIn = (parsed.project && typeof parsed.project === 'object') ? parsed.project : {};
    const n = parsed.periods.length;
    const baseStart = (/^\d{4}-\d{2}-\d{2}$/.test(String(projIn.start_date || '')))
      ? projIn.start_date
      : (currentProject?.start_date || todayStr());
    const baseEnd = (/^\d{4}-\d{2}-\d{2}$/.test(String(projIn.orig_end_date || '')))
      ? projIn.orig_end_date
      : (currentProject?.orig_end_date || mshAddMonthsMinusOneDay(baseStart, 12));
    const fallbackSlots = computeEvenInstallmentSchedule(baseStart, baseEnd, n, 'auto');

    const periods = [];
    for (let i = 0; i < n; i++) {
      const row = parsed.periods[i] || {};
      const pNum = parseInt(row.period, 10) || (i + 1);
      const ps = /^\d{4}-\d{2}-\d{2}$/.test(String(row.plan_start || ''))
        ? row.plan_start
        : fallbackSlots[i].plan_start;
      const peRaw = /^\d{4}-\d{2}-\d{2}$/.test(String(row.plan_end || ''))
        ? row.plan_end
        : fallbackSlots[i].plan_end;
      const pe = peRaw >= ps ? peRaw : ps;
      const amt = Math.max(0, Math.round(Number(row.amount) || 0));
      const extraChecks = mshNormalizeCheckList(row.extra_checks || [], `m_p${pNum}_x`);
      periods.push({
        period: pNum,
        plan_start: ps,
        plan_end: pe,
        amount: amt,
        stage_name: String(row.stage_name || `第 ${pNum} 期履約保養與分期核銷`).trim(),
        billing_seq: String(row.billing_seq || `第${pNum}期保養請款`).trim(),
        note: String(row.note || '').trim(),
        extra_checks: extraChecks
      });
    }

    const sumAmount = periods.reduce((s, r) => s + r.amount, 0);
    const project = {};
    ['fiscal_year', 'project_name', 'procurement_type', 'threshold_tier', 'award_method', 'vendor_name', 'start_date', 'orig_end_date']
      .forEach(k => {
        if (projIn[k] !== undefined && projIn[k] !== null && String(projIn[k]).trim() !== '') {
          project[k] = String(projIn[k]).trim();
        }
      });
    if (projIn.budget_amount !== undefined && projIn.budget_amount !== null && projIn.budget_amount !== '') {
      project.budget_amount = Math.max(0, Math.round(Number(projIn.budget_amount) || 0));
    }
    if (projIn.award_amount !== undefined && projIn.award_amount !== null && projIn.award_amount !== '') {
      project.award_amount = Math.max(0, Math.round(Number(projIn.award_amount) || 0));
    }
    if (projIn.retention_rate !== undefined && projIn.retention_rate !== null && projIn.retention_rate !== '') {
      project.retention_rate = Math.max(0, Number(projIn.retention_rate) || 0);
    }
    if (projIn.flags && typeof projIn.flags === 'object') {
      project.flags = projIn.flags;
    }

    const baseChecks = Array.isArray(parsed.base_checks)
      ? parsed.base_checks.map(s => String(s || '').trim()).filter(Boolean)
      : [];
    const stage1Checks = mshNormalizeCheckList(parsed.stage1_checks || [], 'm_init_x');
    const contractNote = String(parsed.contract_note || '').trim();
    const extraRoutines = Array.isArray(parsed.extra_routines)
      ? parsed.extra_routines
          .filter(r => r && String(r.title || '').trim())
          .map(r => ({
            title: String(r.title).trim(),
            category: String(r.category || '設施安檢維運').trim(),
            recurrence_type: String(r.recurrence_type || '每季').trim(),
            due_rule: String(r.due_rule || 'Q-END-25').trim(),
            lead_days: Math.max(1, parseInt(r.lead_days, 10) || 14),
            portal_url: String(r.portal_url || '').trim(),
            note: String(r.note || '').trim()
          }))
      : [];

    const contractAmt = Number(project.award_amount ?? project.budget_amount ?? currentProject?.award_amount ?? currentProject?.budget_amount ?? sumAmount) || sumAmount;
    return {
      ok: true,
      spec: {
        project,
        periods,
        base_checks: baseChecks,
        stage1_checks: stage1Checks,
        contract_note: contractNote,
        extra_routines: extraRoutines,
        sum_amount: sumAmount,
        contract_amount: contractAmt,
        amount_diff: sumAmount - contractAmt
      }
    };
  }

  window.parseMaintImportSpec = parseMaintImportSpec;

  window.mshFillSampleImportJson = function(projectId) {
    const ta = document.getElementById('msh-import-json');
    if (!ta) return;
    const sample = {
      project: {
        fiscal_year: '116',
        procurement_type: '勞務',
        threshold_tier: '小額(15萬以下)',
        award_method: '逕洽',
        budget_amount: 12000,
        award_amount: 12000,
        start_date: '2027-01-01',
        orig_end_date: '2027-12-31',
        retention_rate: 0
      },
      periods: [
        { period: 1, plan_start: '2027-01-01', plan_end: '2027-03-31', amount: 3000, note: '第1季定期保養', extra_checks: ['確認檢附第1季檢測紀錄表'] },
        { period: 2, plan_start: '2027-04-01', plan_end: '2027-06-30', amount: 3000, note: '第2季定期保養', extra_checks: [] },
        { period: 3, plan_start: '2027-07-01', plan_end: '2027-09-30', amount: 3000, note: '第3季定期保養', extra_checks: [] },
        { period: 4, plan_start: '2027-10-01', plan_end: '2027-12-31', amount: 3000, note: '第4季定期保養與年度結清', extra_checks: ['確認全年度免費項目皆已完成'] }
      ]
    };
    ta.value = JSON.stringify(sample, null, 2);
    window.mshPreviewImportDiff(projectId);
  };

  window.openImportMaintSpecModal = function(projectId) {
    const p = (appData.tables.Projects || []).find(x => x.project_id === projectId);
    if (!p) return toast('找不到該標案資料');
    window._mshParsedImport = null;

    openModal('📥 分期契約比對與批次匯入', `
      <div class="legal-hint" style="margin-bottom:10px">
        貼上結構化契約分期明細 JSON（含期數、不等額各期金額、耗材明細、每期專屬檢核與另案例行事項），點擊 <strong>🔍 解析並比對差異</strong> 即可逐欄確認變更前／變更後內容，確認無誤後一鍵套用並保留既有已打勾與已核銷紀錄。
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px">
        <label for="msh-import-json" style="font-size:12px;font-weight:700;color:#334155">貼上契約分期 JSON（支援直接貼入含 \`\`\`json 區塊之文字）：</label>
        <div style="display:flex;gap:6px">
          <button type="button" class="msh-chip" onclick="mshFillSampleImportJson('${esc(projectId)}')">📋 範例格式</button>
          <button type="button" class="msh-chip" onclick="const t=document.getElementById('msh-import-json');if(t)t.value='';document.getElementById('msh-import-diff-wrap').innerHTML='';const b=document.getElementById('msh-import-apply-btn');if(b)b.disabled=true;window._mshParsedImport=null;">清除</button>
        </div>
      </div>
      <textarea id="msh-import-json" class="msh-import-textarea" placeholder='{"project": {...}, "periods": [{"period": 1, "plan_start": "2027-01-01", "plan_end": "2027-01-31", "amount": 500, "note": "..."}]}'></textarea>
      <div style="display:flex;justify-content:flex-end;margin-top:8px">
        <button type="button" class="btn-sm btn-primary" onclick="mshPreviewImportDiff('${esc(projectId)}')">🔍 解析並比對差異</button>
      </div>
      <div id="msh-import-diff-wrap"></div>
    `, `
      <button type="button" onclick="closeModal()">取消</button>
      <button type="button" id="msh-import-apply-btn" class="btn-primary" disabled onclick="mshApplyImportSpec('${esc(projectId)}')">✅ 確認比對並套用至本案</button>
    `);
  };

  window.mshPreviewImportDiff = function(projectId) {
    const p = (appData.tables.Projects || []).find(x => x.project_id === projectId);
    const wrap = document.getElementById('msh-import-diff-wrap');
    const applyBtn = document.getElementById('msh-import-apply-btn');
    if (!p || !wrap) return;

    const raw = document.getElementById('msh-import-json')?.value || '';
    const res = parseMaintImportSpec(raw, p);
    if (!res.ok) {
      window._mshParsedImport = null;
      if (applyBtn) applyBtn.disabled = true;
      wrap.innerHTML = `<div class="alert-item red" style="margin-top:10px"><strong>⚠️ 解析失敗：</strong>${esc(res.error)}</div>`;
      return;
    }

    const spec = res.spec;
    window._mshParsedImport = { projectId, spec };
    if (applyBtn) applyBtn.disabled = false;

    const curFlg = parseJSON(p.flags_json, {});
    const curTasks = getProjectTasks(projectId);
    const curPeriodTasks = curTasks.filter(t => mshExtractPeriodNo(t.stage_name) !== null);
    const curPeriods = Number(curFlg.maint_periods) || curPeriodTasks.length || 0;
    const curBillings = (appData.tables.Project_Billings || []).filter(b => b.project_id === projectId);

    const rows = [];
    const addRow = (label, oldVal, newVal, opts = {}) => {
      const changed = String(oldVal ?? '') !== String(newVal ?? '');
      rows.push({ label, oldVal: oldVal || '（空白）', newVal: newVal || '（空白）', changed, extraHtml: opts.extraHtml || '' });
    };

    if (spec.project.project_name && spec.project.project_name !== p.project_name) {
      addRow('標案名稱', p.project_name, spec.project.project_name, {
        extraHtml: `<label style="display:inline-flex;align-items:center;gap:4px;font-size:12px;margin-left:8px;cursor:pointer"><input type="checkbox" id="msh-imp-sync-name" checked> 同步更新名稱</label>`
      });
    } else {
      addRow('標案名稱', p.project_name, p.project_name);
    }
    if (spec.project.fiscal_year) addRow('年度', p.fiscal_year, spec.project.fiscal_year);
    if (spec.project.vendor_name) addRow('承攬廠商', p.vendor_name, spec.project.vendor_name);
    if (spec.project.procurement_type || spec.project.threshold_tier || spec.project.award_method) {
      const oldMeta = `${p.procurement_type || '-'}／${p.threshold_tier || '-'}／${p.award_method || '-'}`;
      const newMeta = `${spec.project.procurement_type || p.procurement_type || '-'}／${spec.project.threshold_tier || p.threshold_tier || '-'}／${spec.project.award_method || p.award_method || '-'}`;
      addRow('採購屬性', oldMeta, newMeta);
    }
    const newBudget = spec.project.budget_amount ?? p.budget_amount;
    const newAward = spec.project.award_amount ?? p.award_amount;
    addRow('預算／決標總價', `${fmtMoney(p.budget_amount)} ／ ${fmtMoney(p.award_amount)}`, `${fmtMoney(newBudget)} ／ ${fmtMoney(newAward)}`);
    const oldSpan = `${p.start_date ? mshFmtShortRoc(p.start_date) : '未填'} ~ ${p.orig_end_date ? mshFmtShortRoc(p.orig_end_date) : '未填'}`;
    const newSpan = `${mshFmtShortRoc(spec.project.start_date || spec.periods[0].plan_start)} ~ ${mshFmtShortRoc(spec.project.orig_end_date || spec.periods[spec.periods.length - 1].plan_end)}`;
    addRow('契約履約期間', oldSpan, newSpan);
    addRow('年度保養／分期期數', `${curFlg.is_maintenance ? '已勾選' : '未勾選'}・${curPeriods || '未設定'} 期`, `已勾選・${spec.periods.length} 期`);
    if (spec.project.retention_rate !== undefined) {
      addRow('保留款比率', `${Number(p.retention_rate || 0)}%`, `${Number(spec.project.retention_rate)}%`);
    }

    const amtBadge = spec.amount_diff === 0
      ? `<span class="tag tag-green">✅ 12/合計吻合：${fmtMoney(spec.sum_amount)}</span>`.replace('12/', `${spec.periods.length}期`)
      : `<span class="tag tag-amber">⚠️ 各期加總 ${fmtMoney(spec.sum_amount)} 與契約總價差額 ${fmtMoney(spec.amount_diff)}</span>`;

    const existingRoutineTitles = new Set((appData.tables.Annual_Routines || []).map(r => String(r.title || '').trim()));
    const routinesHtml = spec.extra_routines.length ? `
      <div class="msh-routine-box">
        <div style="font-weight:700;color:#1E3A5F;margin-bottom:5px">📅 建議同步列管之另案「年度固定例行事務」（未計入本案契約總價）</div>
        ${spec.extra_routines.map((rt, idx) => {
          const dup = existingRoutineTitles.has(rt.title);
          return `
            <label style="display:flex;align-items:flex-start;gap:6px;margin-top:4px;cursor:pointer">
              <input type="checkbox" class="msh-imp-rtn-cb" data-idx="${idx}" ${dup ? '' : 'checked'} ${dup ? 'disabled' : ''}>
              <span>
                <strong>${esc(rt.title)}</strong>（${esc(rt.recurrence_type)}・規則 <code>${esc(rt.due_rule)}</code>）
                ${dup ? '<span class="tag tag-gray">已存在，略過重複建立</span>' : '<span class="tag tag-blue">將自動建立</span>'}
                ${rt.note ? `<div style="color:#475569;font-size:12px;margin-top:2px">${esc(rt.note)}</div>` : ''}
              </span>
            </label>
          `;
        }).join('')}
      </div>
    ` : '';

    wrap.innerHTML = `
      <div class="msh-diff-box">
        <div class="msh-diff-hd">
          <span>🔍 比對結果摘要（確認無誤後點擊下方「確認比對並套用至本案」）</span>
          ${amtBadge}
        </div>
        <table class="msh-diff-table">
          <thead><tr><th style="width:24%">欄位</th><th style="width:36%">目前系統內容</th><th style="width:40%">匯入後內容</th></tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr class="${r.changed ? 'msh-diff-changed' : ''}">
                <td><strong>${esc(r.label)}</strong></td>
                <td>${r.changed ? `<span class="msh-diff-old">${esc(r.oldVal)}</span>` : esc(r.oldVal)}</td>
                <td>${r.changed ? `<span class="msh-diff-new">${esc(r.newVal)}</span>` : esc(r.newVal)}${r.extraHtml}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="msh-diff-box">
        <div class="msh-diff-hd">
          <span>📋 各期履約排程、請款金額與專屬查核預覽（共 ${spec.periods.length} 期；現有階段 ${curPeriodTasks.length} 期／請款 ${curBillings.length} 筆）</span>
          <span style="font-size:12px;font-weight:600">加總：${fmtMoney(spec.sum_amount)}</span>
        </div>
        <div style="max-height:230px;overflow-y:auto">
          <table class="msh-diff-table">
            <thead><tr><th style="width:10%">期別</th><th style="width:24%">民國起迄</th><th style="width:15%">預估金額</th><th style="width:51%">項目明細與專屬查核</th></tr></thead>
            <tbody>
              ${spec.periods.map(slot => `
                <tr>
                  <td><strong>第 ${slot.period} 期</strong></td>
                  <td class="num-mono" style="white-space:nowrap">${esc(mshFmtShortRoc(slot.plan_start))} ~ ${esc(mshFmtShortRoc(slot.plan_end))}</td>
                  <td class="num-mono" style="font-weight:700;color:var(--primary);white-space:nowrap">${fmtMoney(slot.amount)}</td>
                  <td>
                    <div>${esc(slot.note || '-')}</div>
                    ${slot.extra_checks.map(c => `<span class="msh-check-pill">✔ ${esc(c.text)}</span>`).join('')}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      ${routinesHtml}
    `;
  };

  window.mshApplyImportSpec = async function(projectId) {
    const cached = window._mshParsedImport;
    if (!cached || cached.projectId !== projectId || !cached.spec) {
      return toast('請先點擊「🔍 解析並比對差異」確認內容');
    }
    const p = (appData.tables.Projects || []).find(x => x.project_id === projectId);
    if (!p) return toast('找不到該標案');

    const spec = cached.spec;
    const now = nowStr();

    // 1. 更新 Projects 基本欄位與分期旗標
    const syncNameCb = document.getElementById('msh-imp-sync-name');
    if (spec.project.project_name && (!syncNameCb || syncNameCb.checked)) {
      p.project_name = spec.project.project_name;
    }
    if (spec.project.fiscal_year) p.fiscal_year = spec.project.fiscal_year;
    if (spec.project.procurement_type) p.procurement_type = spec.project.procurement_type;
    if (spec.project.threshold_tier) p.threshold_tier = spec.project.threshold_tier;
    if (spec.project.award_method) p.award_method = spec.project.award_method;
    if (spec.project.vendor_name) p.vendor_name = spec.project.vendor_name;
    if (spec.project.budget_amount !== undefined) p.budget_amount = spec.project.budget_amount;
    if (spec.project.award_amount !== undefined) p.award_amount = spec.project.award_amount;
    if (spec.project.retention_rate !== undefined) p.retention_rate = spec.project.retention_rate;
    p.start_date = spec.project.start_date || spec.periods[0].plan_start || p.start_date;
    p.orig_end_date = spec.project.orig_end_date || spec.periods[spec.periods.length - 1].plan_end || p.orig_end_date;

    const curFlg = parseJSON(p.flags_json, {});
    const mergedFlg = {
      ...curFlg,
      ...(spec.project.flags || {}),
      is_maintenance: true,
      maint_periods: spec.periods.length
    };
    if (spec.contract_note) mergedFlg.contract_note = spec.contract_note;
    p.flags_json = JSON.stringify(mergedFlg);
    p.updated_at = now;
    upsertLocal('Projects', p, 'project_id');

    // 2. 安全對齊 Project_Tasks（保留第 1 階段與既有已完成勾選狀態）
    const existingTasks = getProjectTasks(projectId);
    const existingPeriodMap = new Map();
    const preservedLeadTasks = [];
    const surplusTaskIds = [];

    const hasExistingPeriodTasks = existingTasks.some(t => mshExtractPeriodNo(t.stage_name) !== null);
    existingTasks.forEach((t, idx) => {
      const pNo = mshExtractPeriodNo(t.stage_name);
      if (pNo !== null) {
        if (!existingPeriodMap.has(pNo)) existingPeriodMap.set(pNo, t);
        else surplusTaskIds.push(t.task_id);
      } else if (idx === 0 || Number(t.stage_order) === 1) {
        preservedLeadTasks.push(t);
      } else if (!hasExistingPeriodTasks && t.status === '已完成') {
        preservedLeadTasks.push(t);
      } else if (!hasExistingPeriodTasks) {
        surplusTaskIds.push(t.task_id);
      } else {
        preservedLeadTasks.push(t);
      }
    });

    const mergeChecklist = (existingJson, desiredItems) => {
      const prev = parseJSON(existingJson, []);
      const prevByText = new Map();
      prev.forEach(item => {
        if (item && item.text) prevByText.set(String(item.text).trim(), item);
      });
      const usedTexts = new Set();
      const merged = desiredItems.map(item => {
        const key = String(item.text).trim();
        usedTexts.add(key);
        const old = prevByText.get(key);
        if (old) {
          return {
            ...item,
            id: old.id || item.id,
            done: Boolean(old.done),
            doc_no: old.doc_no || '',
            done_date: old.done_date || ''
          };
        }
        return item;
      });
      // 保留使用者既有已勾選或手動補充之額外檢核項，避免資料遺失
      prev.forEach(old => {
        const key = String(old?.text || '').trim();
        if (key && !usedTexts.has(key) && (old.done || old.doc_no || String(old.id || '').startsWith('c_'))) {
          merged.push(old);
        }
      });
      return JSON.stringify(merged);
    };

    const upsertTasks = [];
    let taskSeqBase = 0;
    (appData.tables.Project_Tasks || []).forEach(r => {
      const m = String(r.task_id || '').match(/(\d+)$/);
      if (m) taskSeqBase = Math.max(taskSeqBase, parseInt(m[1], 10));
    });
    const allocTaskId = () => {
      taskSeqBase += 1;
      return `TSK-${String(taskSeqBase).padStart(4, '0')}`;
    };

    // 若原本沒有第 1 階段，補建前置訂約階段
    if (!preservedLeadTasks.length) {
      const firstStart = spec.periods[0].plan_start;
      preservedLeadTasks.push({
        task_id: allocTaskId(),
        project_id: projectId,
        stage_order: 1,
        stage_name: (p.threshold_tier || '小額(15萬以下)') === '小額(15萬以下)' ? '簽辦動支與逕洽訂約' : '招標決標與契約簽訂',
        plan_start: addDays(firstStart, -10),
        plan_end: addDays(firstStart, -1),
        actual_start: '', actual_end: '', sla_deadline: '', blocker_note: '', status: '進行中',
        checklist_json: JSON.stringify([
          { id: 'm_init_1', text: '確認全年度累計總價未規避採購法分批辦理（§14），完成請購／動支簽核', required: true, done: false, doc_no: '', done_date: '' },
          { id: 'm_init_2', text: '核對報價單／維護契約條款（含保養頻率、叫修時效、零件計價與分期請款條件）', required: true, done: false, doc_no: '', done_date: '' },
          { id: 'm_init_3', text: '完成契約簽署或下訂通知，確認首期進場保養時間', required: true, done: false, doc_no: '', done_date: '' }
        ]),
        updated_at: now, is_deleted: false
      });
    }

    preservedLeadTasks.forEach((lt, idx) => {
      lt.stage_order = idx + 1;
      if (idx === 0 && spec.stage1_checks.length) {
        const curList = parseJSON(lt.checklist_json, []);
        const curTexts = new Set(curList.map(c => String(c.text || '').trim()));
        spec.stage1_checks.forEach(c => {
          if (!curTexts.has(c.text)) curList.push(c);
        });
        lt.checklist_json = JSON.stringify(curList);
      }
      if (idx === 0 && spec.contract_note && !lt.blocker_note) {
        lt.blocker_note = spec.contract_note;
      }
      lt.updated_at = now;
      upsertLocal('Project_Tasks', lt, 'task_id');
      upsertTasks.push(lt);
    });

    const stageOffset = preservedLeadTasks.length;
    const keptPeriodNos = new Set();
    spec.periods.forEach((slot, idx) => {
      keptPeriodNos.add(slot.period);
      const oldTask = existingPeriodMap.get(slot.period);
      const defaultChecks = spec.base_checks.length
        ? spec.base_checks.map((txt, cIdx) => ({
            id: `m_p${slot.period}_${cIdx + 1}`,
            text: txt.replace(/\{period\}/g, String(slot.period)).replace(/\{amount\}/g, fmtMoney(slot.amount)),
            required: true, done: false, doc_no: '', done_date: ''
          }))
        : [
            { id: `m_p${slot.period}_1`, text: `廠商完成第 ${slot.period} 期現場保養／維護作業並留存經雙方簽名之保養紀錄表`, required: true, done: false, doc_no: '', done_date: '' },
            { id: `m_p${slot.period}_2`, text: `核對第 ${slot.period} 期實際耗材數量、估價單單價與發票金額（預估 ${fmtMoney(slot.amount)}）無誤`, required: true, done: false, doc_no: '', done_date: '' },
            { id: `m_p${slot.period}_3`, text: `完成第 ${slot.period} 期驗收簽章，並於「💰 分期付款」頁籤登錄主計核銷撥款`, required: true, done: false, doc_no: '', done_date: '' }
          ];
      const desiredChecks = [...defaultChecks, ...slot.extra_checks];

      const rec = {
        task_id: oldTask ? oldTask.task_id : allocTaskId(),
        project_id: projectId,
        stage_order: stageOffset + idx + 1,
        stage_name: slot.stage_name,
        plan_start: slot.plan_start,
        plan_end: slot.plan_end,
        actual_start: oldTask ? (oldTask.actual_start || '') : '',
        actual_end: oldTask ? (oldTask.actual_end || '') : '',
        sla_deadline: slot.plan_end,
        blocker_note: slot.note ? `預估 ${fmtMoney(slot.amount)}｜${slot.note}` : (oldTask?.blocker_note || ''),
        status: oldTask ? (oldTask.status || '未開始') : '未開始',
        checklist_json: oldTask ? mergeChecklist(oldTask.checklist_json, desiredChecks) : JSON.stringify(desiredChecks),
        updated_at: now,
        is_deleted: false
      };
      upsertLocal('Project_Tasks', rec, 'task_id');
      upsertTasks.push(rec);
    });

    existingPeriodMap.forEach((oldTask, pNo) => {
      if (!keptPeriodNos.has(pNo)) surplusTaskIds.push(oldTask.task_id);
    });
    if (surplusTaskIds.length) {
      const delSet = new Set(surplusTaskIds);
      appData.tables.Project_Tasks = (appData.tables.Project_Tasks || []).filter(t => !delSet.has(t.task_id));
    }

    // 3. 安全對齊 Project_Billings（保留既有核銷進度、傳票文號與撥款日）
    const existingBillings = (appData.tables.Project_Billings || []).filter(b => b.project_id === projectId);
    const existingBillMap = new Map();
    const surplusBillingIds = [];
    existingBillings.forEach(b => {
      const pNo = mshExtractPeriodNo(b.billing_seq);
      if (pNo !== null && !existingBillMap.has(pNo)) existingBillMap.set(pNo, b);
    });

    let bilSeqBase = 0;
    (appData.tables.Project_Billings || []).forEach(r => {
      const m = String(r.billing_id || '').match(/(\d+)$/);
      if (m) bilSeqBase = Math.max(bilSeqBase, parseInt(m[1], 10));
    });
    const allocBillId = () => {
      bilSeqBase += 1;
      return `BIL-${String(bilSeqBase).padStart(4, '0')}`;
    };

    const contractAmt = Number(p.award_amount) || Number(p.budget_amount) || spec.sum_amount;
    let runningCum = 0;
    const upsertBillings = [];
    spec.periods.forEach(slot => {
      const oldB = existingBillMap.get(slot.period);
      const pen = oldB ? (Number(oldB.penalty_deduct) || 0) : 0;
      const per = slot.amount;
      runningCum += per;
      const net = Math.max(0, per - pen);
      const oldStageDates = oldB ? parseJSON(oldB.stage_dates_json, {}) : {};
      const rangeTag = `${mshFmtShortRoc(slot.plan_start)}~${mshFmtShortRoc(slot.plan_end)}`;
      const ackNote = slot.note ? `${rangeTag}｜${slot.note}` : `預計履約區間 ${rangeTag}`;

      const rec = {
        billing_id: oldB ? oldB.billing_id : allocBillId(),
        project_id: projectId,
        billing_seq: slot.billing_seq,
        base_contract_amount: contractAmt,
        cum_progress_pct: contractAmt > 0 ? Number(((runningCum / contractAmt) * 100).toFixed(1)) : 0,
        cum_billed_amount: runningCum,
        period_amount: per,
        retention_deduct: 0,
        advance_recoup: 0,
        penalty_deduct: pen,
        net_payable: net,
        workflow_stage: oldB ? (oldB.workflow_stage || '廠商請款') : '廠商請款',
        stage_dates_json: JSON.stringify({ ...oldStageDates, '預計請款': slot.plan_end }),
        voucher_no: oldB ? (oldB.voucher_no || '') : '',
        paid_date: oldB ? (oldB.paid_date || '') : '',
        material_gate_ack: ackNote,
        updated_at: now,
        is_deleted: false
      };
      upsertLocal('Project_Billings', rec, 'billing_id');
      upsertBillings.push(rec);
    });

    existingBillMap.forEach((oldB, pNo) => {
      if (!keptPeriodNos.has(pNo) && (oldB.workflow_stage === '廠商請款' || !oldB.workflow_stage) && !oldB.paid_date && !oldB.voucher_no) {
        surplusBillingIds.push(oldB.billing_id);
      }
    });
    if (surplusBillingIds.length) {
      const delSet = new Set(surplusBillingIds);
      appData.tables.Project_Billings = (appData.tables.Project_Billings || []).filter(b => !delSet.has(b.billing_id));
    }

    // 4. 選用：同步建立另案「年度固定例行事務」（自動去重）
    const newRoutines = [];
    const existingRoutineTitles = new Set((appData.tables.Annual_Routines || []).map(r => String(r.title || '').trim()));
    document.querySelectorAll('.msh-imp-rtn-cb:checked').forEach(cb => {
      const idx = parseInt(cb.dataset.idx, 10);
      const item = spec.extra_routines[idx];
      if (!item || existingRoutineTitles.has(item.title)) return;
      existingRoutineTitles.add(item.title);
      const rtnRec = {
        routine_id: nextId('Annual_Routines', 'routine_id', 'RTN', 3),
        title: item.title,
        category: item.category,
        recurrence_type: item.recurrence_type,
        due_rule: item.due_rule,
        lead_days: item.lead_days,
        portal_url: item.portal_url,
        linked_template_id: '',
        last_done_cycle: '',
        last_done_date: '',
        note: item.note,
        is_active: true,
        updated_at: now,
        is_deleted: false
      };
      upsertLocal('Annual_Routines', rtnRec, 'routine_id');
      newRoutines.push(rtnRec);
    });

    const batchItems = [
      { table: 'Projects', records: [p] },
      { table: 'Project_Tasks', records: upsertTasks },
      { table: 'Project_Billings', records: upsertBillings }
    ];
    if (newRoutines.length) {
      batchItems.push({ table: 'Annual_Routines', records: newRoutines });
    }

    window._mshParsedImport = null;
    closeModal();
    renderCurrentView();

    await pushToCloud({ action: 'batchUpsert', items: batchItems });
    for (const tid of surplusTaskIds) {
      await pushToCloud({ action: 'softDelete', table: 'Project_Tasks', id: tid });
    }
    for (const bid of surplusBillingIds) {
      await pushToCloud({ action: 'softDelete', table: 'Project_Billings', id: bid });
    }

    const rtnMsg = newRoutines.length ? `，並建立 ${newRoutines.length} 筆例行事項` : '';
    toast(`✅ 已套用 ${spec.periods.length} 期履約與請款明細（總額 ${fmtMoney(spec.sum_amount)}）${rtnMsg}`);
  };

  // 在標案詳情頁工具列與分期付款頁籤注入入口按鈕
  const _prevRenderDetail_msh = renderProjectDetailHTML;
  renderProjectDetailHTML = function(projectId) {
    let html = _prevRenderDetail_msh(projectId);
    // 1. 工具列加入「📅 各期日期自動推估／調整」與「📥 比對匯入分期明細」按鈕（相容一般採購與工程模組修改後的按鈕文字）
    if (!html.includes('openBatchScheduleModal')) {
      html = html.replace(
        new RegExp(`(<button[^>]*onclick="openEditProjectModal\\('${esc(projectId)}'\\)"[^>]*>[\\s\\S]*?<\\/button>)`),
        `$1<button type="button" class="btn-sm" onclick="openBatchScheduleModal('${esc(projectId)}')">📅 各期日期自動推估／調整</button><button type="button" class="btn-sm" onclick="openImportMaintSpecModal('${esc(projectId)}')">📥 比對匯入分期明細</button>`
      );
    }
    // 2. 分期付款頁籤加入「⚡ 一鍵依期數產生請款排程」與「📥 比對匯入分期明細」按鈕
    const addBillMarker = `onclick="openMaintBillingModal('${esc(projectId)}')"`;
    if (html.includes(addBillMarker) && !html.includes('autoGenerateMaintBillings')) {
      html = html.replace(
        `<button class="btn-sm btn-primary" ${addBillMarker}>＋ 新增本期請款核銷</button>`,
        `<div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="btn-sm" onclick="openImportMaintSpecModal('${esc(projectId)}')">📥 比對匯入分期明細</button><button type="button" class="btn-sm" onclick="autoGenerateMaintBillings('${esc(projectId)}')">⚡ 一鍵依期數產生請款排程</button><button class="btn-sm btn-primary" ${addBillMarker}>＋ 新增本期請款核銷</button></div>`
      );
    }
    return html;
  };

  // 模組登記
  if (window.GA_REGISTRY && typeof window.GA_REGISTRY.registerModule === 'function') {
    window.GA_REGISTRY.registerModule('maint-schedule-helper.js', 'v1.1', '保養分期合約自動推估日期、手動微調、批次請款排程與契約比對匯入');
  }
})();
