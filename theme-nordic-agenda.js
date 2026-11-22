/**
 * ============================================================================
 * 學校總務行政助理 — 「北歐極簡焦點 × 8號行事曆 × 一屏全覽免捲動 × 全卡片進度底色」
 * 檔案名稱：theme-nordic-agenda.js (v2.0 One-Screen Cockpit)
 * 設計規格：
 * 1. 一屏全覽免往下捲動：桌機／筆電戰情室鎖定 100vh，頂部單列整合 KPI＋維運狀態，
 *    左側固定北歐側欄內建 8 號民國年行事曆，右側三欄完整呈現所有區塊。
 * 2. 1 號北歐極簡主視覺：冰霧灰白 (#F6F8FA) ＋ 純白面板 (#FFFFFF) ＋ 峽灣深藍 (#1E3A5F)
 * 3. 8 號行事曆整合（可切換收合）：側欄內嵌柔沙質感民國年迷你月曆，彩色圓點標記到期日，
 *    點任一日期即時篩選全站工作區。
 * 4. 近期例行與待辦雙視圖：「待辦卡片 ↔ 時間軸」一鍵切換並記憶偏好。
 * 5. 全工作卡片背景工作進度條：例行卡片、時間軸列、採購進度、預警雷達、臨時交辦 Memo
 *    全部使用柔和漸層工作進度條底色 ＋ 底部 3px 進度細線 ＋ 純白不透明按鈕防割裂。
 * 6. 100% 相容既有 GAS 同步、採購精靈、甘特圖 PDF、光電／水電、IME 防誤送與實證驗證。
 * ============================================================================
 */

