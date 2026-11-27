/**
 * ============================================================================
 * 學校總務行政助理 — 業務子頁一屏左右雙欄（split-pane.js）｜UI_DESIGN_RULES §1.3 Phase 2
 *
 * 透過 GA_CORE Slot Registry（不新增 renderCurrentView 包裝層）：
 *   0. 一屏殼層：桌機 ≥1024×600 全部分頁鎖定 100dvh，外層不捲動，內容於窗格內捲動
 *   1. 採購標案詳情：左欄 280px 階段導覽（狀態點／完成比／預定迄日），右欄單一階段工作台；
 *      工具列依採購性質過濾（非保養分期案不顯示分期推估／比對匯入）
 *   2. 例行事務：「📋 分組雙欄（左分組清單、右作業步驟與檔案）」↔「🗓️ 1～12 月年度矩陣」；
 *      同月份 ≥3 筆續約案浮現「⚡ 批次轉開下年度採購案」
 *   3. 太陽能租賃：KPI「本年應收」整合 rent_terms_json 繳納時程；左欄契約清單＋預警，右欄契約詳情頁籤
 *   4. 水電費：頂部篩選與預算；左欄（58%）月度對照圖與錶號，右欄（42%）帳單與異常
 * ============================================================================
 */

(function initSplitPane() {
  const GA = window.GA_CORE;
  if (!GA) return;

  const LS = {
    get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* 無痕模式略過 */ } }
  };
  const roc = ymd => (ymd ? GA.formatRocDate(ymd) : '-');
  const rel = ymd => (ymd ? GA.relText(GA.daysLeft(ymd)) : '');
  const isDesktopFit = () => window.innerWidth >= 1024 && window.innerHeight >= 600;

  // --------------------------------------------------------------------------
  // 樣式
  // --------------------------------------------------------------------------
  if (!document.getElementById('ga-split-style')) {
    const st = document.createElement('style');
    st.id = 'ga-split-style';
    st.textContent = `
      /* 殼層：沿用既有 dash-lock／nordic-one-screen 的 100dvh 鎖定（#main-view 已為 flex 欄、overflow hidden），
         內容改放進 .ga-scroll 或 .ga-split 窗格內捲動，不覆寫既有 !important 規則 */
      /* 未分層：既有全站 button 規則為未分層樣式，@layer 內規則無法覆蓋；以 class 特異度取勝、不使用 !important 對抗 */
        #main-view.ga-locked > * { flex-shrink: 0; }
        #main-view.ga-locked > .ga-scroll { flex: 1 1 auto; min-height: 0; overflow: auto; overscroll-behavior: contain; }
        #main-view.ga-locked > .ga-split { flex: 1 1 auto; min-height: 0; }
        #main-view.ga-locked > * + * { margin-top: 10px; }
        #main-view.ga-locked > .panel, #main-view.ga-locked > div { margin-bottom: 0; }
        .ga-split { display: grid; grid-template-columns: 280px minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); gap: 12px; min-width: 0; }
        .ga-split > * { min-height: 0; }
        .ga-split.w-solar { grid-template-columns: 320px minmax(0, 1fr); }
        .ga-split.w-util { grid-template-columns: minmax(0, 58fr) minmax(0, 42fr); }
        .ga-pane { min-height: 0; min-width: 0; overflow: auto; overscroll-behavior: contain; }
        .ga-pane > .panel:last-child { margin-bottom: 0; }
        .ga-nav { background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 12px; display: flex; flex-direction: column; min-height: 0; }
        .ga-nav-hd { padding: 10px 12px 6px; font-size: var(--fs-sm); font-weight: 800; color: var(--text-secondary); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .ga-nav-list { overflow: auto; padding: 0 6px 8px; min-height: 0; flex: 1 1 auto; }
        .ga-nav-grp { font-size: var(--fs-xs); font-weight: 800; color: var(--text-muted); padding: 8px 8px 4px; display: flex; justify-content: space-between; }
        .ga-nav .ga-nav-item { display: grid; min-height: 0; justify-content: stretch; grid-template-columns: 12px minmax(0, 1fr); gap: 4px 8px; align-items: start; width: 100%; text-align: left;
          background: transparent; border: 1px solid transparent; border-radius: 8px; padding: 7px 8px; cursor: pointer; color: var(--text-primary);
          font: inherit; font-size: var(--fs-sm); line-height: 1.35; box-shadow: none; min-height: 0; }
        .ga-nav-item:hover { background: var(--bg-subtle); }
        .ga-nav-item.on { background: var(--brand-soft); border-color: var(--brand-primary); }
        .ga-nav-item:focus-visible { outline: 2px solid var(--brand-accent); outline-offset: 1px; }
        .ga-nav-name { font-weight: 700; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .ga-nav-meta { grid-column: 2; font-size: var(--fs-xs); color: var(--text-muted); font-variant-numeric: tabular-nums; display: flex; gap: 6px; flex-wrap: wrap; }
        .ga-nav-meta .late { color: var(--status-danger); font-weight: 700; }
        .ga-nav-meta .soon { color: var(--status-warn); font-weight: 700; }
        .ga-dot { width: 10px; height: 10px; border-radius: 50%; margin-top: 5px; background: var(--border-strong); }
        .ga-dot.done { background: var(--status-ok); } .ga-dot.doing { background: var(--status-info); }
        .ga-dot.block, .ga-dot.red { background: var(--status-danger); } .ga-dot.amber { background: var(--status-warn); }
        .ga-stage-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
        .ga-stage-bar .sp { flex: 1; }
        .ga-pane .stage-card { margin-bottom: 0; }
        .ga-pane .chk-row { font-size: var(--fs-base); }
        .ga-bar-hd { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .ga-bar-hd h2 { margin: 0; font-size: var(--fs-lg); font-weight: 800; }
        .ga-bar-hd .sp { flex: 1; }
        .ga-seg { display: inline-flex; border: 1px solid var(--border-subtle); border-radius: 999px; overflow: hidden; }
        .ga-seg button { border: 0 !important; border-radius: 0 !important; background: var(--bg-surface) !important; color: var(--text-secondary) !important;
          font-size: var(--fs-sm) !important; font-weight: 700; padding: 5px 12px !important; min-height: 32px; box-shadow: none !important; white-space: nowrap; }
        .ga-seg button.on { background: var(--brand-primary) !important; color: #fff !important; }
        .ga-kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
        .ga-kpi { background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 8px 14px; position: relative; overflow: hidden; }
        .ga-kpi::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--border-strong); }
        .ga-kpi.ok::before { background: var(--status-ok); } .ga-kpi.amber::before { background: var(--status-warn); } .ga-kpi.red::before { background: var(--status-danger); }
        .ga-kpi-lb { font-size: var(--fs-xs); font-weight: 700; color: var(--text-muted); }
        .ga-kpi-v { font-size: 22px; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1.25; }
        .ga-kpi-v small { font-size: var(--fs-xs); font-weight: 600; color: var(--text-muted); margin-left: 4px; }
        .ga-kpi-sub { font-size: var(--fs-xs); color: var(--text-secondary); font-variant-numeric: tabular-nums; }
        .ga-nav .ga-alert-row { display: block; min-height: 0; width: 100%; text-align: left; border: 0; border-left: 3px solid var(--status-warn); background: var(--status-warn-bg);
          border-radius: 6px; padding: 6px 8px; margin: 0 0 6px; cursor: pointer; font: inherit; font-size: var(--fs-xs); color: var(--text-primary); box-shadow: none; }
        .ga-alert-row.red { border-left-color: var(--status-danger); background: var(--status-danger-bg); }
        .ga-alert-row strong { font-size: var(--fs-sm); }
        .ga-detail { background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 14px 16px; }
        .ga-detail h3 { margin: 0 0 4px; font-size: var(--fs-lg); }
        .ga-detail .rtn-sec { margin-bottom: 12px; }
        .ga-actions { display: flex; gap: 6px; flex-wrap: wrap; margin: 8px 0 12px; }
        .ga-actions button { white-space: nowrap; }
        /* 年度矩陣 */
        .ga-matrix { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); grid-template-rows: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .ga-month { background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 12px; display: flex; flex-direction: column; min-height: 0; min-width: 0; }
        .ga-month.now { border-color: var(--brand-primary); box-shadow: inset 0 3px 0 var(--brand-primary); }
        .ga-month-hd { padding: 8px 10px 4px; font-weight: 800; font-size: var(--fs-sm); display: flex; justify-content: space-between; align-items: center; gap: 4px; }
        .ga-month-hd small { font-weight: 700; color: var(--text-muted); font-size: var(--fs-xs); }
        .ga-month-list { overflow: auto; padding: 0 6px 6px; min-height: 0; flex: 1 1 auto; }
        .ga-month .ga-chip { display: block; min-height: 0; width: 100%; text-align: left; border: 1px solid var(--border-subtle); background: var(--bg-subtle); border-radius: 6px;
          padding: 4px 6px; margin-bottom: 4px; font: inherit; font-size: var(--fs-xs); line-height: 1.35; cursor: pointer; color: var(--text-primary); box-shadow: none; }
        .ga-chip .d { color: var(--text-muted); font-variant-numeric: tabular-nums; margin-right: 4px; }
        .ga-chip.red { border-color: var(--status-danger); background: var(--status-danger-bg); }
        .ga-chip.amber { border-color: var(--status-warn); background: var(--status-warn-bg); }
        .ga-chip.done { opacity: .6; text-decoration: line-through; }
        .ga-month .ga-batch { font-size: var(--fs-xs); padding: 3px 8px; min-height: 28px; white-space: normal; width: 100%; line-height: 1.3; }
        /* 水電：右欄帳單表緊湊 */
        .ga-split.w-util table { font-size: 13px; }
        .ga-split.w-util th, .ga-split.w-util td { padding: 6px 8px; }
        .ga-pane .site-card button { white-space: nowrap; }
        .ga-pane .ops-grid-3 { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); }
        @media (max-width: 1023px), (max-height: 599px) {
          .ga-split, .ga-split.w-solar, .ga-split.w-util { grid-template-columns: 1fr; grid-template-rows: none; }
          .ga-pane { overflow: visible; }
          .ga-nav-list { max-height: 260px; }
          .ga-matrix { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: none; }
          .ga-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
    `;
    document.head.appendChild(st);
  }

  // --------------------------------------------------------------------------
  // 0. 一屏殼層
  // --------------------------------------------------------------------------
  function fitModeIsScroll() { return LS.get('ga_dash_autofit_v1', 'auto') === 'scroll'; }
  function syncShell(tab) {
    const mv = document.getElementById('main-view');
    const page = tab !== 'dashboard';
    const lock = page && isDesktopFit() && !fitModeIsScroll();
    document.body.classList.toggle('ga-page', page);
    if (page) {
      ['dash-lock', 'nordic-one-screen'].forEach(cls => {
        document.documentElement.classList.toggle(cls, lock);
        document.body.classList.toggle(cls, lock);
      });
    }
    if (!mv) return;
    mv.classList.toggle('ga-locked', lock);
    if (!lock || mv.querySelector(':scope > .ga-split, :scope > .ga-scroll')) return;
    // 非雙欄頁：整頁內容放入單一捲動窗格，外層維持零捲動
    const wrap = document.createElement('div');
    wrap.className = 'ga-scroll';
    wrap.dataset.key = `scroll-${tab}`;
    // 搬移節點會重設捲動位置（例如甘特圖自動捲到今天），先記錄再還原
    const scrolled = Array.from(mv.querySelectorAll('*')).filter(el => el.scrollLeft || el.scrollTop).map(el => [el, el.scrollLeft, el.scrollTop]);
    while (mv.firstChild) wrap.appendChild(mv.firstChild);
    mv.appendChild(wrap);
    scrolled.forEach(([el, l, t]) => { el.scrollLeft = l; el.scrollTop = t; });
  }

  // 分頁切換前記住右窗格捲動位置，重繪後還原（勾選檢核項不跳回頂端）
  const paneScroll = {};
  GA.onBeforeRender(() => {
    document.querySelectorAll('#main-view [data-key]').forEach(p => { paneScroll[p.dataset.key] = p.scrollTop; });
  });
  function restorePaneScroll() {
    document.querySelectorAll('#main-view [data-key]').forEach(p => {
      if (paneScroll[p.dataset.key] != null) p.scrollTop = paneScroll[p.dataset.key];
    });
  }

  // --------------------------------------------------------------------------
  // 1. 採購標案詳情：階段導覽 × 單一階段工作台
  // --------------------------------------------------------------------------
  const stageSel = {};
  const taskIdOfCard = card => {
    const m = card.innerHTML.match(/updateTaskField\('([^']+)'/) || card.innerHTML.match(/toggleCheckItem\('([^']+)'/);
    return m ? m[1] : null;
  };
  function projectIsInstallment(p) {
    const flg = parseJSON(p.flags_json, {});
    if (flg.is_maintenance) return true;
    if ((appData.tables.Project_Billings || []).some(b => b.project_id === p.project_id)) return true;
    return (appData.tables.Project_Tasks || []).some(t => t.project_id === p.project_id && /期履約保養/.test(t.stage_name || ''));
  }
  function defaultStage(tasks) {
    return (tasks.find(t => t.status === '缺件卡關') || tasks.find(t => t.status === '進行中')
      || tasks.find(t => t.status !== '已完成') || tasks[tasks.length - 1] || {}).task_id;
  }

  function enhanceProjectDetail() {
    const mv = document.getElementById('main-view');
    const pid = typeof selectedProjectId !== 'undefined' ? selectedProjectId : null;
    const p = (appData.tables.Projects || []).find(x => x.project_id === pid);
    if (!mv || !p) return;

    // 工具列依採購性質過濾
    if (!projectIsInstallment(p)) {
      mv.querySelectorAll('button[onclick^="openBatchScheduleModal("], button[onclick^="openImportMaintSpecModal("]').forEach(b => b.remove());
    }

    const cards = Array.from(mv.querySelectorAll(':scope > .stage-card'));
    if (!cards.length) return;
    const tasks = (appData.tables.Project_Tasks || []).filter(t => t.project_id === pid && !t.is_deleted);
    const byId = Object.fromEntries(tasks.map(t => [t.task_id, t]));
    const entries = cards.map((card, i) => ({ card, t: byId[taskIdOfCard(card)] || {}, i }));
    const ordered = entries.map(e => e.t).filter(t => t.task_id);
    let sel = stageSel[pid];
    if (!entries.some(e => e.t.task_id === sel)) sel = stageSel[pid] = defaultStage(ordered) || entries[0].t.task_id;

    const split = document.createElement('div');
    split.className = 'ga-split';
    const navItems = entries.map(({ t, i }) => {
      const items = parseJSON(t.checklist_json, []);
      const done = items.filter(x => x.done).length;
      const dot = t.status === '已完成' ? 'done' : t.status === '進行中' ? 'doing' : t.status === '缺件卡關' ? 'block' : '';
      const due = t.sla_deadline || t.plan_end;
      const d = due && t.status !== '已完成' ? GA.daysLeft(due) : null;
      const dueCls = d === null ? '' : d < 0 ? 'late' : d <= 7 ? 'soon' : '';
      return `<button type="button" class="ga-nav-item ${t.task_id === sel ? 'on' : ''}" data-task="${esc(t.task_id || '')}" data-idx="${i}">
        <span class="ga-dot ${dot}" aria-hidden="true"></span>
        <span class="ga-nav-name">${t.stage_order ? `${esc(t.stage_order)}. ` : ''}${esc(t.stage_name || '階段')}</span>
        <span class="ga-nav-meta"><span>${done}/${items.length}</span>${due ? `<span class="${dueCls}">${t.sla_deadline ? '死線 ' : ''}${roc(due)}${d !== null && d <= 7 ? `・${GA.relText(d)}` : ''}</span>` : ''}<span>${esc(t.status || '')}</span></span>
      </button>`;
    }).join('');
    const doneCnt = ordered.filter(t => t.status === '已完成').length;
    split.innerHTML = `
      <nav class="ga-nav" aria-label="流程階段">
        <div class="ga-nav-hd">📋 流程階段 <span style="margin-left:auto;font-weight:700">${doneCnt}/${ordered.length} 完成</span></div>
        <div class="ga-nav-list" role="listbox">${navItems}</div>
      </nav>
      <section class="ga-pane" data-key="stage-${esc(pid)}"></section>`;
    const pane = split.querySelector('.ga-pane');
    cards[0].insertAdjacentElement('beforebegin', split);
    cards.forEach(c => c.remove());

    const show = taskId => {
      const idx = entries.findIndex(e => e.t.task_id === taskId);
      const cur = idx < 0 ? 0 : idx;
      stageSel[pid] = entries[cur].t.task_id;
      split.querySelectorAll('.ga-nav-item').forEach(b => b.classList.toggle('on', Number(b.dataset.idx) === cur));
      const prev = entries[cur - 1], next = entries[cur + 1];
      pane.innerHTML = `<div class="ga-stage-bar">
          <button type="button" class="btn-sm" ${prev ? '' : 'disabled'} data-go="${prev ? esc(prev.t.task_id) : ''}">◀ 上一階段</button>
          <span class="sp"></span>
          <span class="item-meta">第 ${cur + 1} / ${entries.length} 階段</span>
          <button type="button" class="btn-sm" ${next ? '' : 'disabled'} data-go="${next ? esc(next.t.task_id) : ''}">下一階段 ▶</button>
        </div>`;
      pane.appendChild(entries[cur].card);
      pane.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { if (b.dataset.go) { pane.scrollTop = 0; show(b.dataset.go); } }));
    };
    split.querySelectorAll('.ga-nav-item').forEach(b => b.addEventListener('click', () => { pane.scrollTop = 0; show(entries[Number(b.dataset.idx)].t.task_id); }));
    split.querySelector('.ga-nav-list').addEventListener('keydown', e => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const cur = entries.findIndex(x => x.t.task_id === stageSel[pid]);
      const nx = entries[Math.max(0, Math.min(entries.length - 1, cur + (e.key === 'ArrowDown' ? 1 : -1)))];
      show(nx.t.task_id);
      split.querySelector(`.ga-nav-item[data-idx="${nx.i}"]`)?.focus();
    });
    show(sel);
    split.querySelector('.ga-nav-item.on')?.scrollIntoView({ block: 'nearest' });
  }

  // --------------------------------------------------------------------------
  // 2. 例行事務：分組雙欄 ↔ 年度矩陣
  // --------------------------------------------------------------------------
  const RT = {
    get mode() { return LS.get('ga_rt_mode', 'split'); },
    set mode(v) { LS.set('ga_rt_mode', v); },
    sel: null
  };
  const isRenewal = r => !!r.linked_template_id || /續約|契約|保養|維護|共同供應|小額採購/.test(`${r.title || ''}${r.category || ''}`);

  function routineRows() {
    return (appData.tables.Annual_Routines || []).filter(r => !r.is_deleted).map(r => {
      const sch = computeRoutineSchedule(r);
      const vis = typeof calcRoutineCardVisual === 'function' ? calcRoutineCardVisual(r, sch) : { tone: '' };
      return { r, sch, vis, active: r.is_active !== false };
    });
  }

  // 取用既有「檔案與步驟」視窗內容，改為右欄原位呈現（不重寫業務邏輯）
  const origRoutineDetail = typeof openRoutineDetailModal === 'function' ? openRoutineDetailModal : null;
  function captureRoutineDetail(id) {
    if (!origRoutineDetail) return null;
    let cap = null;
    const om = window.openModal;
    window.openModal = (title, body, footer) => { cap = { title, body, footer }; };
    try { origRoutineDetail(id); } finally { window.openModal = om; }
    return cap;
  }
  if (origRoutineDetail) {
    window.openRoutineDetailModal = function(id) {
      if (typeof currentTab !== 'undefined' && currentTab === 'routines' && RT.mode === 'split' && isDesktopFit()) {
        RT.sel = id;
        if (document.getElementById('modal-backdrop')?.classList.contains('open') && document.getElementById('modal-title')?.textContent.startsWith('📂')) closeModal();
        renderCurrentView();
        return;
      }
      return origRoutineDetail(id);
    };
  }

  function bindStepEnter(id) {
    const inp = document.getElementById('rd-step-text');
    if (!inp || inp.dataset.bound) return;
    inp.dataset.bound = '1';
    let comp = false, lastEnd = 0;
    inp.addEventListener('compositionstart', () => { comp = true; });
    inp.addEventListener('compositionend', () => { comp = false; lastEnd = Date.now(); });
    inp.addEventListener('keydown', e => {
      if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229 || comp || Date.now() - lastEnd < 100) return;
      e.preventDefault();
      if (typeof addRoutineStep === 'function') addRoutineStep(id);
    });
  }

  function routineHeaderHTML(rows) {
    const late = rows.filter(x => x.active && x.sch.diffDays < 0).length;
    const soon = rows.filter(x => x.active && x.sch.diffDays >= 0 && x.sch.diffDays <= 30).length;
    return `<div class="ga-bar-hd">
      <h2>🔁 例行事務</h2>
      <span class="item-meta">共 ${rows.length} 項｜${late ? `<strong style="color:var(--status-danger)">逾期 ${late}</strong>｜` : ''}30 日內 ${soon}</span>
      <span class="sp"></span>
      <div class="ga-seg" role="tablist">
        <button type="button" class="${RT.mode === 'split' ? 'on' : ''}" onclick="gaRtMode('split')">📋 分組雙欄</button>
        <button type="button" class="${RT.mode === 'matrix' ? 'on' : ''}" onclick="gaRtMode('matrix')">🗓️ 年度矩陣</button>
      </div>
      <button type="button" class="btn-sm btn-primary" onclick="openRoutineModal()">＋ 新增例行業務</button>
    </div>`;
  }

  function routineActionsHTML(x) {
    const r = x.r, id = esc(r.routine_id);
    const canQuickBuy = ['一般小額採購', '共同供應契約'].includes(r.category);
    return `<div class="ga-actions">
      <button type="button" class="btn-sm btn-success" onclick="markRoutineDone('${id}','${esc(x.sch.cycle)}')">✓ 完成本期</button>
      ${r.linked_template_id ? `<button type="button" class="btn-sm btn-primary" onclick="openProjectWizard('${esc(r.linked_template_id)}','${esc(r.title)}')">📋 套模板開案</button>` : ''}
      ${!r.linked_template_id && canQuickBuy && typeof openRoutineQuickPurchase === 'function' ? `<button type="button" class="btn-sm btn-primary" onclick="openRoutineQuickPurchase('${id}')">🛒 開單</button>` : ''}
      <button type="button" class="btn-sm" onclick="openRoutineModal('${id}')">✎ 編輯排程規則</button>
      <button type="button" class="btn-sm" onclick="gaCopyRoutine('${id}')">📋 複製催辦詞</button>
      <button type="button" class="btn-sm btn-danger" onclick="deleteRoutine('${id}')">刪除</button>
    </div>`;
  }

  function routineSplitHTML(rows) {
    if (!rows.length) return `<div class="empty-state">尚未建立例行業務。<br><button class="btn-sm btn-primary" style="margin-top:8px" onclick="openRoutineModal()">＋ 新增例行業務</button></div>`;
    const sorted = rows.slice().sort((a, b) => Number(b.active) - Number(a.active) || a.sch.diffDays - b.sch.diffDays);
    if (!sorted.some(x => x.r.routine_id === RT.sel)) RT.sel = sorted[0].r.routine_id;
    const groups = {};
    sorted.forEach(x => { (groups[x.r.category || '未分類'] = groups[x.r.category || '未分類'] || []).push(x); });
    const order = Object.keys(groups).sort((a, b) => groups[a][0].sch.diffDays - groups[b][0].sch.diffDays);
    const nav = order.map(g => `
      <div class="ga-nav-grp"><span>${esc(g)}</span><span>${groups[g].length}</span></div>
      ${groups[g].map(x => {
        const d = x.sch.diffDays;
        const tone = !x.active ? '' : d < 0 ? 'red' : d <= 7 ? 'amber' : d <= 30 ? 'doing' : 'done';
        return `<button type="button" class="ga-nav-item ${x.r.routine_id === RT.sel ? 'on' : ''}" style="${x.active ? '' : 'opacity:.5'}" onclick="gaRtSelect('${esc(x.r.routine_id)}')">
          <span class="ga-dot ${tone}" aria-hidden="true"></span>
          <span class="ga-nav-name">${esc(x.r.title)}</span>
          <span class="ga-nav-meta"><span class="${d < 0 ? 'late' : d <= 7 ? 'soon' : ''}">${roc(x.sch.dueDate)}・${GA.relText(d)}</span></span>
        </button>`;
      }).join('')}`).join('');
    const x = sorted.find(y => y.r.routine_id === RT.sel);
    const cap = captureRoutineDetail(x.r.routine_id);
    const ruleHuman = typeof describeDueRuleHuman === 'function' ? describeDueRuleHuman(x.r.recurrence_type, x.r.due_rule) : x.r.due_rule;
    return `<div class="ga-split">
      <nav class="ga-nav" aria-label="例行業務分組"><div class="ga-nav-list">${nav}</div></nav>
      <section class="ga-pane" data-key="rt-${esc(x.r.routine_id)}">
        <div class="ga-detail">
          <h3>${esc(x.r.title)}</h3>
          <div class="item-meta">${esc(x.r.category || '')}｜${esc(ruleHuman || '')}｜提前 ${esc(x.r.lead_days ?? '-')} 天通知｜本期 ${esc(x.sch.cycle)}・到期 <strong class="ga-roc">${GA.formatRocDate(x.sch.dueDate, { withWeekday: true })}</strong>（${GA.relText(x.sch.diffDays)}）${x.r.last_done_cycle ? `｜上次完成 ${esc(x.r.last_done_cycle)}` : ''}</div>
          ${routineActionsHTML(x)}
          ${cap ? cap.body : ''}
        </div>
      </section>
    </div>`;
  }

  function routineMatrixHTML(rows) {
    const today = todayStr();
    const y = Number(today.slice(0, 4)), m0 = Number(today.slice(5, 7));
    const months = Array.from({ length: 12 }, (_, i) => {
      const mm = ((m0 - 1 + i) % 12) + 1, yy = y + Math.floor((m0 - 1 + i) / 12);
      return { key: `${yy}-${String(mm).padStart(2, '0')}`, label: `${yy - 1911}/${mm} 月`, items: [] };
    });
    const idx = Object.fromEntries(months.map((m, i) => [m.key, i]));
    rows.filter(x => x.active).forEach(x => {
      const k = String(x.sch.dueDate || '').slice(0, 7);
      if (k in idx) months[idx[k]].items.push(x);
      else if (k && k < months[0].key) months[0].items.push(x); // 已逾期者歸入本月
    });
    window._gaRtBatch = {};
    return `<div class="ga-split" style="grid-template-columns:1fr"><div class="ga-matrix">${months.map((m, i) => {
      m.items.sort((a, b) => a.sch.diffDays - b.sch.diffDays);
      const renew = m.items.filter(x => isRenewal(x.r));
      if (renew.length >= 3) window._gaRtBatch[m.key] = renew.map(x => x.r.routine_id);
      return `<div class="ga-month ${i === 0 ? 'now' : ''}">
        <div class="ga-month-hd"><span>${m.label}</span><small>${m.items.length} 項</small></div>
        ${renew.length >= 3 ? `<div style="padding:0 6px 4px"><button type="button" class="btn-xs btn-primary ga-batch" onclick="gaRtBatch('${m.key}')">⚡ 批次轉開下年度採購案（${renew.length}）</button></div>` : ''}
        <div class="ga-month-list">${m.items.map(x => {
          const d = x.sch.diffDays;
          return `<button type="button" class="ga-chip ${d < 0 ? 'red' : d <= 7 ? 'amber' : ''}" title="${esc(x.r.title)}｜${roc(x.sch.dueDate)}" onclick="gaRtMode('split','${esc(x.r.routine_id)}')"><span class="d">${d < 0 ? '逾' : Number(String(x.sch.dueDate).slice(8, 10)) + '日'}</span>${esc(x.r.title)}</button>`;
        }).join('') || '<div class="item-meta" style="padding:4px">—</div>'}</div>
      </div>`;
    }).join('')}</div></div>`;
  }

  window.gaRtMode = function(mode, sel) { RT.mode = mode; if (sel) RT.sel = sel; renderCurrentView(); };
  window.gaRtSelect = function(id) { RT.sel = id; renderCurrentView(); };
  window.gaCopyRoutine = function(id) {
    const x = routineRows().find(y => y.r.routine_id === id);
    if (!x) return;
    GA.copyText(`【例行業務提醒】${x.r.title}\n本期期別：${x.sch.cycle}\n辦理期限：${GA.formatRocDate(x.sch.dueDate, { withWeekday: true })}（${GA.relText(x.sch.diffDays)}）\n請協助於期限前完成，謝謝。`);
  };
  window.gaRtBatch = function(key) {
    const ids = (window._gaRtBatch || {})[key] || [];
    const rows = routineRows().filter(x => ids.includes(x.r.routine_id));
    openModal(`⚡ 批次轉開下年度採購案（${Number(key.slice(0, 4)) - 1911}/${Number(key.slice(5))} 月，${rows.length} 件）`, `
      <div class="item-meta" style="margin-bottom:8px">同月份到期的續約／保養案，可逐件套模板開案或開單；開案後回到此處標記本期完成。</div>
      <table><thead><tr><th>例行業務</th><th>到期</th><th>操作</th></tr></thead><tbody>
      ${rows.map(x => `<tr>
        <td><strong>${esc(x.r.title)}</strong><div class="item-meta">${esc(x.r.category || '')}</div></td>
        <td class="ga-roc" style="white-space:nowrap">${roc(x.sch.dueDate)}<div class="item-meta">${GA.relText(x.sch.diffDays)}</div></td>
        <td style="white-space:nowrap">
          ${x.r.linked_template_id ? `<button type="button" class="btn-xs btn-primary" onclick="closeModal();openProjectWizard('${esc(x.r.linked_template_id)}','${esc(x.r.title)}')">📋 套模板開案</button>`
            : `<button type="button" class="btn-xs btn-primary" onclick="closeModal();openProjectWizard('','${esc(x.r.title)}','')">🛒 開新採購案</button>`}
          <button type="button" class="btn-xs btn-success" onclick="markRoutineDone('${esc(x.r.routine_id)}','${esc(x.sch.cycle)}')">✓ 本期完成</button>
        </td></tr>`).join('')}
      </tbody></table>`, `<button type="button" onclick="closeModal()">關閉</button>`);
  };

  GA.registerView('routines', {
    generator: 'renderRoutinesHTML',
    render(prev) {
      if (!isDesktopFit()) return prev();
      const rows = routineRows();
      return routineHeaderHTML(rows) + (RT.mode === 'matrix' ? routineMatrixHTML(rows) : routineSplitHTML(rows));
    },
    afterRender() { if (RT.sel) bindStepEnter(RT.sel); }
  });

  // --------------------------------------------------------------------------
  // 3. 太陽能租賃：KPI 整合繳納時程＋左欄契約／右欄詳情
  // --------------------------------------------------------------------------
  function solarYearFigures(contracts, rocYear) {
    const adYear = String(rocYear + 1911);
    const cMap = Object.fromEntries(contracts.map(c => [c.solar_id, c]));
    let recCalc = 0, actual = 0, schedDue = 0, schedCnt = 0;
    const recBy = {};
    (appData.tables.Solar_Records || []).filter(r => !r.is_deleted).forEach(r => {
      if (getRecordRocYear(r) !== rocYear) return;
      const k = calcSolarBillV2(r, cMap[r.solar_id]);
      recBy[r.solar_id] = (recBy[r.solar_id] || 0) + k.calculatedRent;
      if (k.hasActual) actual += k.actualPaid;
    });
    contracts.forEach(c => {
      const t = typeof window.getRentTerms === 'function' ? window.getRentTerms(c) : null;
      const inst = t ? t.schedule.filter(i => String(i.due_date || '').startsWith(adYear)) : [];
      const sched = inst.reduce((s, i) => s + (Number(i.amount) || 0), 0);
      schedCnt += inst.length;
      // 已建對帳單者以對帳試算為準；尚未建單者以契約繳納時程補足
      const v = recBy[c.solar_id] != null ? Math.max(recBy[c.solar_id], 0) : sched;
      if (recBy[c.solar_id] == null) schedDue += sched;
      recCalc += v;
    });
    return { due: recCalc, actual, schedDue, schedCnt };
  }

  GA.registerView('solar', {
    generator: 'renderSolarViewHTML',
    render(prev) {
      if (typeof ensureSolarV2Tables === 'function') ensureSolarV2Tables();
      const contracts = (appData.tables.Solar_Contracts || []).filter(c => !c.is_deleted);
      if (!contracts.length || !isDesktopFit()) return prev();
      if (!contracts.some(c => c.solar_id === solarV2SelectedId)) solarV2SelectedId = contracts[0].solar_id;
      const c = contracts.find(x => x.solar_id === solarV2SelectedId);
      const alerts = buildSolarV2Alerts();
      window._solarV2Alerts = alerts;
      const active = contracts.filter(x => !['已屆滿', '已期滿', '已解約'].includes(x.status));
      const kwp = active.reduce((s, x) => s + (Number(x.capacity_kwp) || 0), 0);
      const bond = contracts.reduce((s, x) => s + getContractBondSummary(x.solar_id, x).balance, 0);
      const fig = solarYearFigures(contracts, Number(opsSolarYear));
      const red = alerts.filter(a => a.level === 'red').length;
      const alertBy = {};
      alerts.forEach((a, i) => { const k = (contracts.find(x => a.title && a.title.includes(x.building_name)) || {}).solar_id; if (k) (alertBy[k] = alertBy[k] || []).push(a); });

      let detail = renderSolarContractDetailHTML(c);
      detail = detail.replace(/<button class="btn-sm" onclick="solarV2SelectedId=null;renderCurrentView\(\)">← 返回太陽能契約總覽<\/button>/, '<span></span>');

      const list = contracts.map(x => {
        const n = (alertBy[x.solar_id] || []).length;
        const lv = (alertBy[x.solar_id] || []).some(a => a.level === 'red') ? 'red' : n ? 'amber' : 'done';
        return `<button type="button" class="ga-nav-item ${x.solar_id === c.solar_id ? 'on' : ''}" onclick="openSolarContractDetail('${esc(x.solar_id)}', typeof solarV2DetailTab!=='undefined'?solarV2DetailTab:'billing')">
          <span class="ga-dot ${lv}" aria-hidden="true"></span>
          <span class="ga-nav-name">${esc(x.building_name || x.solar_id)}${x.phase_label ? `（${esc(x.phase_label)}）` : ''}</span>
          <span class="ga-nav-meta"><span>${esc(x.status || '')}</span><span>${x.capacity_kwp || '-'} kWp</span><span>${fmtMoney(x.base_annual_rent)}／年</span>${x.contract_end ? `<span>迄 ${roc(x.contract_end)}</span>` : ''}${n ? `<span class="${lv === 'red' ? 'late' : 'soon'}">預警 ${n}</span>` : ''}</span>
        </button>`;
      }).join('');

      return `
        <div class="ga-bar-hd">
          <h2>☀️ 太陽能租賃</h2>
          <button type="button" class="btn-xs" onclick="opsSolarYear--;renderCurrentView()">◀ ${opsSolarYear - 1}</button>
          <strong class="ga-roc">${opsSolarYear} 年</strong>
          <button type="button" class="btn-xs" onclick="opsSolarYear++;renderCurrentView()">${opsSolarYear + 1} ▶</button>
          <span class="sp"></span>
          <button type="button" class="btn-sm" onclick="openSharedMeterBatchModal()">⚡ 共錶批次拆帳</button>
          <button type="button" class="btn-sm" onclick="printSolarPDF()">🖨️ 總表 PDF</button>
          <button type="button" class="btn-sm btn-primary" onclick="openSolarContractModal()">＋ 新增租賃契約</button>
        </div>
        <div class="ga-kpis">
          <div class="ga-kpi ok"><div class="ga-kpi-lb">☀️ 管理中標租容量</div><div class="ga-kpi-v">${kwp.toFixed(2)}<small>kWp・${active.length} 約</small></div></div>
          <div class="ga-kpi ${fig.due > fig.actual ? 'amber' : 'ok'}"><div class="ga-kpi-lb">💰 ${opsSolarYear} 年應收／已收</div><div class="ga-kpi-v">${fmtMoney(fig.due)}<small>應收</small></div>
            <div class="ga-kpi-sub">已收 ${fmtMoney(fig.actual)}${fig.schedDue ? `｜含繳納時程 ${fmtMoney(fig.schedDue)}（尚未建對帳單）` : ''}</div></div>
          <div class="ga-kpi"><div class="ga-kpi-lb">🔒 履約保證金餘額</div><div class="ga-kpi-v">${fmtMoney(bond)}</div></div>
          <div class="ga-kpi ${red ? 'red' : alerts.length ? 'amber' : 'ok'}"><div class="ga-kpi-lb">🚨 待處理預警</div><div class="ga-kpi-v">${alerts.length}<small>${red ? `紅燈 ${red}` : '項'}</small></div></div>
        </div>
        <div class="ga-split w-solar">
          <nav class="ga-nav" aria-label="太陽能契約">
            <div class="ga-nav-hd">🏢 契約（${contracts.length}）</div>
            <div class="ga-nav-list">
              ${list}
              ${alerts.length ? `<div class="ga-nav-grp"><span>🔔 預警雷達</span><span>${alerts.length}</span></div>
                ${alerts.map((a, i) => `<button type="button" class="ga-alert-row ${a.level === 'red' ? 'red' : ''}" onclick="window._solarV2Alerts[${i}]?.action?.()"><strong>${esc(a.badge)}</strong>｜${esc(a.title)}<div>${esc(a.detail || '')}</div></button>`).join('')}` : ''}
            </div>
          </nav>
          <section class="ga-pane" data-key="solar-${esc(c.solar_id)}-${esc(typeof solarV2DetailTab !== 'undefined' ? solarV2DetailTab : '')}">${detail}</section>
        </div>`;
    }
  });

  // --------------------------------------------------------------------------
  // 4. 水電費：頂部篩選＋預算；左欄圖表與錶號，右欄帳單
  // --------------------------------------------------------------------------
  function enhanceUtilities() {
    const mv = document.getElementById('main-view');
    const kids = Array.from(mv.children);
    const panels = kids.filter(k => k.classList.contains('panel'));
    if (panels.length < 3) return; // 無錶號時維持單欄
    const h3 = el => el.querySelector('.panel-hd h3')?.textContent || '';
    const chart = panels.find(p => h3(p).includes('走勢'));
    const meters = panels.find(p => h3(p).includes('多錶號'));
    const bills = panels.find(p => h3(p).includes('各期水電帳單'));
    if (!bills || !(chart || meters)) return;
    const split = document.createElement('div');
    split.className = 'ga-split w-util';
    split.innerHTML = '<section class="ga-pane" data-key="util-l"></section><section class="ga-pane" data-key="util-r"></section>';
    (chart || meters).insertAdjacentElement('beforebegin', split);
    const [l, r] = split.children;
    if (chart) l.appendChild(chart);
    if (meters) l.appendChild(meters);
    r.appendChild(bills);
  }

  // --------------------------------------------------------------------------
  // 掛載
  // --------------------------------------------------------------------------
  GA.onAfterRender(tab => {
    if (isDesktopFit()) {
      if (tab === 'projects' && typeof selectedProjectId !== 'undefined' && selectedProjectId) enhanceProjectDetail();
      if (tab === 'utilities') enhanceUtilities();
    }
    syncShell(tab);
    restorePaneScroll();
  });
  window.addEventListener('resize', () => {
    clearTimeout(window._gaSplitResize);
    window._gaSplitResize = setTimeout(() => { if (typeof renderCurrentView === 'function') renderCurrentView(); }, 250);
  });

  GA.registerModule({ id: 'split-pane', title: '業務子頁一屏雙欄', navGroup: 'layout', icon: '🪟' });
})();
