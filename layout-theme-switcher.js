/**
 * ============================================================================
 * 學校總務行政助理 — 多元版面結構 × 視覺風格即時切換模組 (layout-theme-switcher.js)
 * 功能：
 * 1. 4 種一屏免捲動「戰情版面排列」即時切換：
 *    - three-col    ：三欄戰情標準（左預警採購｜中寬例行／時間軸｜右 Memo）
 *    - kanban-four  ：四欄並排看板（預警｜採購｜例行／時間軸｜Memo 四獨立全高欄）
 *    - focus-left   ：焦點左寬雙欄（左寬全高例行／時間軸｜右上 Memo＋右下預警採購）
 *    - top-priority ：上下分層指揮（上寬例行＋Memo｜下雙欄預警＋採購並陳）
 * 2. 6 種截然不同「視覺風格與配色主題」即時切換（保留全工作卡片背景進度條）：
 *    - nordic   ：01 北歐極簡（冰霧灰白 ＋ 峽灣深藍）
 *    - washi    ：02 日系無印（和紙暖白 ＋ 藍染靛藍 ＋ 明體標題）
 *    - swiss    ：03 瑞士網格（純白直角銳利線框 ＋ 墨黑 ＋ 訊號朱紅）
 *    - sage     ：05 森系護眼（鼠尾草霧綠 ＋ 深松綠 ＋ 柔和圓角）
 *    - obsidian ：07 深炭暖金（夜間護眼深炭灰 ＋ 暖琥珀金 ＋ 高對比柔白）
 *    - civic    ：09 政務高對比（純白高對比 ＋ 深海藍 ＋ 放大字級）
 * 3. 自動記憶於 localStorage，免重整即時套用，100% 相容既有功能與實證驗證
 * ============================================================================
 */

