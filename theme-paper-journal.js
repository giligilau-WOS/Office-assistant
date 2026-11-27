/**
 * ============================================================================
 * 學校總務行政助理 — 「文青公文手札紙質」主視覺主題模組 (theme-paper-journal.js)
 * 設計規格：
 * 1. 紙質手札基調：米白點陣紙背景 (#F9F8F4) ＋ 溫潤信紙卡片 (#FFFEFA) ＋ 實體紙張偏移陰影
 * 2. 專屬字體搭配：LXGW WenKai TC（文青楷書）＋ IBM Plex Mono（等寬公務數據與日期）
 * 3. 公文印章與裝飾：朱紅「總務」官印、四色斜角狀態印章 (.stamp)、檔案迴紋針 SVG
 * 4. 戰情室三欄比例 (4 : 5 : 3)：
 *    - 左欄 (4)：紅黃燈預警雷達（含雙格紅橘計數）＋ 進行中採購與標案
 *    - 中欄 (5)：近期固定例行業務（含全部/逾期/逼近/已辦篩選、螢光筆畫痕進度背景、卡片內前 3 步驟直接勾選）
 *    - 右欄 (3)：臨時交辦 Memo 牆（微傾黃色便利貼 .sticky-note ＋ IME 安全快填框）
 * 5. 全系統向下相容：100% 保留 GAS 同步、待同步佇列、復原刪除、一屏適配、PDF 列印與無障礙
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// 0. 動態載入 Google Fonts (LXGW WenKai TC + IBM Plex Mono) 與主題樣式
// ----------------------------------------------------------------------------
(function loadPaperJournalFontsAndStyles() {
  if (!document.getElementById('paper-journal-fonts')) {
    const link = document.createElement('link');
    link.id = 'paper-journal-fonts';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=LXGW+WenKai+TC:wght@400;700&display=swap';
    document.head.appendChild(link);
  }

  const st = document.createElement('style');
  st.id = 'theme-paper-journal-style';
  st.textContent = `
    :root {
      --bg: #F9F8F4;
      --surface: #FFFEFA;
      --surface-alt: #F4F1EA;
      --border: #DFDBD2;
      --line: #E7E4DC;
      --text: #1C1917;
      --muted: #57534E;
      --subtle: #78716C;
      --primary: #1D4ED8;
      --primary-soft: #DBEAFE;
      --red: #B91C1C;
      --red-soft: #FEE2E2;
      --vermilion: #C84B31;
      --amber: #B45309;
      --amber-soft: #FEF3C7;
      --green: #15803D;
      --green-soft: #DCFCE7;
      --radius: 8px;
      --shadow: 2px 3px 0px rgba(28, 25, 23, 0.06);
    }

    /* 全域公文手札點陣紙質背景 */
    body {
      background-color: #F9F8F4 !important;
      background-image:
        radial-gradient(#E2DDD3 0.75px, transparent 0.75px),
        radial-gradient(#E2DDD3 0.75px, #F9F8F4 0.75px) !important;
      background-size: 30px 30px !important;
      background-position: 0 0, 15px 15px !important;
      color: #1C1917 !important;
      font-family: "LXGW WenKai TC", "Noto Serif TC", "Microsoft JhengHei", Georgia, serif !important;
    }
    ::selection { background: #FDE68A; color: #78350F; }

    /* 等寬公務數據字體 */
    .num-mono, code, .kpi-val, .eng-stat .val {
      font-family: "IBM Plex Mono", ui-monospace, SFMono-Regular, monospace !important;
      font-feature-settings: "tnum";
    }

    /* 頂部溫潤紙質手札導覽列（取代深藍黑條） */
    .topbar {
      background: rgba(249, 248, 244, 0.96) !important;
      backdrop-filter: blur(8px);
      color: #1C1917 !important;
      border-bottom: 1px solid #DFDBD2 !important;
      padding: 9px 18px;
    }
    .brand {
      color: #1C1917 !important;
      gap: 10px;
      align-items: center;
    }
    .brand-title-wrap {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }
    .brand-title-row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: 0.5px;
      line-height: 1.25;
    }
    .brand-sub-row {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: #57534E;
    }
    .brand small#today-roc {
      color: #57534E !important;
      font-family: "IBM Plex Mono", monospace;
      font-weight: 600;
    }

    /* 頂部操作列與搜尋框 */
    .sync-pill {
      background: #FEF3C7 !important;
      color: #92400E !important;
      border: 1px solid #FCD34D !important;
      font-family: "IBM Plex Mono", monospace;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 5px !important;
    }
    .sync-pill.is-synced {
      background: #DCFCE7 !important;
      color: #166534 !important;
      border-color: #86EFAC !important;
    }
    .sync-pill.is-err {
      background: #FEE2E2 !important;
      color: #991B1B !important;
      border-color: #FCA5A5 !important;
    }
    #global-search {
      background: #FFFEFA !important;
      color: #1C1917 !important;
      border: 1px solid #DFDBD2 !important;
      box-shadow: inset 1px 1px 2px rgba(28, 25, 23, 0.04);
      padding: 6px 11px !important;
    }
    #global-search::placeholder { color: #78716C; }
    #global-search:focus {
      outline: none;
      border-color: #1D4ED8 !important;
      box-shadow: 0 0 0 2px rgba(29, 78, 216, 0.14);
    }
    .topbar button {
      background: #FFFEFA !important;
      color: #1C1917 !important;
      border: 1px solid #DFDBD2 !important;
      box-shadow: 1px 2px 0px rgba(28, 25, 23, 0.06);
    }
    .topbar button:hover {
      background: #F4F1EA !important;
      border-color: #C7C2B6 !important;
    }
    .topbar button.btn-primary {
      background: #FFFEFA !important;
      color: #1C1917 !important;
      border: 1.5px solid #C84B31 !important;
    }
    .topbar button.btn-primary:hover {
      background: #FEF2F2 !important;
      color: #991B1B !important;
    }
    .topbar button.queue-badge {
      background: #B91C1C !important;
      color: #FFFFFF !important;
      border-color: #991B1B !important;
    }

    /* 常用公務傳送門：溫潤羊皮紙橫條 */
    .portal-bar {
      background: #F3F0E8 !important;
      border-bottom: 1px solid #DFDBD2 !important;
      color: #57534E;
      padding: 5px 18px !important;
    }
    .portal-bar > span { color: #57534E !important; font-weight: 700; }
    .portal-chip {
      background: #FFFEFA !important;
      color: #1C1917 !important;
      border: 1px solid #DFDBD2 !important;
      box-shadow: 1px 1px 0px rgba(28, 25, 23, 0.05);
      border-radius: 5px !important;
      padding: 3px 9px !important;
      transition: .15s;
    }
    .portal-chip:hover {
      background: #FEF3C7 !important;
      border-color: #D97706 !important;
      color: #78350F !important;
    }
    .portal-bar button {
      background: #FFFEFA !important;
      color: #57534E !important;
      border: 1px solid #DFDBD2 !important;
    }

    /* 資料夾風格分頁頁籤 (Folder Tabs) */
    .nav-tabs-wrap {
      background: rgba(249, 248, 244, 0.96) !important;
      border-bottom: 1px solid #DFDBD2 !important;
    }
    .nav-tabs-wrap::after {
      background: linear-gradient(to right, rgba(249,248,244,0), rgba(249,248,244,0.96)) !important;
    }
    .nav-tabs {
      background: transparent !important;
      gap: 4px;
      padding-top: 4px !important;
    }
    .nav-tab {
      font-family: "LXGW WenKai TC", serif !important;
      color: #57534E !important;
      border-radius: 6px 6px 0 0 !important;
      border-bottom: 3px solid transparent !important;
      background: transparent !important;
      padding: 8px 14px !important;
    }
    .nav-tab:hover {
      color: #1C1917 !important;
      background: rgba(255, 254, 250, 0.7) !important;
    }
    .nav-tab.active {
      background: #FFFEFA !important;
      color: #B91C1C !important;
      border-bottom-color: #B91C1C !important;
      border-top: 1px solid #DFDBD2;
      border-left: 1px solid #DFDBD2;
      border-right: 1px solid #DFDBD2;
      font-weight: 700 !important;
    }
    .tab-cnt-badge {
      display: inline-flex; align-items: center; justify-content: center;
      padding: 0 6px; min-width: 20px; height: 18px; border-radius: 999px;
      font-family: "IBM Plex Mono", monospace; font-size: 12px !important; font-weight: 700;
      background: #E7E4DC; color: #44403C; margin-left: 4px;
    }
    .tab-cnt-badge.red { background: #FEE2E2; color: #B91C1C; }

    /* 紙張卡片與實體偏移陰影 */
    .panel, .kpi-card, .ops-mini-card, .site-card, .meter-card, .eng-stat, .stage-card {
      background: #FFFEFA !important;
      border: 1px solid #DFDBD2 !important;
      box-shadow: 2px 3px 0px rgba(28, 25, 23, 0.06) !important;
      border-radius: 8px !important;
    }
    .kpi-card:hover, .ops-mini-card:hover, .site-card:hover {
      box-shadow: 3px 5px 0px rgba(28, 25, 23, 0.10) !important;
    }
    .panel-hd, .stage-hd, .modal-hd, .modal-ft, th {
      background: #F4F1EA !important;
      border-color: #E7E4DC !important;
      color: #1C1917 !important;
    }
    .panel-hd h3 {
      font-size: 15px;
      letter-spacing: 0.4px;
      color: #1C1917;
    }
    .kpi-card.kpi-red { border-left: 4px solid #C84B31 !important; }
    .kpi-card.kpi-amber { border-left: 4px solid #D97706 !important; }
    .kpi-card.kpi-blue { border-left: 4px solid #1D4ED8 !important; }
    .kpi-card.kpi-green { border-left: 4px solid #15803D !important; }
    .ops-mini-card.warn-red { border-left: 4px solid #B91C1C !important; background: #FFFDFB !important; }
    .ops-mini-card.warn-amber { border-left: 4px solid #D97706 !important; background: #FFFDF7 !important; }
    .ops-mini-card.warn-ok { border-left: 4px solid #15803D !important; }

    /* 表格與輸入欄位紙質化 */
    th, td { border-bottom-color: #E7E4DC !important; }
    tr:hover td { background: #F9F7F1 !important; }
    input, select, textarea {
      background: #FFFEFA;
      border-color: #DFDBD2;
      color: #1C1917;
    }
    .btn-primary {
      background: #1D4ED8 !important;
      border-color: #1E40AF !important;
      color: #FFFFFF !important;
    }
    .btn-primary:hover { background: #1E40AF !important; }
    .btn-success {
      background: #15803D !important;
      border-color: #166534 !important;
      color: #FFFFFF !important;
    }
    .btn-success:hover { background: #166534 !important; }

    /* 公文朱紅／四色斜角印章 (.stamp) */
    .stamp {
      font-family: "LXGW WenKai TC", serif !important;
      font-weight: 700;
      letter-spacing: 1px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 1px 6px;
      border-radius: 3px;
      font-size: 12px !important;
      line-height: 1.2;
      user-select: none;
      box-shadow: inset 0 0 0 1px currentColor;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .stamp-red { color: #B91C1C; border: 2px solid #B91C1C; transform: rotate(-4deg); background: rgba(254, 226, 226, 0.35); }
    .stamp-amber { color: #B45309; border: 2px solid #B45309; transform: rotate(-2.5deg); background: rgba(254, 243, 199, 0.45); }
    .stamp-blue { color: #1D4ED8; border: 2px solid #1D4ED8; transform: rotate(3deg); background: rgba(219, 234, 254, 0.35); }
    .stamp-green { color: #15803D; border: 2px solid #15803D; transform: rotate(-3deg); background: rgba(220, 252, 231, 0.4); }

    /* 戰情室三欄黃金比例 4 : 5 : 3（中欄例行業務為視覺焦點） */
    .dash-grid {
      grid-template-columns: 4fr 5fr 3fr !important;
      gap: 14px !important;
    }
    @media (max-width: 1120px) {
      .dash-grid { grid-template-columns: 1fr !important; }
    }
    @media (min-width: 960px) {
      body.dash-lock .dash-grid {
        grid-template-columns: 4fr 5fr 3fr !important;
      }
    }

    /* 紅黃燈預警雷達面板：朱紅左飾條 ＋ 內嵌紅橘統計盒 */
    .radar-panel-paper {
      border-left: 4px solid #C84B31 !important;
    }
    .radar-pulse-dot {
      width: 9px; height: 9px; border-radius: 50%; background: #DC2626;
      display: inline-block; animation: pulse 1.4s infinite;
    }
    .radar-mini-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px;
    }
    .radar-stat-box {
      border-radius: 6px; padding: 5px 8px; text-align: center; border: 1px solid;
    }
    .radar-stat-box.red { background: #FEF2F2; border-color: #FECACA; color: #B91C1C; }
    .radar-stat-box.amber { background: #FFFBEB; border-color: #FDE68A; color: #92400E; }
    .radar-stat-box .num { font-size: 18px; font-weight: 800; line-height: 1.15; }

    /* 四色螢光筆畫痕進度背景 (Highlighter Progress Wash) */
    .card-prog-bg {
      background: #FFFEFA !important;
      border: 1px solid #DFDBD2 !important;
      box-shadow: 2px 3px 0px rgba(28, 25, 23, 0.06) !important;
    }
    .tone-red {
      border-left: 4px solid #B91C1C !important;
      --prog-bg: rgba(252, 165, 165, 0.35);
      --prog-bar: #B91C1C;
    }
    .tone-amber {
      border-left: 4px solid #D97706 !important;
      --prog-bg: rgba(252, 211, 77, 0.38);
      --prog-bar: #D97706;
    }
    .tone-blue {
      border-left: 4px solid #1D4ED8 !important;
      --prog-bg: rgba(147, 197, 253, 0.35);
      --prog-bar: #1D4ED8;
    }
    .tone-green {
      border-left: 4px solid #15803D !important;
      --prog-bg: rgba(134, 239, 172, 0.35);
      --prog-bar: #15803D;
    }

    /* 迴紋針 SVG 裝飾與卡片內快速步驟 Checkbox */
    .paperclip-deco {
      position: absolute; top: -4px; right: 12px; width: 18px; height: 18px;
      color: #A8A29E; transform: rotate(14deg); pointer-events: none; z-index: 2;
    }
    .rtn-filter-pills {
      display: inline-flex; gap: 3px; background: #EBE7DE; padding: 3px;
      border-radius: 6px; border: 1px solid #DFDBD2;
    }
    .rtn-filter-pill {
      min-height: 28px !important; padding: 2px 8px !important; font-size: 12px !important;
      border: none !important; background: transparent !important; color: #57534E !important;
      border-radius: 4px !important; font-weight: 600;
    }
    .rtn-filter-pill.active {
      background: #FFFEFA !important; color: #1D4ED8 !important;
      box-shadow: 0 1px 2px rgba(0,0,0,.08) !important;
    }
    .rtn-inline-steps {
      display: flex; flex-wrap: wrap; gap: 5px; margin-top: 6px;
    }
    .rtn-step-chip {
      display: inline-flex; align-items: center; gap: 5px;
      background: rgba(255, 254, 250, 0.88); border: 1px solid #DFDBD2;
      border-radius: 5px; padding: 3px 8px; font-size: 12px; color: #1C1917;
      cursor: pointer; user-select: none; transition: .15s;
    }
    .rtn-step-chip:hover { background: #FFFFFF; border-color: #A8A29E; }
    .rtn-step-chip.done { color: #78716C; text-decoration: line-through; background: rgba(245, 245, 244, 0.8); }

    /* 右欄 Memo 牆：溫潤便箋背景 ＋ 微傾黃色便利貼 (.sticky-note) */
    .memo-wall-panel { background: #FFFDF7 !important; }
    .memo-quick {
      background: rgba(254, 243, 199, 0.55);
      border: 1px solid #FDE68A;
      border-radius: 7px;
      padding: 8px 9px !important;
      border-bottom: 1px solid #FDE68A !important;
    }
    .memo-item.sticky-note {
      background: #FEF9C3 !important;
      border: 1px solid #FDE047 !important;
      border-left: 1px solid #FDE047 !important;
      box-shadow: 3px 4px 0px rgba(161, 98, 7, 0.13) !important;
      transform: rotate(-0.5deg);
      transition: transform .18s ease, box-shadow .18s ease;
    }
    .memo-item.sticky-note::before, .memo-item.sticky-note::after { display: none !important; }
    .memo-item.sticky-note:nth-child(even) { transform: rotate(0.7deg); }
    .memo-item.sticky-note:hover {
      transform: rotate(0deg) translateY(-2px);
      box-shadow: 4px 6px 0px rgba(161, 98, 7, 0.18) !important;
    }
    .memo-item.sticky-note.done {
      background: #F5F5F4 !important;
      border-color: #E7E5E4 !important;
      box-shadow: 1px 2px 0px rgba(0,0,0,.05) !important;
      opacity: .85;
      transform: rotate(0deg);
    }

    /* 彈窗紙張卷宗感 */
    .modal {
      background: #FFFEFA !important;
      border: 2px solid #A8A29E !important;
      box-shadow: 6px 8px 0px rgba(28, 25, 23, 0.18) !important;
    }
    .modal-backdrop { background: rgba(28, 25, 23, 0.45) !important; backdrop-filter: blur(2px); }

    /* 手札風格滾動條 */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: #F1EEE7; }
    ::-webkit-scrollbar-thumb { background: #C7C2B6; border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: #A8A295; }

    /* 筆電較矮視窗在一屏適配下的微調 */
    @media (min-width: 960px) and (max-height: 820px) {
      body.dash-lock .brand-title-row { font-size: 15.5px; }
      body.dash-lock .brand-sub-row { font-size: 12px; }
      body.dash-lock .radar-mini-grid { gap: 5px; margin-bottom: 5px; }
      body.dash-lock .radar-stat-box { padding: 3px 6px; }
      body.dash-lock .radar-stat-box .num { font-size: 15px; }
      body.dash-lock .rtn-step-chip { padding: 2px 6px; font-size: 12px; }
    }

    /* 列印 PDF 時還原純白正式公文格式 */
    @media print {
      body { background: #FFFFFF !important; background-image: none !important; }
      .stamp { transform: none !important; }
      .paper-card, .panel { box-shadow: none !important; }
    }
  `;
  document.head.appendChild(st);
})();

// ----------------------------------------------------------------------------
// 1. 狀態變數：中欄近期固定例行業務篩選 (all | red | amber | done)
// ----------------------------------------------------------------------------
let paperRoutineFilter = 'all';

const PAPERCLIP_SVG = `<svg class="paperclip-deco" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>`;
const DOC_ICON_SVG = `<svg style="width:26px;height:26px;color:#C84B31;flex-shrink:0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`;

// ----------------------------------------------------------------------------
// 2. 升級頂部手札標題、朱紅「總務」官印、民國曆與快捷按鈕
// ----------------------------------------------------------------------------
function enhancePaperTopbar() {
  const brand = document.querySelector('.topbar .brand');
  if (brand && !brand.dataset.paperStyled) {
    brand.dataset.paperStyled = '1';
    const schoolName = (typeof appData !== 'undefined' && appData.schoolName) || (typeof appConfig !== 'undefined' && appConfig.schoolName) || '高雄市立溪埔國民中學';
    brand.innerHTML = `
      ${DOC_ICON_SVG}
      <div class="brand-title-wrap">
        <div class="brand-title-row">
          <span id="school-title">${esc(schoolName)}</span>
          <span>總務行政助理</span>
          <span class="stamp stamp-red">總務</span>
        </div>
        <div class="brand-sub-row">
          <span>總務行政戰情室</span>
          <span>•</span>
          <small id="today-roc" class="num-mono"></small>
        </div>
      </div>
    `;
  }

  // 更新完整民國曆與西元對照
  const rocEl = document.getElementById('today-roc');
  if (rocEl) {
    const now = new Date();
    const wk = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
    const y = now.getFullYear(), m = String(now.getMonth() + 1).padStart(2, '0'), d = String(now.getDate()).padStart(2, '0');
    rocEl.textContent = `中華民國${y - 1911}年${m}月${d}日 (${wk}) ｜ ${y}-${m}-${d}`;
  }

  // 頂部補上「＋ 新增例行」快捷鍵
  const actions = document.querySelector('.topbar .top-actions');
  if (actions && !document.getElementById('btn-quick-new-routine')) {
    const addPrjBtn = Array.from(actions.querySelectorAll('button')).find(b => (b.getAttribute('onclick') || '').includes('openProjectWizard'));
    if (addPrjBtn) {
      addPrjBtn.innerHTML = '<span style="color:#C84B31;font-weight:800">＋</span> 新增採購';
      const rtnBtn = document.createElement('button');
      rtnBtn.id = 'btn-quick-new-routine';
      rtnBtn.type = 'button';
      rtnBtn.innerHTML = '<span style="color:#1D4ED8;font-weight:800">＋</span> 新增例行';
      rtnBtn.onclick = () => openRoutineModal();
      addPrjBtn.insertAdjacentElement('afterend', rtnBtn);
    }
  }

  // 同步狀態藥丸依燈號套用手札色彩
  const syncPill = document.getElementById('sync-status');
  const syncDot = document.getElementById('sync-dot');
  if (syncPill && syncDot) {
    syncPill.classList.toggle('is-synced', syncDot.classList.contains('ok'));
    syncPill.classList.toggle('is-err', syncDot.classList.contains('err'));
  }
}

// ----------------------------------------------------------------------------
// 3. 更新資料夾分頁計數徽章
// ----------------------------------------------------------------------------
function updatePaperTabBadges() {
  const alerts = typeof buildAllAlerts === 'function' ? buildAllAlerts() : [];
  const prjCnt = (appData.tables?.Projects || []).filter(p => !['已結案', '廢標撤案'].includes(p.status)).length;
  const rtnCnt = (appData.tables?.Annual_Routines || []).filter(r => r.is_active !== false).length;

  const setBadge = (tabKey, count, isRed) => {
    const btn = document.querySelector(`#nav-tabs [data-tab="${tabKey}"]`);
    if (!btn) return;
    let b = btn.querySelector('.tab-cnt-badge');
    if (count <= 0) {
      if (b) b.remove();
      return;
    }
    if (!b) {
      b = document.createElement('span');
      b.className = 'tab-cnt-badge' + (isRed ? ' red' : '');
      btn.appendChild(b);
    } else {
      b.className = 'tab-cnt-badge' + (isRed ? ' red' : '');
    }
    b.textContent = String(count);
  };

  setBadge('dashboard', alerts.length, true);
  setBadge('projects', prjCnt, false);
  setBadge('routines', rtnCnt, false);
}

// ----------------------------------------------------------------------------
// 4. 戰情室手札化精雕：左欄雷達雙格計數 ＋ 中欄篩選與直接勾步驟 ＋ 右欄黃色便利貼
// ----------------------------------------------------------------------------
function setPaperRoutineFilter(mode) {
  paperRoutineFilter = mode;
  renderCurrentView();
}

async function toggleRoutineStepInline(routineId, stepIdx, checked) {
  const r = (appData.tables.Annual_Routines || []).find(x => x.routine_id === routineId);
  if (!r || typeof parseRoutineNote !== 'function' || typeof serializeRoutineNote !== 'function') return;
  const parsed = parseRoutineNote(r.note);
  if (!parsed.steps[stepIdx]) return;
  parsed.steps[stepIdx].done = checked;
  r.note = serializeRoutineNote(parsed);
  r.updated_at = nowStr();
  renderCurrentView();
  await pushToCloud({ action: 'upsert', table: 'Annual_Routines', record: r });
}

function enhancePaperWarRoom() {
  if (typeof currentTab === 'undefined' || currentTab !== 'dashboard') return;
  const dashGrid = document.querySelector('#main-view .dash-grid');
  if (!dashGrid) return;

  const q = (document.getElementById('global-search')?.value || '').trim().toLowerCase();

  // (A) 左上：紅黃燈預警雷達手札化（朱紅左飾條、脈動紅點、雙格紅橘計數、公文印章）
  const leftPanels = dashGrid.querySelectorAll(':scope > div:first-child > .panel');
  if (leftPanels[0]) {
    leftPanels[0].classList.add('radar-panel-paper');
    const hdH3 = leftPanels[0].querySelector('.panel-hd h3');
    if (hdH3) hdH3.innerHTML = '<span class="radar-pulse-dot"></span> 紅黃燈預警雷達';

    const alerts = Array.isArray(window._dashAlerts) ? window._dashAlerts : [];
    const redCnt = alerts.filter(a => a.level === 'red').length;
    const amberCnt = alerts.filter(a => a.level === 'amber').length;
    const bd = leftPanels[0].querySelector('.panel-bd');
    if (bd && !bd.querySelector('.radar-mini-grid')) {
      const mini = document.createElement('div');
      mini.className = 'radar-mini-grid';
      mini.innerHTML = `
        <div class="radar-stat-box red"><div style="font-size:12px">逾期／極緊急</div><div class="num num-mono">${redCnt}</div></div>
        <div class="radar-stat-box amber"><div style="font-size:12px">逼近時限預警</div><div class="num num-mono">${amberCnt}</div></div>
      `;
      bd.insertBefore(mini, bd.firstChild);
    }
    leftPanels[0].querySelectorAll('.alert-item .tag-red').forEach(t => { t.className = 'stamp stamp-red'; });
    leftPanels[0].querySelectorAll('.alert-item .tag-amber').forEach(t => { t.className = 'stamp stamp-amber'; });
  }

  // (A2) 左下：進行中標案手札化（狀態改為公文印章）
  if (leftPanels[1]) {
    leftPanels[1].querySelectorAll('.alert-item').forEach(el => {
      const tags = el.querySelectorAll('.tag');
      if (tags.length >= 2) {
        const stTag = tags[1];
        const txt = (stTag.textContent || '').trim();
        if (txt === '已結案') stTag.className = 'stamp stamp-green';
        else if (txt === '驗收中' || txt === '保固追蹤中') stTag.className = 'stamp stamp-amber';
        else stTag.className = 'stamp stamp-blue';
      }
    });
  }

  // (B) 中欄：近期固定例行業務（加入篩選 Pill ＋ 迴紋針 ＋ 印章 ＋ 前 3 步驟直接勾選）
  const midPanel = dashGrid.querySelector(':scope > .panel:nth-child(2)');
  if (midPanel) {
    const midHd = midPanel.querySelector('.panel-hd');
    if (midHd) {
      midHd.innerHTML = `
        <h3>📅 近期固定例行業務</h3>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <div class="rtn-filter-pills" role="group" aria-label="例行業務狀態篩選">
            ${[['all','全部'],['red','🔴 逾期'],['amber','🟠 逼近'],['done','🟢 已辦']].map(([k, lbl]) =>
              `<button type="button" class="rtn-filter-pill ${paperRoutineFilter === k ? 'active' : ''}" onclick="setPaperRoutineFilter('${k}')">${lbl}</button>`
            ).join('')}
          </div>
          <button type="button" class="btn-xs" style="min-height:30px;padding:2px 8px" onclick="switchTab('routines')">管理全部</button>
        </div>
      `;
    }

    const midBd = midPanel.querySelector('.panel-bd');
    if (midBd) {
      const allActive = (appData.tables.Annual_Routines || [])
        .filter(r => r.is_active !== false)
        .filter(r => !q || String(r.title + r.category + r.note).toLowerCase().includes(q));

      let list = [];
      if (paperRoutineFilter === 'done') {
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
          .filter(x => x.sch.isVisible)
          .filter(x => paperRoutineFilter === 'all' || x.vis.tone === paperRoutineFilter)
          .sort((a, b) => a.sch.diffDays - b.sch.diffDays);
      }

      if (!list.length) {
        midBd.innerHTML = `<div class="empty-state">${paperRoutineFilter === 'all' ? '🎉 近期待辦的固定例行業務皆已完成！' : '此狀態分類下目前沒有項目。'}<br><button type="button" class="btn-sm" style="margin-top:8px" onclick="${paperRoutineFilter === 'all' ? "switchTab('routines')" : "setPaperRoutineFilter('all')"}">${paperRoutineFilter === 'all' ? '檢視全年度例行清單' : '顯示全部近期待辦'}</button></div>`;
      } else {
        midBd.innerHTML = list.map(item => {
          const r = item, sch = item.sch, vis = item.vis;
          const isDoneView = paperRoutineFilter === 'done';
          const tone = isDoneView ? 'green' : vis.tone;
          const pct = isDoneView ? 100 : vis.pct;
          const d = sch.diffDays;
          const dTxt = isDoneView ? `上次辦結 ${r.last_done_date || r.last_done_cycle}` : (d < 0 ? `逾期 ${Math.abs(d)} 天` : d === 0 ? '今天到期' : `剩 ${d} 天`);
          const stampMap = {
            red: ['stamp-red', '逾期'],
            amber: ['stamp-amber', '速辦'],
            blue: ['stamp-blue', '辦理中'],
            green: ['stamp-green', (isDoneView || pct >= 100) ? '已辦' : '充裕']
          };
          const [stCls, stTxt] = stampMap[tone] || ['stamp-blue', '辦理中'];
          const rocDue = typeof toRocDate === 'function' ? toRocDate(sch.dueDate) : sch.dueDate;
          const canQuickBuy = ['一般小額採購', '共同供應契約'].includes(r.category);
          const steps = (vis.parsed && vis.parsed.steps) ? vis.parsed.steps : [];
          const inlineStepsHtml = steps.length ? `
            <div class="rtn-inline-steps" onclick="event.stopPropagation()">
              ${steps.slice(0, 3).map((s, idx) => `
                <label class="rtn-step-chip ${s.done ? 'done' : ''}">
                  <input type="checkbox" ${s.done ? 'checked' : ''} onchange="toggleRoutineStepInline('${esc(r.routine_id)}', ${idx}, this.checked)">
                  <span>${esc(s.text)}</span>
                </label>
              `).join('')}
              ${steps.length > 3 ? `<span class="rtn-step-chip" onclick="openRoutineDetailModal('${esc(r.routine_id)}')">…尚有 ${steps.length - 3} 項</span>` : ''}
            </div>
          ` : '';

          return `
            <div class="routine-item card-prog-bg tone-${tone} ${(pct <= 0 || pct >= 100) ? 'prog-edge-none' : ''} routine-card-clickable"
                 style="--prog-pct:${pct}%"
                 role="button" tabindex="0"
                 onclick="openRoutineDetailModal('${esc(r.routine_id)}')">
              ${PAPERCLIP_SVG}
              <div class="item-row" style="padding-right:16px">
                <div style="flex:1;min-width:0">
                  <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                    <strong style="font-size:14.5px;color:#1C1917">${esc(r.title)}</strong>
                    <span class="stamp ${stCls}">${stTxt}</span>
                  </div>
                  <div class="item-meta num-mono" style="margin-top:3px">
                    ${esc(r.category)} • 期別 ${esc(sch.cycle)} • ${esc(rocDue)}（<strong style="color:${tone==='red'?'#B91C1C':'#1C1917'}">${esc(dTxt)}</strong>）
                  </div>
                </div>
                <div style="display:flex;align-items:center;gap:5px;flex-shrink:0">
                  ${vis.fileCount > 0 ? `<span class="tag tag-amber">📎 ${vis.fileCount}</span>` : ''}
                  <span class="prog-pill num-mono">${pct}%</span>
                </div>
              </div>
              ${vis.parsed?.plainNote ? `<div class="item-meta">💡 ${esc(vis.parsed.plainNote.split('\n')[0])}</div>` : ''}
              ${inlineStepsHtml}
              <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;align-items:center;padding-top:6px;border-top:1px dashed rgba(28,25,23,.12)">
                <button type="button" class="btn-xs btn-success" onclick="event.stopPropagation();markRoutineDone('${esc(r.routine_id)}','${esc(sch.cycle)}')">✓ 本期辦結</button>
                <button type="button" class="btn-xs" onclick="event.stopPropagation();openRoutineDetailModal('${esc(r.routine_id)}')">📂 詳情與檔案</button>
                ${r.portal_url ? `<a class="btn-xs" style="border:1px solid #DFDBD2;border-radius:6px;background:rgba(255,254,250,.92);color:#1D4ED8" href="${esc(r.portal_url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">🌐 網站</a>` : ''}
                ${r.linked_template_id ? `<button type="button" class="btn-xs btn-primary" onclick="event.stopPropagation();openProjectWizard('${esc(r.linked_template_id)}','${esc(r.title)}')">📋 套模板</button>` : ''}
                ${(!r.linked_template_id && canQuickBuy && typeof openRoutineQuickPurchase === 'function') ? `<button type="button" class="btn-xs btn-primary" onclick="event.stopPropagation();openRoutineQuickPurchase('${esc(r.routine_id)}')">🛒 開單</button>` : ''}
              </div>
            </div>
          `;
        }).join('');
      }
    }
  }

  // (C) 右欄：臨時交辦 Memo 牆 → 轉為手札黃色便利貼 (.sticky-note) ＋ 印章
  const rightPanel = dashGrid.querySelector(':scope > .panel:last-child');
  if (rightPanel) {
    rightPanel.classList.add('memo-wall-panel');
    rightPanel.querySelectorAll('.memo-item').forEach(el => {
      el.classList.add('sticky-note');
      el.classList.remove('card-prog-bg', 'tone-red', 'tone-amber', 'tone-blue', 'tone-green');
      const tag = el.querySelector('.tag');
      if (tag) {
        if (tag.classList.contains('tag-red')) tag.className = 'stamp stamp-red';
        else if (tag.classList.contains('tag-amber')) tag.className = 'stamp stamp-amber';
        else tag.className = 'stamp stamp-blue';
      }
      if (el.classList.contains('done') && !el.querySelector('.stamp-green')) {
        const doneStamp = document.createElement('div');
        doneStamp.style.cssText = 'text-align:right;margin-top:4px';
        doneStamp.innerHTML = '<span class="stamp stamp-green">已辦</span>';
        el.appendChild(doneStamp);
      }
    });
  }
}

// ----------------------------------------------------------------------------
// 5. 掛載生命週期、同步狀態聯動與模組登記
// ----------------------------------------------------------------------------
if (window.GA_REGISTRY && typeof window.GA_REGISTRY.registerModule === 'function') {
  window.GA_REGISTRY.registerModule('theme-paper-journal.js', 'v1.0', '文青公文手札紙質主視覺與 4:5:3 戰情佈局');
}

const _prevSetSyncUI_paper = setSyncUI;
setSyncUI = function(state, text) {
  _prevSetSyncUI_paper(state, text);
  const pill = document.getElementById('sync-status');
  if (pill) {
    pill.classList.toggle('is-synced', state === 'ok');
    pill.classList.toggle('is-err', state === 'err');
  }
};

const _prevRenderHeader_paper = renderHeaderAndPortals;
renderHeaderAndPortals = function() {
  _prevRenderHeader_paper();
  enhancePaperTopbar();
};

const _prevRenderView_paper = renderCurrentView;
renderCurrentView = function() {
  _prevRenderView_paper();
  enhancePaperTopbar();
  updatePaperTabBadges();
  enhancePaperWarRoom();
};

enhancePaperTopbar();
updatePaperTabBadges();
enhancePaperWarRoom();
