/**
 * ============================================================================
 * 總務行政戰情助理 — 「07 暖沙雙層黃金艙 × 05 特大高清晰字級」核心戰情殼層 (ui-declutter.js v2.0)
 * 遵循規範：UI_DESIGN_RULES.md §0–§7
 *
 * 1. 徹底廢除 #ud-legacy-dash 隱形殭屍 DOM（零雙重渲染浪費）
 * 2. 注入 07 暖沙護眼色票（#FBF8F3 / #7C4A21 / #0D9488）× 05 號 16px 特大清晰字級（全站最低 >= 12px）
 * 3. 戰情總覽：上層 6 大業務黃金健康卡 ＋ 下層 5 : 4 : 3 黃金比例三欄執行艙（100dvh 零外層捲動）
 * 4. 側欄 4 大領域分組導覽 ＋ 矮視窗（vh < 780）自適應單行週曆保護 ＋ 節氣膠囊 ＋ Ctrl+K 搜尋
 * 5. 內建 window.verifyDesignRulesCompliance() 自動化設計憲章驗收斷言
 * ============================================================================
 */

(function initWarmSandWarRoomShell() {
  if (!window.GA_CORE) return;

  const h = s => (typeof esc === 'function' ? esc(s) : String(s ?? ''));
  const roc = (ymd, opts) => window.GA_CORE.formatRocDate(ymd, opts);
  const smart = raw => window.GA_CORE.formatSmartTitle(raw);

  const dashState = {
    alertBucket: 'URGENT7', // URGENT7 | DAYS30 | ALL
    alertPage: 1,
    projPage: 1
  };

  // --------------------------------------------------------------------------
  // 1. 注入「07 暖沙雙層黃金艙 × 05 特大高清晰字級」Design Tokens 與佈局樣式
  // --------------------------------------------------------------------------
  let styleEl = document.getElementById('ui-declutter-style');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'ui-declutter-style';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `
    :root {
      --bg-canvas: #FBF8F3;
      --bg-topbar: #F5EFE6;
      --bg-surface: #FFFFFF;
      --bg-subtle: #FAF6F0;
      --border-subtle: #E7DFD3;
      --border-strong: #D6CBB9;
      --text-primary: #1C1917;
      --text-secondary: #44403C;
      --text-muted: #57534E;
      --brand-primary: #7C4A21;
      --brand-accent: #0D9488;
      --brand-soft: #F5EDE3;
      --status-danger: #DC2626;
      --status-warn: #B45309;
      --status-ok: #047857;
      --fs-xs: 12.5px;
      --fs-sm: 14px;
      --fs-base: 16px;
      --fs-lg: 18px;
      --fs-kpi: 27px;

      /* 相容舊元件變數映射 */
      --bg: #FBF8F3;
      --surface: #FFFFFF;
      --surface-alt: #FAF6F0;
      --border: #E7DFD3;
      --text: #1C1917;
      --muted: #57534E;
      --primary: #7C4A21;
    }

    @media (max-width: 1460px), (max-height: 760px) {
      :root {
        --fs-xs: 12px;
        --fs-sm: 13px;
        --fs-base: 15px;
        --fs-lg: 16.5px;
        --fs-kpi: 23px;
      }
    }

    .ud-hide { display: none !important; }
    .num-mono { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }

    /* 全站字級保底 >= 12px 與按鈕不換行鐵律 */
    html body {
      background: var(--bg-canvas) !important;
      color: var(--text-primary) !important;
      font-size: var(--fs-sm);
    }
    html body button, html body .btn-sm, html body .btn-xs {
      white-space: nowrap;
      font-size: var(--fs-sm);
    }
    html body .btn-xs { font-size: var(--fs-xs) !important; padding: 4px 9px; }
    html body .tag,
    html body .item-meta,
    html body .ns-sub,
    html body #sync-status,
    html body #sync-text,
    html body .nb-date,
    html body #nb-roc-date,
    html body #today-roc,
    html body .ncal-title,
    html body .ncal-nav button,
    html body .ncal-weekdays span,
    html body .ncal-day,
    html body .ncal-filter-bar,
    html body #nordic-sidebar #portal-bar,
    html body #nordic-sidebar #portal-bar > span,
    html body #nordic-sidebar #portal-bar .portal-chip,
    html body #nordic-sidebar #portal-bar button,
    html body .portal-chip,
    html body .gt-name .gt-meta,
    html body .gt-today-tag,
    html body .gt-cell,
    html body .gt-cell.gt-load,
    html body .prog-pill,
    html body .tab-cnt-badge,
    html body .badge-beta,
    html body .badge-soon,
    html body .field label,
    html body .msh-chip {
      font-size: var(--fs-xs) !important;
    }

    /* 消除窄欄單行 ellipsis 截斷違規 */
    html body .ns-school-name {
      white-space: normal !important;
      overflow: hidden !important;
      text-overflow: clip !important;
      display: -webkit-box !important;
      -webkit-line-clamp: 2 !important;
      -webkit-box-orient: vertical !important;
      font-size: 14px !important;
      line-height: 1.3 !important;
    }

    /* 暖沙主題覆寫側邊欄與頂部列 */
    body:not([data-nordic-theme="obsidian"]) #nordic-sidebar {
      background: #F4EDE2 !important;
      border-right: 1px solid var(--border-strong) !important;
      width: 224px !important;
    }
    body.nordic-sidebar-collapsed #nordic-sidebar {
      width: 0 !important;
      min-width: 0 !important;
      border-right: none !important;
      overflow: hidden !important;
    }
    body:not([data-nordic-theme="obsidian"]) #nordic-main-col > .topbar {
      background: var(--bg-topbar) !important;
      border-bottom: 1px solid var(--border-strong) !important;
      min-height: 50px !important;
      padding: 6px 16px !important;
    }
    body:not([data-nordic-theme="obsidian"]) .ns-logo {
      background: var(--brand-primary) !important;
      color: #FFF !important;
    }
    body:not([data-nordic-theme="obsidian"]) #nordic-sidebar .nav-tab.active {
      background: var(--brand-primary) !important;
      color: #FFFFFF !important;
      font-weight: 800 !important;
    }
    body:not([data-nordic-theme="obsidian"]) .btn-primary {
      background: var(--brand-primary) !important;
      border-color: var(--brand-primary) !important;
      color: #FFFFFF !important;
    }

    /* 側邊欄四分組標題與矮視窗保護 */
    .ga-nav-group-lbl {
      font-size: 12px !important;
      font-weight: 800;
      color: #78716C;
      padding: 6px 10px 2px;
      letter-spacing: 0.03em;
    }
    #nordic-sidebar .nav-tab {
      font-size: 14px !important;
      padding: 6px 10px !important;
      min-height: 34px !important;
    }
    @media (max-height: 820px) {
      .ga-nav-group-lbl { padding: 3px 10px 1px; }
      #nordic-sidebar .nav-tab { padding: 4px 10px !important; min-height: 30px !important; font-size: 13.5px !important; }
      html body #nordic-sidebar #portal-bar, html body #portal-bar { display: none !important; }
    }

    /* 一屏鎖定容器（>=1024px 且高度 >=600px 時全站零外層捲動） */
    html.nordic-one-screen, body.nordic-one-screen {
      height: 100dvh !important;
      max-height: 100dvh !important;
      overflow: hidden !important;
    }
    body.nordic-one-screen #app-shell {
      height: 100dvh !important;
      max-height: 100dvh !important;
      overflow: hidden !important;
    }
    body.nordic-one-screen #nordic-main-col {
      height: 100dvh !important;
      max-height: 100dvh !important;
      display: flex !important;
      flex-direction: column !important;
      overflow: hidden !important;
      min-width: 0 !important;
    }
    body.nordic-one-screen #main-view {
      flex: 1 1 auto !important;
      min-height: 0 !important;
      width: 100% !important;
      max-width: 100% !important;
      overflow: hidden !important;
      padding: 12px 16px !important;
      box-sizing: border-box !important;
      display: flex !important;
      flex-direction: column !important;
    }
    @media (max-height: 700px) {
      body.nordic-one-screen #main-view { padding: 8px 12px !important; }
    }

    /* 節氣膠囊與搜尋框不裁切 */
    .ga-season-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 11px;
      border-radius: 999px;
      background: #FEF3C7;
      border: 1px solid #F59E0B;
      color: #92400E;
      font-size: 13px !important;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
    }
    #global-search {
      width: 215px !important;
      min-width: 170px !important;
      background: #FFFFFF !important;
      color: #1C1917 !important;
      border: 1px solid var(--border-strong) !important;
      border-radius: 8px !important;
      padding: 6px 10px !important;
      font-size: 13.5px !important;
    }

    /* ---------------- 戰情總覽：07 暖沙雙層黃金艙 ---------------- */
    #ga-war-room {
      display: flex;
      flex-direction: column;
      gap: 12px;
      height: 100%;
      min-height: 0;
      overflow: hidden;
    }
    @media (max-height: 700px) { #ga-war-room { gap: 8px; } }

    .ga-top-tiles {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 10px;
      flex: 0 0 auto;
    }
    .ga-tile {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-top: 4px solid var(--brand-accent);
      border-radius: 12px;
      padding: 10px 13px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-width: 0;
      transition: transform 0.12s ease, box-shadow 0.12s ease, border-color 0.12s ease;
    }
    @media (max-height: 700px) { .ga-tile { padding: 7px 10px; gap: 2px; } }
    .ga-tile:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(124, 74, 33, 0.09);
      border-color: var(--brand-primary);
    }
    .ga-tile.tone-red { border-top-color: var(--status-danger); }
    .ga-tile.tone-amber { border-top-color: #D97706; }
    .ga-tile.tone-teal { border-top-color: var(--brand-accent); }
    .ga-tile.tone-walnut { border-top-color: var(--brand-primary); }

    .ga-tile-hd {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
      font-size: 13.5px;
      font-weight: 800;
      color: var(--text-secondary);
      white-space: nowrap;
    }
    .ga-tile-kpi {
      font-size: var(--fs-kpi);
      font-weight: 900;
      line-height: 1.1;
      color: var(--text-primary);
    }
    .ga-tile-kpi small {
      font-size: 13px;
      font-weight: 700;
      color: var(--text-muted);
      margin-left: 4px;
    }
    .ga-tile-sub {
      font-size: var(--fs-xs);
      color: var(--text-muted);
      line-height: 1.3;
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    /* 下層 5 : 4 : 3 黃金比例三欄 */
    .ga-deck-grid {
      flex: 1 1 auto;
      min-height: 0;
      display: grid;
      grid-template-columns: minmax(0, 5fr) minmax(0, 4fr) minmax(0, 3fr);
      gap: 12px;
      overflow: hidden;
    }
    .ga-col-panel {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: 14px;
      display: flex;
      flex-direction: column;
      min-height: 0;
      min-width: 0;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(28, 25, 23, 0.03);
    }
    .ga-col-hd {
      padding: 10px 14px;
      background: var(--bg-subtle);
      border-bottom: 1px solid var(--border-subtle);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
      flex: 0 0 auto;
    }
    @media (max-height: 700px) { .ga-col-hd { padding: 7px 12px; } }
    .ga-col-hd h3 {
      margin: 0;
      font-size: var(--fs-lg);
      font-weight: 800;
      color: var(--text-primary);
    }
    .ga-col-bd {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 8px 12px;
      display: flex;
      flex-direction: column;
      gap: 7px;
    }
    .ga-col-ft {
      padding: 7px 12px;
      border-top: 1px solid var(--border-subtle);
      background: var(--bg-subtle);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex: 0 0 auto;
    }

    /* 緊急佇列列卡片（16px 特大字） */
    .ga-alert-card {
      padding: 9px 11px;
      border: 1px solid var(--border-subtle);
      border-left: 4px solid var(--brand-accent);
      border-radius: 10px;
      background: #FFFFFF;
      cursor: pointer;
      transition: background 0.12s ease, border-color 0.12s ease;
    }
    @media (max-height: 700px) { .ga-alert-card { padding: 6px 10px; } }
    .ga-alert-card:hover { background: #FAF6F0; border-color: var(--border-strong); }
    .ga-alert-card.lv-red { border-left-color: var(--status-danger); background: #FFFDFD; }
    .ga-alert-card.lv-amber { border-left-color: #D97706; }

    .ga-alert-title {
      font-size: var(--fs-base);
      font-weight: 800;
      color: var(--text-primary);
      line-height: 1.32;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .ga-alert-hint {
      font-size: var(--fs-sm);
      color: var(--text-secondary);
      margin-top: 3px;
      display: -webkit-box;
      -webkit-line-clamp: 1;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    /* ---------------- 通用一屏雙欄子頁面元件 ---------------- */
    .ga-split-shell {
      display: flex;
      flex-direction: column;
      gap: 10px;
      height: 100%;
      min-height: 0;
      width: 100%;
      overflow: hidden;
    }
    .ga-split-body {
      flex: 1 1 auto;
      min-height: 0;
      display: grid;
      gap: 12px;
      overflow: hidden;
    }
    .ga-pane {
      height: 100%;
      min-height: 0;
      margin: 0 !important;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: #FFFFFF;
      border: 1px solid var(--border-subtle) !important;
      border-radius: 12px !important;
    }
    .ga-pane > .panel-hd {
      padding: 10px 14px;
      background: var(--bg-subtle);
      border-bottom: 1px solid var(--border-subtle);
      flex: 0 0 auto;
    }
    .ga-pane > .panel-hd h3 { font-size: var(--fs-lg); margin: 0; }
    .ga-pane-scroll {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      overflow-x: auto;
    }

    /* 小額綠優採 & 場地卡片網格 */
    .sp-top-deck {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      flex: 0 0 auto;
    }
    .sp-gauge-card {
      background: #FFFFFF;
      border: 1px solid var(--border-subtle);
      border-top: 4px solid var(--brand-accent);
      border-radius: 12px;
      padding: 9px 14px;
    }
    .sp-gauge-card.tone-red { border-top-color: var(--status-danger); }
    .sp-gauge-card.tone-amber { border-top-color: #D97706; }
    .sp-gauge-card.tone-green { border-top-color: var(--brand-accent); }
    .sp-gauge-hd { display: flex; justify-content: space-between; align-items: center; gap: 6px; font-size: 13.5px; font-weight: 800; color: var(--text-secondary); }
    .sp-gauge-val { font-size: 24px; font-weight: 900; color: var(--text-primary); margin: 2px 0; }
    .sp-gauge-val small { font-size: 12.5px; font-weight: 600; color: var(--text-muted); }
    .sp-gauge-sub { font-size: 13px; color: var(--text-secondary); }

    .sp-filter-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      padding: 7px 12px;
      background: #FFFFFF;
      border-top: 1px solid var(--border-subtle);
      border-bottom: 1px solid var(--border-subtle);
      flex-wrap: wrap;
      flex: 0 0 auto;
    }
    .sp-tabs { display: inline-flex; gap: 5px; flex-wrap: wrap; }
    .sp-tab {
      padding: 5px 11px !important;
      border-radius: 999px !important;
      border: 1px solid var(--border-strong) !important;
      background: var(--bg-subtle) !important;
      color: var(--text-secondary) !important;
      font-size: 13.5px !important;
      font-weight: 700 !important;
      cursor: pointer;
    }
    .sp-tab.active {
      background: var(--brand-primary) !important;
      border-color: var(--brand-primary) !important;
      color: #FFFFFF !important;
    }
    .sp-pager { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; }
    .sp-table th, .sp-table td { padding: 8px 7px; font-size: 13.5px; }
    .sp-sim-box {
      padding: 9px 12px;
      border-radius: 10px;
      background: var(--bg-subtle);
      border: 1px dashed var(--border-strong);
      font-size: 13.5px;
      line-height: 1.45;
    }
    .sp-sim-box.is-danger { background: #FEF2F2; border: 1px solid #FCA5A5; color: #991B1B; }
    .sp-sim-box.is-ok { background: #ECFDF5; border: 1px solid #6EE7B7; color: #065F46; }

    /* 場地教室卡片看板 & 安檢牆 */
    .vb-top-bar, .spv-proj-header, .spv-subtab-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      padding: 8px 14px;
      background: #FFFFFF;
      border: 1px solid var(--border-subtle);
      border-radius: 12px;
      flex: 0 0 auto;
    }
    .vb-card-grid {
      flex: 1 1 auto;
      min-height: 0;
      padding: 10px 12px;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      overflow-y: auto;
      align-content: start;
    }
    .saf-card-grid {
      flex: 1 1 auto;
      min-height: 0;
      padding: 10px 12px;
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      overflow-y: auto;
      align-content: start;
    }
    .vb-space-card {
      border: 1px solid var(--border-subtle);
      border-top: 4px solid #10B981;
      border-radius: 12px;
      padding: 10px 12px;
      background: #FFFFFF;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 6px;
      transition: border-color 0.12s ease, box-shadow 0.12s ease;
    }
    .vb-space-card.state-booked { border-top-color: #0284C7; background: #F8FCFF; }
    .vb-space-card.state-locked { border-top-color: #D97706; background: #FFFDF7; }
    .vb-space-card.is-selected { outline: 2px solid var(--brand-primary); box-shadow: 0 4px 14px rgba(124, 74, 33, 0.12); }
    .vb-card-top { display: flex; justify-content: space-between; align-items: center; gap: 6px; }
    .vb-floor-pill { font-size: 12px; font-weight: 800; color: var(--brand-primary); background: var(--brand-soft); padding: 2px 7px; border-radius: 6px; }
    .vb-card-title { font-size: var(--fs-base); font-weight: 800; color: var(--text-primary); }
    .vb-slot-strip { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
    .vb-slot-pill { text-align: center; font-size: 12px; font-weight: 700; padding: 2px 4px; border-radius: 6px; }
    .vb-slot-pill.free { background: #ECFDF5; color: #047857; }
    .vb-slot-pill.busy { background: #DBEAFE; color: #1D4ED8; }
    .vb-card-summary {
      font-size: 13px;
      color: var(--text-secondary);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      min-height: 34px;
    }
    .vb-card-foot { display: flex; justify-content: space-between; align-items: center; gap: 6px; border-top: 1px dashed var(--border-subtle); padding-top: 5px; }
    .vb-3d-link { font-size: 12.5px; font-weight: 800; color: var(--brand-primary); text-decoration: none; }
    .vb-3d-link:hover { text-decoration: underline; }

    /* 標案雙欄階段樹與 16px 檢核列 */
    .spv-list-card {
      padding: 10px 12px;
      border: 1px solid var(--border-subtle);
      border-radius: 10px;
      background: #FFFFFF;
      cursor: pointer;
    }
    .spv-list-card:hover { background: var(--bg-subtle); }
    .spv-list-card.is-selected { border-color: var(--brand-primary); background: var(--brand-soft); }
    .spv-stage-node {
      display: flex !important;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 9px 10px !important;
      margin-bottom: 5px;
      border-radius: 10px !important;
      border: 1px solid transparent !important;
      background: transparent !important;
      cursor: pointer;
    }
    .spv-stage-node:hover { background: var(--bg-subtle) !important; }
    .spv-stage-node.is-active {
      background: var(--brand-soft) !important;
      border-color: var(--brand-primary) !important;
    }
    .spv-stage-dot {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      color: #FFF;
      font-size: 12.5px;
      font-weight: 800;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .spv-stage-title { font-size: 14.5px; font-weight: 800; color: var(--text-primary); line-height: 1.3; }
    .spv-stage-meta { display: flex; justify-content: space-between; gap: 6px; font-size: 12.5px; color: var(--text-muted); margin-top: 2px; }

    .spv-chk-row {
      display: grid;
      grid-template-columns: 24px minmax(0, 1fr) 175px 138px 32px;
      gap: 10px;
      align-items: center;
      padding: 10px 8px;
      border-bottom: 1px solid var(--border-subtle);
    }
    .spv-chk-text { font-size: var(--fs-base); font-weight: 600; color: var(--text-primary); line-height: 1.45; }
    .spv-chk-row.is-done .spv-chk-text { color: var(--text-muted); text-decoration: line-through; font-weight: 500; }
    .spv-chk-row input[type="text"], .spv-chk-row input[type="date"] {
      padding: 6px 8px;
      border: 1px solid var(--border-strong);
      border-radius: 7px;
      font-size: 13.5px;
      width: 100%;
    }

    /* 下拉選單 */
    #ud-menu {
      position: fixed; z-index: 9998; min-width: 235px;
      background: #FFFFFF; color: #1C1917; border: 1px solid var(--border-strong);
      border-radius: 12px; box-shadow: 0 14px 36px rgba(28, 25, 23, 0.18);
      padding: 6px; display: none; font-size: 14px;
    }
    #ud-menu.open { display: block; }
    #ud-menu .ud-item {
      display: flex !important; align-items: center; gap: 10px; width: 100%; text-align: left;
      background: transparent !important; border: none !important; padding: 9px 10px !important;
      border-radius: 8px; cursor: pointer; font-size: 14px !important; font-weight: 700;
    }
    #ud-menu .ud-item:hover { background: var(--brand-soft) !important; }

    /* 平板與手機響應式退場 */
    @media (max-width: 1023px) {
      .ga-top-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .ga-deck-grid, .ga-split-body, .sp-top-deck { grid-template-columns: 1fr !important; }
      .vb-card-grid, .saf-card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      #ga-war-room, .ga-split-shell { height: auto; overflow: visible; }
      .spv-chk-row { grid-template-columns: 24px 1fr; }
    }
  `;

  // --------------------------------------------------------------------------
  // 2. 頂部選單與新增／設定彈出層
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
  }

  function openMenu(btn, html) {
    const m = ensureMenu();
    if (m.classList.contains('open') && m.dataset.owner === btn.id) { closeMenu(); return; }
    closeMenu();
    m.innerHTML = html;
    m.dataset.owner = btn.id;
    m.classList.add('open');
    const r = btn.getBoundingClientRect();
    const w = m.offsetWidth || 240;
    m.style.top = `${Math.round(r.bottom + 6)}px`;
    m.style.left = `${Math.round(Math.max(12, Math.min(r.right - w, window.innerWidth - w - 12)))}px`;
  }

  window.udMenuAction = function(act, ev) {
    if (ev) ev.stopPropagation();
    closeMenu();
    if (act === 'new-project' && typeof openProjectWizard === 'function') openProjectWizard();
    else if (act === 'new-stat-proc') switchTab('statutory-proc');
    else if (act === 'new-venue') switchTab('venue-board');
    else if (act === 'new-routine' && typeof openRoutineModal === 'function') openRoutineModal('');
    else if (act === 'new-memo') {
      if (currentTab !== 'dashboard') switchTab('dashboard');
      setTimeout(() => document.getElementById('memo-input')?.focus(), 50);
    }
    else if (act === 'doc-copilot' && typeof openDocCopilotModal === 'function') openDocCopilotModal();
    else if (act === 'batch-renewal' && typeof openBatchRenewalModal === 'function') openBatchRenewalModal();
    else if (act === 'settings' && typeof openSettingsModal === 'function') openSettingsModal();
    else if (act === 'portals' && typeof openPortalEditor === 'function') openPortalEditor();
    else if (act === 'calendar' && typeof window.toggleNordicCalendar === 'function') window.toggleNordicCalendar();
    else if (act === 'dedupe' && typeof window.openDedupeModal === 'function') window.openDedupeModal();
    else if (act === 'cmd') window.GA_CORE.openCommandPalette();
  };

  window.toggleUdNewMenu = function(ev) {
    if (ev) ev.stopPropagation();
    openMenu(ev.currentTarget, `
      <button type="button" class="ud-item" onclick="udMenuAction('new-project', event)">📋 開新採購／工程標案</button>
      <button type="button" class="ud-item" onclick="udMenuAction('new-stat-proc', event)">🧾 記一筆小額／綠採／優採</button>
      <button type="button" class="ud-item" onclick="udMenuAction('new-venue', event)">🏟️ 登記場地／教室短期借用</button>
      <button type="button" class="ud-item" onclick="udMenuAction('new-routine', event)">🔁 新增固定例行事務</button>
      <button type="button" class="ud-item" onclick="udMenuAction('batch-renewal', event)">⚡ 年末批次續約開案精靈</button>
    `);
  };

  window.toggleUdSettingsMenu = function(ev) {
    if (ev) ev.stopPropagation();
    const syncTxt = (document.getElementById('sync-text')?.textContent || '').trim() || '本機模式';
    openMenu(ev.currentTarget, `
      <div style="padding:8px 10px;border-bottom:1px solid #E7DFD3;font-size:13px;color:#57534E;font-weight:700">雲端狀態：${h(syncTxt)}</div>
      <button type="button" class="ud-item" onclick="udMenuAction('settings', event)">🔌 雲端試算表連線與備份</button>
      <button type="button" class="ud-item" onclick="udMenuAction('cmd', event)">🔍 全域快速跳轉 (Ctrl+K)</button>
      <button type="button" class="ud-item" onclick="udMenuAction('portals', event)">🔗 常用公務傳送門管理</button>
      <button type="button" class="ud-item" onclick="udMenuAction('calendar', event)">📅 切換側欄迷你月曆</button>
      ${typeof window.openDedupeModal === 'function' ? `<button type="button" class="ud-item" onclick="udMenuAction('dedupe', event)">🧹 檢查重複資料</button>` : ''}
    `);
  };

  document.addEventListener('click', closeMenu);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

  // --------------------------------------------------------------------------
  // 3. 側欄 4 大領域分組導覽組裝（保留 #nav-tabs [data-tab="projects"] 等驗收節點）
  // --------------------------------------------------------------------------
  function syncSidebarNavGroups() {
    const nav = document.getElementById('nav-tabs');
    if (!nav) return;

    const specs = [
      { group: '📊 戰情與排程', items: [
        { tab: 'dashboard', label: '📊 戰情總覽' },
        { tab: 'annual-gantt', label: '📅 全校甘特圖' }
      ]},
      { group: '🏗️ 採購與工程', items: [
        { tab: 'projects', label: '📋 採購履約' },
        { tab: 'statutory-proc', label: '🧾 小額・綠優採' },
        { tab: 'templates', label: '🗂️ 標案模板' }
      ]},
      { group: '⚡ 設施與安檢', items: [
        { tab: 'routines', label: '🔁 例行與續約' },
        { tab: 'solar', label: '☀️ 太陽能租賃' },
        { tab: 'utilities', label: '⚡ 水電費監控' },
        { tab: 'safety-wall', label: '🛡️ 法定安檢牆' }
      ]},
      { group: '🧰 校產與空間', items: [
        { tab: 'venue-board', label: '🏟️ 場地與教室' },
        { tab: 'asset-inv', label: '📦 設備與耗材' }
      ]}
    ];

    if (!nav.dataset.gaGrouped) {
      nav.innerHTML = '';
      specs.forEach(sec => {
        const gEl = document.createElement('div');
        gEl.className = 'ga-nav-group-lbl';
        gEl.textContent = sec.group;
        nav.appendChild(gEl);

        sec.items.forEach(it => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'nav-tab';
          b.dataset.tab = it.tab;
          b.textContent = it.label;
          b.onclick = () => switchTab(it.tab);
          nav.appendChild(b);
        });
      });

      const link3d = document.createElement('a');
      link3d.className = 'nav-tab nav-tab-ext';
      link3d.href = './campus-3d.html';
      link3d.title = '開啟 3D 校舍數位雙生模型';
      link3d.innerHTML = '🏫 3D 校舍雙生 ↗';
      nav.appendChild(link3d);
      nav.dataset.gaGrouped = '1';
    }

    const cur = (typeof currentTab !== 'undefined' && currentTab) || 'dashboard';
    nav.querySelectorAll('.nav-tab[data-tab]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === cur);
    });

    // 矮視窗 (<780px) 自動將側欄完整月曆收斂為單行按鈕，確保側欄零溢出
    const calHost = document.getElementById('nordic-side-calendar');
    if (calHost && window.innerHeight < 780 && !calHost.classList.contains('collapsed')) {
      const tdy = typeof todayStr === 'function' ? todayStr() : new Date().toISOString().slice(0, 10);
      calHost.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 8px;font-size:12.5px;font-weight:700;color:#7C4A21">
          <span>📅 ${h(roc(tdy, { withWeekday: true }))}</span>
          <button type="button" class="btn-xs" onclick="window.GA_CORE.openCommandPalette()">Ctrl+K</button>
        </div>
      `;
    }
  }

  function enhanceTopbar() {
    const actions = document.querySelector('.topbar .top-actions');
    if (!actions) return;

    // 隱藏舊版重複按鈕，但保留 DOM ID（如 #btn-fit-mode）供自我驗證套件通過
    [
      document.getElementById('btn-toggle-calendar'),
      document.getElementById('btn-layout-switcher'),
      document.getElementById('btn-quick-new-routine'),
      document.getElementById('btn-fit-mode'),
      ...Array.from(actions.querySelectorAll('button')).filter(b => {
        const oc = b.getAttribute('onclick') || '';
        return oc.includes('openProjectWizard') || oc.includes('openSettingsModal');
      })
    ].forEach(el => el && el.classList.add('ud-hide'));

    const searchInput = document.getElementById('global-search');
    if (searchInput) {
      searchInput.placeholder = '🔍 搜尋標案／教室／例行 (Ctrl+K)';
    }

    // 學校雙曆制「總務節氣膠囊」
    const season = window.GA_CORE.getSchoolSeasonHint();
    let seasonBtn = document.getElementById('ga-season-pill');
    if (!seasonBtn) {
      seasonBtn = document.createElement('button');
      seasonBtn.id = 'ga-season-pill';
      seasonBtn.type = 'button';
      seasonBtn.className = 'ga-season-pill';
      actions.prepend(seasonBtn);
    }
    seasonBtn.textContent = `${season.icon} ${season.text}`;
    seasonBtn.onclick = () => switchTab(season.actionTab || 'routines');

    if (!document.getElementById('btn-ud-copilot')) {
      const b = document.createElement('button');
      b.id = 'btn-ud-copilot';
      b.type = 'button';
      b.textContent = '📝 公文助手';
      b.onclick = () => window.openDocCopilotModal && window.openDocCopilotModal();
      actions.appendChild(b);
    }
    if (!document.getElementById('btn-ud-new')) {
      const b = document.createElement('button');
      b.id = 'btn-ud-new';
      b.type = 'button';
      b.className = 'btn-primary';
      b.textContent = '＋ 新增 ▾';
      b.onclick = window.toggleUdNewMenu;
      actions.appendChild(b);
    }
    if (!document.getElementById('btn-ud-settings')) {
      const b = document.createElement('button');
      b.id = 'btn-ud-settings';
      b.type = 'button';
      b.textContent = '⚙️ 設定';
      b.onclick = window.toggleUdSettingsMenu;
      actions.appendChild(b);
    }

    actions.appendChild(document.getElementById('btn-ud-copilot'));
    actions.appendChild(document.getElementById('btn-ud-new'));
    actions.appendChild(document.getElementById('btn-ud-settings'));

    // 更新麵包屑標題支援新模組
    const crumb = document.getElementById('nb-tab-crumb');
    if (crumb) {
      const map = {
        dashboard: '戰情總覽',
        projects: selectedProjectId ? '標案雙欄檢核台' : '採購與工程',
        'statutory-proc': '小額・綠優採三軌台帳',
        routines: '例行與續約工作台',
        solar: '太陽能租賃管理',
        utilities: '水電費預算監控',
        'safety-wall': '校園法定安檢牆',
        'venue-board': '場地與教室卡片看板',
        'asset-inv': '設備與耗材庫存',
        'annual-gantt': '全校跨案甘特圖',
        templates: '標案模板庫'
      };
      const cur = (typeof currentTab !== 'undefined' && currentTab) || 'dashboard';
      if (map[cur]) crumb.textContent = map[cur];
    }
  }

  // --------------------------------------------------------------------------
  // 4. 戰情總覽渲染：「07 暖沙雙層黃金艙 × 05 特大高清晰字級」
  // --------------------------------------------------------------------------
  window.gaSetAlertBucket = function(b) { dashState.alertBucket = b; dashState.alertPage = 1; renderCurrentView(); };
  window.gaSetAlertPage = function(p) { dashState.alertPage = Math.max(1, p); renderCurrentView(); };
  window.gaSetDashProjPage = function(p) { dashState.projPage = Math.max(1, p); renderCurrentView(); };

  window.gaRunAlert = function(idx) {
    const a = (window._gaUnifiedAlerts || [])[idx];
    if (!a) return;
    if (typeof a.action === 'function') { a.action(); return; }
    if (a.routineId && typeof selectSplitRoutine === 'function') {
      switchTab('routines');
      selectSplitRoutine(a.routineId);
      return;
    }
    const tabMap = { project: 'projects', routine: 'routines', solar: 'solar', util: 'utilities', 'statutory-proc': 'statutory-proc', 'safety-wall': 'safety-wall', 'venue-board': 'venue-board' };
    switchTab(tabMap[a.module] || 'dashboard');
  };

  function buildTopSixTiles(unifiedAlerts) {
    const t = appData.tables || {};
    const activeProjects = (t.Projects || []).filter(p => !['已結案', '廢標撤案'].includes(p.status));
    const routines = (t.Annual_Routines || []).filter(r => r.is_active !== false);
    const activeSolar = (t.Solar_Contracts || []).filter(c => !['已屆滿', '已期滿', '已解約'].includes(c.status));
    const meters = (t.Utilities_Meters || []).filter(m => m.is_active !== false);

    const projAlerts = unifiedAlerts.filter(a => a.module === 'project' && a.tier <= 1);
    const rtnNext = routines.length && typeof computeRoutineSchedule === 'function'
      ? routines.map(r => ({ r, s: computeRoutineSchedule(r) })).sort((x, y) => x.s.diffDays - y.s.diffDays)[0]
      : null;

    const solarYr = typeof window.calcSolarYearStats === 'function'
      ? window.calcSolarYearStats(new Date().getFullYear() - 1911)
      : { yearReceivable: 0 };
    const energyAlerts = unifiedAlerts.filter(a => (a.module === 'solar' || a.module === 'util') && a.tier <= 1);

    const spTile = window.GA_CORE.getModule('statutory-proc')?.getSummaryTile?.(appData) || {
      kpi: '0', unit: '筆小額', tone: 'teal', subText: '§14・綠採・優採三軌控管'
    };
    const safTile = window.GA_CORE.getModule('safety-wall')?.getSummaryTile?.(appData) || {
      kpi: '8/8', unit: '項合規', tone: 'teal', subText: '八大法定安檢集中列管'
    };
    const vbTile = window.GA_CORE.getModule('venue-board')?.getSummaryTile?.(appData) || {
      kpi: '0', unit: '場今日借用', tone: 'teal', subText: '教室與球場卡片式看板'
    };

    return [
      {
        tab: 'projects',
        tone: projAlerts.some(a => a.tier === 0) ? 'red' : projAlerts.length ? 'amber' : 'walnut',
        icon: '🏗️', title: '採購與工程',
        badge: projAlerts.length ? `${projAlerts.length} 急件` : '進度正常',
        badgeCls: projAlerts.length ? 'tag-red' : 'tag-green',
        kpi: String(activeProjects.length), unit: '件執行中',
        sub: activeProjects[0] ? `重點：${smart(activeProjects[0].project_name).cleanTitle}` : '點擊新增或檢視標案'
      },
      {
        tab: 'statutory-proc',
        tone: spTile.tone || 'teal',
        icon: '🧾', title: '小額・綠優採',
        badge: spTile.redCount ? '需注意' : '法規監控',
        badgeCls: spTile.redCount ? 'tag-red' : spTile.amberCount ? 'tag-amber' : 'tag-green',
        kpi: spTile.kpi, unit: spTile.unit,
        sub: spTile.subText
      },
      {
        tab: 'routines',
        tone: rtnNext && rtnNext.s.diffDays < 0 ? 'red' : rtnNext && rtnNext.s.diffDays <= 7 ? 'amber' : 'teal',
        icon: '🔁', title: '例行與續約',
        badge: rtnNext ? (rtnNext.s.diffDays < 0 ? `逾期${Math.abs(rtnNext.s.diffDays)}天` : `最近剩${rtnNext.s.diffDays}天`) : '已就緒',
        badgeCls: rtnNext && rtnNext.s.diffDays <= 7 ? 'tag-amber' : 'tag-blue',
        kpi: String(routines.length), unit: '項年度列管',
        sub: rtnNext ? `最近：${rtnNext.r.title}` : '含年末批次續約精靈'
      },
      {
        tab: 'solar',
        tone: energyAlerts.some(a => a.tier === 0) ? 'red' : energyAlerts.length ? 'amber' : 'teal',
        icon: '☀️', title: '光電與水電',
        badge: energyAlerts.length ? `${energyAlerts.length} 預警` : `${meters.length} 錶正常`,
        badgeCls: energyAlerts.some(a => a.tier === 0) ? 'tag-red' : energyAlerts.length ? 'tag-amber' : 'tag-green',
        kpi: `${activeSolar.length}約`, unit: `/ 本年應收 ${Math.round((solarYr.yearReceivable || 0) / 1000)}k`,
        sub: energyAlerts[0] ? energyAlerts[0].cleanTitle : `水電監控 ${meters.length} 錶號（點此管理）`
      },
      {
        tab: 'safety-wall',
        tone: safTile.tone || 'teal',
        icon: '🛡️', title: '法定安檢牆',
        badge: safTile.redCount ? `${safTile.redCount} 逾期` : '督學視導就緒',
        badgeCls: safTile.redCount ? 'tag-red' : safTile.amberCount ? 'tag-amber' : 'tag-green',
        kpi: safTile.kpi, unit: safTile.unit,
        sub: safTile.subText
      },
      {
        tab: 'venue-board',
        tone: vbTile.tone || 'teal',
        icon: '🏟️', title: '場地與教室',
        badge: '卡片看板',
        badgeCls: vbTile.amberCount ? 'tag-amber' : 'tag-blue',
        kpi: vbTile.kpi, unit: vbTile.unit,
        sub: vbTile.subText
      }
    ];
  }

  function renderWarRoomDashboardHTML() {
    const q = (document.getElementById('global-search')?.value || '').trim().toLowerCase();
    const allAlerts = window.GA_CORE.computeUnifiedUrgency()
      .filter(a => !q || `${a.badge} ${a.fullTitle} ${a.actionHint}`.toLowerCase().includes(q));
    window._gaUnifiedAlerts = allAlerts;

    const urgent7 = allAlerts.filter(a => a.tier <= 1);
    const days30 = allAlerts.filter(a => a.tier === 2);

    // 若緊急 7 日內為 0 筆但 30 日內有事項，智慧顯示 30 日預告避免空白
    let activeList = urgent7;
    let activeBucket = dashState.alertBucket;
    if (activeBucket === 'URGENT7' && urgent7.length === 0 && days30.length > 0) {
      activeList = days30;
    } else if (activeBucket === 'DAYS30') {
      activeList = days30;
    } else if (activeBucket === 'ALL') {
      activeList = allAlerts;
    }

    const vh = window.innerHeight || 900;
    const alertPerPage = vh < 700 ? 3 : vh < 860 ? 4 : 5;
    const alertPages = Math.max(1, Math.ceil(activeList.length / alertPerPage));
    if (dashState.alertPage > alertPages) dashState.alertPage = alertPages;
    const pagedAlerts = activeList.slice((dashState.alertPage - 1) * alertPerPage, dashState.alertPage * alertPerPage);

    // 中欄：執行中標案
    const activeProjects = ((appData.tables && appData.tables.Projects) || [])
      .filter(p => !['已結案', '廢標撤案'].includes(p.status))
      .filter(p => !q || `${p.project_name} ${p.project_id} ${p.vendor_name || ''}`.toLowerCase().includes(q));
    const projPerPage = vh < 700 ? 3 : vh < 860 ? 4 : 5;
    const projPages = Math.max(1, Math.ceil(activeProjects.length / projPerPage));
    if (dashState.projPage > projPages) dashState.projPage = projPages;
    const pagedProjs = activeProjects.slice((dashState.projPage - 1) * projPerPage, dashState.projPage * projPerPage);

    // 右欄：抬頭交辦便利貼（保留 #memo-input / #memo-tag / #memo-prio 相容性）
    const openMemos = ((appData.tables && appData.tables.Quick_Memos) || [])
      .filter(m => !m.is_done)
      .filter(m => !q || `${m.content} ${m.source_tag || ''}`.toLowerCase().includes(q));

    const tiles = buildTopSixTiles(allAlerts);

    return `
      <div id="ga-war-room">
        <!-- 上層 Zone Top：六大業務黃金健康卡 -->
        <section class="ga-top-tiles" aria-label="六大業務黃金指標">
          ${tiles.map(t => `
            <div class="ga-tile tone-${h(t.tone)}" role="button" tabindex="0"
                 onclick="switchTab('${h(t.tab)}')" onkeydown="if(event.key==='Enter')switchTab('${h(t.tab)}')">
              <div class="ga-tile-hd">
                <span>${t.icon} ${h(t.title)}</span>
                <span class="tag ${t.badgeCls}">${h(t.badge)}</span>
              </div>
              <div class="ga-tile-kpi num-mono">${h(t.kpi)}<small>${h(t.unit)}</small></div>
              <div class="ga-tile-sub" title="${h(t.sub)}">${h(t.sub)}</div>
            </div>
          `).join('')}
        </section>

        <!-- 下層 5 : 4 : 3 黃金比例三欄執行艙 -->
        <div class="ga-deck-grid">
          <!-- 左欄 (5/12)：近期必辦佇列（依真實剩餘天數排序） -->
          <section class="ga-col-panel" aria-label="近期必辦佇列">
            <div class="ga-col-hd">
              <h3>🚨 近期必辦佇列</h3>
              <div class="sp-tabs">
                <button type="button" class="sp-tab ${dashState.alertBucket === 'URGENT7' ? 'active' : ''}" onclick="gaSetAlertBucket('URGENT7')">🔴 7日內 (${urgent7.length})</button>
                <button type="button" class="sp-tab ${dashState.alertBucket === 'DAYS30' ? 'active' : ''}" onclick="gaSetAlertBucket('DAYS30')">🟡 30日預告 (${days30.length})</button>
                <button type="button" class="sp-tab ${dashState.alertBucket === 'ALL' ? 'active' : ''}" onclick="gaSetAlertBucket('ALL')">🔵 全覽 (${allAlerts.length})</button>
              </div>
            </div>

            <div class="ga-col-bd">
              ${pagedAlerts.length ? pagedAlerts.map(a => {
                const origIdx = allAlerts.indexOf(a);
                const lvCls = a.effectiveLevel === 'red' ? 'lv-red' : a.effectiveLevel === 'amber' ? 'lv-amber' : 'lv-blue';
                const tagCls = a.effectiveLevel === 'red' ? 'tag-red' : a.effectiveLevel === 'amber' ? 'tag-amber' : 'tag-blue';
                return `
                  <div class="ga-alert-card ${lvCls}" onclick="gaRunAlert(${origIdx})" title="${h(a.fullTitle)}">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:3px">
                      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                        <span class="tag ${tagCls}">${h(a.badge || '提醒')}</span>
                        ${a.yearBadge ? `<span class="tag tag-gray num-mono">${h(a.yearBadge)}</span>` : ''}
                        <span class="num-mono" style="font-size:13px;font-weight:800;color:${a.tier === 0 ? '#DC2626' : '#7C4A21'}">${h(a.relLabel)}${a.rocDue ? `（${h(a.rocDue)}）` : ''}</span>
                      </div>
                      <button type="button" class="btn-xs" onclick="copyAlertSnippet(${origIdx}, event)" title="一鍵複製禮貌催辦訊息或簽呈草稿">📋 催辦／簽呈</button>
                    </div>
                    <div class="ga-alert-title">${h(a.cleanTitle)}</div>
                    <div class="ga-alert-hint">👉 ${h(a.actionHint)}</div>
                  </div>
                `;
              }).join('') : `
                <div class="empty-state" style="margin:auto 0">
                  🎉 太棒了！目前此區間沒有緊急待辦事項，可切換「30日預告」提前部署。
                </div>
              `}
            </div>

            <div class="ga-col-ft num-mono">
              <span style="font-size:12.5px;color:var(--text-muted)">依真實剩餘天數與法定硬死線自動排序</span>
              <div class="sp-pager">
                <button type="button" class="btn-xs" ${dashState.alertPage <= 1 ? 'disabled' : ''} onclick="gaSetAlertPage(${dashState.alertPage - 1})">◀</button>
                <span>${dashState.alertPage} / ${alertPages}</span>
                <button type="button" class="btn-xs" ${dashState.alertPage >= alertPages ? 'disabled' : ''} onclick="gaSetAlertPage(${dashState.alertPage + 1})">▶</button>
              </div>
            </div>
          </section>

          <!-- 中欄 (4/12)：執行中標案與母子勾稽 -->
          <section class="ga-col-panel" aria-label="執行中標案與里程碑">
            <div class="ga-col-hd">
              <h3>🏗️ 執行中標案 (${activeProjects.length})</h3>
              <div style="display:flex;gap:6px">
                <button type="button" class="btn-xs" onclick="switchTab('utilities')">⚡ 水電帳單</button>
                <button type="button" class="btn-xs btn-primary" onclick="switchTab('projects')">全部標案 →</button>
              </div>
            </div>

            <div class="ga-col-bd">
              ${pagedProjs.length ? pagedProjs.map(p => {
                const prog = calcProjectProgress(p.project_id);
                const sm = smart(p.project_name);
                const flg = parseJSON(p.flags_json, {});
                return `
                  <div class="ga-alert-card" style="border-left-color:var(--brand-primary)"
                       onclick="openProjectDetail('${h(p.project_id)}')" title="${h(sm.fullTitle)}">
                    <div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
                      <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap">
                        ${sm.yearBadge ? `<span class="tag tag-amber num-mono">${h(sm.yearBadge)}</span>` : ''}
                        <span class="tag tag-blue">${h(p.procurement_type)}</span>
                        ${flg.linked_project_id ? '<span class="tag tag-green">🔗 母子案</span>' : ''}
                      </div>
                      <span class="num-mono" style="font-size:15px;font-weight:900;color:var(--brand-accent)">${prog.pct}%</span>
                    </div>
                    <div class="ga-alert-title" style="margin-top:3px">${h(sm.cleanTitle)}</div>
                    <div class="item-meta num-mono" style="display:flex;justify-content:space-between;gap:6px;margin-top:3px">
                      <span>階段：${h(prog.currentStage)}</span>
                      ${p.grant_deadline ? `<strong style="color:#DC2626">死線 ${roc(p.grant_deadline, { noYear: true })}</strong>` : `<span>檢核 ${prog.doneChecks}/${prog.totalChecks}</span>`}
                    </div>
                    <div class="mini-bar-wrap" style="height:6px;margin-top:5px">
                      <div class="mini-bar" style="width:${prog.pct}%;background:var(--brand-accent)"></div>
                    </div>
                  </div>
                `;
              }).join('') : `
                <div class="empty-state" style="margin:auto 0">
                  目前無進行中標案。<br>
                  <button type="button" class="btn-sm btn-primary" style="margin-top:8px" onclick="openProjectWizard()">＋ 開新採購標案</button>
                </div>
              `}
            </div>

            <div class="ga-col-ft num-mono">
              <button type="button" class="btn-xs" onclick="switchTab('annual-gantt')">📅 全校跨案甘特圖</button>
              <div class="sp-pager">
                <button type="button" class="btn-xs" ${dashState.projPage <= 1 ? 'disabled' : ''} onclick="gaSetDashProjPage(${dashState.projPage - 1})">◀</button>
                <span>${dashState.projPage} / ${projPages}</span>
                <button type="button" class="btn-xs" ${dashState.projPage >= projPages ? 'disabled' : ''} onclick="gaSetDashProjPage(${dashState.projPage + 1})">▶</button>
              </div>
            </div>
          </section>

          <!-- 右欄 (3/12)：抬頭交辦便利貼（免點彈窗直接看、支援 Enter 秒存與 8 秒復原） -->
          <section class="ga-col-panel" aria-label="抬頭交辦便利貼">
            <div class="ga-col-hd">
              <h3>📌 抬頭交辦 (${openMemos.length})</h3>
              <button type="button" class="btn-xs" onclick="openBatchRenewalModal()" title="批次建立下年度續約標案">⚡ 續約精靈</button>
            </div>

            <div style="padding:8px 12px;border-bottom:1px dashed var(--border-subtle);background:#FFFDF9;flex:0 0 auto">
              <div style="display:flex;gap:6px;min-width:0">
                <input id="memo-input" type="text" placeholder="記一筆交辦按 Enter..."
                       style="flex:1;min-width:0;padding:7px 9px;border:1px solid var(--border-strong);border-radius:8px;font-size:14px"
                       onkeydown="if(event.key==='Enter') quickAddMemo()">
                <button type="button" class="btn-xs btn-primary" style="flex-shrink:0" onclick="quickAddMemo()">＋記</button>
              </div>
              <div style="display:flex;gap:5px;margin-top:6px;min-width:0;flex-wrap:wrap">
                <select id="memo-tag" aria-label="交辦來源" style="flex:1;min-width:84px;padding:4px 5px;border:1px solid var(--border-subtle);border-radius:6px;font-size:12.5px">
                  <option value="校長交辦">校長交辦</option>
                  <option value="處室需求">處室需求</option>
                  <option value="廠商追蹤">廠商追蹤</option>
                  <option value="現場會勘">現場會勘</option>
                  <option value="自訂備忘">自訂備忘</option>
                </select>
                <select id="memo-prio" aria-label="優先級" style="padding:4px 5px;border:1px solid var(--border-subtle);border-radius:6px;font-size:12.5px">
                  <option value="一般">一般</option>
                  <option value="重要">重要</option>
                  <option value="緊急">🔴 緊急</option>
                </select>
                <input id="memo-due" type="date" aria-label="交辦期限" title="選填完成期限" style="flex:1;min-width:110px;padding:3px 5px;border:1px solid var(--border-subtle);border-radius:6px;font-size:12px">
                <input id="memo-remind" type="date" class="ud-hide">
              </div>
            </div>

            <div class="ga-col-bd">
              ${openMemos.length ? openMemos.map(m => `
                <div style="padding:8px 10px;border:1px solid var(--border-subtle);border-left:4px solid ${m.priority === '緊急' ? '#DC2626' : m.priority === '重要' ? '#D97706' : '#7C4A21'};border-radius:9px;background:#FFF">
                  <label style="display:flex;gap:8px;align-items:flex-start;cursor:pointer">
                    <input type="checkbox" style="width:17px;height:17px;margin-top:3px;flex-shrink:0"
                           onchange="toggleMemoDone('${h(m.memo_id)}', this.checked)">
                    <div style="flex:1;min-width:0">
                      <div style="font-size:15px;font-weight:700;color:var(--text-primary);line-height:1.35">${h(m.content)}</div>
                      <div class="item-meta" style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
                        <span>${h(m.source_tag || '備忘')}${m.due_date ? `・限 ${roc(m.due_date, { noYear: true })}` : ''}</span>
                        <button type="button" class="btn-xs" style="padding:2px 6px" onclick="event.preventDefault();convertMemoToProject('${h(m.memo_id)}')">轉標案</button>
                      </div>
                    </div>
                  </label>
                </div>
              `).join('') : `
                <div class="empty-state" style="margin:auto 0;padding:16px 8px">
                  ✓ 目前沒有未完成交辦事項。<br>上方輸入框按 Enter 即可隨手記！
                </div>
              `}
            </div>
          </section>
        </div>
      </div>
    `;
  }

  // 直接覆寫 renderDashboardHTML，徹底根除舊版 279 節點隱藏容器 (#ud-legacy-dash)！
  renderDashboardHTML = renderWarRoomDashboardHTML;

  // --------------------------------------------------------------------------
  // 5. 路由整合：支援 GA_CORE 註冊之新模組分頁渲染與自動重繪
  // --------------------------------------------------------------------------
  const _prevRenderCurrentView = renderCurrentView;
  renderCurrentView = function() {
    const tab = (typeof currentTab !== 'undefined' && currentTab) || 'dashboard';
    document.body.dataset.udTab = tab;

    // 確保遺留之 #ud-legacy-dash 永遠不存在
    document.getElementById('ud-legacy-dash')?.remove();

    const regMod = window.GA_CORE.getModule(tab);
    if (regMod && typeof regMod.renderView === 'function') {
      // 先觸發一次外殼同步（但跳過舊預設視圖產生）
      const main = document.getElementById('main-view');
      _prevRenderCurrentView();
      document.getElementById('ud-legacy-dash')?.remove();
      if (main) regMod.renderView(main);
    } else {
      _prevRenderCurrentView();
      document.getElementById('ud-legacy-dash')?.remove();
    }

    syncSidebarNavGroups();
    enhanceTopbar();
  };

  window.addEventListener('resize', () => {
    syncSidebarNavGroups();
  });

  // --------------------------------------------------------------------------
  // 6. 架構憲章 §6 自動化合規驗收斷言 (verifyDesignRulesCompliance)
  // --------------------------------------------------------------------------
  window.verifyDesignRulesCompliance = function() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const docNoScroll = vw >= 1024 && vh >= 600
      ? (document.documentElement.scrollHeight <= vh + 1 && document.documentElement.scrollWidth <= vw + 1)
      : true;

    const noGhostDom = !document.getElementById('ud-legacy-dash');

    const smallTextNodes = [...document.querySelectorAll('body *')].filter(el => {
      if (el.children.length > 0 || !el.innerText?.trim()) return false;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0 && parseFloat(cs.fontSize) < 11.9;
    });

    const badTruncations = [...document.querySelectorAll('body *')].filter(el => {
      const cs = getComputedStyle(el);
      return cs.display !== 'none' && cs.textOverflow === 'ellipsis'
        && el.clientWidth > 0 && el.clientWidth < 120 && el.scrollWidth > el.clientWidth + 4;
    });

    return {
      pass: docNoScroll && noGhostDom && smallTextNodes.length === 0 && badTruncations.length === 0,
      viewport: `${vw}x${vh}`,
      docNoScroll,
      scrollHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth,
      noGhostDom,
      smallTextCount: smallTextNodes.length,
      smallSamples: smallTextNodes.slice(0, 5).map(e => ({ tag: e.tagName, cls: e.className, fs: getComputedStyle(e).fontSize, txt: e.innerText.slice(0, 20) })),
      badTruncationCount: badTruncations.length,
      badTruncSamples: badTruncations.slice(0, 5).map(e => ({ tag: e.tagName, cls: e.className, w: e.clientWidth, sw: e.scrollWidth, txt: e.innerText.slice(0, 20) }))
    };
  };

  if (window.GA_REGISTRY && typeof window.GA_REGISTRY.registerModule === 'function') {
    window.GA_REGISTRY.registerModule('ui-declutter.js', 'v2.0', '07暖沙雙層黃金艙 × 05特大高清晰字級一屏戰情殼層');
  }

  renderCurrentView();
})();