(function initLayoutThemeSwitcher() {
  const PREF_KEY = 'ga_nordic_layout_theme_v1';

  const LAYOUTS = [
    { id: 'three-col',    name: '三欄戰情標準', desc: '左預警採購・中例行・右交辦' },
    { id: 'kanban-four',  name: '四欄並排看板', desc: '四大模組各自獨立全高直欄' },
    { id: 'focus-left',   name: '焦點左寬雙欄', desc: '左全高大區辦正事・右分層' },
    { id: 'top-priority', name: '上下分層指揮', desc: '上例行交辦・下預警採購並排' }
  ];

  const THEMES = [
    { id: 'nordic',   name: '01 北歐極簡',   desc: '冰霧灰白・峽灣深藍', colors: ['#F6F8FA', '#1E3A5F', '#059669'] },
    { id: 'washi',    name: '02 日系無印',   desc: '和紙暖白・明體標題', colors: ['#FAF7F2', '#2B4C7E', '#C2593F'] },
    { id: 'swiss',    name: '03 瑞士網格',   desc: '純白直角・墨黑朱紅', colors: ['#FFFFFF', '#111111', '#D92B2B'] },
    { id: 'sage',     name: '05 森系護眼',   desc: '鼠尾草綠・低眩柔和', colors: ['#F1F5F0', '#2D5A43', '#C88228'] },
    { id: 'obsidian', name: '07 深炭暖金',   desc: '夜間護眼・炭灰琥珀', colors: ['#14161A', '#E5A93C', '#34D399'] },
    { id: 'civic',    name: '09 政務高對比', desc: '大字清晰・深海政藍', colors: ['#EEF2F6', '#0F4C81', '#B91C1C'] }
  ];

  let cfg = { layout: 'three-col', theme: 'nordic' };
  try {
    const saved = JSON.parse(localStorage.getItem(PREF_KEY));
    if (saved && typeof saved === 'object') {
      if (LAYOUTS.some(l => l.id === saved.layout)) cfg.layout = saved.layout;
      if (THEMES.some(t => t.id === saved.theme)) cfg.theme = saved.theme;
    }
  } catch {}

  function saveCfg() {
    try { localStorage.setItem(PREF_KEY, JSON.stringify(cfg)); } catch {}
  }

  // 載入日系無印明體（Noto Serif TC）以供 washi 主題呈現道地紙感字型
  if (!document.getElementById('switcher-serif-font')) {
    const lnk = document.createElement('link');
    lnk.id = 'switcher-serif-font';
    lnk.rel = 'stylesheet';
    lnk.href = 'https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@600;700&display=swap';
    document.head.appendChild(lnk);
  }

  // --------------------------------------------------------------------------
  // 1. 注入 4 種版面排列 ＋ 6 種視覺風格 ＋ 切換彈窗樣式
  // --------------------------------------------------------------------------
  const st = document.createElement('style');
  st.id = 'layout-theme-switcher-style';
  st.textContent = `
    /* ==================== 切換器按鈕與浮動選擇面板 ==================== */
    #btn-layout-switcher.is-open {
      background: var(--primary-soft) !important;
      color: var(--primary) !important;
      border-color: var(--primary) !important;
    }

    #nordic-style-popover {
      position: fixed;
      top: 52px;
      right: 18px;
      width: min(440px, calc(100vw - 24px));
      background: #FFFFFF !important;
      color: #0F172A;
      border: 1px solid #CBD5E1;
      border-radius: 14px;
      box-shadow: 0 20px 50px rgba(15, 23, 42, 0.22), 0 4px 14px rgba(15, 23, 42, 0.08);
      padding: 14px 16px;
      z-index: 9999 !important;
      display: none;
    }
    #nordic-style-popover.open { display: block !important; opacity: 1 !important; }

    .lsp-hd {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 10px;
      margin-bottom: 11px;
      border-bottom: 1px solid #E5E9F0;
    }
    .lsp-hd strong { font-size: 14px; font-weight: 800; }
    .lsp-sec-title {
      font-size: 12px;
      font-weight: 700;
      color: #64748B;
      letter-spacing: 0.4px;
      margin-bottom: 7px;
    }
    .lsp-grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 7px;
      margin-bottom: 13px;
    }
    .lsp-opt {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 8px 9px !important;
      min-height: 50px !important;
      border-radius: 9px !important;
      border: 1.5px solid #E5E9F0 !important;
      background: #F8FAFC !important;
      color: #0F172A !important;
      text-align: left;
      justify-content: flex-start !important;
      cursor: pointer;
      transition: all 0.14s ease;
    }
    .lsp-opt:hover {
      border-color: #94A3B8 !important;
      background: #FFFFFF !important;
    }
    .lsp-opt.active {
      border-color: var(--primary) !important;
      background: var(--primary-soft) !important;
      box-shadow: 0 0 0 2px rgba(30, 58, 95, 0.12);
    }
    .lsp-opt-title { font-size: 12.5px; font-weight: 700; line-height: 1.25; }
    .lsp-opt-desc { font-size: 12px; color: #64748B; margin-top: 2px; line-height: 1.2; }

    /* 版面微型示意圖 */
    .lsp-wire {
      width: 34px;
      height: 26px;
      border-radius: 4px;
      border: 1px solid #CBD5E1;
      background: #FFFFFF;
      padding: 2px;
      display: grid;
      gap: 2px;
      flex-shrink: 0;
    }
    .lsp-wire i { display: block; background: #CBD5E1; border-radius: 1.5px; }
    .lsp-opt.active .lsp-wire { border-color: var(--primary); }
    .lsp-opt.active .lsp-wire i { background: var(--primary); opacity: 0.72; }
    .lsp-wire.w-three { grid-template-columns: 1fr 1.5fr 1fr; }
    .lsp-wire.w-kanban { grid-template-columns: repeat(4, 1fr); }
    .lsp-wire.w-focus { grid-template-columns: 1.5fr 1fr; grid-template-rows: 1fr 1fr; }
    .lsp-wire.w-focus i:first-child { grid-row: 1 / 3; }
    .lsp-wire.w-top { grid-template-columns: 1.4fr 1fr; grid-template-rows: 1.3fr 0.8fr; }
    .lsp-wire.w-top i:nth-child(3) { grid-column: 1 / -1; }

    /* 配色三圓點 */
    .lsp-dots { display: flex; flex-direction: column; gap: 2px; flex-shrink: 0; }
    .lsp-dots span {
      width: 14px; height: 7px; border-radius: 3px;
      border: 1px solid rgba(15, 23, 42, 0.18); display: block;
    }

    .lsp-ft {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 9px;
      border-top: 1px solid #E5E9F0;
      font-size: 12px;
      color: #64748B;
    }

    /* ==================== 4 種戰情版面結構（桌機 >= 1024px，全維持一屏免捲動） ==================== */
    @media (min-width: 1024px) {
      /* 1. 四欄並排看板（display: contents 釋放左欄兩面板為獨立全高欄） */
      body[data-nordic-layout="kanban-four"].nordic-one-screen .dash-grid,
      body[data-nordic-layout="kanban-four"].nordic-one-screen.dash-lock .dash-grid {
        grid-template-columns: minmax(195px, 0.95fr) minmax(195px, 0.95fr) minmax(280px, 1.42fr) minmax(205px, 0.95fr) !important;
        gap: 10px !important;
      }
      body[data-nordic-layout="kanban-four"].nordic-one-screen .dash-grid > div:first-child {
        display: contents !important;
      }
      body[data-nordic-layout="kanban-four"].nordic-one-screen .dash-grid > div:first-child > .panel {
        height: 100% !important;
        min-height: 0 !important;
        display: flex !important;
        flex-direction: column !important;
        margin-bottom: 0 !important;
      }

      /* 2. 焦點左寬雙欄（左全高例行／時間軸 ＋ 右上 Memo ＋ 右下預警/採購並排） */
      body[data-nordic-layout="focus-left"].nordic-one-screen .dash-grid,
      body[data-nordic-layout="focus-left"].nordic-one-screen.dash-lock .dash-grid {
        grid-template-columns: minmax(420px, 1.5fr) minmax(340px, 1.15fr) !important;
        grid-template-rows: minmax(0, 1.05fr) minmax(0, 0.95fr) !important;
        gap: 12px !important;
      }
      body[data-nordic-layout="focus-left"].nordic-one-screen .dash-grid > .panel:nth-child(2) {
        grid-column: 1 / 2 !important;
        grid-row: 1 / 3 !important;
      }
      body[data-nordic-layout="focus-left"].nordic-one-screen .dash-grid > .panel:last-child {
        grid-column: 2 / 3 !important;
        grid-row: 1 / 2 !important;
      }
      body[data-nordic-layout="focus-left"].nordic-one-screen .dash-grid > div:first-child {
        grid-column: 2 / 3 !important;
        grid-row: 2 / 3 !important;
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 10px !important;
        height: 100% !important;
        min-height: 0 !important;
      }
      body[data-nordic-layout="focus-left"].nordic-one-screen .dash-grid > div:first-child > .panel {
        height: 100% !important;
        min-height: 0 !important;
      }

      /* 3. 上下分層指揮台（上排例行＋Memo，下排預警＋採購橫向並陳） */
      body[data-nordic-layout="top-priority"].nordic-one-screen .dash-grid,
      body[data-nordic-layout="top-priority"].nordic-one-screen.dash-lock .dash-grid {
        grid-template-columns: minmax(0, 1.55fr) minmax(290px, 1fr) !important;
        grid-template-rows: minmax(0, 1.32fr) minmax(0, 0.68fr) !important;
        gap: 12px !important;
      }
      body[data-nordic-layout="top-priority"].nordic-one-screen .dash-grid > .panel:nth-child(2) {
        grid-column: 1 / 2 !important;
        grid-row: 1 / 2 !important;
      }
      body[data-nordic-layout="top-priority"].nordic-one-screen .dash-grid > .panel:last-child {
        grid-column: 2 / 3 !important;
        grid-row: 1 / 2 !important;
      }
      body[data-nordic-layout="top-priority"].nordic-one-screen .dash-grid > div:first-child {
        grid-column: 1 / -1 !important;
        grid-row: 2 / 3 !important;
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 12px !important;
        height: 100% !important;
        min-height: 0 !important;
      }
      body[data-nordic-layout="top-priority"].nordic-one-screen .dash-grid > div:first-child > .panel {
        height: 100% !important;
        min-height: 0 !important;
      }
    }

    /* ==================== 6 種視覺風格主題覆寫 ==================== */

    /* --- 02 日系無印手札 (washi) --- */
    body[data-nordic-theme="washi"] {
      --bg: #FAF7F2;
      --surface: #FFFEFB;
      --surface-alt: #F5F1E8;
      --border: #E5DFD3;
      --text: #25221E;
      --muted: #756E64;
      --primary: #2B4C7E;
      --primary-hover: #1E385E;
      --primary-soft: #EEF3F9;
      --cal-sand: #F3EDE1;
      --cal-sand-border: #DFD5C3;
      --radius: 6px;
    }
    body[data-nordic-theme="washi"] #nordic-sidebar,
    body[data-nordic-theme="washi"] #nordic-main-col .topbar,
    body[data-nordic-theme="washi"] .panel,
    body[data-nordic-theme="washi"] .kpi-card,
    body[data-nordic-theme="washi"] .ops-mini-card,
    body[data-nordic-theme="washi"] .card-prog-bg {
      background: #FFFEFB !important;
      border-color: #E5DFD3 !important;
    }
    body[data-nordic-theme="washi"] .nt-greet-title,
    body[data-nordic-theme="washi"] .panel-hd h3,
    body[data-nordic-theme="washi"] .ns-school-name {
      font-family: "Noto Serif TC", "Songti TC", "PMingLiU", Georgia, serif !important;
      letter-spacing: 0.4px;
    }

    /* --- 03 瑞士國際網格 (swiss) --- */
    body[data-nordic-theme="swiss"] {
      --bg: #FFFFFF;
      --surface: #FFFFFF;
      --surface-alt: #F5F5F5;
      --border: #111111;
      --text: #111111;
      --muted: #555555;
      --primary: #111111;
      --primary-hover: #D92B2B;
      --primary-soft: #F3F3F3;
      --red: #D92B2B;
      --cal-sand: #F5F5F5;
      --cal-sand-border: #111111;
      --radius: 0px;
      --shadow: none;
    }
    body[data-nordic-theme="swiss"] .panel,
    body[data-nordic-theme="swiss"] .kpi-card,
    body[data-nordic-theme="swiss"] .ops-mini-card,
    body[data-nordic-theme="swiss"] .card-prog-bg,
    body[data-nordic-theme="swiss"] button,
    body[data-nordic-theme="swiss"] .nav-tab,
    body[data-nordic-theme="swiss"] #nordic-side-calendar,
    body[data-nordic-theme="swiss"] .nordic-seg,
    body[data-nordic-theme="swiss"] .nordic-seg button,
    body[data-nordic-theme="swiss"] .tag {
      border-radius: 0px !important;
      box-shadow: none !important;
    }
    body[data-nordic-theme="swiss"] .panel,
    body[data-nordic-theme="swiss"] #nordic-sidebar,
    body[data-nordic-theme="swiss"] #nordic-main-col .topbar {
      border-color: #111111 !important;
    }
    body[data-nordic-theme="swiss"] .ns-logo {
      background: #D92B2B !important;
      border-radius: 0px !important;
    }
    body[data-nordic-theme="swiss"] #nordic-sidebar .nav-tab.active {
      background: #111111 !important;
      color: #FFFFFF !important;
    }
    body[data-nordic-theme="swiss"] #nordic-sidebar .nav-tab.active .tab-cnt-badge {
      background: #D92B2B !important;
      color: #FFFFFF !important;
    }

    /* --- 05 森系植感護眼 (sage) --- */
    body[data-nordic-theme="sage"] {
      --bg: #F1F5F0;
      --surface: #FCFDFB;
      --surface-alt: #F4F8F3;
      --border: #D9E5D8;
      --text: #1E3228;
      --muted: #587063;
      --primary: #2D5A43;
      --primary-hover: #204231;
      --primary-soft: #E4EEE3;
      --amber: #C88228;
      --red: #B84A39;
      --green: #2D5A43;
      --cal-sand: #EBF2EA;
      --cal-sand-border: #D2E1D0;
      --radius: 15px;
    }
    body[data-nordic-theme="sage"] .panel,
    body[data-nordic-theme="sage"] .kpi-card,
    body[data-nordic-theme="sage"] .ops-mini-card,
    body[data-nordic-theme="sage"] .card-prog-bg {
      background: #FCFDFB !important;
      border-color: #D9E5D8 !important;
      border-radius: 14px !important;
    }
    body[data-nordic-theme="sage"] #nordic-sidebar,
    body[data-nordic-theme="sage"] #nordic-main-col .topbar {
      background: #FCFDFB !important;
      border-color: #D9E5D8 !important;
    }

    /* --- 07 深炭暖金夜間 (obsidian) --- */
    body[data-nordic-theme="obsidian"] {
      --bg: #14161A;
      --surface: #1C1F26;
      --surface-alt: #232731;
      --border: #2C313E;
      --text: #F3F4F6;
      --muted: #9CA3AF;
      --primary: #E5A93C;
      --primary-hover: #D49729;
      --primary-soft: rgba(229, 169, 60, 0.16);
      --red: #F87171;
      --amber: #E5A93C;
      --green: #34D399;
      --cal-sand: #20242D;
      --cal-sand-border: #323846;
      --shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
    }
    body[data-nordic-theme="obsidian"],
    body[data-nordic-theme="obsidian"] #app-shell {
      background: #14161A !important;
      color: #F3F4F6 !important;
    }
    body[data-nordic-theme="obsidian"] #nordic-sidebar,
    body[data-nordic-theme="obsidian"] #nordic-main-col .topbar,
    body[data-nordic-theme="obsidian"] .panel,
    body[data-nordic-theme="obsidian"] .panel-hd,
    body[data-nordic-theme="obsidian"] .kpi-card,
    body[data-nordic-theme="obsidian"] .ops-mini-card,
    body[data-nordic-theme="obsidian"] .modal,
    body[data-nordic-theme="obsidian"] .modal-hd,
    body[data-nordic-theme="obsidian"] .modal-ft,
    body[data-nordic-theme="obsidian"] #nordic-style-popover {
      background: #1C1F26 !important;
      border-color: #2C313E !important;
      color: #F3F4F6 !important;
    }
    body[data-nordic-theme="obsidian"] .card-prog-bg {
      background: #21252F !important;
      border-color: #303645 !important;
      color: #F3F4F6 !important;
    }
    body[data-nordic-theme="obsidian"] .tone-red {
      --prog-bg-start: rgba(248, 113, 113, 0.08);
      --prog-bg-end: rgba(248, 113, 113, 0.22);
      --prog-bar: #F87171;
      --prog-edge: 1px solid rgba(248, 113, 113, 0.34);
    }
    body[data-nordic-theme="obsidian"] .tone-amber {
      --prog-bg-start: rgba(229, 169, 60, 0.08);
      --prog-bg-end: rgba(229, 169, 60, 0.22);
      --prog-bar: #E5A93C;
      --prog-edge: 1px solid rgba(229, 169, 60, 0.34);
    }
    body[data-nordic-theme="obsidian"] .tone-blue {
      --prog-bg-start: rgba(96, 165, 250, 0.08);
      --prog-bg-end: rgba(96, 165, 250, 0.20);
      --prog-bar: #60A5FA;
      --prog-edge: 1px solid rgba(96, 165, 250, 0.32);
    }
    body[data-nordic-theme="obsidian"] .tone-green {
      --prog-bg-start: rgba(52, 211, 153, 0.08);
      --prog-bg-end: rgba(52, 211, 153, 0.20);
      --prog-bar: #34D399;
      --prog-edge: 1px solid rgba(52, 211, 153, 0.32);
    }
    body[data-nordic-theme="obsidian"] .ns-logo,
    body[data-nordic-theme="obsidian"] .btn-primary,
    body[data-nordic-theme="obsidian"] .topbar button.btn-primary {
      background: #E5A93C !important;
      color: #14161A !important;
      border-color: #E5A93C !important;
    }
    body[data-nordic-theme="obsidian"] #nordic-sidebar .nav-tab { color: #CBD5E1 !important; }
    body[data-nordic-theme="obsidian"] #nordic-sidebar .nav-tab:hover { background: #262B36 !important; color: #FFFFFF !important; }
    body[data-nordic-theme="obsidian"] #nordic-sidebar .nav-tab.active { background: rgba(229, 169, 60, 0.16) !important; color: #E5A93C !important; }
    body[data-nordic-theme="obsidian"] .topbar button:not(.btn-primary),
    body[data-nordic-theme="obsidian"] .card-prog-bg button:not(.btn-primary):not(.btn-success):not(.btn-danger),
    body[data-nordic-theme="obsidian"] .card-prog-bg a.btn-xs,
    body[data-nordic-theme="obsidian"] .rtn-step-chip,
    body[data-nordic-theme="obsidian"] .prog-pill,
    body[data-nordic-theme="obsidian"] .lsp-opt,
    body[data-nordic-theme="obsidian"] #nordic-sidebar .portal-chip,
    body[data-nordic-theme="obsidian"] .ncal-nav button,
    body[data-nordic-theme="obsidian"] .memo-date-chip {
      background: #262B36 !important;
      border-color: #373E4E !important;
      color: #E5E7EB !important;
    }
    body[data-nordic-theme="obsidian"] .lsp-opt.active {
      background: rgba(229, 169, 60, 0.16) !important;
      border-color: #E5A93C !important;
    }
    body[data-nordic-theme="obsidian"] .nordic-seg,
    body[data-nordic-theme="obsidian"] .memo-quick,
    body[data-nordic-theme="obsidian"] .memo-quick input[type="text"],
    body[data-nordic-theme="obsidian"] #global-search,
    body[data-nordic-theme="obsidian"] input,
    body[data-nordic-theme="obsidian"] select,
    body[data-nordic-theme="obsidian"] textarea {
      background: #14161A !important;
      border-color: #323846 !important;
      color: #F3F4F6 !important;
    }
    body[data-nordic-theme="obsidian"] .nordic-seg button.active {
      background: #2A303E !important;
      color: #E5A93C !important;
    }
    body[data-nordic-theme="obsidian"] .ncal-title,
    body[data-nordic-theme="obsidian"] .ncal-day,
    body[data-nordic-theme="obsidian"] .kpi-label,
    body[data-nordic-theme="obsidian"] .tl-title,
    body[data-nordic-theme="obsidian"] .tl-date-md,
    body[data-nordic-theme="obsidian"] .ns-school-name,
    body[data-nordic-theme="obsidian"] .nt-greet-title,
    body[data-nordic-theme="obsidian"] strong {
      color: #F3F4F6 !important;
    }
    body[data-nordic-theme="obsidian"] .ncal-day.is-today {
      background: rgba(229, 169, 60, 0.22) !important;
      color: #E5A93C !important;
      border-color: #E5A93C !important;
    }
    body[data-nordic-theme="obsidian"] .ncal-day.is-selected {
      background: #E5A93C !important;
      color: #14161A !important;
    }
    body[data-nordic-theme="obsidian"] .ns-footer .sync-pill {
      background: #232731 !important;
      color: #D1D5DB !important;
      border-color: #323846 !important;
    }
    body[data-nordic-theme="obsidian"] .tag-gray { background: #2D3342 !important; color: #CBD5E1 !important; }
    body[data-nordic-theme="obsidian"] .tag-blue { background: rgba(96,165,250,0.18) !important; color: #93C5FD !important; }
    body[data-nordic-theme="obsidian"] .tag-amber { background: rgba(229,169,60,0.20) !important; color: #FCD34D !important; }
    body[data-nordic-theme="obsidian"] .tag-red { background: rgba(248,113,113,0.20) !important; color: #FCA5A5 !important; }
    body[data-nordic-theme="obsidian"] .tag-green { background: rgba(52,211,153,0.20) !important; color: #6EE7B7 !important; }
    body[data-nordic-theme="obsidian"] th { background: #232731 !important; color: #CBD5E1 !important; border-color: #323846 !important; }
    body[data-nordic-theme="obsidian"] td { border-color: #2A2F3A !important; }
    body[data-nordic-theme="obsidian"] tr:hover td { background: #232731 !important; }
    body[data-nordic-theme="obsidian"] .btn-danger { background: rgba(248,113,113,0.14) !important; color: #FCA5A5 !important; border-color: rgba(248,113,113,0.4) !important; }

    /* --- 09 數位政務高對比 (civic) --- */
    body[data-nordic-theme="civic"] {
      --bg: #EEF2F6;
      --surface: #FFFFFF;
      --surface-alt: #F8FAFC;
      --border: #94A3B8;
      --text: #0B1320;
      --muted: #334155;
      --primary: #0F4C81;
      --primary-hover: #0A375E;
      --primary-soft: #E0EEFA;
      --red: #B91C1C;
      --amber: #92400E;
      --green: #065F46;
      --radius: 8px;
      font-size: 14.5px !important;
    }
    body[data-nordic-theme="civic"] .panel,
    body[data-nordic-theme="civic"] .kpi-card,
    body[data-nordic-theme="civic"] .ops-mini-card,
    body[data-nordic-theme="civic"] .card-prog-bg {
      border-width: 1.5px !important;
      border-color: #94A3B8 !important;
    }
    body[data-nordic-theme="civic"] .alert-item,
    body[data-nordic-theme="civic"] .routine-item,
    body[data-nordic-theme="civic"] .memo-item,
    body[data-nordic-theme="civic"] .tl-title {
      font-size: 13.5px !important;
    }
    body[data-nordic-theme="civic"] #nordic-main-col .topbar {
      background: #0F4C81 !important;
      color: #FFFFFF !important;
      border-bottom-color: #0A375E !important;
    }
    body[data-nordic-theme="civic"] .nt-greet-title { color: #FFFFFF !important; }
    body[data-nordic-theme="civic"] .nt-greet-sub { color: #DCE8F5 !important; }
    body[data-nordic-theme="civic"] .topbar button.btn-primary {
      background: #FFFFFF !important;
      color: #0F4C81 !important;
      border-color: #FFFFFF !important;
      font-weight: 800 !important;
    }
  `;
  document.head.appendChild(st);

  // --------------------------------------------------------------------------
  // 2. 狀態套用與浮動切換面板
  // --------------------------------------------------------------------------
  function applyLayoutAndTheme() {
    document.body.dataset.nordicLayout = cfg.layout;
    document.body.dataset.nordicTheme = cfg.theme;
    const pop = document.getElementById('nordic-style-popover');
    if (pop && pop.classList.contains('open')) renderPopoverContent();
  }

  window.setNordicLayout = function(layoutId) {
    if (!LAYOUTS.some(l => l.id === layoutId)) return;
    cfg.layout = layoutId;
    saveCfg();
    applyLayoutAndTheme();
    const hit = LAYOUTS.find(l => l.id === layoutId);
    if (typeof toast === 'function') toast(`📐 已切換版面：${hit.name}`);
  };

  window.setNordicVisualTheme = function(themeId) {
    if (!THEMES.some(t => t.id === themeId)) return;
    cfg.theme = themeId;
    saveCfg();
    applyLayoutAndTheme();
    const hit = THEMES.find(t => t.id === themeId);
    if (typeof toast === 'function') toast(`🎨 已切換風格：${hit.name}`);
  };

  window.resetNordicLayoutTheme = function() {
    cfg = { layout: 'three-col', theme: 'nordic' };
    saveCfg();
    applyLayoutAndTheme();
    if (typeof toast === 'function') toast('↺ 已還原預設版面與北歐極簡風格');
  };

  window.toggleLayoutSwitcherPopover = function(ev) {
    if (ev) ev.stopPropagation();
    ensurePopover();
    const pop = document.getElementById('nordic-style-popover');
    const btn = document.getElementById('btn-layout-switcher');
    if (!pop) return;
    const opening = !pop.classList.contains('open');
    if (opening) renderPopoverContent();
    pop.classList.toggle('open', opening);
    if (btn) btn.classList.toggle('is-open', opening);
  };

  function closePopover() {
    document.getElementById('nordic-style-popover')?.classList.remove('open');
    document.getElementById('btn-layout-switcher')?.classList.remove('is-open');
  }

  function wireHtml(id) {
    if (id === 'three-col') return `<span class="lsp-wire w-three"><i></i><i></i><i></i></span>`;
    if (id === 'kanban-four') return `<span class="lsp-wire w-kanban"><i></i><i></i><i></i><i></i></span>`;
    if (id === 'focus-left') return `<span class="lsp-wire w-focus"><i></i><i></i><i></i></span>`;
    return `<span class="lsp-wire w-top"><i></i><i></i><i></i></span>`;
  }

  function renderPopoverContent() {
    const pop = document.getElementById('nordic-style-popover');
    if (!pop) return;
    pop.innerHTML = `
      <div class="lsp-hd">
        <strong>🎨 版面與風格切換</strong>
        <button type="button" class="btn-xs" style="min-height:26px!important;padding:2px 8px" onclick="document.getElementById('nordic-style-popover').classList.remove('open');document.getElementById('btn-layout-switcher')?.classList.remove('is-open')">✕ 關閉</button>
      </div>

      <div class="lsp-sec-title">📐 戰情版面排列（4 款皆維持一屏免捲動）</div>
      <div class="lsp-grid-2">
        ${LAYOUTS.map(l => `
          <button type="button" class="lsp-opt ${cfg.layout === l.id ? 'active' : ''}" onclick="setNordicLayout('${l.id}')">
            ${wireHtml(l.id)}
            <div>
              <div class="lsp-opt-title">${l.name}</div>
              <div class="lsp-opt-desc">${l.desc}</div>
            </div>
          </button>
        `).join('')}
      </div>

      <div class="lsp-sec-title">🎨 視覺風格與配色（6 款皆保留卡片進度條底色）</div>
      <div class="lsp-grid-2">
        ${THEMES.map(t => `
          <button type="button" class="lsp-opt ${cfg.theme === t.id ? 'active' : ''}" onclick="setNordicVisualTheme('${t.id}')">
            <span class="lsp-dots">${t.colors.map(c => `<span style="background:${c}"></span>`).join('')}</span>
            <div>
              <div class="lsp-opt-title">${t.name}</div>
              <div class="lsp-opt-desc">${t.desc}</div>
            </div>
          </button>
        `).join('')}
      </div>

      <div class="lsp-ft">
        <span>設定自動記憶於瀏覽器</span>
        <button type="button" class="btn-xs" style="min-height:26px!important;padding:2px 9px" onclick="resetNordicLayoutTheme()">↺ 還原預設</button>
      </div>
    `;
  }

  function ensurePopover() {
    if (document.getElementById('nordic-style-popover')) return;
    const pop = document.createElement('div');
    pop.id = 'nordic-style-popover';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', '版面與風格切換選單');
    pop.onclick = e => e.stopPropagation();
    document.body.appendChild(pop);
  }

  function ensureSwitcherButton() {
    const actions = document.querySelector('.topbar .top-actions');
    if (!actions || document.getElementById('btn-layout-switcher')) return;
    const btn = document.createElement('button');
    btn.id = 'btn-layout-switcher';
    btn.type = 'button';
    btn.textContent = '🎨 版面風格';
    btn.title = '切換戰情版面排列與視覺配色主題';
    btn.onclick = window.toggleLayoutSwitcherPopover;

    const calBtn = document.getElementById('btn-toggle-calendar');
    if (calBtn) calBtn.insertAdjacentElement('afterend', btn);
    else actions.prepend(btn);
  }

  document.addEventListener('click', closePopover);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePopover(); });

  // --------------------------------------------------------------------------
  // 3. 掛載生命週期與模組健康登記
  // --------------------------------------------------------------------------
  if (window.GA_REGISTRY && typeof window.GA_REGISTRY.registerModule === 'function') {
    window.GA_REGISTRY.registerModule('layout-theme-switcher.js', 'v1.0', '4 種一屏版面結構 × 6 種視覺風格即時切換器');
  }

  const _prevRenderView_lsp = renderCurrentView;
  renderCurrentView = function() {
    _prevRenderView_lsp();
    ensureSwitcherButton();
    applyLayoutAndTheme();
  };

  ensureSwitcherButton();
  applyLayoutAndTheme();
})();
