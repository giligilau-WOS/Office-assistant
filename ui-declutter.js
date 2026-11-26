/**
 * ============================================================================
 * 學校總務行政助理 — 介面降噪模組 (ui-declutter.js)
 * 必須最後載入（在所有主題／版面模組之後）。
 *
 * 1. 頂部 Header 收斂：原本 6 顆按鈕（行事曆／版面風格／新增採購／新增例行／
 *    連線與備份…）收斂為兩顆：「＋ 新增 ▾」主按鈕 ＋「⚙️ 設定」選單。
 *    原按鈕節點只隱藏（.ud-hide），不刪除，既有 ID 與自我測試相依節點完整保留。
 * 2. 卡片降噪：移除卡片背景進度底色與底部進度條、隱藏進度／附件小標籤，
 *    卡片只留「狀態色籤＋標題＋日期」，細節統一由「檢視細節」視窗呈現。
 * 3. 狀態色票收斂為三色：🔴 紅／橘 = 逾期、緊急；🔵 藍 = 進行中、正常；
 *    ⚪ 灰 = 已完成、次要。原綠色標籤一律改為藍色。
 * 4. 戰情總覽改為三區塊：(A) 急件與到期提醒（紅／橘，上限 5 筆，其餘「全部」視窗）
 *    (B) 模組關鍵數據卡（數字 ＋ 最緊急 1 筆）(C) 快速入口（Memo 快填 ＋ 常用按鈕）。
 *    原儀表板整包移入隱藏容器 #ud-legacy-dash（不刪除節點）。
 * ============================================================================
 */