(function initNordicAgendaTheme() {
  // --------------------------------------------------------------------------
  // 0. 載入高易讀字體（Noto Sans TC + Inter + IBM Plex Mono）與一屏設計系統 CSS
  // --------------------------------------------------------------------------
  if (!document.getElementById('nordic-agenda-fonts')) {
    const link = document.createElement('link');
    link.id = 'nordic-agenda-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=Noto+Sans+TC:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(link);
  }

  const st = document.createElement('style');
  st.id = 'theme-nordic-agenda-style';
  st.textContent = `
    :root {
      --bg: #F6F8FA;
      --surface: #FFFFFF;
      --surface-alt: #F8FAFC;
      --border: #E5E9F0;
      --border-strong: #CBD5E1;
      --text: #0F172A;
      --muted: #64748B;
      --primary: #1E3A5F;
      --primary-hover: #152C49;
      --primary-soft: #EFF4F9;
      --red: #DC2626;
      --red-soft: #FEF2F2;
      --amber: #D97706;
      --amber-soft: #FFFBEB;
      --green: #059669;
      --green-soft: #ECFDF5;
      --cal-sand: #F7F4EC;
      --cal-sand-border: #E7E0D0;
      --radius: 11px;
      --shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.03);
      --sidebar-w: 246px;
    }

    body {
      background: var(--bg) !important;
      background-image: none !important;
      color: var(--text) !important;
      font-family: "Inter", "PingFang TC", "Noto Sans TC", "Microsoft JhengHei", system-ui, -apple-system, sans-serif !important;
      font-size: 13.5px;
      line-height: 1.48;
      margin: 0;
    }

    .num-mono, code, .kpi-val, .eng-stat .val, .tnum {
      font-family: "IBM Plex Mono", "Inter", ui-monospace, SFMono-Regular, monospace;
      font-variant-numeric: tabular-nums;
    }

    /* ==================== 主殼層：左側固定側欄 ＋ 右側工作區 ==================== */
    #app-shell {
      display: grid !important;
      grid-template-columns: var(--sidebar-w) minmax(0, 1fr);
      min-height: 100vh;
      background: var(--bg);
    }

    #nordic-sidebar {
      position: sticky;
      top: 0;
      height: 100vh;
      height: 100dvh;
      overflow-y: auto;
      background: #FFFFFF;
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 12px 11px 10px;
      z-index: 80;
    }

    #nordic-main-col {
      min-width: 0;
      display: flex;
      flex-direction: column;
    }

    /* 桌機戰情室「一屏全覽免往下捲動」(>= 1024px) */
    @media (min-width: 1024px) {
      html.nordic-one-screen,
      body.nordic-one-screen {
        height: 100% !important;
        overflow: hidden !important;
      }
      body.nordic-one-screen #app-shell {
        height: 100vh !important;
        height: 100dvh !important;
        overflow: hidden !important;
      }
      body.nordic-one-screen #nordic-main-col {
        height: 100vh !important;
        height: 100dvh !important;
        overflow: hidden !important;
      }
      body.nordic-one-screen #main-view {
        flex: 1 1 auto !important;
        min-height: 0 !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
        padding: 10px 16px 12px !important;
        max-width: 100% !important;
      }
      body.nordic-one-screen .dash-grid,
      body.nordic-one-screen.dash-lock .dash-grid {
        flex: 1 1 auto !important;
        min-height: 0 !important;
        overflow: hidden !important;
        display: grid !important;
        grid-template-columns: minmax(250px, 1.02fr) minmax(380px, 1.58fr) minmax(250px, 0.98fr) !important;
        gap: 12px !important;
        align-items: stretch !important;
      }
      body.nordic-one-screen .dash-grid > div:first-child {
        display: flex !important;
        flex-direction: column !important;
        gap: 10px !important;
        min-height: 0 !important;
        height: 100% !important;
        overflow: hidden !important;
      }
      body.nordic-one-screen .dash-grid > div:first-child > .panel {
        flex: 1 1 0 !important;
        min-height: 0 !important;
        display: flex !important;
        flex-direction: column !important;
        margin-bottom: 0 !important;
      }
      body.nordic-one-screen .dash-grid > .panel {
        height: 100% !important;
        min-height: 0 !important;
        display: flex !important;
        flex-direction: column !important;
        margin-bottom: 0 !important;
      }
      body.nordic-one-screen .dash-grid .panel-hd {
        flex-shrink: 0 !important;
        padding: 9px 12px !important;
      }
      body.nordic-one-screen .dash-grid .panel-bd {
        flex: 1 1 auto !important;
        min-height: 0 !important;
        max-height: none !important;
        overflow-y: auto !important;
        padding: 9px 11px !important;
      }
      body.nordic-one-screen .dash-grid > .panel:last-child > .panel-bd {
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
      }
      body.nordic-one-screen .dash-grid > .panel:last-child .memo-quick {
        flex-shrink: 0 !important;
      }
      body.nordic-one-screen .dash-grid > .panel:last-child .memo-quick + div {
        flex: 1 1 auto !important;
        min-height: 0 !important;
        max-height: none !important;
        overflow-y: auto !important;
      }
    }

    /* 細緻內捲軸（僅在單一面板項目超多時優雅浮現） */
    #nordic-sidebar::-webkit-scrollbar,
    .panel-bd::-webkit-scrollbar,
    .memo-quick + div::-webkit-scrollbar { width: 5px; height: 5px; }
    #nordic-sidebar::-webkit-scrollbar-thumb,
    .panel-bd::-webkit-scrollbar-thumb,
    .memo-quick + div::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 99px; }

    /* ==================== 左側北歐側欄 ==================== */
    .ns-brand {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 2px 6px 10px;
      border-bottom: 1px solid #EEF2F6;
      margin-bottom: 8px;
    }
    .ns-logo {
      width: 30px;
      height: 30px;
      border-radius: 8px;
      background: var(--primary);
      color: #FFFFFF;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 14px;
      flex-shrink: 0;
    }
    .ns-school-name {
      font-size: 13px;
      font-weight: 700;
      color: var(--text);
      line-height: 1.25;
    }
    .ns-sub {
      font-size: 11px;
      color: var(--muted);
    }

    /* 側欄主導覽（緊湊高效率，確保 7 項＋行事曆＋傳送門一屏全見） */
    #nordic-sidebar .nav-tabs-wrap {
      position: static !important;
      background: transparent !important;
      border: none !important;
      margin-bottom: 8px;
    }
    #nordic-sidebar .nav-tabs-wrap::after { display: none !important; }
    #nordic-sidebar .nav-tabs {
      display: flex !important;
      flex-direction: column !important;
      gap: 2px !important;
      padding: 0 !important;
      background: transparent !important;
      border: none !important;
      overflow: visible !important;
    }
    #nordic-sidebar .nav-tab {
      width: 100%;
      justify-content: flex-start !important;
      text-align: left;
      padding: 5px 9px !important;
      min-height: 31px !important;
      border-radius: 7px !important;
      border: none !important;
      color: #475569 !important;
      font-size: 12.5px !important;
      font-weight: 500 !important;
      background: transparent !important;
      gap: 7px;
    }
    #nordic-sidebar .nav-tab:hover { background: #F1F5F9 !important; color: var(--text) !important; }
    #nordic-sidebar .nav-tab.active {
      background: var(--primary-soft) !important;
      color: var(--primary) !important;
      font-weight: 700 !important;
    }
    .tab-cnt-badge {
      margin-left: auto;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 17px;
      padding: 0 5px;
      border-radius: 999px;
      font-size: 10.5px !important;
      font-weight: 700;
      background: #E2E8F0;
      color: #475569;
    }
    .nav-tab.active .tab-cnt-badge { background: var(--primary); color: #FFFFFF; }
    .tab-cnt-badge.red { background: #FEE2E2; color: #B91C1C; }
    .nav-tab.active .tab-cnt-badge.red { background: #DC2626; color: #FFFFFF; }

    /* ==================== 8 號風格迷你行事曆（內嵌側欄，一鍵開合不佔右區高度） ==================== */
    #nordic-side-calendar {
      background: var(--cal-sand);
      border: 1px solid var(--cal-sand-border);
      border-radius: 10px;
      padding: 8px 9px;
      margin: 6px 0 8px;
    }
    #nordic-side-calendar.collapsed { display: none !important; }
    .ncal-hd {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 5px;
    }
    .ncal-title {
      font-size: 12px;
      font-weight: 800;
      color: #1E293B;
    }
    .ncal-nav {
      display: flex;
      gap: 3px;
    }
    .ncal-nav button {
      min-height: 22px !important;
      padding: 1px 6px !important;
      font-size: 11px !important;
      border-radius: 5px;
      border: 1px solid var(--cal-sand-border);
      background: #FFFFFF;
      color: #475569;
    }
    .ncal-nav button:hover { background: var(--primary-soft); color: var(--primary); }
    .ncal-weekdays {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      text-align: center;
      font-size: 10px;
      font-weight: 700;
      color: #78716C;
      margin-bottom: 2px;
    }
    .ncal-days {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 1px;
    }
    .ncal-day {
      border: 1px solid transparent;
      background: transparent;
      border-radius: 6px;
      min-height: 24px !important;
      padding: 1px 0 !important;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1px;
      font-size: 11px !important;
      font-weight: 500;
      color: #334155;
      cursor: pointer;
    }
    .ncal-day:hover { background: rgba(255,255,255,0.8); }
    .ncal-day.other-m { opacity: 0.32; }
    .ncal-day.is-today {
      background: #FFFFFF;
      color: var(--primary);
      font-weight: 800;
      border-color: #93B4D4;
    }
    .ncal-day.is-selected {
      background: var(--primary) !important;
      color: #FFFFFF !important;
      font-weight: 800;
    }
    .ncal-day.is-selected .ncal-dot { background: #FFFFFF !important; }
    .ncal-dots { display: flex; gap: 2px; height: 4px; align-items: center; }
    .ncal-dot { width: 4px; height: 4px; border-radius: 50%; }
    .ncal-dot.red { background: #DC2626; }
    .ncal-dot.amber { background: #D97706; }
    .ncal-dot.blue { background: #2563EB; }
    .ncal-dot.green { background: #059669; }
    .ncal-filter-bar {
      margin-top: 6px;
      padding-top: 5px;
      border-top: 1px dashed var(--cal-sand-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      color: var(--primary);
      font-weight: 700;
    }
    .ncal-filter-bar button {
      min-height: 22px !important;
      padding: 1px 6px !important;
      font-size: 10.5px !important;
      background: #FFFFFF !important;
      border: 1px solid #CBD5E1 !important;
    }

    /* 側欄精巧傳送門（雙欄緊湊晶片，不佔高） */
    #nordic-sidebar .portal-bar {
      background: transparent !important;
      border: none !important;
      border-top: 1px solid #EEF2F6 !important;
      padding: 8px 0 4px !important;
      display: flex !important;
      flex-wrap: wrap !important;
      align-items: center !important;
      gap: 4px !important;
      overflow: visible !important;
    }
    #nordic-sidebar .portal-bar > span {
      width: 100%;
      font-size: 10.5px !important;
      font-weight: 700 !important;
      color: #94A3B8 !important;
      padding: 0 4px 2px !important;
    }
    #nordic-sidebar .portal-chip {
      background: #F8FAFC !important;
      color: #475569 !important;
      border: 1px solid #E5E9F0 !important;
      border-radius: 6px !important;
      padding: 3px 7px !important;
      font-size: 11px !important;
      font-weight: 500;
      min-height: 24px !important;
    }
    #nordic-sidebar .portal-chip:hover {
      background: var(--primary-soft) !important;
      border-color: #93B4D4 !important;
      color: var(--primary) !important;
      text-decoration: none !important;
    }
    #nordic-sidebar .portal-bar button:not(.portal-mobile-toggle) {
      margin-left: auto !important;
      background: #FFFFFF !important;
      color: #64748B !important;
      border: 1px solid var(--border) !important;
      min-height: 24px !important;
      padding: 1px 7px !important;
      font-size: 10.5px !important;
      border-radius: 6px !important;
    }
    #nordic-sidebar .portal-mobile-toggle { display: none !important; }

    /* 側欄底部雲端狀態 */
    .ns-footer {
      margin-top: 6px;
      padding-top: 8px;
      border-top: 1px solid #EEF2F6;
    }
    .ns-footer .sync-pill {
      width: 100%;
      justify-content: flex-start;
      background: #F8FAFC !important;
      color: #334155 !important;
      border: 1px solid var(--border) !important;
      border-radius: 7px !important;
      padding: 5px 9px !important;
      font-size: 11.5px !important;
      font-weight: 600;
    }
    .ns-footer .sync-pill.is-synced { background: #ECFDF5 !important; border-color: #A7F3D0 !important; color: #065F46 !important; }
    .ns-footer .sync-pill.is-err { background: #FEF2F2 !important; border-color: #FECACA !important; color: #991B1B !important; }

    /* ==================== 頂部單行極簡操作列 ==================== */
    #nordic-main-col .topbar {
      flex-shrink: 0;
      background: #FFFFFF !important;
      color: var(--text) !important;
      border-bottom: 1px solid var(--border) !important;
      padding: 8px 16px !important;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .topbar .brand {
      color: var(--text) !important;
      display: flex;
      align-items: center;
      gap: 9px;
    }
    .nt-greet-title {
      font-size: 15.5px;
      font-weight: 800;
      color: var(--text);
      line-height: 1.2;
    }
    .nt-greet-sub {
      font-size: 11.5px;
      color: var(--muted);
    }
    .nt-mobile-menu-btn {
      display: none !important;
      min-height: 34px !important;
      padding: 4px 10px !important;
    }
    .topbar .top-actions { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
    #global-search {
      background: #F8FAFC !important;
      color: var(--text) !important;
      border: 1px solid #DCE3EC !important;
      border-radius: 8px !important;
      padding: 5px 10px !important;
      width: 195px !important;
      min-height: 32px;
      font-size: 12.5px;
    }
    #global-search:focus {
      outline: none;
      background: #FFFFFF !important;
      border-color: var(--primary) !important;
      box-shadow: 0 0 0 2px rgba(30, 58, 95, 0.12);
    }
    .topbar button {
      background: #FFFFFF !important;
      color: #334155 !important;
      border: 1px solid #DCE3EC !important;
      min-height: 32px !important;
      padding: 4px 10px !important;
      font-size: 12px !important;
      border-radius: 7px !important;
    }
    .topbar button:hover { background: #F8FAFC !important; border-color: #CBD5E1 !important; }
    .topbar button.btn-primary, .btn-primary {
      background: var(--primary) !important;
      color: #FFFFFF !important;
      border-color: var(--primary) !important;
    }
    .topbar button.btn-primary:hover, .btn-primary:hover { background: var(--primary-hover) !important; }
    .topbar button.btn-cal-active {
      background: var(--cal-sand) !important;
      color: #78350F !important;
      border-color: #D6C7A9 !important;
    }
    .topbar button.queue-badge { background: #DC2626 !important; color: #FFFFFF !important; border-color: #B91C1C !important; }
    .btn-success { background: #059669 !important; color: #FFFFFF !important; border-color: #059669 !important; }
    .btn-success:hover { background: #047857 !important; }
    .btn-danger { background: #FFFFFF !important; color: #DC2626 !important; border: 1px solid #FECACA !important; }
    .btn-danger:hover { background: #FEF2F2 !important; }
    #btn-fit-mode { display: none !important; }

    /* ==================== 頂部超薄雙列狀態帶（38px KPI 橫條 ＋ 40px 維運橫條 ＝ 共 84px，零斷行！） ==================== */
    .nordic-top-ribbon {
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 10px;
    }
    .nordic-top-ribbon .kpi-grid {
      display: grid !important;
      grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
      gap: 8px !important;
      margin-bottom: 0 !important;
    }
    .nordic-top-ribbon .kpi-card {
      background: #FFFFFF !important;
      border: 1px solid var(--border) !important;
      border-radius: 8px !important;
      padding: 6px 12px !important;
      box-shadow: var(--shadow) !important;
      min-height: 36px;
      min-width: 0;
    }
    .nordic-top-ribbon .kpi-card > div {
      width: 100%;
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 8px;
      min-width: 0;
    }
    .nordic-top-ribbon .kpi-card > span { display: none !important; }
    .nordic-top-ribbon .kpi-label {
      font-size: 12px !important;
      color: #475569 !important;
      font-weight: 600 !important;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .nordic-top-ribbon .kpi-val {
      font-size: 18px !important;
      font-weight: 800 !important;
      line-height: 1 !important;
      margin-top: 0 !important;
      flex-shrink: 0;
    }
    .kpi-card.kpi-red { border-left: 3px solid var(--red) !important; }
    .kpi-card.kpi-amber { border-left: 3px solid var(--amber) !important; }
    .kpi-card.kpi-blue { border-left: 3px solid var(--primary) !important; }
    .kpi-card.kpi-green { border-left: 3px solid var(--green) !important; }

    .nordic-top-ribbon .ops-strip {
      display: grid !important;
      grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
      gap: 8px !important;
      margin-bottom: 0 !important;
    }
    .nordic-top-ribbon .ops-mini-card {
      background: #FFFFFF !important;
      border: 1px solid var(--border) !important;
      border-radius: 8px !important;
      padding: 6px 10px !important;
      box-shadow: var(--shadow) !important;
      font-size: 12px !important;
      min-height: 38px;
      min-width: 0;
      overflow: hidden;
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 6px !important;
    }
    .nordic-top-ribbon .ops-mini-card > div:first-child {
      display: flex;
      align-items: baseline;
      gap: 6px;
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
    }
    .nordic-top-ribbon .ops-mini-card > div:first-child > div:first-child {
      font-size: 11.5px !important;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
      flex: 0 1 auto;
    }
    .nordic-top-ribbon .ops-mini-card > div:first-child > div:nth-child(2) {
      white-space: nowrap;
      flex-shrink: 0;
      font-size: 12.5px !important;
    }
    .nordic-top-ribbon .ops-mini-card .item-meta { display: none !important; }
    .nordic-top-ribbon .ops-mini-card button,
    .nordic-top-ribbon .ops-mini-card .tag {
      font-size: 11px !important;
      padding: 2px 8px !important;
      min-height: 24px !important;
      flex-shrink: 0;
      white-space: nowrap;
    }
    .ops-mini-card.warn-red { border-left: 3px solid var(--red) !important; background: #FFFCFC !important; }
    .ops-mini-card.warn-amber { border-left: 3px solid var(--amber) !important; background: #FFFDF8 !important; }
    .ops-mini-card.warn-ok { border-left: 3px solid var(--green) !important; }

    /* ==================== 主面板樣式 ==================== */
    .panel {
      background: #FFFFFF !important;
      border: 1px solid var(--border) !important;
      border-radius: var(--radius) !important;
      box-shadow: var(--shadow) !important;
      overflow: hidden;
    }
    .panel-hd {
      background: #FFFFFF !important;
      border-bottom: 1px solid #EEF2F6 !important;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .panel-hd h3 {
      margin: 0;
      font-size: 13.5px !important;
      font-weight: 700 !important;
      color: var(--text) !important;
    }

    /* ==================== 全工作卡片背景工作進度條（漸層柔和 ＋ 3px 進度底線 ＋ 實白按鈕） ==================== */
    .card-prog-bg {
      position: relative !important;
      overflow: hidden !important;
      background: #FFFFFF !important;
      border: 1px solid #E5E9F0 !important;
      border-radius: 9px !important;
      isolation: isolate;
      transition: transform 0.14s ease, box-shadow 0.14s ease, border-color 0.14s ease;
    }
    .card-prog-bg:hover {
      border-color: #CBD5E1 !important;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06) !important;
      transform: translateY(-1px);
    }
    .card-prog-bg::before {
      content: "";
      position: absolute;
      inset: 0;
      width: var(--prog-pct, 0%);
      background: linear-gradient(90deg, var(--prog-bg-start, rgba(37, 99, 235, 0.05)) 0%, var(--prog-bg-end, rgba(37, 99, 235, 0.13)) 100%) !important;
      border-right: var(--prog-edge, 1px solid rgba(30, 58, 95, 0.16)) !important;
      z-index: -1;
      transition: width 0.35s cubic-bezier(0.22, 1, 0.36, 1), background 0.3s ease;
      pointer-events: none;
    }
    .card-prog-bg::after {
      content: "";
      position: absolute;
      left: 0;
      bottom: 0;
      height: 3px !important;
      width: var(--prog-pct, 0%);
      background: var(--prog-bar, #1E3A5F) !important;
      z-index: 1;
      transition: width 0.35s cubic-bezier(0.22, 1, 0.36, 1);
      pointer-events: none;
    }
    .card-prog-bg.prog-edge-none::before { border-right: none !important; }

    .tone-red {
      border-left: 3.5px solid #DC2626 !important;
      --prog-bg-start: rgba(220, 38, 38, 0.05);
      --prog-bg-end: rgba(220, 38, 38, 0.14);
      --prog-bar: #DC2626;
      --prog-edge: 1px solid rgba(220, 38, 38, 0.22);
    }
    .tone-amber {
      border-left: 3.5px solid #D97706 !important;
      --prog-bg-start: rgba(217, 119, 6, 0.06);
      --prog-bg-end: rgba(217, 119, 6, 0.15);
      --prog-bar: #D97706;
      --prog-edge: 1px solid rgba(217, 119, 6, 0.24);
    }
    .tone-blue {
      border-left: 3.5px solid #1E3A5F !important;
      --prog-bg-start: rgba(30, 58, 95, 0.05);
      --prog-bg-end: rgba(37, 99, 235, 0.12);
      --prog-bar: #1E3A5F;
      --prog-edge: 1px solid rgba(30, 58, 95, 0.18);
    }
    .tone-green {
      border-left: 3.5px solid #059669 !important;
      --prog-bg-start: rgba(5, 150, 105, 0.05);
      --prog-bg-end: rgba(5, 150, 105, 0.14);
      --prog-bar: #059669;
      --prog-edge: 1px solid rgba(5, 150, 105, 0.22);
    }

    .card-prog-bg button:not(.btn-primary):not(.btn-success):not(.btn-danger),
    .card-prog-bg a.btn-xs {
      background: rgba(255, 255, 255, 0.96) !important;
      border: 1px solid #DCE3EC !important;
      color: #334155 !important;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
    }
    .card-prog-bg button:not(.btn-primary):not(.btn-success):not(.btn-danger):hover,
    .card-prog-bg a.btn-xs:hover {
      background: #FFFFFF !important;
      border-color: #94A3B8 !important;
    }

    .alert-item, .routine-item, .memo-item {
      padding: 9px 11px !important;
      margin-bottom: 8px !important;
      border-radius: 9px !important;
      font-size: 12.5px !important;
    }
    .item-meta { font-size: 11.5px !important; color: var(--muted) !important; margin-top: 2px; }
    .prog-pill {
      background: rgba(255, 255, 255, 0.94) !important;
      border: 1px solid #DCE3EC !important;
      color: #1E293B !important;
      font-family: "IBM Plex Mono", monospace;
      font-size: 11px !important;
      font-weight: 700 !important;
      padding: 1px 7px !important;
      border-radius: 999px !important;
    }

    .tag { border-radius: 5px !important; padding: 1px 6px !important; font-size: 11px !important; font-weight: 600 !important; }
    .tag-red { background: #FEE2E2 !important; color: #B91C1C !important; }
    .tag-amber { background: #FEF3C7 !important; color: #B45309 !important; }
    .tag-green { background: #DCFCE7 !important; color: #047857 !important; }
    .tag-blue { background: #EFF4F9 !important; color: #1E3A5F !important; }
    .tag-gray { background: #F1F5F9 !important; color: #475569 !important; }

    /* 分段控制器（待辦卡片 ↔ 時間軸 ＋ 狀態篩選） */
    .nordic-seg {
      display: inline-flex;
      background: #F1F5F9;
      padding: 2px;
      border-radius: 7px;
      gap: 2px;
      border: 1px solid #E2E8F0;
    }
    .nordic-seg button {
      min-height: 24px !important;
      padding: 2px 8px !important;
      font-size: 11.5px !important;
      font-weight: 600 !important;
      border: none !important;
      background: transparent !important;
      color: #64748B !important;
      border-radius: 5px !important;
      box-shadow: none !important;
    }
    .nordic-seg button.active {
      background: #FFFFFF !important;
      color: var(--primary) !important;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08) !important;
    }

    .rtn-inline-steps { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 7px; }
    .rtn-step-chip {
      display: inline-flex; align-items: center; gap: 5px;
      background: rgba(255, 255, 255, 0.94); border: 1px solid #DCE3EC;
      border-radius: 6px; padding: 3px 7px; font-size: 11.5px; color: #334155; cursor: pointer;
    }
    .rtn-step-chip.done { color: #94A3B8; text-decoration: line-through; }
    .rtn-step-chip input { accent-color: var(--primary); }

    /* 8 號時間軸視圖 */
    .tl-group-lbl {
      font-size: 11px; font-weight: 700; color: var(--muted);
      margin: 8px 0 6px; display: flex; align-items: center; gap: 8px;
    }
    .tl-group-lbl:first-child { margin-top: 0; }
    .tl-group-lbl::after { content: ""; flex: 1; height: 1px; background: #E5E9F0; }
    .tl-row {
      display: grid;
      grid-template-columns: 84px 1fr auto;
      gap: 10px;
      align-items: center;
      padding: 8px 11px !important;
      margin-bottom: 7px !important;
      cursor: pointer;
    }
    .tl-date-anchor {
      text-align: center;
      border-right: 2px solid #CBD5E1;
      padding-right: 8px;
      white-space: nowrap;
    }
    .tone-red .tl-date-anchor { border-right-color: #DC2626; }
    .tone-amber .tl-date-anchor { border-right-color: #D97706; }
    .tone-blue .tl-date-anchor { border-right-color: #1E3A5F; }
    .tone-green .tl-date-anchor { border-right-color: #059669; }
    .tl-date-md { font-size: 14px; font-weight: 800; color: var(--text); line-height: 1.15; }
    .tl-date-sub { font-size: 10.5px; color: var(--muted); margin-top: 1px; }
    .tl-body { min-width: 0; }
    .tl-title { font-size: 12.5px; font-weight: 700; color: var(--text); margin-top: 2px; line-height: 1.35; }

    /* 右欄漸進揭露 Memo 快填 */
    .memo-quick {
      background: #F8FAFC !important;
      border: 1px solid var(--border) !important;
      border-radius: 9px !important;
      padding: 8px !important;
      margin-bottom: 8px !important;
      gap: 6px !important;
    }
    .memo-quick-top { display: flex; flex-direction: column; gap: 6px; }
    .memo-quick-bar { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
    .memo-quick input[type="text"] {
      width: 100%; border: 1px solid #DCE3EC !important; background: #FFFFFF !important;
      border-radius: 7px !important; padding: 6px 9px !important; font-size: 12.5px !important;
    }
    .memo-quick-extra { display: flex; flex-direction: column; gap: 5px; padding-top: 6px; border-top: 1px dashed #DCE3EC; }
    .memo-quick-extra.collapsed { display: none !important; }
    .memo-date-chips { display: flex; gap: 4px; flex-wrap: wrap; }
    .memo-date-chip {
      min-height: 22px !important; padding: 1px 7px !important; font-size: 10.5px !important;
      border-radius: 99px !important; background: #FFFFFF !important; border: 1px solid #DCE3EC !important; color: #475569 !important;
    }
    .memo-item.done { opacity: 0.72; }

    /* 表格與彈窗 */
    th { background: #F8FAFC !important; color: #475569 !important; font-size: 12px; border-bottom: 1px solid var(--border) !important; }
    td { border-bottom-color: #EEF2F6 !important; }
    tr:hover td { background: #F8FAFC !important; }
    .modal { border-radius: 14px !important; border: 1px solid var(--border) !important; box-shadow: 0 24px 60px rgba(15, 23, 42, 0.22) !important; }
    .modal-hd, .modal-ft { background: #F8FAFC !important; }

    #nordic-drawer-backdrop { display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.42); z-index: 75; }
    #nordic-drawer-backdrop.open { display: block; }

    /* 較窄桌機 (1024~1240px) 頂部狀態條兩排微調 */
    @media (max-width: 1240px) and (min-width: 1024px) {
      .nordic-top-ribbon { grid-template-columns: 1fr; gap: 6px; }
    }

    /* 手機與平板響應式 (< 1024px) */
    @media (max-width: 1023px) {
      #app-shell { grid-template-columns: 1fr !important; }
      #nordic-sidebar {
        position: fixed; left: 0; top: 0; bottom: 0; width: 272px;
        transform: translateX(-105%); transition: transform 0.22s ease;
        box-shadow: 8px 0 30px rgba(15, 23, 42, 0.16);
      }
      #nordic-sidebar.mobile-open { transform: translateX(0); }
      .nt-mobile-menu-btn { display: inline-flex !important; }
      .container { padding: 12px 12px 36px !important; }
      .nordic-top-ribbon { grid-template-columns: 1fr; }
      .nordic-top-ribbon .kpi-grid { grid-template-columns: repeat(2, 1fr) !important; }
      .nordic-top-ribbon .ops-strip { grid-template-columns: 1fr !important; }
      .dash-grid { grid-template-columns: 1fr !important; }
    }

    @media print {
      html.nordic-one-screen, body.nordic-one-screen, body.nordic-one-screen #app-shell,
      body.nordic-one-screen #nordic-main-col, body.nordic-one-screen #main-view {
        height: auto !important; overflow: visible !important; display: block !important;
      }
      #nordic-sidebar, #nordic-drawer-backdrop { display: none !important; }
      .card-prog-bg::before, .card-prog-bg::after { display: none !important; }
    }
  `;
  document.head.appendChild(st);

  // --------------------------------------------------------------------------
  // 1. 狀態記憶（localStorage）
  // --------------------------------------------------------------------------
  const STORE_KEY = 'ga_nordic_agenda_prefs_v2';
  let prefs = {
    viewMode: 'cards',      // 'cards' | 'timeline'
    routineFilter: 'all',   // 'all' | 'red' | 'amber' | 'done'
    timelineType: 'all',    // 'all' | 'routine' | 'project' | 'memo'
    showCalendar: true,
    memoExpanded: false
  };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY));
    if (saved && typeof saved === 'object') prefs = { ...prefs, ...saved };
  } catch {}

  function savePrefs() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(prefs)); } catch {}
  }

  const nowDt = new Date();
  let calYear = nowDt.getFullYear();
  let calMonth = nowDt.getMonth() + 1;
  let calSelectedDate = '';

  // --------------------------------------------------------------------------
  // 2. 重組北歐側欄與主區骨架
  // --------------------------------------------------------------------------
  function ensureNordicShell() {
    const shell = document.getElementById('app-shell');
    if (!shell || document.getElementById('nordic-sidebar')) return;

    const topbar = shell.querySelector('.topbar');
    const portalBar = document.getElementById('portal-bar');
    const navWrap = shell.querySelector('.nav-tabs-wrap') || document.getElementById('nav-tabs');
    const mainView = document.getElementById('main-view');

    const sidebar = document.createElement('aside');
    sidebar.id = 'nordic-sidebar';
    sidebar.setAttribute('aria-label', '主導覽、行事曆與常用公務傳送門');

    const sideTop = document.createElement('div');
    sideTop.id = 'nordic-side-top';
    const schoolName = (typeof appData !== 'undefined' && appData.schoolName) || (typeof appConfig !== 'undefined' && appConfig.schoolName) || '高雄市立溪埔國民中學';
    const shortMark = schoolName.replace(/高雄市立|市立|縣立|國立/g, '').slice(0, 1) || '總';

    sideTop.innerHTML = `
      <div class="ns-brand">
        <span class="ns-logo">${esc(shortMark)}</span>
        <div class="ns-brand-text">
          <div class="ns-school-name" id="ns-school-title">${esc(schoolName)}</div>
          <div class="ns-sub">總務行政戰情助理</div>
        </div>
      </div>
    `;

    if (navWrap) sideTop.appendChild(navWrap);

    // 側欄內嵌 8 號民國年迷你行事曆容器
    const calHost = document.createElement('div');
    calHost.id = 'nordic-side-calendar';
    sideTop.appendChild(calHost);

    if (portalBar) sideTop.appendChild(portalBar);

    const sideFooter = document.createElement('div');
    sideFooter.className = 'ns-footer';
    const syncPill = document.getElementById('sync-status');
    if (syncPill) sideFooter.appendChild(syncPill);

    sidebar.appendChild(sideTop);
    sidebar.appendChild(sideFooter);

    const mainCol = document.createElement('div');
    mainCol.id = 'nordic-main-col';
    if (topbar) mainCol.appendChild(topbar);
    const bannerHost = document.getElementById('sys-banners-host');
    if (bannerHost) mainCol.appendChild(bannerHost);
    if (mainView) mainCol.appendChild(mainView);

    shell.appendChild(sidebar);
    shell.appendChild(mainCol);

    if (!document.getElementById('nordic-drawer-backdrop')) {
      const bd = document.createElement('div');
      bd.id = 'nordic-drawer-backdrop';
      bd.onclick = closeMobileSidebar;
      document.body.appendChild(bd);
    }
  }

  window.toggleMobileSidebar = function() {
    const sb = document.getElementById('nordic-sidebar');
    const bd = document.getElementById('nordic-drawer-backdrop');
    if (!sb || !bd) return;
    const isOpen = sb.classList.toggle('mobile-open');
    bd.classList.toggle('open', isOpen);
  };
  function closeMobileSidebar() {
    document.getElementById('nordic-sidebar')?.classList.remove('mobile-open');
    document.getElementById('nordic-drawer-backdrop')?.classList.remove('open');
  }

  // --------------------------------------------------------------------------
  // 3. 日期與統一事件排程引擎（供 8 號側欄月曆 ＋ 時間軸視圖共用）
  // --------------------------------------------------------------------------
  function fmtShortRoc(ymd) {
    if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd || '-';
    const [y, m, d] = ymd.split('-');
    return `${Number(y) - 1911}/${m}/${d}`;
  }
  function weekdayZh(ymd) {
    if (!ymd) return '';
    const dt = new Date(ymd + 'T00:00:00');
    if (isNaN(dt.getTime())) return '';
    return '週' + ['日', '一', '二', '三', '四', '五', '六'][dt.getDay()];
  }

  function buildUnifiedScheduleItems(q = '') {
    const today = todayStr();
    const items = [];

    (appData.tables.Annual_Routines || [])
      .filter(r => r.is_active !== false)
      .forEach(r => {
        const sch = computeRoutineSchedule(r);
        if (!sch.dueDate) return;
        const vis = typeof calcRoutineCardVisual === 'function'
          ? calcRoutineCardVisual(r, sch)
          : { pct: 50, tone: 'blue', parsed: { steps: [], plainNote: '' }, fileCount: 0, label: '辦理中' };
        if (q && !`${r.title} ${r.category} ${r.note || ''}`.toLowerCase().includes(q)) return;
        items.push({
          kind: 'routine', kindLabel: r.category || '例行業務', id: r.routine_id,
          title: r.title, date: sch.dueDate, diff: sch.diffDays,
          pct: Math.max(vis.pct, 8), tone: vis.tone,
          meta: `期別 ${sch.cycle} ・ ${vis.label}`, raw: r, sch, vis
        });
      });

    (appData.tables.Projects || [])
      .filter(p => !['已結案', '廢標撤案'].includes(p.status))
      .forEach(p => {
        if (q && !`${p.project_name} ${p.project_id} ${p.vendor_name || ''}`.toLowerCase().includes(q)) return;
        const prog = calcProjectProgress(p.project_id);
        const vis = typeof calcProjectCardVisual === 'function' ? calcProjectCardVisual(p, prog) : { pct: prog.pct, tone: 'blue' };
        const anchorDate = p.grant_deadline || p.orig_end_date || p.warranty_end_date || today;
        items.push({
          kind: 'project', kindLabel: p.grant_deadline ? '採購補助死線' : `${p.procurement_type || '採購'}進度`,
          id: p.project_id, title: p.project_name, date: anchorDate, diff: diffDays(today, anchorDate),
          pct: Math.max(vis.pct, 8), tone: vis.tone,
          meta: `${prog.currentStage} ・ 檢核 ${prog.doneChecks}/${prog.totalChecks} (${prog.pct}%)`, raw: p, prog
        });
      });

    (appData.tables.Quick_Memos || [])
      .filter(m => !m.is_done)
      .forEach(m => {
        if (q && !`${m.content} ${m.source_tag || ''}`.toLowerCase().includes(q)) return;
        const dt = m.due_date || m.remind_date;
        if (!dt) return;
        const vis = typeof calcMemoCardVisual === 'function' ? calcMemoCardVisual(m, today) : { pct: 50, tone: 'amber' };
        items.push({
          kind: 'memo', kindLabel: m.source_tag || '臨時交辦', id: m.memo_id,
          title: m.content, date: dt, diff: diffDays(today, dt),
          pct: Math.max(vis.pct, 18), tone: vis.tone,
          meta: m.due_date ? `交辦期限 ${fmtShortRoc(m.due_date)}` : `提醒日 ${fmtShortRoc(m.remind_date)}`, raw: m
        });
      });

    items.sort((a, b) => a.date.localeCompare(b.date) || (a.diff - b.diff));
    return items;
  }

  // --------------------------------------------------------------------------
  // 4. 8 號迷你行事曆渲染於側欄（點擊日期即篩選戰情面板）
  // --------------------------------------------------------------------------
  window.toggleNordicCalendar = function() {
    prefs.showCalendar = !prefs.showCalendar;
    if (!prefs.showCalendar) calSelectedDate = '';
    savePrefs();
    renderCurrentView();
  };
  window.shiftNordicCalMonth = function(delta) {
    calMonth += delta;
    if (calMonth < 1) { calMonth = 12; calYear--; }
    else if (calMonth > 12) { calMonth = 1; calYear++; }
    renderSideCalendar(buildUnifiedScheduleItems((document.getElementById('global-search')?.value || '').trim().toLowerCase()));
  };
  window.jumpNordicCalToday = function() {
    const n = new Date();
    calYear = n.getFullYear();
    calMonth = n.getMonth() + 1;
    calSelectedDate = '';
    renderCurrentView();
  };
  window.selectNordicCalDate = function(ymd) {
    calSelectedDate = (calSelectedDate === ymd) ? '' : ymd;
    if (calSelectedDate && typeof currentTab !== 'undefined' && currentTab !== 'dashboard') {
      switchTab('dashboard');
      return;
    }
    renderCurrentView();
  };

  function renderSideCalendar(allItems) {
    const host = document.getElementById('nordic-side-calendar');
    if (!host) return;
    host.classList.toggle('collapsed', !prefs.showCalendar);
    if (!prefs.showCalendar) return;

    const today = todayStr();
    const byDate = {};
    allItems.forEach(it => {
      if (!byDate[it.date]) byDate[it.date] = [];
      byDate[it.date].push(it);
    });

    const firstDow = new Date(calYear, calMonth - 1, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth, 0).getDate();
    const prevDays = new Date(calYear, calMonth - 1, 0).getDate();

    const cells = [];
    for (let i = firstDow - 1; i >= 0; i--) {
      const d = prevDays - i;
      const pm = calMonth === 1 ? 12 : calMonth - 1;
      const py = calMonth === 1 ? calYear - 1 : calYear;
      cells.push({ ymd: `${py}-${String(pm).padStart(2, '0')}-${String(d).padStart(2, '0')}`, d, other: true });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ ymd: `${calYear}-${String(calMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`, d, other: false });
    }
    while (cells.length % 7 !== 0) {
      const nextD = cells.length - (firstDow + daysInMonth) + 1;
      const nm = calMonth === 12 ? 1 : calMonth + 1;
      const ny = calMonth === 12 ? calYear + 1 : calYear;
      cells.push({ ymd: `${ny}-${String(nm).padStart(2, '0')}-${String(nextD).padStart(2, '0')}`, d: nextD, other: true });
    }

    host.innerHTML = `
      <div class="ncal-hd">
        <span class="ncal-title num-mono">民國 ${calYear - 1911} 年 ${calMonth} 月</span>
        <div class="ncal-nav">
          <button type="button" onclick="shiftNordicCalMonth(-1)" title="上個月">‹</button>
          <button type="button" onclick="jumpNordicCalToday()" title="回到今天">今</button>
          <button type="button" onclick="shiftNordicCalMonth(1)" title="下個月">›</button>
        </div>
      </div>
      <div class="ncal-weekdays"><span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span></div>
      <div class="ncal-days num-mono">
        ${cells.map(c => {
          const evs = byDate[c.ymd] || [];
          const dots = evs.slice(0, 3).map(e => `<span class="ncal-dot ${e.tone}"></span>`).join('');
          const cls = ['ncal-day', c.other ? 'other-m' : '', c.ymd === today ? 'is-today' : '', c.ymd === calSelectedDate ? 'is-selected' : ''].filter(Boolean).join(' ');
          return `<button type="button" class="${cls}" onclick="selectNordicCalDate('${c.ymd}')" title="${c.ymd}${evs.length ? `（${evs.length} 項業務）` : ''}">
            <span>${c.d}</span><span class="ncal-dots">${dots}</span>
          </button>`;
        }).join('')}
      </div>
      ${calSelectedDate ? `
        <div class="ncal-filter-bar num-mono">
          <span>篩選 ${fmtShortRoc(calSelectedDate)}</span>
          <button type="button" onclick="selectNordicCalDate('')">清除</button>
        </div>
      ` : ''}
    `;
  }

  // --------------------------------------------------------------------------
  // 5. 頂部列與一屏鎖定狀態更新
  // --------------------------------------------------------------------------
  function syncOneScreenLock() {
    const isDash = (typeof currentTab === 'undefined' || currentTab === 'dashboard') && window.innerWidth >= 1024;
    document.documentElement.classList.toggle('nordic-one-screen', isDash);
    document.body.classList.toggle('nordic-one-screen', isDash);
  }

  function enhanceNordicChrome() {
    ensureNordicShell();
    syncOneScreenLock();

    const schoolName = (typeof appData !== 'undefined' && appData.schoolName) || (typeof appConfig !== 'undefined' && appConfig.schoolName) || '高雄市立溪埔國民中學';
    const sideTitle = document.getElementById('ns-school-title');
    if (sideTitle) sideTitle.textContent = schoolName;

    const now = new Date();
    const wk = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
    const rocStr = `民國${now.getFullYear() - 1911}年${String(now.getMonth() + 1).padStart(2, '0')}月${String(now.getDate()).padStart(2, '0')}日 (${wk})`;

    const tabTitles = {
      dashboard: '今日總務焦點工作台',
      projects: '採購與履約管理',
      'annual-gantt': '全校年度甘特圖',
      templates: '年度標案模板庫',
      routines: '年度固定例行事務',
      solar: '太陽能屋頂租賃',
      utilities: '水電費異常控管'
    };

    const brand = document.querySelector('.topbar .brand');
    if (brand) {
      const pageTitle = tabTitles[typeof currentTab !== 'undefined' ? currentTab : 'dashboard'] || '總務行政戰情助理';
      brand.innerHTML = `
        <button type="button" class="nt-mobile-menu-btn" aria-label="開啟導覽選單" onclick="toggleMobileSidebar()">☰</button>
        <div>
          <div class="nt-greet-title">${esc(pageTitle)}</div>
          <div class="nt-greet-sub num-mono"><span id="school-title" style="display:none">${esc(schoolName)}</span><span id="today-roc">${esc(rocStr)}</span></div>
        </div>
      `;
    }

    const actions = document.querySelector('.topbar .top-actions');
    if (actions) {
      let calBtn = document.getElementById('btn-toggle-calendar');
      if (!calBtn) {
        calBtn = document.createElement('button');
        calBtn.id = 'btn-toggle-calendar';
        calBtn.type = 'button';
        calBtn.onclick = () => window.toggleNordicCalendar();
        const searchEl = document.getElementById('global-search');
        if (searchEl) searchEl.insertAdjacentElement('afterend', calBtn);
        else actions.prepend(calBtn);
      }
      calBtn.classList.toggle('btn-cal-active', prefs.showCalendar);
      calBtn.textContent = prefs.showCalendar ? '📅 收合行事曆' : '📅 顯示行事曆';

      if (!document.getElementById('btn-quick-new-routine')) {
        const addPrjBtn = Array.from(actions.querySelectorAll('button')).find(b => (b.getAttribute('onclick') || '').includes('openProjectWizard'));
        if (addPrjBtn) {
          addPrjBtn.textContent = '＋ 新增採購';
          const rtnBtn = document.createElement('button');
          rtnBtn.id = 'btn-quick-new-routine';
          rtnBtn.type = 'button';
          rtnBtn.textContent = '＋ 新增例行';
          rtnBtn.onclick = () => openRoutineModal();
          addPrjBtn.insertAdjacentElement('afterend', rtnBtn);
        }
      }
    }

    const syncPill = document.getElementById('sync-status');
    const syncDot = document.getElementById('sync-dot');
    if (syncPill && syncDot) {
      syncPill.classList.toggle('is-synced', syncDot.classList.contains('ok'));
      syncPill.classList.toggle('is-err', syncDot.classList.contains('err'));
    }

    // 側欄徽章
    const alerts = typeof buildAllAlerts === 'function' ? buildAllAlerts() : [];
    const prjCnt = (appData.tables?.Projects || []).filter(p => !['已結案', '廢標撤案'].includes(p.status)).length;
    const rtnCnt = (appData.tables?.Annual_Routines || []).filter(r => r.is_active !== false).length;
    const setBadge = (tabKey, count, isRed) => {
      const btn = document.querySelector(`#nav-tabs [data-tab="${tabKey}"]`);
      if (!btn) return;
      let b = btn.querySelector('.tab-cnt-badge');
      if (count <= 0) { if (b) b.remove(); return; }
      if (!b) { b = document.createElement('span'); btn.appendChild(b); }
      b.className = 'tab-cnt-badge' + (isRed ? ' red' : '');
      b.textContent = String(count);
    };
    setBadge('dashboard', alerts.length, alerts.some(a => a.level === 'red'));
    setBadge('projects', prjCnt, false);
    setBadge('routines', rtnCnt, false);

    // 更新側欄 8 號月曆
    const q = (document.getElementById('global-search')?.value || '').trim().toLowerCase();
    renderSideCalendar(buildUnifiedScheduleItems(q));
  }

  // --------------------------------------------------------------------------
  // 6. 戰情室一屏工作區強化（單列 KPI+維運 ＋ 卡片/時間軸切換 ＋ 全卡片進度底色）
  // --------------------------------------------------------------------------
  window.setNordicViewMode = function(mode) { prefs.viewMode = mode; savePrefs(); renderCurrentView(); };
  window.setNordicRoutineFilter = function(mode) { prefs.routineFilter = mode; savePrefs(); renderCurrentView(); };
  window.setNordicTimelineType = function(tp) { prefs.timelineType = tp; savePrefs(); renderCurrentView(); };

  window.toggleNordicStepInline = async function(routineId, stepIdx, checked) {
    const r = (appData.tables.Annual_Routines || []).find(x => x.routine_id === routineId);
    if (!r || typeof parseRoutineNote !== 'function' || typeof serializeRoutineNote !== 'function') return;
    const parsed = parseRoutineNote(r.note);
    if (!parsed.steps[stepIdx]) return;
    parsed.steps[stepIdx].done = checked;
    r.note = serializeRoutineNote(parsed);
    r.updated_at = nowStr();
    renderCurrentView();
    await pushToCloud({ action: 'upsert', table: 'Annual_Routines', record: r });
  };

  window.toggleNordicMemoExtra = function() {
    prefs.memoExpanded = !prefs.memoExpanded;
    savePrefs();
    const ex = document.getElementById('nordic-memo-extra');
    const btn = document.getElementById('nordic-memo-toggle-btn');
    if (ex) ex.classList.toggle('collapsed', !prefs.memoExpanded);
    if (btn) btn.textContent = prefs.memoExpanded ? '收合選項' : '＋ 期限／分類';
  };

  window.setQuickMemoDateOffset = function(days) {
    const dueEl = document.getElementById('memo-due');
    if (!dueEl) return;
    dueEl.value = addDays(todayStr(), days);
    dueEl.dispatchEvent(new Event('change'));
  };

  function renderTimelineCardHTML(it) {
    const md = it.date ? it.date.slice(5).replace('-', '/') : '--/--';
    const d = it.diff;
    const dTxt = d < 0 ? `逾期 ${Math.abs(d)} 天` : d === 0 ? '今天到期' : `剩 ${d} 天`;
    const tagCls = it.tone === 'red' ? 'tag-red' : it.tone === 'amber' ? 'tag-amber' : it.tone === 'green' ? 'tag-green' : 'tag-blue';
    const edgeCls = (it.pct <= 0 || it.pct >= 100) ? 'prog-edge-none' : '';
    const onClickAttr = it.kind === 'routine'
      ? `openRoutineDetailModal('${esc(it.id)}')`
      : it.kind === 'project'
        ? `openProjectDetail('${esc(it.id)}')`
        : `document.getElementById('memo-input')?.focus()`;

    const actionBtn = it.kind === 'routine'
      ? (it.raw.linked_template_id
          ? `<button type="button" class="btn-xs btn-primary" style="min-height:26px!important;padding:2px 8px" onclick="event.stopPropagation();openProjectWizard('${esc(it.raw.linked_template_id)}','${esc(it.title)}')">套模板</button>`
          : `<button type="button" class="btn-xs btn-success" style="min-height:26px!important;padding:2px 8px" onclick="event.stopPropagation();markRoutineDone('${esc(it.id)}','${esc(it.sch.cycle)}')">✓ 辦結</button>`)
      : it.kind === 'project'
        ? `<button type="button" class="btn-xs" style="min-height:26px!important;padding:2px 8px" onclick="event.stopPropagation();openProjectDetail('${esc(it.id)}')">進控管</button>`
        : `<button type="button" class="btn-xs" style="min-height:26px!important;padding:2px 8px" onclick="event.stopPropagation();convertMemoToProject('${esc(it.id)}')">轉採購</button>`;

    return `
      <div class="tl-row card-prog-bg tone-${it.tone} ${edgeCls}"
           style="--prog-pct:${it.pct}%"
           role="button" tabindex="0"
           onclick="${onClickAttr}">
        <div class="tl-date-anchor num-mono">
          <div class="tl-date-md">${esc(md)}</div>
          <div class="tl-date-sub">${esc(weekdayZh(it.date))}・${esc(dTxt)}</div>
        </div>
        <div class="tl-body">
          <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap">
            <span class="tag ${tagCls}">${esc(it.kindLabel)}</span>
            <span class="prog-pill">${it.pct}%</span>
          </div>
          <div class="tl-title">${esc(it.title)}</div>
          <div class="item-meta num-mono">${esc(it.meta)}</div>
        </div>
        <div>${actionBtn}</div>
      </div>
    `;
  }

  function enhanceNordicWarRoom() {
    if (typeof currentTab === 'undefined' || currentTab !== 'dashboard') return;
    const mainView = document.getElementById('main-view');
    const dashGrid = document.querySelector('#main-view .dash-grid');
    if (!mainView || !dashGrid) return;

    // 1. 將 4 格 KPI 與 3 格維運條整合為單一精簡列 (.nordic-top-ribbon)，大幅釋放垂直高度
    const kpiGrid = mainView.querySelector(':scope > .kpi-grid');
    const opsStrip = mainView.querySelector(':scope > .ops-strip');
    if (kpiGrid && !mainView.querySelector('.nordic-top-ribbon')) {
      const ribbon = document.createElement('div');
      ribbon.className = 'nordic-top-ribbon';
      kpiGrid.parentNode.insertBefore(ribbon, kpiGrid);
      ribbon.appendChild(kpiGrid);
      if (opsStrip) ribbon.appendChild(opsStrip);
    }

    const q = (document.getElementById('global-search')?.value || '').trim().toLowerCase();
    const allScheduleItems = buildUnifiedScheduleItems(q);

    // 2. 左欄：紅黃燈預警雷達 ＋ 進行中採購（全卡片工作進度底色）
    const leftPanels = dashGrid.querySelectorAll(':scope > div:first-child > .panel');
    if (leftPanels[0]) {
      const h3 = leftPanels[0].querySelector('.panel-hd h3');
      if (h3) h3.textContent = '紅黃燈預警雷達';
      leftPanels[0].querySelectorAll('.alert-item').forEach((el, idx) => {
        const a = (window._dashAlerts || [])[idx];
        if (!a || typeof calcAlertCardVisual !== 'function') return;
        const v = calcAlertCardVisual(a);
        applyProgStyleToEl(el, Math.max(v.pct, 12), v.tone);
      });
    }
    if (leftPanels[1]) {
      const h3 = leftPanels[1].querySelector('.panel-hd h3');
      if (h3) h3.textContent = '進行中採購與履約';
      const activeProjects = (appData.tables.Projects || [])
        .filter(p => !['已結案', '廢標撤案'].includes(p.status))
        .filter(p => !q || String(p.project_name + p.project_id + p.vendor_name).toLowerCase().includes(q));
      leftPanels[1].querySelectorAll('.alert-item').forEach((el, idx) => {
        const p = activeProjects[idx];
        if (!p) return;
        const prog = calcProjectProgress(p.project_id);
        const v = typeof calcProjectCardVisual === 'function' ? calcProjectCardVisual(p, prog) : { pct: prog.pct, tone: 'blue' };
        applyProgStyleToEl(el, Math.max(v.pct, 8), v.tone);
      });
      const emptyEl = leftPanels[1].querySelector('.empty-state');
      if (emptyEl && emptyEl.textContent.includes('開新標案')) {
        emptyEl.textContent = '尚無進行中採購案，點擊右上角「＋ 新增採購」啟動流程。';
      }
    }

    // 3. 中欄：近期例行與待辦（支援 待辦卡片 ↔ 時間軸 ＋ 側欄月曆篩選連動 ＋ 全卡片進度底色）
    const midPanel = dashGrid.querySelector(':scope > .panel:nth-child(2)');
    if (midPanel) {
      const midHd = midPanel.querySelector('.panel-hd');
      if (midHd) {
        midHd.innerHTML = `
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <h3>${prefs.viewMode === 'timeline' ? '近期業務時間軸' : '近期例行與待辦'}</h3>
            <div class="nordic-seg" role="group" aria-label="切換待辦卡片或時間軸">
              <button type="button" class="${prefs.viewMode === 'cards' ? 'active' : ''}" onclick="setNordicViewMode('cards')">待辦卡片</button>
              <button type="button" class="${prefs.viewMode === 'timeline' ? 'active' : ''}" onclick="setNordicViewMode('timeline')">時間軸</button>
            </div>
            ${calSelectedDate ? `<span class="tag tag-blue num-mono" style="cursor:pointer" onclick="selectNordicCalDate('')">📅 ${fmtShortRoc(calSelectedDate)} ✕</span>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap">
            ${prefs.viewMode === 'cards' ? `
              <div class="nordic-seg" role="group" aria-label="狀態篩選">
                ${[['all','全部'],['red','逾期'],['amber','逼近'],['done','已辦']].map(([k, lbl]) =>
                  `<button type="button" class="${prefs.routineFilter === k ? 'active' : ''}" onclick="setNordicRoutineFilter('${k}')">${lbl}</button>`
                ).join('')}
              </div>
            ` : `
              <div class="nordic-seg" role="group" aria-label="時間軸分類">
                ${[['all','全部'],['routine','例行'],['project','採購'],['memo','交辦']].map(([k, lbl]) =>
                  `<button type="button" class="${prefs.timelineType === k ? 'active' : ''}" onclick="setNordicTimelineType('${k}')">${lbl}</button>`
                ).join('')}
              </div>
            `}
            <button type="button" class="btn-xs" style="min-height:26px!important;padding:2px 7px" onclick="switchTab('routines')">管理</button>
          </div>
        `;
      }

      const midBd = midPanel.querySelector('.panel-bd');
      if (midBd) {
        if (prefs.viewMode === 'timeline') {
          const tlList = allScheduleItems.filter(it => {
            if (prefs.timelineType !== 'all' && it.kind !== prefs.timelineType) return false;
            if (calSelectedDate && it.date !== calSelectedDate) return false;
            return true;
          });
          if (!tlList.length) {
            midBd.innerHTML = `<div class="empty-state">${calSelectedDate ? `${fmtShortRoc(calSelectedDate)} 無到期業務。` : '目前沒有符合條件的排程。'}${calSelectedDate ? `<br><button type="button" class="btn-xs" style="margin-top:6px" onclick="selectNordicCalDate('')">顯示全部日期</button>` : ''}</div>`;
          } else {
            const overdue = tlList.filter(x => x.diff < 0);
            const week = tlList.filter(x => x.diff >= 0 && x.diff <= 7);
            const later = tlList.filter(x => x.diff > 7);
            const sec = [];
            if (overdue.length) sec.push(`<div class="tl-group-lbl" style="color:#DC2626">已逾期（${overdue.length}）</div>${overdue.map(renderTimelineCardHTML).join('')}`);
            if (week.length) sec.push(`<div class="tl-group-lbl" style="color:#B45309">7 日內必辦（${week.length}）</div>${week.map(renderTimelineCardHTML).join('')}`);
            if (later.length) sec.push(`<div class="tl-group-lbl">後續排程（${later.length}）</div>${later.map(renderTimelineCardHTML).join('')}`);
            midBd.innerHTML = sec.join('');
          }
        } else {
          const allActive = (appData.tables.Annual_Routines || [])
            .filter(r => r.is_active !== false)
            .filter(r => !q || String(r.title + r.category + r.note).toLowerCase().includes(q));

          let list = [];
          if (prefs.routineFilter === 'done') {
            list = allActive.map(r => {
              const sch = computeRoutineSchedule(r);
              const vis = typeof calcRoutineCardVisual === 'function' ? calcRoutineCardVisual(r, sch) : { pct: 100, tone: 'green', parsed: { steps: [], plainNote: '' }, fileCount: 0, label: '已辦' };
              return { ...r, sch, vis, isRecentlyDone: Boolean(r.last_done_cycle) || vis.pct >= 100 };
            }).filter(x => x.isRecentlyDone);
          } else {
            list = allActive
              .map(r => {
                const sch = computeRoutineSchedule(r);
                const vis = typeof calcRoutineCardVisual === 'function' ? calcRoutineCardVisual(r, sch) : { pct: 50, tone: 'blue', parsed: { steps: [], plainNote: '' }, fileCount: 0, label: '' };
                return { ...r, sch, vis };
              })
              .filter(x => calSelectedDate ? x.sch.dueDate === calSelectedDate : x.sch.isVisible)
              .filter(x => prefs.routineFilter === 'all' || x.vis.tone === prefs.routineFilter)
              .sort((a, b) => a.sch.diffDays - b.sch.diffDays);
          }

          if (!list.length) {
            midBd.innerHTML = `<div class="empty-state">${calSelectedDate ? `${fmtShortRoc(calSelectedDate)} 無到期例行業務。` : (prefs.routineFilter === 'all' ? '近期待辦例行業務皆已完成！' : '此分類目前無項目。')}<br><button type="button" class="btn-xs" style="margin-top:6px" onclick="${calSelectedDate ? "selectNordicCalDate('')" : (prefs.routineFilter === 'all' ? "switchTab('routines')" : "setNordicRoutineFilter('all')")}">${calSelectedDate ? '顯示全部日期' : (prefs.routineFilter === 'all' ? '檢視全年度清單' : '顯示全部')}</button></div>`;
          } else {
            midBd.innerHTML = list.map(item => {
              const r = item, sch = item.sch, vis = item.vis;
              const isDoneView = prefs.routineFilter === 'done';
              const tone = isDoneView ? 'green' : vis.tone;
              const pct = isDoneView ? 100 : Math.max(vis.pct, 8);
              const d = sch.diffDays;
              const dTxt = isDoneView ? `辦結 ${r.last_done_date || r.last_done_cycle}` : (d < 0 ? `逾期 ${Math.abs(d)} 天` : d === 0 ? '今天到期' : `剩 ${d} 天`);
              const badgeCls = tone === 'red' ? 'tag-red' : tone === 'amber' ? 'tag-amber' : tone === 'green' ? 'tag-green' : 'tag-blue';
              const canQuickBuy = ['一般小額採購', '共同供應契約'].includes(r.category);
              const steps = (vis.parsed && vis.parsed.steps) ? vis.parsed.steps : [];
              const modeHint = vis.mode === 'work' ? `步驟 ${vis.doneSteps}/${vis.totalSteps} (${vis.pct}%)` : `進度 ${vis.pct}%`;

              const inlineStepsHtml = steps.length ? `
                <div class="rtn-inline-steps" onclick="event.stopPropagation()">
                  ${steps.slice(0, 3).map((s, idx) => `
                    <label class="rtn-step-chip ${s.done ? 'done' : ''}">
                      <input type="checkbox" ${s.done ? 'checked' : ''} onchange="toggleNordicStepInline('${esc(r.routine_id)}', ${idx}, this.checked)">
                      <span>${esc(s.text)}</span>
                    </label>
                  `).join('')}
                  ${steps.length > 3 ? `<span class="rtn-step-chip" onclick="openRoutineDetailModal('${esc(r.routine_id)}')">…+${steps.length - 3}</span>` : ''}
                </div>
              ` : '';

              return `
                <div class="routine-item card-prog-bg tone-${tone} ${(pct <= 0 || pct >= 100) ? 'prog-edge-none' : ''} routine-card-clickable"
                     style="--prog-pct:${pct}%"
                     role="button" tabindex="0"
                     onclick="openRoutineDetailModal('${esc(r.routine_id)}')">
                  <div class="item-row">
                    <div style="flex:1;min-width:0">
                      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                        <span class="tag ${badgeCls}">${esc(dTxt)}</span>
                        <strong style="font-size:13.5px;color:var(--text)">${esc(r.title)}</strong>
                      </div>
                      <div class="item-meta num-mono">${esc(r.category)} ・ 期別 ${esc(sch.cycle)} ・ ${esc(fmtShortRoc(sch.dueDate))}（${esc(weekdayZh(sch.dueDate))}）</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:4px;flex-shrink:0">
                      ${vis.fileCount > 0 ? `<span class="tag tag-gray">附件 ${vis.fileCount}</span>` : ''}
                      <span class="prog-pill">${esc(modeHint)}</span>
                    </div>
                  </div>
                  ${inlineStepsHtml}
                  <div style="display:flex;gap:5px;margin-top:7px;flex-wrap:wrap;align-items:center;padding-top:6px;border-top:1px solid rgba(15, 23, 42, 0.06)">
                    <button type="button" class="btn-xs btn-success" style="min-height:27px!important;padding:2px 8px" onclick="event.stopPropagation();markRoutineDone('${esc(r.routine_id)}','${esc(sch.cycle)}')">✓ 辦結</button>
                    <button type="button" class="btn-xs" style="min-height:27px!important;padding:2px 8px" onclick="event.stopPropagation();openRoutineDetailModal('${esc(r.routine_id)}')">詳情附件</button>
                    ${r.portal_url ? `<a class="btn-xs" style="min-height:27px!important;padding:2px 8px" href="${esc(r.portal_url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">網站 ↗</a>` : ''}
                    ${r.linked_template_id ? `<button type="button" class="btn-xs btn-primary" style="min-height:27px!important;padding:2px 8px;margin-left:auto" onclick="event.stopPropagation();openProjectWizard('${esc(r.linked_template_id)}','${esc(r.title)}')">套模板</button>` : ''}
                    ${(!r.linked_template_id && canQuickBuy && typeof openRoutineQuickPurchase === 'function') ? `<button type="button" class="btn-xs btn-primary" style="min-height:27px!important;padding:2px 8px;margin-left:auto" onclick="event.stopPropagation();openRoutineQuickPurchase('${esc(r.routine_id)}')">開單</button>` : ''}
                  </div>
                </div>
              `;
            }).join('');
          }
        }
      }
    }

    // 4. 右欄：臨時交辦 Memo（漸進揭露 ＋ 全卡片背景進度底色）
    const rightPanel = dashGrid.querySelector(':scope > .panel:last-child');
    if (rightPanel) {
      const rh3 = rightPanel.querySelector('.panel-hd h3');
      if (rh3) rh3.textContent = '臨時交辦 Memo';

      const quickBox = rightPanel.querySelector('.memo-quick');
      if (quickBox && !quickBox.dataset.nordicUpgraded) {
        quickBox.dataset.nordicUpgraded = '1';
        const inp = quickBox.querySelector('#memo-input');
        const rows = Array.from(quickBox.querySelectorAll('.memo-quick-row'));
        const addBtn = quickBox.querySelector('button[onclick*="quickAddMemo"]');

        const topRow = document.createElement('div');
        topRow.className = 'memo-quick-top';
        if (inp) {
          inp.placeholder = '快速輸入交辦事項，按 Enter 存檔...';
          topRow.appendChild(inp);
        }
        const bar = document.createElement('div');
        bar.className = 'memo-quick-bar';
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'nordic-memo-toggle-btn';
        toggleBtn.type = 'button';
        toggleBtn.className = 'btn-xs';
        toggleBtn.style.cssText = 'min-height:26px!important;white-space:nowrap;padding:2px 8px;font-size:11.5px';
        toggleBtn.textContent = prefs.memoExpanded ? '收合選項' : '＋ 期限／分類';
        toggleBtn.onclick = () => window.toggleNordicMemoExtra();
        bar.appendChild(toggleBtn);
        if (addBtn) {
          addBtn.style.cssText = 'min-height:26px!important;white-space:nowrap;padding:2px 12px;font-size:11.5px';
          addBtn.textContent = '＋ 記錄';
          bar.appendChild(addBtn);
        }
        topRow.appendChild(bar);

        const extraWrap = document.createElement('div');
        extraWrap.id = 'nordic-memo-extra';
        extraWrap.className = 'memo-quick-extra' + (prefs.memoExpanded ? '' : ' collapsed');
        const chips = document.createElement('div');
        chips.className = 'memo-date-chips';
        chips.innerHTML = `
          <button type="button" class="memo-date-chip" onclick="setQuickMemoDateOffset(0)">今天</button>
          <button type="button" class="memo-date-chip" onclick="setQuickMemoDateOffset(1)">明天</button>
          <button type="button" class="memo-date-chip" onclick="setQuickMemoDateOffset(3)">3天後</button>
          <button type="button" class="memo-date-chip" onclick="setQuickMemoDateOffset(7)">1週後</button>
        `;
        extraWrap.appendChild(chips);
        rows.forEach(r => extraWrap.appendChild(r));

        quickBox.innerHTML = '';
        quickBox.appendChild(topRow);
        quickBox.appendChild(extraWrap);
      }

      const today = todayStr();
      const allMemos = (appData.tables.Quick_Memos || []).filter(m => !q || String(m.content + m.source_tag).toLowerCase().includes(q));
      const openMemos = allMemos.filter(m => !m.is_done).sort((a, b) => {
        const score = m => {
          if (m.due_date && diffDays(today, m.due_date) <= 0) return 0;
          if (m.remind_date && diffDays(today, m.remind_date) <= 0) return 1;
          if (m.priority === '緊急') return 2;
          if (m.priority === '重要') return 3;
          return 4;
        };
        return score(a) - score(b) || String(a.due_date || '9999').localeCompare(String(b.due_date || '9999'));
      });
      const doneMemos = (typeof showDoneMemos !== 'undefined' && showDoneMemos) ? allMemos.filter(m => m.is_done).slice(0, 20) : [];
      const renderedMemos = openMemos.concat(doneMemos);

      rightPanel.querySelectorAll('.memo-item').forEach((el, idx) => {
        const m = renderedMemos[idx];
        if (!m) return;
        const v = typeof calcMemoCardVisual === 'function' ? calcMemoCardVisual(m, today) : { pct: 35, tone: 'blue' };
        const pct = m.is_done ? 100 : Math.max(v.pct, 18);
        applyProgStyleToEl(el, pct, v.tone);
        const delBtn = el.querySelector('.btn-danger');
        if (delBtn && delBtn.textContent.trim() === '刪') delBtn.textContent = '刪除';
      });
    }
  }

  // --------------------------------------------------------------------------
  // 7. 掛載生命週期、視窗尺寸監聽與模組健康登記
  // --------------------------------------------------------------------------
  if (window.GA_REGISTRY && typeof window.GA_REGISTRY.registerModule === 'function') {
    window.GA_REGISTRY.registerModule('theme-nordic-agenda.js', 'v2.0', '北歐極簡焦點 × 8號行事曆 × 一屏全覽免捲動 × 全卡片進度底色');
  }

  const _prevSetSyncUI_nordic = setSyncUI;
  setSyncUI = function(state, text) {
    _prevSetSyncUI_nordic(state, text);
    const pill = document.getElementById('sync-status');
    if (pill) {
      pill.classList.toggle('is-synced', state === 'ok');
      pill.classList.toggle('is-err', state === 'err');
    }
  };

  const _prevRenderHeader_nordic = renderHeaderAndPortals;
  renderHeaderAndPortals = function() {
    _prevRenderHeader_nordic();
    enhanceNordicChrome();
  };

  const _prevSwitchTab_nordic = switchTab;
  switchTab = function(tab) {
    closeMobileSidebar();
    _prevSwitchTab_nordic(tab);
  };

  const _prevRenderView_nordic = renderCurrentView;
  renderCurrentView = function() {
    _prevRenderView_nordic();
    enhanceNordicChrome();
    enhanceNordicWarRoom();
  };

  window.addEventListener('resize', syncOneScreenLock);

  enhanceNordicChrome();
  enhanceNordicWarRoom();
})();
