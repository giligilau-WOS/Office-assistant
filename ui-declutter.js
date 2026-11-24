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
      html body .card-prog-bg.tone-blue,
      html body .card-prog-bg.tone-green { border-left: 3px solid #2563EB !important; }
      body[data-nordic-theme="obsidian"] .card-prog-bg { background: transparent !important; }

      /* 戰情總覽只留 3 資訊點：色籤／標題／日期 → 隱藏進度與附件小標籤、內嵌步驟 */
      body[data-ud-tab="dashboard"] .prog-pill,
      body[data-ud-tab="dashboard"] .routine-item .item-row .tag-gray,
      body[data-ud-tab="dashboard"] .rtn-inline-steps { display: none !important; }

      /* ---------- 三色票：綠 → 藍 ---------- */
      html body .tag-green { background: #DBEAFE !important; color: #1D4ED8 !important; border-color: #BFDBFE !important; }
      html body .tag-amber { background: #FFEDD5 !important; color: #C2410C !important; border-color: #FED7AA !important; }
      html body .ops-mini-card.warn-ok { border-left: 3px solid #94A3B8 !important; }
      html body .kpi-card.kpi-green { border-left-color: #2563EB !important; }
      body[data-nordic-theme="obsidian"] .tag-green { background: rgba(37, 99, 235, 0.22) !important; color: #93C5FD !important; }
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
      <button type="button" class="ud-item" role="menuitem" onclick="udMenuAction('settings', event)">🔌 連線與備份</button>
      ${typeof window.toggleLayoutSwitcherPopover === 'function' ? `<button type="button" class="ud-item" role="menuitem" onclick="udMenuAction('style', event)">🎨 版面風格</button>` : ''}
      ${calBtn ? `<button type="button" class="ud-item" role="menuitem" onclick="udMenuAction('calendar', event)">📅 行事曆 <small>${esc_(calLabel.replace('行事曆', ''))}</small></button>` : ''}
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

  function applyDeclutter() {
    document.body.dataset.udTab = (typeof currentTab !== 'undefined' && currentTab) || 'dashboard';
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