(function initUiDeclutter() {
  // --------------------------------------------------------------------------
  // 1. 樣式
  // --------------------------------------------------------------------------
  if (!document.getElementById('ui-declutter-style')) {
    const st = document.createElement('style');
    st.id = 'ui-declutter-style';
    st.textContent = `
      .ud-hide { display: none !important; }

      /* ---------- Header 兩顆按鈕 ＋ 下拉選單 ---------- */
      #btn-ud-new, #btn-ud-settings { white-space: nowrap; }
      #btn-ud-settings.is-open, #btn-ud-new.is-open { box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.18) !important; }
      #ud-menu {
        position: fixed;
        z-index: 9998;
        min-width: 220px;
        max-width: calc(100vw - 24px);
        background: #FFFFFF;
        color: #0F172A;
        border: 1px solid #CBD5E1;
        border-radius: 10px;
        box-shadow: 0 14px 36px rgba(15, 23, 42, 0.18);
        padding: 6px;
        display: none;
        font-size: 14px;
      }
      #ud-menu.open { display: block; }
      #ud-menu .ud-item {
        display: flex !important; align-items: center; justify-content: flex-start !important; gap: 10px;
        width: 100%; text-align: left;
        background: transparent !important; border: none !important; box-shadow: none !important;
        color: inherit !important;
        padding: 9px 10px !important; min-height: 38px;
        border-radius: 7px; cursor: pointer; font-size: 14px; font-weight: 600;
      }
      #ud-menu .ud-item:hover, #ud-menu .ud-item:focus-visible { background: #F1F5F9 !important; outline: none; }
      #ud-menu .ud-item small { margin-left: auto; color: #64748B; font-weight: 500; font-size: 12px; }
      #ud-menu .ud-status {
        display: flex; align-items: center; gap: 8px;
        padding: 8px 10px 10px; margin-bottom: 4px;
        border-bottom: 1px solid #E2E8F0;
        font-size: 13px; color: #334155;
      }
      #ud-menu .ud-status .ud-dot { width: 8px; height: 8px; border-radius: 50%; background: #94A3B8; flex-shrink: 0; }
      #ud-menu .ud-status.ok .ud-dot { background: #2563EB; }
      #ud-menu .ud-status.err .ud-dot { background: #DC2626; }
      body[data-nordic-theme="obsidian"] #ud-menu { background: #1C1F26; color: #E5E7EB; border-color: #374151; }
      body[data-nordic-theme="obsidian"] #ud-menu .ud-item:hover { background: #2A2F38 !important; }
      body[data-nordic-theme="obsidian"] #ud-menu .ud-status { color: #CBD5E1; border-color: #374151; }

      /* ---------- 卡片降噪：去背景進度底色與底部進度條 ---------- */
      html body .card-prog-bg::before,
      html body .card-prog-bg::after { display: none !important; }
      html body .card-prog-bg { background: #FFFFFF !important; }
      html body .card-prog-bg.tone-red   { border-left: 3px solid #DC2626 !important; }
      html body .card-prog-bg.tone-amber { border-left: 3px solid #EA580C !important; }
      html body .card-prog-bg.tone-blue  { border-left: 3px solid #2563EB !important; }
      html body .card-prog-bg.tone-green { border-left: 3px solid #059669 !important; }
      body[data-nordic-theme="obsidian"] .card-prog-bg { background: transparent !important; }

      /* 戰情總覽只留 3 資訊點：色籤／標題／日期 → 隱藏進度與附件小標籤、內嵌步驟 */
      body[data-ud-tab="dashboard"] .prog-pill,
      body[data-ud-tab="dashboard"] .routine-item .item-row .tag-gray,
      body[data-ud-tab="dashboard"] .rtn-inline-steps { display: none !important; }

      /* ---------- 三色原則：紅橘 = 急件／卡關、藍 = 進行中、綠 = 已完成／正常、灰 = 分類與其他 ---------- */
      html body .tag-amber { background: #FFEDD5 !important; color: #C2410C !important; border-color: #FED7AA !important; }
      html body .tag-green { background: #DCFCE7 !important; color: #047857 !important; border-color: #BBF7D0 !important; }

      /* ---------- 戰情總覽三區塊 ---------- */
      #ud-legacy-dash { display: none !important; }
      body[data-ud-tab="dashboard"] #main-view { min-width: 0 !important; max-width: 100% !important; box-sizing: border-box; }
      /* 主內容區固定撐滿可用寬度（避免依內容縮成置中窄欄，如年度甘特圖） */
      #main-view { width: 100% !important; min-width: 0 !important; box-sizing: border-box; }
      #ud-dash {
        display: flex; flex-direction: column; gap: 16px;
        flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden;
        min-width: 0; width: 100%; max-width: 100%;
        padding-bottom: 4px;
      }
      #ud-dash > section { min-width: 0; max-width: 100%; }
      #ud-dash .panel { margin: 0 !important; flex-shrink: 0; }
      #ud-dash .panel-hd { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }

      /* (A) 急件列：不套框，只用分隔線 ＋ 左色條 */
      .ud-zone-a-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
      .ud-rows { display: flex; flex-direction: column; padding-top: 4px !important; padding-bottom: 4px !important; }
      .ud-row {
        display: flex; align-items: center; gap: 10px;
        padding: 9px 10px; min-height: 48px;
        border-left: 3px solid #94A3B8;
        border-bottom: 1px solid var(--border, #E2E8F0);
        cursor: pointer;
      }
      .ud-row:last-of-type { border-bottom: none; }
      .ud-row:hover, .ud-row:focus-visible { background: rgba(37, 99, 235, 0.05); outline: none; }
      .ud-row.lv-red { border-left-color: #DC2626; }
      .ud-row.lv-amber { border-left-color: #EA580C; }
      .ud-row.lv-blue { border-left-color: #2563EB; }
      .ud-row > .tag { flex-shrink: 0; }
      .ud-row-main { flex: 1 1 auto; min-width: 0; }
      .ud-row-title { font-weight: 700; font-size: 14px; color: var(--text, #0F172A); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .ud-row-sub { font-size: 12.5px; color: var(--muted, #64748B); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .ud-row-go { flex-shrink: 0; font-size: 12.5px; font-weight: 700; color: #2563EB; min-width: 78px; text-align: right; }
      .ud-row-due { flex-shrink: 0; margin-left: auto; font-size: 13px; font-weight: 700; color: var(--muted, #475569); white-space: nowrap; font-variant-numeric: tabular-nums; }
      .ud-row-due.is-red { color: #DC2626; }
      .ud-row-due.is-amber { color: #C2410C; }
      .ud-row > .tag:last-child { margin-left: auto; flex-shrink: 0; }
      .ud-fold {
        display: flex; align-items: center; justify-content: space-between; gap: 8px;
        width: 100%; margin-top: 6px; padding: 10px 12px !important; min-height: 42px;
        background: var(--bg, #F8FAFC) !important; border: 1px dashed var(--border, #CBD5E1) !important; box-shadow: none !important;
        border-radius: 8px; color: var(--text, #334155) !important; font-size: 13.5px; font-weight: 600; cursor: pointer;
      }
      .ud-fold:hover { border-color: #93C5FD !important; }
      .ud-fold-act { color: #2563EB; font-weight: 700; font-size: 12.5px; }
      .ud-fold-list { display: flex; flex-direction: column; margin-top: 4px; }
      .ud-more {
        margin-top: 4px; align-self: flex-start;
        background: transparent !important; border: none !important; box-shadow: none !important;
        color: #2563EB !important; font-weight: 700; font-size: 13px; padding: 6px 10px !important;
      }
      .ud-empty { padding: 14px 10px; color: var(--muted, #64748B); font-size: 14px; }

      /* (B) 模組卡 */
      .ud-zone-title { font-size: 13px; font-weight: 800; color: var(--muted, #64748B); margin: 0 0 6px 2px; }
      .ud-mods { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 16px; }
      .ud-mod {
        background: var(--panel, #FFFFFF);
        border: 1px solid var(--border, #E2E8F0);
        border-left: 3px solid #94A3B8;
        border-radius: 10px;
        padding: 14px 16px;
        cursor: pointer; min-width: 0;
        display: flex; flex-direction: column; gap: 4px;
      }
      .ud-mod:hover, .ud-mod:focus-visible { border-color: #93C5FD; outline: none; }
      .ud-mod.tone-red { border-left-color: #DC2626; }
      .ud-mod.tone-amber { border-left-color: #EA580C; }
      .ud-mod.tone-blue { border-left-color: #2563EB; }
      .ud-mod-hd { display: flex; align-items: center; justify-content: space-between; font-size: 13px; font-weight: 700; color: var(--muted, #475569); }
      .ud-mod-cnt { font-size: 11.5px; font-weight: 800; border-radius: 999px; padding: 1px 8px; }
      .ud-mod-cnt.tag-red { background: #FEE2E2; color: #B91C1C; }
      .ud-mod-cnt.tag-amber { background: #FFEDD5; color: #C2410C; }
      .ud-mod-num { font-size: 26px; font-weight: 800; line-height: 1.1; color: var(--text, #0F172A); font-variant-numeric: tabular-nums; }
      .ud-mod-num small { font-size: 12px; font-weight: 600; color: var(--muted, #64748B); margin-left: 4px; }
      .ud-mod-top { display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 12.5px; min-height: 22px; }
      .ud-mod-top > .tag { flex-shrink: 0; }
      .ud-mod-top-txt { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; color: var(--text, #334155); }
      .ud-mod-ok { color: var(--muted, #64748B); }

      /* (C) 快速入口 */
      .ud-quick { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 14px; align-items: start; }
      .ud-quick-label { font-size: 13px; font-weight: 700; color: var(--muted, #475569); margin-bottom: 6px; }
      .ud-quick-memo .memo-quick { margin: 0 !important; }
      .ud-quick-btns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
      .ud-quick-btns button { min-height: 40px; justify-content: center; white-space: nowrap; }
      .ud-quick-btns a.ud-quick-link {
        grid-column: 1 / -1; min-height: 40px; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
        padding: 7px 12px; border-radius: 8px; border: 1px solid #fcd34d; background: #fffbeb; color: #92400e;
        font-size: 13px; font-weight: 700; text-decoration: none; transition: background .15s, border-color .15s;
      }
      .ud-quick-btns a.ud-quick-link:hover { background: #fef3c7; border-color: #f59e0b; text-decoration: none; }
      body[data-nordic-theme="obsidian"] .ud-quick-btns a.ud-quick-link { background: rgba(245, 158, 11, 0.14); border-color: rgba(251, 191, 36, 0.45); color: #fde68a; }
      @media (max-width: 760px) {
        .ud-quick { grid-template-columns: 1fr; }
        .ud-mods { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .ud-row-go { display: none; }
        .ud-row-due { font-size: 12px; }
      }

      body[data-nordic-theme="obsidian"] .ud-mod { background: #1C1F26; border-color: #374151; }
      body[data-nordic-theme="obsidian"] .ud-row-title, body[data-nordic-theme="obsidian"] .ud-mod-num { color: #F3F4F6; }
      body[data-nordic-theme="obsidian"] .ud-mod-top-txt { color: #D1D5DB; }

      /* 戰情改三區塊後，「版面排列」選項已不適用 → 只留配色主題 */
      #nordic-style-popover > .lsp-sec-title:nth-child(2),
      #nordic-style-popover > .lsp-grid-2:nth-child(3) { display: none !important; }
    `;
    document.head.appendChild(st);
  }

  // --------------------------------------------------------------------------
  // 2. 下拉選單
  // --------------------------------------------------------------------------
  function ensureMenu() {
    let m = document.getElementById('ud-menu');
    if (!m) {
      m = document.createElement('div');
      m.id = 'ud-menu';
      m.setAttribute('role', 'menu');
      m.onclick = e => e.stopPropagation();
      document.body.appendChild(m);
    }
    return m;
  }

  function closeMenu() {
    const m = document.getElementById('ud-menu');
    if (m) { m.classList.remove('open'); m.dataset.owner = ''; }
    document.getElementById('btn-ud-new')?.classList.remove('is-open');
    document.getElementById('btn-ud-settings')?.classList.remove('is-open');
  }

  function openMenu(btn, html) {
    const m = ensureMenu();
    if (m.classList.contains('open') && m.dataset.owner === btn.id) { closeMenu(); return; }
    closeMenu();
    m.innerHTML = html;
    m.dataset.owner = btn.id;
    m.classList.add('open');
    btn.classList.add('is-open');
    const r = btn.getBoundingClientRect();
    const w = m.offsetWidth;
    m.style.top = `${Math.round(r.bottom + 6)}px`;
    m.style.left = `${Math.round(Math.max(12, Math.min(r.right - w, window.innerWidth - w - 12)))}px`;
    m.querySelector('.ud-item')?.focus();
  }

  window.udMenuAction = function(act, ev) {
    if (ev) ev.stopPropagation();
    closeMenu();
    if (act === 'new-project' && typeof openProjectWizard === 'function') openProjectWizard();
    else if (act === 'new-routine' && typeof openRoutineModal === 'function') openRoutineModal();
    else if (act === 'new-memo') {
      if (typeof switchTab === 'function' && typeof currentTab !== 'undefined' && currentTab !== 'dashboard') switchTab('dashboard');
      setTimeout(() => document.getElementById('memo-input')?.focus(), 60);
    }
    else if (act === 'settings' && typeof openSettingsModal === 'function') openSettingsModal();
    else if (act === 'style' && typeof window.toggleLayoutSwitcherPopover === 'function') window.toggleLayoutSwitcherPopover(ev);
    else if (act === 'calendar' && typeof window.toggleNordicCalendar === 'function') window.toggleNordicCalendar();
    else if (act === 'dedupe' && typeof window.openDedupeModal === 'function') window.openDedupeModal();
  };

  window.toggleUdNewMenu = function(ev) {
    if (ev) ev.stopPropagation();
    openMenu(ev.currentTarget, `
      <button type="button" class="ud-item" role="menuitem" onclick="udMenuAction('new-project', event)">📋 採購案</button>
      <button type="button" class="ud-item" role="menuitem" onclick="udMenuAction('new-routine', event)">🔁 例行事務</button>
      <button type="button" class="ud-item" role="menuitem" onclick="udMenuAction('new-memo', event)">📌 交辦 Memo</button>
    `);
  };

  window.toggleUdSettingsMenu = function(ev) {
    if (ev) ev.stopPropagation();
    const dot = document.getElementById('sync-dot');
    const syncTxt = (document.getElementById('sync-text')?.textContent || '').trim() || '未連線';
    const stCls = dot?.classList.contains('ok') ? 'ok' : dot?.classList.contains('err') ? 'err' : '';
    const calBtn = document.getElementById('btn-toggle-calendar');
    const calLabel = calBtn ? (calBtn.textContent || '').replace('📅', '').trim() : '';
    const esc_ = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    openMenu(ev.currentTarget, `
      <div class="ud-status ${stCls}"><span class="ud-dot"></span><span>${esc_(syncTxt)}</span></div>
      <button type="button" class="ud-item" role="menuitem" onclick="udMenuAction('settings', event)">🔌 同步與備份</button>
      ${typeof window.toggleLayoutSwitcherPopover === 'function' ? `<button type="button" class="ud-item" role="menuitem" onclick="udMenuAction('style', event)">🎨 配色風格</button>` : ''}
      ${calBtn ? `<button type="button" class="ud-item" role="menuitem" onclick="udMenuAction('calendar', event)">📅 行事曆 <small>${esc_(calLabel.replace('行事曆', ''))}</small></button>` : ''}
      ${typeof window.openDedupeModal === 'function' ? `<button type="button" class="ud-item" role="menuitem" onclick="udMenuAction('dedupe', event)">🔍 檢查重複資料</button>` : ''}
    `);
  };

  document.addEventListener('click', closeMenu);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  window.addEventListener('resize', closeMenu);

  // --------------------------------------------------------------------------
  // 3. Header 收斂（每次重繪後重新套用，原節點只隱藏不刪除）
  // --------------------------------------------------------------------------
  function declutterHeader() {
    const actions = document.querySelector('.topbar .top-actions');
    if (!actions) return;

    const toHide = [
      document.getElementById('btn-toggle-calendar'),
      document.getElementById('btn-layout-switcher'),
      document.getElementById('btn-quick-new-routine'),
      ...Array.from(actions.querySelectorAll('button')).filter(b => {
        const oc = b.getAttribute('onclick') || '';
        return oc.includes('openProjectWizard') || oc.includes('openSettingsModal');
      })
    ];
    toHide.forEach(el => el && el.classList.add('ud-hide'));

    if (!document.getElementById('btn-ud-new')) {
      const b = document.createElement('button');
      b.id = 'btn-ud-new';
      b.type = 'button';
      b.className = 'btn-primary';
      b.textContent = '＋ 新增 ▾';
      b.setAttribute('aria-haspopup', 'menu');
      b.onclick = window.toggleUdNewMenu;
      actions.appendChild(b);
    }
    if (!document.getElementById('btn-ud-settings')) {
      const b = document.createElement('button');
      b.id = 'btn-ud-settings';
      b.type = 'button';
      b.textContent = '⚙️ 設定';
      b.title = '連線狀態、備份、版面風格、行事曆';
      b.setAttribute('aria-haspopup', 'menu');
      b.onclick = window.toggleUdSettingsMenu;
      actions.appendChild(b);
    }
    // 永遠保持兩顆按鈕在最右側
    actions.appendChild(document.getElementById('btn-ud-new'));
    actions.appendChild(document.getElementById('btn-ud-settings'));
  }

  // --------------------------------------------------------------------------
  // 4. 戰情總覽三區塊：(A) 急件與到期 ＋ (B) 模組關鍵數據卡 ＋ (C) 快速入口
  //    原儀表板（KPI 列、四欄面板）整包移入隱藏容器，節點保留不刪除；
  //    Memo 快速輸入框（#memo-input）整塊搬到 (C) 區，維持唯一 ID。
  // --------------------------------------------------------------------------
  const A_LIMIT = 5;
  const UTIL_BADGES = ['水電異常', '水費異常', '電費異常', '水電預算', '節費建議'];
  const h = s => (typeof esc === 'function' ? esc(s) : String(s ?? ''));
  const levelTag = lv => (lv === 'red' ? 'tag-red' : lv === 'amber' ? 'tag-amber' : lv === 'blue' ? 'tag-blue' : 'tag-gray');

  function udCtx() {
    const t = (typeof appData !== 'undefined' && appData.tables) || {};
    const openMemos = (t.Quick_Memos || []).filter(m => !m.is_done);
    const routines = (t.Annual_Routines || []).filter(r => r.is_active !== false);
    return {
      t, openMemos, routines,
      memoTitles: new Set(openMemos.map(m => m.content)),
      routineIdByTitle: Object.fromEntries(routines.map(r => [r.title, r.routine_id]))
    };
  }

  function classifyAlert(a, ctx) {
    const b = String(a.badge || '');
    if (b === '例行業務') return 'routine';
    if (b.startsWith('太陽能') || b.startsWith('光電')) return 'solar';
    if (UTIL_BADGES.includes(b)) return 'util';
    if (ctx.memoTitles.has(a.title)) return 'memo';
    return 'project';
  }

  const MOD_TAB = { project: 'projects', routine: 'routines', solar: 'solar', util: 'utilities' };

  window.udGoModule = function(key) {
    if (key === 'memo') { window.openUdMemoModal(); return; }
    if (key === 'solar' && typeof solarV2SelectedId !== 'undefined') solarV2SelectedId = null;
    if (typeof switchTab === 'function') switchTab(MOD_TAB[key] || 'dashboard');
  };

  window.udAlertAct = function(i) {
    const a = (window._udAlerts || [])[i];
    if (!a) return;
    if (typeof closeModal === 'function' && document.getElementById('ud-all-alerts')) closeModal();
    const ctx = udCtx();
    const mod = classifyAlert(a, ctx);
    if (mod === 'memo') { window.openUdMemoModal(); return; }
    if (mod === 'routine' && ctx.routineIdByTitle[a.title] && typeof openRoutineDetailModal === 'function') {
      openRoutineDetailModal(ctx.routineIdByTitle[a.title]);
      return;
    }
    if (typeof a.action === 'function') { a.action(); return; }
    window.udGoModule(mod);
  };

  // 日期結合相對天數：「11/22 截止（逾期 2 天）」
  function relDue(ymd, word = '截止') {
    if (!ymd || typeof diffDays !== 'function' || typeof todayStr !== 'function') return null;
    const d = diffDays(todayStr(), ymd);
    const rel = d < 0 ? `逾期 ${Math.abs(d)} 天` : d === 0 ? '今天' : `剩 ${d} 天`;
    return { d, text: `${ymd.slice(5, 7)}/${ymd.slice(8, 10)} ${word}（${rel}）` };
  }
  function dueFromDetail(detail) {
    const m = /(\d{4}-\d{2}-\d{2})/.exec(String(detail || ''));
    if (!m) return null;
    return relDue(m[1], /提醒/.test(detail) ? '提醒' : '截止');
  }

  // 具體動詞按鈕（取代「處理」）
  const MOD_VERB = { project: '更新進度', routine: '檢視步驟', memo: '開啟交辦', solar: '檢視契約', util: '檢視帳單' };

  function alertRowHTML(a, i) {
    const due = dueFromDetail(a.detail);
    const mod = classifyAlert(a, udCtx());
    const dueCls = due && (due.d < 0 || a.level === 'red') ? 'is-red' : 'is-amber';
    return `
      <div class="ud-row lv-${h(a.level)}" role="button" tabindex="0"
           onclick="udAlertAct(${i})" onkeydown="if(event.key==='Enter'){udAlertAct(${i})}">
        <span class="tag ${levelTag(a.level)}">${h(a.badge || '提醒')}</span>
        <div class="ud-row-main">
          <div class="ud-row-title">${h(a.title || '')}</div>
          ${!due && a.detail ? `<div class="ud-row-sub">${h(a.detail)}</div>` : ''}
        </div>
        ${due ? `<span class="ud-row-due ${dueCls}">${h(due.text)}</span>` : ''}
        <span class="ud-row-go">${MOD_VERB[mod] || '檢視明細'} →</span>
      </div>`;
  }

  // 首頁只看急件：其餘正常推進的項目摺疊成一行
  let udFoldOpen = false;
  window.toggleUdFold = function() { udFoldOpen = !udFoldOpen; renderCurrentView(); };

  function normalItems(urgentAlerts, ctx) {
    const urgentTitles = urgentAlerts.map(a => String(a.title || ''));
    const isUrgent = name => urgentTitles.some(t => t === name || t.startsWith(name + '｜'));
    const items = [];
    (ctx.t.Projects || [])
      .filter(p => !['已結案', '廢標撤案'].includes(p.status) && !isUrgent(p.project_name))
      .forEach(p => {
        const ph = typeof projectStatusPhrase === 'function' ? projectStatusPhrase(p) : { text: p.status, cls: 'tag-blue' };
        items.push({ sort: 9999, title: p.project_name, right: `<span class="tag ${ph.cls}">${h(ph.text)}</span>`,
          act: `openProjectDetail('${h(p.project_id)}')` });
      });
    if (typeof computeRoutineSchedule === 'function') {
      ctx.routines.filter(r => !isUrgent(r.title)).forEach(r => {
        const s = computeRoutineSchedule(r);
        const due = relDue(s.dueDate);
        items.push({ sort: s.diffDays, title: r.title, right: due ? `<span class="ud-row-due">${h(due.text)}</span>` : '',
          act: typeof openRoutineDetailModal === 'function' ? `openRoutineDetailModal('${h(r.routine_id)}')` : `switchTab('routines')` });
      });
    }
    return items.sort((x, y) => x.sort - y.sort);
  }

  function foldHTML(items) {
    if (!items.length) return '';
    return `
      <button type="button" class="ud-fold" aria-expanded="${udFoldOpen}" onclick="toggleUdFold()">
        <span>其他進行中 <strong>${items.length}</strong> 件</span>
        <span class="ud-fold-act">${udFoldOpen ? '收合 ▲' : '點擊展開 ▼'}</span>
      </button>
      ${udFoldOpen ? `<div class="ud-fold-list">${items.map(it => `
        <div class="ud-row lv-blue" role="button" tabindex="0" onclick="${it.act}" onkeydown="if(event.key==='Enter'){${it.act}}">
          <div class="ud-row-main"><div class="ud-row-title">${h(it.title)}</div></div>
          ${it.right}
        </div>`).join('')}</div>` : ''}`;
  }

  window.openUdAllAlerts = function() {
    const list = window._udAlerts || [];
    if (typeof openModal !== 'function') return;
    openModal(`🚨 全部提醒（${list.length} 筆）`,
      `<div id="ud-all-alerts" class="ud-rows">${list.length ? list.map(alertRowHTML).join('') : '<div class="empty-state">目前沒有提醒。</div>'}</div>`,
      `<button class="btn-primary" onclick="closeModal()">關閉</button>`);
  };

  function memoListHTML() {
    const ctx = udCtx();
    const today = typeof todayStr === 'function' ? todayStr() : '';
    const doneCnt = (ctx.t.Quick_Memos || []).length - ctx.openMemos.length;
    const body = ctx.openMemos.length && typeof renderMemoCardHTML === 'function'
      ? ctx.openMemos.map(m => renderMemoCardHTML(m, today)).join('')
      : '<div class="empty-state">✓ 沒有待辦 Memo。</div>';
    return `${body}${doneCnt > 0 ? `<div class="item-meta" style="margin-top:8px">另有 ${doneCnt} 筆已完成</div>` : ''}`;
  }

  window.openUdMemoModal = function() {
    if (typeof openModal !== 'function') return;
    openModal('📌 交辦 Memo', `<div id="ud-memo-list">${memoListHTML()}</div>`,
      `<button onclick="closeModal();udMenuAction('new-memo')">＋ 新增 Memo</button><button class="btn-primary" onclick="closeModal()">關閉</button>`);
  };

  function moduleCardsHTML(alerts, ctx) {
    const t = ctx.t;
    const activeProjects = (t.Projects || []).filter(p => !['已結案', '廢標撤案'].includes(p.status));
    const activeSolar = (t.Solar_Contracts || []).filter(c => !['已屆滿', '已期滿', '已解約'].includes(c.status));
    const meters = (t.Utilities_Meters || []).filter(m => m.is_active !== false);

    const mods = [
      { key: 'project', icon: '📋', name: '採購履約', num: activeProjects.length, unit: '件執行中' },
      { key: 'routine', icon: '🔁', name: '例行事務', num: ctx.routines.length, unit: '項列管' },
      { key: 'solar', icon: '☀️', name: '太陽能', num: activeSolar.length, unit: '份契約' },
      { key: 'util', icon: '⚡', name: '水電費', num: meters.length, unit: '個錶號' },
      { key: 'memo', icon: '📌', name: '交辦 Memo', num: ctx.openMemos.length, unit: '件待辦' }
    ];

    return mods.map(m => {
      const mine = alerts.filter(a => classifyAlert(a, ctx) === m.key && a.level !== 'blue');
      const top = mine[0];
      let tone = top ? top.level : 'none';
      let topHtml;
      if (top) {
        topHtml = `<span class="tag ${levelTag(top.level)}">${h(top.badge || '提醒')}</span><span class="ud-mod-top-txt">${h(top.title)}</span>`;
      } else if (m.key === 'routine' && ctx.routines.length && typeof computeRoutineSchedule === 'function') {
        const next = ctx.routines.map(r => ({ r, s: computeRoutineSchedule(r) })).sort((x, y) => x.s.diffDays - y.s.diffDays)[0];
        tone = 'blue';
        topHtml = `<span class="tag tag-blue">剩 ${h(next.s.diffDays)} 天</span><span class="ud-mod-top-txt">${h(next.r.title)}</span>`;
      } else if (m.key === 'memo' && ctx.openMemos.length) {
        tone = 'blue';
        topHtml = `<span class="tag tag-blue">待辦</span><span class="ud-mod-top-txt">${h(ctx.openMemos[0].content)}</span>`;
      } else {
        topHtml = `<span class="ud-mod-ok">✓ 無急件</span>`;
      }
      return `
        <div class="ud-mod tone-${h(tone)}" role="button" tabindex="0"
             onclick="udGoModule('${m.key}')" onkeydown="if(event.key==='Enter'){udGoModule('${m.key}')}">
          <div class="ud-mod-hd"><span>${m.icon} ${m.name}</span>${mine.length ? `<span class="ud-mod-cnt ${levelTag(mine.some(a => a.level === 'red') ? 'red' : 'amber')}">${mine.length}</span>` : ''}</div>
          <div class="ud-mod-num">${h(m.num)}<small>${m.unit}</small></div>
          <div class="ud-mod-top">${topHtml}</div>
        </div>`;
    }).join('');
  }

  function buildThreeZoneDashboard() {
    const main = document.getElementById('main-view');
    if (!main || document.getElementById('ud-dash')) return;
    if (!main.querySelector('.dash-grid')) return;

    // 舊儀表板整包收進隱藏容器（不刪除節點）
    const legacy = document.createElement('div');
    legacy.id = 'ud-legacy-dash';
    legacy.setAttribute('aria-hidden', 'true');
    while (main.firstChild) legacy.appendChild(main.firstChild);

    const ctx = udCtx();
    const q = (document.getElementById('global-search')?.value || '').trim().toLowerCase();
    const all = typeof buildAllAlerts === 'function' ? buildAllAlerts() : [];
    window._udAlerts = all;
    const urgent = all
      .map((a, i) => ({ a, i }))
      .filter(({ a }) => a.level === 'red' || a.level === 'amber')
      .filter(({ a }) => !q || `${a.badge} ${a.title} ${a.detail || ''}`.toLowerCase().includes(q));
    const redN = urgent.filter(x => x.a.level === 'red').length;
    const amberN = urgent.length - redN;

    const dash = document.createElement('div');
    dash.id = 'ud-dash';
    dash.innerHTML = `
      <section class="panel ud-zone-a" aria-label="急件與到期提醒">
        <div class="panel-hd">
          <h3>🚨 急件與到期提醒</h3>
          <div class="ud-zone-a-meta">
            ${redN ? `<span class="tag tag-red">逾期／緊急 ${redN}</span>` : ''}
            ${amberN ? `<span class="tag tag-amber">即將到期 ${amberN}</span>` : ''}
            ${all.length ? `<button type="button" class="btn-xs" onclick="openUdAllAlerts()">全部 ${all.length} 筆 →</button>` : ''}
          </div>
        </div>
        <div class="panel-bd ud-rows">
          ${urgent.length
            ? urgent.slice(0, A_LIMIT).map(({ a, i }) => alertRowHTML(a, i)).join('') +
              (urgent.length > A_LIMIT ? `<button type="button" class="ud-more" onclick="openUdAllAlerts()">還有 ${urgent.length - A_LIMIT} 筆 →</button>` : '')
            : `<div class="ud-empty">${q ? `找不到符合「${h(q)}」的急件` : '✓ 目前沒有逾期或即將到期的事項'}</div>`}
          ${q ? '' : foldHTML(normalItems(urgent.map(x => x.a), ctx))}
        </div>
      </section>

      <section class="ud-zone-b" aria-label="模組關鍵數據">
        <div class="ud-zone-title">📊 各模組概況</div>
        <div class="ud-mods">${moduleCardsHTML(all, ctx)}</div>
      </section>

      <section class="panel ud-zone-c" aria-label="常用快速入口">
        <div class="panel-hd"><h3>⚡ 快速入口</h3></div>
        <div class="panel-bd ud-quick">
          <div class="ud-quick-memo"><div class="ud-quick-label">📌 快速記一筆交辦</div></div>
          <div class="ud-quick-btns">
            <button type="button" class="btn-primary" onclick="udMenuAction('new-project')">＋ 新增採購案</button>
            <button type="button" onclick="udMenuAction('new-routine')">＋ 新增例行事務</button>
            <button type="button" onclick="switchTab('annual-gantt')">📅 全校甘特圖</button>
            <button type="button" onclick="switchTab('templates')">🗂️ 標案模板</button>
            <a class="ud-quick-link" href="./campus-3d.html" target="_blank" rel="noopener" title="另開新分頁開啟溪埔國中 3D 校舍模型（測試建置中）">🏫 3D 校舍模型 <span class="badge-beta">測試建置中</span> ↗</a>
          </div>
        </div>
      </section>
    `;

    // Memo 快速輸入框整塊搬入 (C) 區，保留原 ID 與事件
    const memoQuick = legacy.querySelector('.memo-quick');
    if (memoQuick) dash.querySelector('.ud-quick-memo').appendChild(memoQuick);
    else dash.querySelector('.ud-quick-memo').innerHTML += `<button type="button" onclick="openUdMemoModal()">📌 開啟交辦 Memo</button>`;

    main.appendChild(dash);
    main.appendChild(legacy);
  }

  // --------------------------------------------------------------------------
  // 5. 年度甘特圖依容器實寬重繪（字級不再被縮放到看不清楚）
  // --------------------------------------------------------------------------
  function fitAnnualGantt() {
    if (typeof annualGanttFitW === 'undefined') return;
    const box = document.querySelector('#main-view .gantt-box');
    if (!box) return;
    const cs = getComputedStyle(box);
    const avail = Math.floor(box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
    if (avail > 0 && Math.abs(avail - annualGanttFitW) > 4) {
      annualGanttFitW = avail;
      renderCurrentView();
    }
  }

  let ganttResizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(ganttResizeTimer);
    ganttResizeTimer = setTimeout(() => {
      if (typeof currentTab !== 'undefined' && currentTab === 'annual-gantt') fitAnnualGantt();
    }, 200);
  });

  function applyDeclutter() {
    const tab = (typeof currentTab !== 'undefined' && currentTab) || 'dashboard';
    document.body.dataset.udTab = tab;
    if (tab === 'dashboard') buildThreeZoneDashboard();
    if (tab === 'annual-gantt') fitAnnualGantt();
    const memoList = document.getElementById('ud-memo-list');
    if (memoList) memoList.innerHTML = memoListHTML();
    declutterHeader();
  }

  // --------------------------------------------------------------------------
  // 4. 掛載
  // --------------------------------------------------------------------------
  if (window.GA_REGISTRY && typeof window.GA_REGISTRY.registerModule === 'function') {
    window.GA_REGISTRY.registerModule('ui-declutter.js', 'v1.0', '介面降噪：Header 收斂、卡片三資訊點、三色狀態票');
  }

  if (typeof renderCurrentView === 'function') {
    const _prevRenderView_ud = renderCurrentView;
    renderCurrentView = function() {
      _prevRenderView_ud();
      applyDeclutter();
    };
  }

  applyDeclutter();
})();
